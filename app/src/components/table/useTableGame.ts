import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { track } from '@/analytics';
import type { CallClaim } from '@/analytics/events';
import { awaiting, gameReducer, newGame, type Claim, type GameAction, type GameState, type Seat } from '@/game/engine';
import { DEFAULT_LEVEL, type BotLevel } from '@/game/bots';
import {
  arrangeRack,
  autoAction,
  canCall,
  EXPOSURE_NAMES,
  lostCallNote,
  outcomeFor,
  SEAT_NAMES,
  type RestoredGame,
} from '@/game/table';
import type { Tile } from '@/game/tiles';

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

/** The call window counting down on the discard on offer. */
export type CallTimer = {
  /** Changes with each discard, so the countdown starts over. */
  key: string;
  ms: number;
  /** False on a frozen demo table: the bar shows but doesn't drain. */
  running: boolean;
  /** The player paused it for this tile: nothing is let go until they choose. */
  paused: boolean;
};

/** The note a resumed game opens with. */
export const RESUMED_NOTE = 'Welcome back. Nothing has moved.';

/** What a save needs from the table after each change. */
export type TableProgress = {
  /** Every move since the deal. */
  actions: readonly GameAction[];
  /** The player's rack arrangement, as tile ids. */
  order: readonly number[];
  ended: boolean;
};

/** The engine state, plus every move that led to it (what a save keeps). */
type Table = { game: GameState; log: readonly GameAction[] };

/** `gameReducer`, keeping each move the engine accepts. */
function tableReducer(table: Table, action: GameAction): Table {
  const game = gameReducer(table.game, action);
  return game === table.game ? table : { game, log: [...table.log, action] };
}

export type TableGameOptions = {
  seed: number;
  you: Seat;
  /** Start from this state instead of a fresh deal (the styleguide's mid-game table). */
  initial?: GameState;
  /** Multiplies every pause; 0 plays automatic moves at once. */
  pace?: number;
  /** Let the bots play. Off for a frozen table, e.g. the styleguide. */
  autoplay?: boolean;
  /** How well the three computer players play. */
  level?: BotLevel;
  /** How long the player has to call a discard before it's let go; null waits as long as they like. */
  callWindowMs?: number | null;
  /** Sit back down to a saved game instead of dealing (`seed` and `initial` are then ignored). */
  resume?: RestoredGame;
  /** Called after every move and rack rearrangement, so the game can be saved. */
  onProgress?: (progress: TableProgress) => void;
};

/**
 * One game at the table: the engine state, the bots’ moves on a gentle
 * clock, and the player’s own rack order and selection.
 */
