// docs/STRATEGY.md must record every policy the win-rate simulator measures.
// (Plain JS like the other script tests, because the app's TypeScript has no
// Node types.) The fast-mode regression floor lives in winrate.floor.test.js,
// which `npm test` runs on its own after the parallel suite (`npm run test:sim`).
const fs = require('node:fs');
const path = require('node:path');

const { SCENARIOS } = require('../../src/game/scenarios');
const { ABLATIONS } = require('../../src/game/sim');

const APP_ROOT = path.join(__dirname, '..', '..');
const STRATEGY = fs.readFileSync(path.join(APP_ROOT, '..', 'docs', 'STRATEGY.md'), 'utf8');

describe('docs/STRATEGY.md', () => {
  const results = STRATEGY.slice(STRATEGY.indexOf('## Simulator results'));

  it('records a simulator run', () => {
    expect(results).toMatch(/npm run winrate/);
    for (const table of ['beginner', 'club', 'shark']) expect(results).toContain(`| ${table} bots |`);
  });

  it('lists every ablation under the principle it measures', () => {
    for (const policy of ABLATIONS) {
      expect(STRATEGY).toMatch(new RegExp(`^\\| ${policy.principle} \\|`, 'm'));
      expect(results).toContain(`| ${policy.principle} | ${policy.label} |`);
    }
  });

  it('marks no principle "to measure" once the simulator has run', () => {
    expect(STRATEGY).not.toMatch(/\*to measure\*/);
  });

  // The doc uses straight apostrophes; scenario titles use typographic ones.
  const rowOf = (principle) => STRATEGY.split('\n').find((line) => line.startsWith(`| ${principle} |`));
  const titled = (scenario) => `*${scenario.title.replace(/’/g, "'")}*`;

  it('names every scenario in the row of the principle it teaches', () => {
    for (const scenario of SCENARIOS) expect(rowOf(scenario.principle)).toContain(titled(scenario));
  });

  it('teaches the S.3 scenarios only from principles with a measured delta', () => {
    const s3 = ['keep-doors-open', 'big-hands-need-real-tiles', 'exposures-count-too', 'stay-concealed', 'call-the-kong', 'take-the-joker', 'swap-the-spare'];
    for (const id of s3) {
      const scenario = SCENARIOS.find((s) => s.id === id);
      const policy = ABLATIONS.find((p) => p.principle === scenario.principle);
      expect(policy).toBeDefined();
      // Measured, and not "not distinguishable" / "no detectable effect".
      expect(rowOf(scenario.principle)).toMatch(/\*measured\*: /);
      expect(rowOf(scenario.principle)).not.toMatch(/\*measured\*: (\*\*)?(not distinguishable|no detectable)/);
    }
  });
});
