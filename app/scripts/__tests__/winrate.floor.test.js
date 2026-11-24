// Regression floor for the win-rate simulator: `npm run winrate` in fast mode
// (100 games per table) must keep the student above the floors below. (Plain JS
// like the other script tests, because the app's TypeScript has no Node types.)
//
// This suite is CPU-heavy (it plays 300 full games in worker threads), so the
// parallel `jest` run ignores it (see `testPathIgnorePatterns` in package.json)
// and `npm test` runs it on its own afterwards via `npm run test:sim`. Running
// it beside the other suites starves their timing checks.
//
// Fast mode replays seeds winrate-0…99, which are the first 100 games of the
// full run recorded in STRATEGY.md, so it is exactly reproducible. If a bot or
// engine change moves these numbers, re-run `npm run winrate`, update
// STRATEGY.md, and only then move a floor, never just to get green.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { POLICIES, summarize } = require('../../src/game/sim');

const APP_ROOT = path.join(__dirname, '..', '..');

/**
 * The student's floors over the 100 fast-mode games at each table: its Mah Jongg count and its mean
 * net points per game. Each sits a little under the fast-mode result (in the comment) so small bot
 * tweaks pass but a real regression fails. Against Sharks the student is playing its own policy, so
 * its floor is about breaking even, not beating them.
 */
const FLOORS = {
  beginner: { wins: 45, net: 60 }, // fast mode: 51 wins, +76.4 per game
  club: { wins: 35, net: 30 }, // fast mode: 42 wins, +48.0 per game
  shark: { wins: 10, net: -25 }, // fast mode: 14 wins, −12.1 per game
};

describe('npm run winrate (fast mode)', () => {
  let runs;
  beforeAll(() => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'winrate-')), 'fast.json');
    execFileSync(process.execPath, ['scripts/winrate.js', '--games', '100', '--policies', 'student', '--json', out], {
      cwd: APP_ROOT,
      stdio: 'pipe',
      timeout: 240_000,
    });
    runs = JSON.parse(fs.readFileSync(out, 'utf8')).runs;
  }, 300_000);

  it('plays 100 games at each table', () => {
    expect(runs.map((r) => [r.policy, r.table, r.records.length])).toEqual([
      ['student', 'beginner', 100],
      ['student', 'club', 100],
      ['student', 'shark', 100],
    ]);
    expect(POLICIES[0].id).toBe('student');
  });

  it.each(Object.entries(FLOORS))('the student stays above its floor against %s bots', (table, floor) => {
    const summary = summarize(runs.find((r) => r.table === table).records);
    expect(summary.mahJongg.count).toBeGreaterThanOrEqual(floor.wins);
    expect(summary.net.mean).toBeGreaterThanOrEqual(floor.net);
  });
});