export function useTableGame({
  seed,
  you,
  initial,
  pace = 1,
  autoplay = true,
  level = DEFAULT_LEVEL,
  callWindowMs = null,
  resume,
  onProgress,
}: TableGameOptions) {
  const [{ game: state, log }, dispatch] = useReducer(tableReducer, null, () => ({
    game: resume?.state ?? initial ?? newGame(seed),
    log: resume?.saved.actions ?? [],
  }));
  const [selected, setSelected] = useState<readonly number[]>([]);

  // The player's own arrangement of the rack. Each time the engine's rack
  // changes, arrivals join on the right and are marked fresh (so they drop in)
  // until the next change. A fresh deal arrives whole; a styleguide table doesn't.
  const rack = state.players[you].rack;
  // A resumed game keeps the player's arrangement, and nothing drops in.
  const [arranged, setArranged] = useState(() => {
    const { tiles, fresh } = arrangeRack(resume?.saved.order ?? [], rack);
    return { rack, order: tiles.map((t) => t.id), fresh: initial || resume ? [] : fresh };
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

  const next = useMemo(() => (autoplay ? autoAction(state, you, level) : null), [autoplay, state, you, level]);
  useEffect(() => {
    if (!next) return;
    const timer = setTimeout(() => dispatch(next), PACE_MS[next.type] * pace);
    return () => clearTimeout(timer);
  }, [next, pace]);

  // Saving: after every move the engine accepts, and every rearrangement.
  const progress = useRef(onProgress);
  useEffect(() => {
    progress.current = onProgress;
  }, [onProgress]);
  const ended = state.phase.type === 'ended';
  useEffect(() => {
    progress.current?.({ actions: log, order, ended });
  }, [log, order, ended]);

  // Analytics: one start (or resume) and one finish per sitting. Leaving
  // mid-game isn't a finish, since the game is saved; replacing a saved
  // game with a new deal reports it 'abandoned' (GameScreen does that).
  const started = useRef(false);
  const finished = useRef(false);
  const resumed = resume !== undefined;
  useEffect(() => {
    if (started.current || !autoplay) return;
    started.current = true;
    if (resumed) track('game_resumed', { opponents: level });
    else track('game_started', { opponents: level });
  }, [autoplay, level, resumed]);
  useEffect(() => {
    if (state.phase.type !== 'ended' || finished.current || !autoplay) return;
    finished.current = true;
    track('game_finished', { opponents: level, result: outcomeFor(state.phase.result, you) });
  }, [state.phase, you, autoplay, level]);

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
  // The call window: while the table waits on the player to call or let a
  // discard go, a timer lets it go for them (unless the window is off, or
  // they paused it). One window per discard.
  // A frozen demo table shows the timer standing still, so screenshots can see it.
  const waitingOnCall = useMemo(
    () => state.phase.type === 'calls' && awaiting(state).includes(you) && canCall(state, you),
    [state, you],
  );
  // Keyed on the discard itself: a called tile never reaches the discard pile
  // and draws nothing from the wall, so counts alone could repeat.
  const callKey = waitingOnCall && state.phase.type === 'calls' ? String(state.phase.tile.id) : null;
  const [held, setHeld] = useState<string | null>(null);
  const timed = callKey !== null && callWindowMs !== null && held !== callKey;
  useEffect(() => {
    if (!timed || !autoplay || callWindowMs === null) return;
    const timer = setTimeout(() => dispatch({ type: 'pass', seat: you }), callWindowMs);
    return () => clearTimeout(timer);
  }, [timed, autoplay, callKey, callWindowMs, you]);
  const hold = useCallback(() => setHeld(callKey), [callKey]);
  // A paused window stays on show (saying so), so the player can see the pause took.
  const callTimer: CallTimer | null =
    callKey !== null && callWindowMs !== null
      ? { key: callKey, ms: callWindowMs, running: autoplay && timed, paused: !timed }
      : null;

  // How the player's own calls turned out: analytics, and a word when another claim took the tile.
  // The player's claim is remembered from the moment they call, since the
  // same action can also settle the calls (when everyone else has answered).
  // A resumed game opens with a word that nothing was lost, until the player's first move.
  const [note, setNote] = useState<string | null>(resume ? RESUMED_NOTE : null);
  const pending = useRef<{ claim: Claim; at: GameState } | null>(null);
  useEffect(() => {
    const call = pending.current;
    if (!call || state.phase.type === 'calls') return;
    pending.current = null;
    const { claim, at } = call;
    const won =
      state.players[you].exposures.length > at.players[you].exposures.length ||
      (state.phase.type === 'ended' && state.phase.result.type === 'mahJongg' && state.phase.result.winner === you);
    if (autoplay) {
      const kind: CallClaim =
        claim.type === 'mahJongg' ? 'mah_jongg' : (EXPOSURE_NAMES[claim.tiles.length + 1] as CallClaim);
      track('tile_called', { claim: kind, won });
    }
    setNote(lostCallNote(at, claim, state, you, (s) => SEAT_NAMES[s]));
  }, [state, you, autoplay]);

  // The latest state, read by `act` so its identity stays put between engine steps.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const act = useCallback(
    (action: GameAction) => {
      setSelected([]);
      setNote(null);
      if (action.type === 'call') pending.current = { claim: action.claim, at: stateRef.current };
      if (action.type === 'jokerSwap' && autoplay) track('joker_swapped', { own: action.owner === action.seat });
      dispatch(action);
    },
    [autoplay],
  );

  return { state, tiles, freshIds, selected, toggle, reorder, act, callTimer, hold, note };
}
