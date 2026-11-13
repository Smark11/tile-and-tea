// Computer opponents in three levels, built on the same advisors the drills
// coach with. Every bot plays only legal moves and decides only from what a
// player in its seat can see: its own rack and exposures, the discards, and
// everyone's exposures. It never looks at other racks or the wall order
// (bots.test.ts proves this by scrambling them).
//
// - Beginner: plays toward its closest card hand, but loosely. It often lets
//   go of a tile that sets the hand back by one, ignores dead tiles and the
//   other players, sometimes calls an exposure that doesn't help, and never
//   notices a Joker it could swap for.
// - Club: the advisor with a little noise. It counts dead tiles (copies in the
//   discards and exposures can't be drawn), keeps backup hands alive, calls
//   only exposures that help, and swaps for Jokers. Now and then it misses the
//   backup or lets a hand slip by a tile.
// - Shark: the full advisor plus defense. It never slips, reads the exposures
//   of anyone with two or more groups (`readExposures`), and won't hand them
//   a tile they can call when an equally good, safe throw exists. Late in
//   the game, or against a player with three exposures, it gives up a tile of
//   its own progress rather than feed them, and with no hand left it just
//   throws safe.
//
// The noise is seeded from the game and the moment, so a game replays exactly
// from its seed.

import {
  cardDistances,
  CURRENT_CARD,
  readExposures,
  wantedBy,
  type ExposureRead,
  type PracticeCard,
} from '../card';
import { awaiting, step } from '../engine/game';
import {
  MAX_COURTESY,
  PASS_SIZE,
  type ExposedGroup,
  type GameAction,
  type GameState,
  type Seat,
} from '../engine/types';
import { createRng, type Rng } from '../rng';
import { copiesOf, sameKind, type Tile, type TileKind } from '../tiles';

export type BotLevel = 'beginner' | 'club' | 'shark';

export const BOT_LEVELS: readonly BotLevel[] = ['beginner', 'club', 'shark'];

/** The level the table seats when none is chosen. */
export const DEFAULT_LEVEL: BotLevel = 'club';

export function isBotLevel(value: unknown): value is BotLevel {
  return typeof value === 'string' && (BOT_LEVELS as readonly string[]).includes(value);
}

/** How a level plays. Exported for tests and the Play tab's descriptions. */
export type BotStyle = {
  /** Counts copies seen on the table as gone. */
  readonly deadTiles: boolean;
  /** Prefers moves that keep other hands within a tile of the closest. */
  readonly backups: boolean;
  /** Chance a discard or pass ignores the backup tie-break. */
  readonly careless: number;
  /** Chance a discard or pass sets the closest hand back by a tile. */
  readonly slip: number;
  /** Chance it calls an exposure that brings no hand closer. */
  readonly idleCall: number;
  /** Swaps a real tile for an exposed Joker when that doesn't cost progress. */
  readonly swapsJokers: boolean;
  /** Reads opponents' exposures and avoids feeding them. */
  readonly defends: boolean;
};

export const BOT_STYLES: Readonly<Record<BotLevel, BotStyle>> = {
  beginner: {
    deadTiles: false,
    backups: false,
    careless: 1,
    slip: 0.3,
    idleCall: 0.3,
    swapsJokers: false,
    defends: false,
  },
  club: {
    deadTiles: true,
    backups: true,
    careless: 0.25,
    slip: 0.06,
    idleCall: 0,
    swapsJokers: true,
    defends: false,
  },
  shark: {
    deadTiles: true,
    backups: true,
    careless: 0,
    slip: 0,
    idleCall: 0,
    swapsJokers: true,
    defends: true,
  },
};

/** Exposures it takes before a Shark reads a player: one group fits too much of the card. */
export const READ_FROM = 2;
/** A player this many exposures in may be one tile from Mah Jongg. */
export const NEAR_FROM = 3;
/** From here to the end of the wall, a Shark gives up a tile of progress to stay safe. */
export const LATE_WALL = 24;

const isJoker = (tile: Tile) => tile.kind.type === 'joker';

// ---- What a seat can see ------------------------------------------------------

/** Every tile visible to `seat` outside its own rack and exposures: the discards and the other players' exposures. */
export function seenBy(state: GameState, seat: Seat): TileKind[] {
  const seen = state.discards.map((d) => d.tile.kind);
  for (const p of state.players) {
    if (p.seat === seat) continue;
    for (const e of p.exposures) for (const t of e.tiles) seen.push(t.kind);
  }
  return seen;
}

