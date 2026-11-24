// Turns simulator runs into the Markdown tables recorded in docs/STRATEGY.md.

import type { BotLevel } from '../bots';
import { excludesZero, type Interval, type Mean } from './stats';
import { POLICIES, STUDENT, type PolicyId } from './policies';
import { compare, summarize, type GameRecord } from './simulate';

export type Run = { readonly policy: PolicyId; readonly table: BotLevel; readonly records: readonly GameRecord[] };

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const signed = (x: number, digits: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(digits)}`;
const range = (ci: Interval, f: (x: number) => string) => `${f(ci.low)} to ${f(ci.high)}`;

/** A paired delta as "+3.1 pp (+0.4 to +5.8)", in percentage points when `points` is false. */
function delta(m: Mean, asPoints: boolean): string {
  const f = asPoints ? (x: number) => signed(x, 1) : (x: number) => signed(x * 100, 1);
  return `${f(m.mean)}${asPoints ? '' : ' pp'} (${range(m.ci, f)})`;
}

/** Whether a delta is clear of chance at 95%, and in which direction for the student. */
export function verdict(m: Mean): 'helps' | 'hurts' | 'unclear' {
  if (!excludesZero(m.ci)) return 'unclear';
  return m.mean > 0 ? 'helps' : 'hurts';
}

const VERDICT_WORDS = { helps: 'helps ✅', hurts: 'hurts ❌', unclear: 'not distinguishable' } as const;

/** The student's results at each table, then every ablation's paired delta against the student. */
export function formatReport(runs: readonly Run[]): string {
  const find = (policy: PolicyId, table: BotLevel) => runs.find((r) => r.policy === policy && r.table === table);
  const tables = [...new Set(runs.map((r) => r.table))];
  const lines: string[] = [];

  lines.push('| Table | Games | Mah Jongg rate (95% CI) | Wall games | Fed the winner | Net points / game (95% CI) | Mean winning hand |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const table of tables) {
    const run = find(STUDENT.id, table);
    if (!run) continue;
    const s = summarize(run.records);
    // A seat's fair share: a quarter of the games anyone won (wall games and dead-hand endings have no winner).
    const decided = run.records.filter((r) => r.outcome === 'won' || r.outcome === 'lost').length;
    const fair = s.games ? decided / s.games / 4 : 0;
    lines.push(
      `| ${table} bots | ${s.games} | ${pct(s.mahJongg.rate)} (${range(s.mahJongg.ci, pct)}; fair share ${pct(fair)}) | ${pct(s.wallGames.rate)} | ${pct(s.fedWinner.rate)} | ${signed(s.net.mean, 1)} (${range(s.net.ci, (x) => signed(x, 1))}) | ${s.meanWinValue.toFixed(1)} |`,
    );
  }

  const ablations = POLICIES.filter((p) => p.id !== STUDENT.id && tables.some((t) => find(p.id, t)));
  if (ablations.length > 0) {
    lines.push('');
    lines.push('Each row switches one principle off and replays the same deals. Deltas are the full student minus the ablation (positive: the principle wins games or points), with 95% paired intervals.');
    lines.push('');
    lines.push('| Principle | Switched off | Table | Δ Mah Jongg rate | Δ net points / game | Verdict (net) |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const policy of ablations) {
      for (const table of tables) {
        const base = find(STUDENT.id, table);
        const run = find(policy.id, table);
        if (!base || !run) continue;
        const c = compare(base.records, run.records);
        lines.push(
          `| ${policy.principle} | ${policy.label} | ${table} | ${delta(c.mahJongg, false)} | ${delta(c.net, true)} | ${VERDICT_WORDS[verdict(c.net)]} |`,
        );
      }
    }
  }
  return lines.join('\n');
}
