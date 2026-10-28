import { RACK_MIN_TILE_WIDTH, rackLayout, slotAt, slotOrigin } from '../rack/rackLayout';

// The rack's tile area on an iPhone 15: 393pt screen, minus the Screen's
// 24pt side padding and the tray's 12pt padding.
const PHONE = 393 - 2 * 24 - 2 * 12;
// The widest content column (maxContentWidth 640) minus tray padding.
const TABLET = 640 - 2 * 12;

describe('rackLayout', () => {
  it('splits 14 tiles into two tiers of 7 on a phone, each tile readable', () => {
    const l = rackLayout(PHONE, 14);
    expect(l).toMatchObject({ perRow: 7, rows: 2 });
    expect(l.tileWidth).toBeGreaterThanOrEqual(RACK_MIN_TILE_WIDTH);
    expect(l.width).toBeLessThanOrEqual(PHONE);
    expect(l.tileHeight).toBe(Math.round(l.tileWidth * 1.4));
  });

  it('splits 13 tiles 7 + 6 on a phone', () => {
    expect(rackLayout(PHONE, 13)).toMatchObject({ perRow: 7, rows: 2 });
  });

  it('keeps all 14 tiles on one tier when the column is wide enough', () => {
    const l = rackLayout(TABLET, 14);
    expect(l).toMatchObject({ perRow: 14, rows: 1 });
    expect(l.tileWidth).toBeGreaterThanOrEqual(RACK_MIN_TILE_WIDTH);
    expect(l.width).toBeLessThanOrEqual(TABLET);
  });

  it('caps tile width so a short rack on a wide screen stays tile-sized', () => {
    const l = rackLayout(1000, 3, { maxTileWidth: 60 });
    expect(l.tileWidth).toBe(60);
    expect(l.width).toBe(3 * 60 + 2 * 4);
  });

  it('never uses more than two tiers, even when squeezed', () => {
    const l = rackLayout(200, 14);
    expect(l.rows).toBe(2);
    expect(l.tileWidth).toBeGreaterThan(0);
  });

  it('reports the full tile area, tiers and gaps included', () => {
    const l = rackLayout(PHONE, 14, { gap: 4, rowGap: 14 });
    expect(l.width).toBe(7 * l.tileWidth + 6 * 4);
    expect(l.height).toBe(2 * l.tileHeight + 14);
    expect(l.pitchX).toBe(l.tileWidth + 4);
    expect(l.pitchY).toBe(l.tileHeight + 14);
  });

  it('copes with an unmeasured or empty rack', () => {
    expect(rackLayout(0, 14).tileWidth).toBeGreaterThan(0);
    expect(rackLayout(PHONE, 0)).toMatchObject({ perRow: 1, rows: 1 });
  });
});

describe('slotOrigin and slotAt', () => {
  const l = rackLayout(PHONE, 14);

  it('fills tiers left to right, top to bottom', () => {
    expect(slotOrigin(l, 0)).toEqual({ x: 0, y: 0 });
    expect(slotOrigin(l, 6)).toEqual({ x: 6 * l.pitchX, y: 0 });
    expect(slotOrigin(l, 7)).toEqual({ x: 0, y: l.pitchY });
    expect(slotOrigin(l, 13)).toEqual({ x: 6 * l.pitchX, y: l.pitchY });
  });

  it('round-trips every slot', () => {
    for (let i = 0; i < 14; i++) {
      const { x, y } = slotOrigin(l, i);
      expect(slotAt(l, 14, x, y)).toBe(i);
    }
  });

  it('picks the nearest slot once a tile is dragged past the halfway point', () => {
    expect(slotAt(l, 14, l.pitchX * 0.49, 0)).toBe(0);
    expect(slotAt(l, 14, l.pitchX * 0.51, 0)).toBe(1);
    expect(slotAt(l, 14, 2 * l.pitchX, l.pitchY * 0.6)).toBe(9);
  });

  it('clamps drags past the rack edges to the end slots', () => {
    expect(slotAt(l, 14, -50, -50)).toBe(0);
    expect(slotAt(l, 14, 9999, 9999)).toBe(13);
  });

  it('never returns an empty slot in a short last tier', () => {
    const thirteen = rackLayout(PHONE, 13);
    expect(slotAt(thirteen, 13, 6 * thirteen.pitchX, thirteen.pitchY)).toBe(12);
    expect(slotAt(thirteen, 0, 0, 0)).toBe(0);
  });
});