/** How a holding stands: the closest hand, and how many others sit within a tile of it. */
type Standing = { readonly closest: number; readonly backups: number };

function standing(
  rack: readonly Tile[],
  exposures: readonly ExposedGroup[],
  seen: readonly TileKind[],
  card: PracticeCard,
): Standing {
  const ranked = cardDistances(
    { concealed: rack.map((t) => t.kind), exposures: exposures.map((e) => e.tiles.map((t) => t.kind)) },
    card,
    seen,
  );
  const closest = ranked[0]?.tilesAway ?? Infinity;
  if (closest === Infinity) return { closest, backups: 0 };
  const near = ranked.filter((r) => r.tilesAway !== null && r.tilesAway <= closest + 1).length;
  return { closest, backups: near - 1 };
}

/** The rng for one decision: the same game, seat and moment always get the same draws. */
function rngFor(state: GameState, seat: Seat, what: string): Rng {
  return createRng(`${String(state.seed)}|${seat}|${what}|${state.wall.length}|${state.discards.length}`);
}

const pickOne = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

// ---- Choosing what to let go -----------------------------------------------------

/** One distinct tile the bot could let go of, and where that leaves it. */
type Option = { readonly tile: Tile; readonly after: Standing; readonly danger: number };

/** Each distinct non-Joker tile on the rack, judged by what keeping the rest leaves. */
function options(
  rack: readonly Tile[],
  exposures: readonly ExposedGroup[],
  seen: readonly TileKind[],
  card: PracticeCard,
  danger: (kind: TileKind) => number = () => 0,
): Option[] {
  const out: Option[] = [];
  for (const tile of rack) {
    if (isJoker(tile) || out.some((o) => sameKind(o.tile.kind, tile.kind))) continue;
    const after = standing(
      rack.filter((t) => t.id !== tile.id),
      exposures,
      seen,
      card,
    );
    out.push({ tile, after, danger: danger(tile.kind) });
  }
  return out;
}

/** The option the style picks among those that keep the closest hand where it best can be. */
function choose(all: readonly Option[], style: BotStyle, rng: Rng, prefer: (a: Option, b: Option) => number): Option {
  const best = Math.min(...all.map((o) => o.after.closest));
  // With no hand in reach there is nothing to slip from (and Infinity + 1 would match everything).
  if (best !== Infinity && style.slip > 0 && rng() < style.slip) {
    const slipped = all.filter((o) => o.after.closest === best + 1);
    if (slipped.length > 0) return pickOne(slipped, rng);
  }
  const keepers = all.filter((o) => o.after.closest === best);
  if (!style.backups || rng() < style.careless) return pickOne(keepers, rng);
  return [...keepers].sort(prefer)[0];
}

const byBackups = (a: Option, b: Option) => b.after.backups - a.after.backups;

/** Up to `count` tiles to pass, one at a time, each the one the style can best spare. */
function tilesToPass(rack: readonly Tile[], count: number, style: BotStyle, rng: Rng, card: PracticeCard): Tile[] {
  const passed: Tile[] = [];
  let left = rack;
  while (passed.length < count) {
    const all = options(left, [], [], card);
    if (all.length === 0) break;
    const { tile } = choose(all, style, rng, byBackups);
    passed.push(tile);
    left = left.filter((t) => t.id !== tile.id);
  }
  return passed;
}

/** How many tiles the bot can spare without its closest hand slipping: its courtesy offer. */
function spareCount(rack: readonly Tile[], card: PracticeCard): number {
  const now = standing(rack, [], [], card).closest;
  let left = rack;
  let spare = 0;
  while (spare < MAX_COURTESY) {
    const all = options(left, [], [], card);
    const cheapest = [...all].sort((a, b) => a.after.closest - b.after.closest)[0];
    if (!cheapest || cheapest.after.closest > now) break;
    left = left.filter((t) => t.id !== cheapest.tile.id);
    spare++;
  }
  return spare;
}

// ---- Defense ----------------------------------------------------------------------

/** What a Shark knows about one opponent worth reading. */
type Threat = { readonly read: ExposureRead; readonly near: boolean };

