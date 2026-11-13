// Checks that docs/ANALYTICS.md lists every event in src/analytics/events.ts.
// (Plain JS like the other script tests, because the app's TypeScript has no
// Node types.)
const fs = require('node:fs');
const path = require('node:path');

const { ANALYTICS_EVENT_NAMES } = require('../../src/analytics/events');

describe('docs/ANALYTICS.md', () => {
  it('documents every event in its events table', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../../../docs/ANALYTICS.md'), 'utf8');
    for (const name of ANALYTICS_EVENT_NAMES) expect(doc).toContain(`| \`${name}\` |`);
  });
});
