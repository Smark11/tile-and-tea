// docs/STRATEGY.md must record every policy the win-rate simulator measures.
// (Plain JS like the other script tests, because the app's TypeScript has no
// Node types.) The fast-mode regression floor lives in winrate.floor.test.js,
// which `npm test` runs on its own after the parallel suite (`npm run test:sim`).
const fs = require('node:fs');
const path = require('node:path');

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
});
