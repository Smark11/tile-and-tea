import { GUTTER, laneX, MEDALLION, MEDALLION_TOP, medallionCenter, segmentPath, trailSegments } from '@/components/lesson/path/trail';

describe('lesson trail geometry', () => {
  it('alternates lanes and keeps every medallion inside the gutter', () => {
    expect(laneX(0)).toBeLessThan(GUTTER / 2);
    expect(laneX(1)).toBeGreaterThan(GUTTER / 2);
    expect(laneX(2)).toBe(laneX(0));
    for (const i of [0, 1]) {
      expect(laneX(i) - MEDALLION / 2).toBeGreaterThanOrEqual(0);
      expect(laneX(i) + MEDALLION / 2).toBeLessThanOrEqual(GUTTER);
    }
  });

  it('centers the medallion near the top of its row', () => {
    expect(medallionCenter(1, 100)).toEqual({ x: laneX(1), y: 100 + MEDALLION_TOP + MEDALLION / 2 });
  });

  it('joins medallions with an S-curve that leaves and arrives vertically', () => {
    expect(segmentPath({ x: 32, y: 42 }, { x: 64, y: 242 })).toBe('M32 42 C32 142 64 142 64 242');
  });

  it('waits for every row before drawing', () => {
    expect(trailSegments([0, undefined, 400])).toEqual([]);
    expect(trailSegments([0])).toEqual([]);
    const segments = trailSegments([0, 200, 420]);
    expect(segments).toHaveLength(2);
    expect(segments[1].from).toEqual(medallionCenter(1, 200));
    expect(segments[1].to).toEqual(medallionCenter(2, 420));
  });
});