/** The live opponents with enough exposures to read, from `seat`'s point of view. */
export function threatsTo(state: GameState, seat: Seat, card: PracticeCard = CURRENT_CARD): Threat[] {
  const me = state.players[seat];
  const own = [...me.rack, ...me.exposures.flatMap((e) => e.tiles)].map((t) => t.kind);
  const discards = state.discards.map((d) => d.tile.kind);
  const threats: Threat[] = [];
  for (const p of state.players) {
    if (p.seat === seat || p.dead || p.exposures.length < READ_FROM) continue;
    const others = state.players
      .filter((o) => o.seat !== seat && o.seat !== p.seat)
      .flatMap((o) => o.exposures.flatMap((e) => e.tiles.map((t) => t.kind)));
    const read = readExposures(
      p.exposures.map((e) => e.tiles.map((t) => t.kind)),
      [...own, ...discards, ...others],
      card,
    );
    threats.push({ read, near: p.exposures.length >= NEAR_FROM });
  }
  return threats;
}

/**
 * How risky a tile is to throw: for each reading, 2 if they could call it for
 * an exposure, 1 if only for Mah Jongg (a single or pair); doubled for a
 * player who may be one tile away.
 */
function dangerOf(threats: readonly Threat[]) {
  return (kind: TileKind): number => {
    let total = 0;
    for (const t of threats) {
      const want = wantedBy(t.read, kind);
      if (!want) continue;
      total += (want.use === 'group' ? 2 : 1) * (t.near ? 2 : 1);
    }
    return total;
  };
}

/** Among equally safe throws, the tile with the most copies already showing: fewer left for anyone to want. */
function visibleShare(kind: TileKind, seen: readonly TileKind[]): number {
  return seen.filter((k) => sameKind(k, kind)).length / copiesOf(kind);
}

function sharkDiscard(
  state: GameState,
  seat: Seat,
  seen: readonly TileKind[],
  card: PracticeCard,
): Tile {
  const me = state.players[seat];
  const threats = threatsTo(state, seat, card);
  const all = options(me.rack, me.exposures, seen, card, dangerOf(threats));
  const best = Math.min(...all.map((o) => o.after.closest));
  const safest = (pool: readonly Option[]) =>
    [...pool].sort(
      (a, b) =>
        a.danger - b.danger ||
        b.after.backups - a.after.backups ||
        visibleShare(b.tile.kind, seen) - visibleShare(a.tile.kind, seen),
    )[0];
  // No hand left: play pure defense.
  if (best === Infinity) return safest(all).tile;
  const keepers = all.filter((o) => o.after.closest === best);
  const pick = safest(keepers);
  // One tile from Mah Jongg, a Shark plays to win rather than break its hand.
  const defending =
    best > 1 && (threats.some((t) => t.near) || (threats.length > 0 && state.wall.length <= LATE_WALL));
  if (pick.danger > 0 && defending) {
    const safeSlip = all.filter((o) => o.after.closest === best + 1 && o.danger === 0);
    if (safeSlip.length > 0) return safest(safeSlip).tile;
  }
  return pick.tile;
}

// ---- Calls and swaps ---------------------------------------------------------------

/** The best exposure the bot could make with the discard on offer, and where it leaves the bot. */
function bestExposure(
  state: GameState,
  seat: Seat,
  seen: readonly TileKind[],
  card: PracticeCard,
): { tiles: number[]; after: Standing } | null {
  const { phase } = state;
  if (phase.type !== 'calls' || isJoker(phase.tile)) return null;
  const me = state.players[seat];
  const naturals = me.rack.filter((t) => sameKind(t.kind, phase.tile.kind));
  const jokers = me.rack.filter(isJoker);
  let best: { tiles: number[]; after: Standing; jokers: number } | null = null;
  // Pungs, kongs and quints: real copies first, then Jokers.
  for (let size = 3; size <= 5; size++) {
    const fromRack = size - 1;
    const real = naturals.slice(0, fromRack);
    if (real.length === 0) continue;
    const used = [...real, ...jokers.slice(0, fromRack - real.length)];
    if (used.length < fromRack) continue;
    const exposed: ExposedGroup = { tiles: [phase.tile, ...used], kind: phase.tile.kind, calledFrom: phase.discarder };
    const rest = me.rack.filter((t) => !used.includes(t));
    const after = standing(rest, [...me.exposures, exposed], seen, card);
    const jokerCount = used.length - real.length;
    if (
      !best ||
      after.closest < best.after.closest ||
      (after.closest === best.after.closest && jokerCount < best.jokers)
    ) {
      best = { tiles: used.map((t) => t.id), after, jokers: jokerCount };
    }
  }
  return best && best.after.closest !== Infinity ? { tiles: best.tiles, after: best.after } : null;
}

