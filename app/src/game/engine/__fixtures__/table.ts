// Builders for engine tests: set up a table with exactly the tiles a rule needs.

import { createTileSet, sameKind, type Tile, type TileKind } from '../../tiles';
import { step } from '../game';
import type { GameAction, GameState, Phase, Seat } from '../types';

export const JOKER: TileKind = { type: 'joker' };
export const FLOWER: TileKind = { type: 'flower' };
export const bam = (rank: number): TileKind => ({ type: 'suited', suit: 'bam', rank: rank as 1 });
export const crak = (rank: number): TileKind => ({ type: 'suited', suit: 'crak', rank: rank as 1 });
export const dot = (rank: number): TileKind => ({ type: 'suited', suit: 'dot', rank: rank as 1 });
export const N: TileKind = { type: 'wind', wind: 'N' };
export const E: TileKind = { type: 'wind', wind: 'E' };
export const W: TileKind = { type: 'wind', wind: 'W' };
export const S: TileKind = { type: 'wind', wind: 'S' };
export const RED: TileKind = { type: 'dragon', dragon: 'red' };
export const SOAP: TileKind = { type: 'dragon', dragon: 'white' };
export const of = (n: number, kind: TileKind): TileKind[] => Array<TileKind>(n).fill(kind);

/** Honors-1 on the practice card: NNN EEEE WWWW SSS. */
export const HONORS_1: TileKind[] = [...of(3, N), ...of(4, E), ...of(4, W), ...of(3, S)];

export type TableSpec = {
  /**
   * The tiles that matter on each seat's rack. Every rack is padded with plain
   * suited filler to 13 tiles, or 14 for the seat about to discard, counting
   * exposures.
   */
  readonly racks?: Partial<Record<Seat, TileKind[]>>;
  readonly exposures?: readonly { seat: Seat; kinds: TileKind[]; calledFrom: Seat }[];
  /** The next tiles off the wall, first drawn first. */
  readonly wallTop?: TileKind[];
  /** Total wall size. Defaults to every tile not placed elsewhere. */
  readonly wallSize?: number;
  readonly phase: Phase;
};

/**
 * A mid-game table built from real tiles of one set. Filler racks use plain
 * Bams, Craks and Dots so they never complete a hand by accident.
 */
export function table(spec: TableSpec): GameState {
  const pool = createTileSet();
  const used = new Set<number>();
  const take = (kind: TileKind): Tile => {
    const tile = pool.find((t) => !used.has(t.id) && sameKind(t.kind, kind));
    if (!tile) throw new Error(`no ${JSON.stringify(kind)} left`);
    used.add(tile.id);
    return tile;
  };
  const exposures = (spec.exposures ?? []).map((e) => ({ ...e, tiles: e.kinds.map(take) }));
  const explicit = ([0, 1, 2, 3] as Seat[]).map((seat) => (spec.racks?.[seat] ?? []).map(take));
  const wallTop = (spec.wallTop ?? []).map(take);
  const filler = pool.filter((t) => !used.has(t.id) && t.kind.type === 'suited');
  const { phase } = spec;
  const holdsFourteen = (seat: Seat) =>
    phase.type === 'turn' && phase.seat === seat && phase.step === 'discard';
  const players = ([0, 1, 2, 3] as Seat[]).map((seat) => {
    const exposed = exposures.filter((e) => e.seat === seat);
    const size = (holdsFourteen(seat) ? 14 : 13) - exposed.reduce((n, e) => n + e.tiles.length, 0);
    if (explicit[seat].length > size) throw new Error(`seat ${seat} given ${explicit[seat].length} tiles, holds ${size}`);
    const padding = filler.splice(0, size - explicit[seat].length);
    padding.forEach((t) => used.add(t.id));
    const rack = [...explicit[seat], ...padding];
    return {
      seat,
      rack,
      exposures: exposed.map((e) => ({ tiles: e.tiles, kind: e.kinds.find((k) => k.type !== 'joker')!, calledFrom: e.calledFrom })),
      dead: null,
    };
  });
  const rest = pool.filter((t) => !used.has(t.id));
  const wall = [...wallTop, ...rest].slice(0, spec.wallSize ?? wallTop.length + rest.length);
  return { seed: 'table', wall, players, discards: [], phase: spec.phase };
}

export const turn = (seat: Seat, stepName: 'draw' | 'discard', source: 'deal' | 'wall' | 'call' = 'wall'): Phase => ({
  type: 'turn',
  seat,
  step: stepName,
  source,
  calledFrom: null,
});

/** The id of the first tile of `kind` on a seat's rack. */
export function idOf(state: GameState, seat: Seat, kind: TileKind): number {
  const tile = state.players[seat].rack.find((t) => sameKind(t.kind, kind));
  if (!tile) throw new Error(`seat ${seat} has no ${JSON.stringify(kind)}`);
  return tile.id;
}

/** Ids of the first `n` tiles of `kind` on a seat's rack. */
export function idsOf(state: GameState, seat: Seat, kind: TileKind, n: number): number[] {
  const ids = state.players[seat].rack.filter((t) => sameKind(t.kind, kind)).map((t) => t.id);
  if (ids.length < n) throw new Error(`seat ${seat} has ${ids.length} of ${JSON.stringify(kind)}, wanted ${n}`);
  return ids.slice(0, n);
}

/** Applies actions in order, failing the test on the first illegal one. */
export function play(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((s, action) => {
    const result = step(s, action);
    if (!result.ok) throw new Error(`${JSON.stringify(action)} refused: ${result.error}`);
    return result.state;
  }, state);
}

/** The error an action is refused with (fails if it's accepted). */
export function refusal(state: GameState, action: GameAction): string {
  const result = step(state, action);
  if (result.ok) throw new Error(`${JSON.stringify(action)} was accepted`);
  return result.error;
}

export const kinds = (tiles: readonly Tile[]) => tiles.map((t) => t.kind);
