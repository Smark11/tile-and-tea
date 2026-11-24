// The playbook screen (src/game/playbook) must say exactly what docs/STRATEGY.md
// says: the same principles in the same order and stage, taught by what the doc
// names, and no evidence claim the simulator results don't back. Plain JS like
// winrate.test.js, because the app's TypeScript has no Node types.
const fs = require('node:fs');
const path = require('node:path');

const { DRILLS } = require('../../src/game/drills');
const { LESSON_ORDER } = require('../../src/game/lessons');
const { PRINCIPLES } = require('../../src/game/playbook');

const STRATEGY = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docs', 'STRATEGY.md'), 'utf8');
const curriculum = STRATEGY.slice(STRATEGY.indexOf('## The curriculum'), STRATEGY.indexOf('### Planned'));
const results = STRATEGY.slice(STRATEGY.indexOf('## Simulator results'));

const SECTION_STAGES = { 'The Charleston': 'charleston', 'Choosing a hand': 'hand-choice', 'At the table': 'table' };

/** The curriculum rows, in order: { id, stage, row }. */
function curriculumRows() {
  const rows = [];
  let stage = null;
  for (const line of curriculum.split('\n')) {
    const heading = line.match(/^### (.+)$/);
    if (heading) stage = SECTION_STAGES[heading[1]];
    const row = line.match(/^\| ([CHT]\d) \|/);
    if (row) rows.push({ id: row[1], stage, row: line });
  }
  return rows;
}

/** The simulator rows for one principle: { table, mj: [estimate, low, high] }. */
function simulatorRows(id) {
  const number = (s) => Number(s.replace('−', '-'));
  return results
    .split('\n')
    .filter((line) => line.startsWith(`| ${id} |`))
    .map((line) => {
      const cells = line.split('|').map((c) => c.trim());
      const mj = cells[4].match(/^([+−-]?[\d.]+) pp \(([+−-]?[\d.]+) to ([+−-]?[\d.]+)\)$/);
      return { table: cells[3], mj: [number(mj[1]), number(mj[2]), number(mj[3])], verdict: cells[6] };
    });
}

describe('the playbook matches docs/STRATEGY.md', () => {
  const rows = curriculumRows();

  it('lists every curriculum principle, in order, under its stage', () => {
    expect(PRINCIPLES.map((p) => [p.id, p.stage])).toEqual(rows.map((r) => [r.id, r.stage]));
  });

  it('names only drills and lessons the doc says teach the principle', () => {
    for (const principle of PRINCIPLES) {
      const { row } = rows.find((r) => r.id === principle.id);
      for (const teacher of principle.teachers) {
        if (teacher.kind === 'drill') {
          const drill = DRILLS.find((d) => d.id === teacher.id);
          expect(drill).toBeDefined();
          expect(row).toContain(`${drill.title} drill`);
        } else {
          const index = LESSON_ORDER.indexOf(teacher.id);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(row).toContain(`Lesson ${index + 1}`);
        }
      }
    }
  });

  it('gives every principle something to learn it from', () => {
    for (const principle of PRINCIPLES) {
      const { row } = rows.find((r) => r.id === principle.id);
      const taughtBy = row.split('|')[3];
      expect(taughtBy).toMatch(/Scenario|drill|Lesson/);
    }
  });

  it('claims a measured edge exactly where the simulator found one, with its numbers', () => {
    for (const principle of PRINCIPLES) {
      const { row } = rows.find((r) => r.id === principle.id);
      const sims = simulatorRows(principle.id);
      const status = row.split('|')[4];
      // A table where switching the principle off cost Mah Jonggs beyond the 95% interval.
      const helped = sims.filter((s) => s.mj[1] > 0);
      const { evidence } = principle;
      switch (evidence.kind) {
        case 'measured': {
          expect(status).toMatch(/\*measured\*/);
          expect(evidence.tables).toEqual(helped.map((s) => s.table));
          const estimates = helped.map((s) => Math.round(s.mj[0]));
          expect(evidence.perHundred).toEqual([Math.min(...estimates), Math.max(...estimates)]);
          break;
        }
        case 'tie-break':
          expect(status).toMatch(/\*measured\*/);
          expect(sims.length).toBeGreaterThan(0);
          expect(helped).toEqual([]);
          expect(sims.every((s) => s.verdict === 'not distinguishable')).toBe(true);
          break;
        case 'engine':
          expect(sims).toEqual([]);
          expect(status).toMatch(/engine-backed/);
          break;
        case 'rule':
          expect(sims).toEqual([]);
          expect(status.trim()).toBe('rule');
          break;
      }
    }
  });
});
