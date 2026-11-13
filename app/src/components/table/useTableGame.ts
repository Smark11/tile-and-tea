import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { track } from '@/analytics';
import { gameReducer, newGame, type GameAction, type GameState, type Seat } from '@/game/engine';
import { arrangeRack, autoAction, outcomeFor } from '@/game/table';
import type { Tile } from '@/game/tiles';

/** Who the human plays against until the real bots arrive (M4.2). */
export const OPPONENTS = 'stand_in';

/** How long the table pauses before each automatic move, so play reads like people taking turns. */
const PACE_MS: Record<GameAction['type'], number> = {
  charlestonPass: 450,
  charlestonVote: 300,
  courtesyOffer: 300,
  courtesyPass: 450,
  draw: 550,
  discard: 950,
  jokerSwap: 600,
  declareMahJongg: 700,
  call: 500,
  pass: 250,
  closeCalls: 0,
};

export type TableGameOptions = {
  seed: number;
  you: Seat;
  /** Start from this state instead of a fresh deal (the styleguide's mid-game table). */
  initial?: GameState;
  /** Multiplies every pause; 0 plays automatic moves at once. */
  pace?: number;
  /** Let the stand-ins play. Off for a frozen table, e.g. the styleguide. */
  autoplay?: boolean;
};

/**
 * One game at the table: the engine state, the stand-ins' moves on a gentle
 * clock, and the player's own rack order and selection.
 */
export function useTableGame({ seed, you, initial, pace = 1, autoplay = true }: TableGameOptions) {
  const [state, dispatch] = useReducer(gameReducer, initial ?? seed, (start) =>
    typeof start === 'number' ? newGame(start) : start,
  );
  const [selected, setSelected] = useState<readonly number[]>([]);

  // The player's own arrangement of the rack. Each time the engine's rack
  // changes, arrivals join on the right and are marked fresh (so they drop in)
  // until the next change. A fresh deal arrives whole; a styleguide table doesn't.
  const rack = state.players[you].rack;
  const [arranged, setArranged] = useState(() => {
    const { tiles, fresh } = arrangeRack([], rack);
    return { rack, order: tiles.map((t) => t.id), fresh: initial ? [] : fresh };
  });
  if (arranged.rack !== rack) {
    const { tiles, fresh } = arrangeRack(arranged.order, rack);
    setArranged({ rack, order: tiles.map((t) => t.id), fresh });
  }
  const { order, fresh } = arranged;
  const tiles = useMemo(() => arrangeRack(order, rack).tiles, [order, rack]);
  const freshIds = useMemo(() => new Set(fresh), [fresh]);

  // A selection only means something for the move it was made for.
  const phaseKey = `${state.phase.type}-${'pass' in state.phase ? state.phase.pass : ''}-${rack.length}`;
  const [selectionKey, setSelectionKey] = useState(phaseKey);
  if (selectionKey !== phaseKey) {
    setSelectionKey(phaseKey);
    setSelected([]);
  }

  const next = useMemo(() => (autoplay ? autoAction(state, you) : null), [autoplay, state, you]);
  useEffect(() => {
    if (!next) return;
    const timer = setTimeout(() => dispatch(next), PACE_MS[next.type] * pace);
    return () => clearTimeout(timer);
  }, [next, pace]);

  // Analytics: one start and one finish per game (a leave mid-game reports 'abandoned').
  const started = useRef(false);
  const finished = useRef(false);
  useEffect(() => {
    if (started.current || !autoplay) return;
    started.current = true;
    track('game_started', { opponents: OPPONENTS });
  }, [autoplay]);
  useEffect(() => {
    if (state.phase.type !== 'ended' || finished.current || !autoplay) return;
    finished.current = true;
    track('game_finished', { opponents: OPPONENTS, result: outcomeFor(state.phase.result, you) });
  }, [state.phase, you, autoplay]);
  const abandon = useCallback(() => {
    if (finished.current || !started.current) return;
    finished.current = true;
    track('game_finished', { opponents: OPPONENTS, result: 'abandoned' });
  }, []);

  const reorder = useCallback(
    (next: Tile[]) => setArranged((a) => ({ ...a, order: next.map((t) => t.id), fresh: [] })),
    [],
  );
  const toggle = useCallback((tile: Tile, limit: number) => {
    setSelected((current) => {
      if (current.includes(tile.id)) return current.filter((id) => id !== tile.id);
      // Past the limit, the oldest pick gives way, so a single-pick move just switches tiles.
      return [...current, tile.id].slice(-limit);
    });
  }, []);
  const act = useCallback((action: GameAction) => {
    setSelected([]);
    dispatch(action);
  }, []);

  return { state, tiles, freshIds, selected, toggle, reorder, act, abandon };
}
