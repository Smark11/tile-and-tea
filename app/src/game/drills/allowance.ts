// The daily free drill allowance (docs/BUSINESS.md §5: free players get 3
// drill rounds a day, Plus is unlimited). This is only the hook: rounds are
// counted per local day, but nothing is blocked until DAILY_LIMIT_ENFORCED
// turns on with the paywall (backlog N.1).

export const FREE_ROUNDS_PER_DAY = 3;

/** Off until monetization ships. While off, every round may start. */
export const DAILY_LIMIT_ENFORCED = false;

/** Rounds started on one local calendar day. */
export type DrillUsage = {
  /** The local day, YYYY-MM-DD. */
  readonly day: string;
  readonly rounds: number;
};

export type DrillAllowance = {
  readonly limit: number;
  /** Rounds started today. */
  readonly used: number;
  /** Free rounds left today (never negative). */
  readonly remaining: number;
  /** Whether another round may start now. */
  readonly canStart: boolean;
};

export const NO_USAGE: DrillUsage = { day: '', rounds: 0 };

/** The player's local calendar day, so "today" turns over at their midnight. */
export function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Rounds started today; yesterday's count doesn't carry over. */
export function roundsToday(usage: DrillUsage, now: Date): number {
  return usage.day === localDay(now) ? usage.rounds : 0;
}

/** Counts one more round started at `now`. */
export function recordRound(usage: DrillUsage, now: Date): DrillUsage {
  return { day: localDay(now), rounds: roundsToday(usage, now) + 1 };
}

export function drillAllowance(
  usage: DrillUsage,
  now: Date,
  { unlimited = false, enforced = DAILY_LIMIT_ENFORCED }: { unlimited?: boolean; enforced?: boolean } = {},
): DrillAllowance {
  const used = roundsToday(usage, now);
  const remaining = Math.max(0, FREE_ROUNDS_PER_DAY - used);
  return {
    limit: FREE_ROUNDS_PER_DAY,
    used,
    remaining,
    canStart: !enforced || unlimited || remaining > 0,
  };
}