/** A Joker swap that costs the bot nothing, or null. */
function jokerSwap(state: GameState, seat: Seat, seen: readonly TileKind[], card: PracticeCard): GameAction | null {
  const me = state.players[seat];
  const before = standing(me.rack, me.exposures, seen, card).closest;
  for (const owner of state.players) {
    for (let index = 0; index < owner.exposures.length; index++) {
      const group = owner.exposures[index];
      const joker = group.tiles.find(isJoker);
      const real = me.rack.find((t) => !isJoker(t) && sameKind(t.kind, group.kind));
      if (!joker || !real) continue;
      const action: GameAction = { type: 'jokerSwap', seat, tile: real.id, owner: owner.seat, exposure: index };
      const result = step(state, action, card);
      if (!result.ok) continue;
      const after = result.state.players[seat];
      // The real tile goes out of sight into the exposure, so it joins what the bot sees elsewhere.
      if (standing(after.rack, after.exposures, owner.seat === seat ? seen : [...seen, real.kind], card).closest <= before) {
        return action;
      }
    }
  }
  return null;
}

// ---- The move -------------------------------------------------------------------------

/** The bot's move for `seat` at `level`, or null if the game isn't waiting on it. */
export function botAction(
  state: GameState,
  seat: Seat,
  level: BotLevel,
  card: PracticeCard = CURRENT_CARD,
): GameAction | null {
  if (!awaiting(state).includes(seat)) return null;
  const style = BOT_STYLES[level];
  const { phase } = state;
  const me = state.players[seat];
  const seen = style.deadTiles ? seenBy(state, seat) : [];
  switch (phase.type) {
    case 'charleston': {
      // A rack holds at most eight Jokers, so three real tiles are always there. Bots never pass blind.
      // Pass ids name the round ('first-right' vs 'second-right'), so every pass draws its own noise.
      const rng = rngFor(state, seat, phase.pass);
      return { type: 'charlestonPass', seat, tiles: tilesToPass(me.rack, PASS_SIZE, style, rng, card).map((t) => t.id) };
    }
    case 'charleston-vote':
      // Bots leave the second Charleston to the human player.
      return { type: 'charlestonVote', seat, continueCharleston: true };
    case 'courtesy-offer':
      return { type: 'courtesyOffer', seat, count: spareCount(me.rack, card) };
    case 'courtesy-pass': {
      const rng = rngFor(state, seat, 'courtesy');
      return { type: 'courtesyPass', seat, tiles: tilesToPass(me.rack, phase.counts[seat], style, rng, card).map((t) => t.id) };
    }
    case 'turn': {
      if (phase.step === 'draw') return { type: 'draw', seat };
      if (step(state, { type: 'declareMahJongg', seat }, card).ok) return { type: 'declareMahJongg', seat };
      if (style.swapsJokers) {
        const swap = jokerSwap(state, seat, seen, card);
        if (swap) return swap;
      }
      // A rack of nothing but Jokers (it happens after exposures, since bots keep their Jokers) can only throw one.
      if (me.rack.every(isJoker)) return { type: 'discard', seat, tile: me.rack[0].id };
      const tile = style.defends
        ? sharkDiscard(state, seat, seen, card)
        : choose(options(me.rack, me.exposures, seen, card), style, rngFor(state, seat, 'discard'), byBackups).tile;
      return { type: 'discard', seat, tile: tile.id };
    }
    case 'calls': {
      if (step(state, { type: 'call', seat, claim: { type: 'mahJongg' } }, card).ok) {
        return { type: 'call', seat, claim: { type: 'mahJongg' } };
      }
      const exposure = bestExposure(state, seat, seen, card);
      if (exposure) {
        const before = standing(me.rack, me.exposures, seen, card).closest;
        const helps = exposure.after.closest < before;
        // A Beginner sometimes calls a group that fits its hand but brings it no closer.
        const idle =
          exposure.after.closest === before && style.idleCall > 0 && rngFor(state, seat, 'call')() < style.idleCall;
        if ((helps || idle) && step(state, { type: 'call', seat, claim: { type: 'expose', tiles: exposure.tiles } }, card).ok) {
          return { type: 'call', seat, claim: { type: 'expose', tiles: exposure.tiles } };
        }
      }
      return { type: 'pass', seat };
    }
    case 'ended':
      return null;
  }
}
