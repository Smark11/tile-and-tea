// The win-rate simulator: seeded games with one policy ("the student") in one
// seat and three bots of one level in the others. Every move goes through the
// game engine, so an illegal move fails the run instead of skewing it.
//
// Every policy plays the same deals in the same seats (game i always uses
// seed `${seedPrefix}-${i}` and seat i mod 4), so two policies can be compared
// game by game and the luck of the deal cancels out (`pairedDelta`).

import { styleAction, botAction, type BotLevel, type BotStyle } from '../bots';
import { CURRENT_CARD, type PracticeCard } from '../card';
import { awaiting, newGame, step } from '../engine/game';
import type { GameState, Seat } from '../engine/types';
import { mean, pairedDelta, share, type Mean, type Share } from './stats';
import type { Policy } from './policies';

/** Far more moves than any real game takes; a game past this is stuck, which is a bug. */
const MAX_MOVES = 3000;

export type GameOutcome = 'won' | 'lost' | 'wall' | 'deadHands';

/** One game from the student's chair. */
export type GameRecord = {
  readonly seed: string;
  readonly seat: Seat;
  readonly outcome: GameOutcome;
  /** Points won minus points paid. */
  readonly net: number;
  /** The student threw the tile someone else won on. */
  readonly fed: boolean;
  /** The student won from the wall. */
  readonly selfDrawn: boolean;
  /** The student's hand went dead. */
  readonly dead: boolean;
  /** The card value of the student's winning hand, or 0. */
  readonly handValue: number;
};

export const gameSeed = (prefix: string, index: number): string => `${prefix}-${index}`;
export const studentSeat = (index: number): Seat => (index % 4) as Seat;

/** Plays one game to its end: the student's `style` in `seat`, `table`-level bots in the other three. */
export function playGame(
  seed: string,
  seat: Seat,
  style: BotStyle,
  table: BotLevel,
  card: PracticeCard = CURRENT_CARD,
): { final: GameState; record: GameRecord } {
  let state = newGame(seed);
  for (let moves = 0; state.phase.type !== 'ended'; moves++) {
    if (moves > MAX_MOVES) throw new Error(`Game ${seed} didn't end after ${MAX_MOVES} moves`);
    const [next] = awaiting(state);
    const action = next === seat ? styleAction(state, next, style, card) : botAction(state, next, table, card);
    if (!action) throw new Error(`Game ${seed}: seat ${next} had no move in ${state.phase.type}`);
    const result = step(state, action, card);
    if (!result.ok) throw new Error(`Game ${seed}: ${JSON.stringify(action)} refused (${result.error})`);
    state = result.state;
  }
  if (state.phase.type !== 'ended') throw new Error('unreachable');
  const { result } = state.phase;
  const dead = state.players[seat].dead !== null;
  if (result.type !== 'mahJongg') {
    return {
      final: state,
      record: { seed, seat, outcome: result.type, net: 0, fed: false, selfDrawn: false, dead, handValue: 0 },
    };
  }
  const won = result.winner === seat;
  return {
    final: state,
    record: {
      seed,
      seat,
      outcome: won ? 'won' : 'lost',
      net: result.payments[seat],
      fed: !won && result.discarder === seat,
      selfDrawn: won && result.selfDrawn,
      dead,
      handValue: won ? result.value : 0,
    },
  };
}

export type RunOptions = {
  readonly games: number;
  readonly table: BotLevel;
  /** Seeds are `${seedPrefix}-0` … `${seedPrefix}-${games - 1}`. */
  readonly seedPrefix?: string;
  /** The first game index (lets a run be split across workers). */
  readonly start?: number;
  readonly card?: PracticeCard;
};

export const DEFAULT_SEED_PREFIX = 'winrate';

/** Plays `games` seeded games for one policy at one table. */
export function runGames(policy: Policy, options: RunOptions): GameRecord[] {
  const { games, table, seedPrefix = DEFAULT_SEED_PREFIX, start = 0, card = CURRENT_CARD } = options;
  const records: GameRecord[] = [];
  for (let i = start; i < start + games; i++) {
    records.push(playGame(gameSeed(seedPrefix, i), studentSeat(i), policy.style, table, card).record);
  }
  return records;
}

/** What a run of games adds up to. */
export type Summary = {
  readonly games: number;
  /** The share of games the student declared Mah Jongg. */
  readonly mahJongg: Share;
  /** The share that ended with the wall exhausted. */
  readonly wallGames: Share;
  /** The share where someone else won on the student's discard. */
  readonly fedWinner: Share;
  /** Points won minus points paid, per game. */
  readonly net: Mean;
  /** The mean card value of the student's wins. */
  readonly meanWinValue: number;
};

export function summarize(records: readonly GameRecord[]): Summary {
  const n = records.length;
  const count = (f: (r: GameRecord) => boolean) => records.filter(f).length;
  const wins = records.filter((r) => r.outcome === 'won');
  return {
    games: n,
    mahJongg: share(wins.length, n),
    wallGames: share(count((r) => r.outcome === 'wall'), n),
    fedWinner: share(count((r) => r.fed), n),
    net: mean(records.map((r) => r.net)),
    meanWinValue: wins.length ? wins.reduce((a, r) => a + r.handValue, 0) / wins.length : 0,
  };
}

/** How a policy did against the full student on the same deals: positive means the student did better. */
export type Comparison = {
  /** Student Mah Jongg rate minus the policy's, per game (a paired difference of 0/1 outcomes). */
  readonly mahJongg: Mean;
  /** Student net points minus the policy's, per game. */
  readonly net: Mean;
};

export function compare(studentRecords: readonly GameRecord[], other: readonly GameRecord[]): Comparison {
  if (studentRecords.some((r, i) => r.seed !== other[i]?.seed || r.seat !== other[i]?.seat)) {
    throw new RangeError('compare needs both runs on the same deals and seats');
  }
  const win = (r: GameRecord) => (r.outcome === 'won' ? 1 : 0);
  return {
    mahJongg: pairedDelta(studentRecords.map(win), other.map(win)),
    net: pairedDelta(
      studentRecords.map((r) => r.net),
      other.map((r) => r.net),
    ),
  };
}
