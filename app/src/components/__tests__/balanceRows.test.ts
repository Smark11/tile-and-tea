import { balanceRows } from '@/components/lesson/CardLineView';

const seven = ['NN', 'EE', 'WW', 'SS', '11', '22', '33'];

describe('balanceRows', () => {
  it('keeps one row until every group has been measured', () => {
    expect(balanceRows(seven, [], 300, 6)).toEqual([seven]);
    expect(balanceRows(seven, [30, 30, 0, 30, 30, 30, 30], 300, 6)).toEqual([seven]);
    expect(balanceRows(seven, Array(7).fill(30), 0, 6)).toEqual([seven]);
  });

  it('keeps one row when the whole line fits', () => {
    // 7 × 30 + 6 × 6 = 246
    expect(balanceRows(seven, Array(7).fill(30), 246, 6)).toEqual([seven]);
  });

  it('splits a line that must wrap evenly, never leaving an orphan', () => {
    const rows = balanceRows(seven, Array(7).fill(30), 240, 6);
    expect(rows).toEqual([
      ['NN', 'EE', 'WW', 'SS'],
      ['11', '22', '33'],
    ]);
  });

  it('uses more balanced rows only when two still overflow', () => {
    // A 4-group row is 4 × 30 + 3 × 6 = 138, too wide for 130; 3 per row is 102.
    expect(balanceRows(seven, Array(7).fill(30), 130, 6).map((r) => r.length)).toEqual([3, 2, 2]);
  });
});
