import { TILE_VIEWBOX } from '@/components/tile/TileFace';

// Geometry for the rack. Pure functions marked as worklets, so the drag
// gesture can find slots on the UI thread and tests can check the math.

export type RackLayout = {
  /** Tiles per tier. */
  perRow: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  /** Distance from one slot's left edge to the next. */
  pitchX: number;
  /** Distance from one tier's top to the next. */
  pitchY: number;
  /** Size of the tile area (excluding the rack's own padding). */
  width: number;
  height: number;
};

export type RackLayoutOptions = {
  /** Space between neighbouring tiles. */
  gap?: number;
  /** Space between tiers, which also leaves room for a selected tile to rise. */
  rowGap?: number;
  /**
   * Narrowest a tile may get before the rack wraps onto another tier. Below
   * about 40pt the faces stop being readable at arm's length.
   */
  minTileWidth?: number;
  /** Widest a tile gets, so a short rack on a tablet doesn't balloon. */
  maxTileWidth?: number;
};

export const RACK_GAP = 4;
export const RACK_ROW_GAP = 14;
export const RACK_MIN_TILE_WIDTH = 40;
export const RACK_MAX_TILE_WIDTH = 60;

function heightFor(width: number) {
  return Math.round((width * TILE_VIEWBOX.height) / TILE_VIEWBOX.width);
}

/**
 * Fits `count` tiles into `availableWidth`. Uses one tier when the tiles stay
 * at least `minTileWidth` wide; otherwise splits them into balanced tiers
 * (14 → 7 + 7, 13 → 7 + 6), like the two-tier racks some players use.
 */
export function rackLayout(
  availableWidth: number,
  count: number,
  {
    gap = RACK_GAP,
    rowGap = RACK_ROW_GAP,
    minTileWidth = RACK_MIN_TILE_WIDTH,
    maxTileWidth = RACK_MAX_TILE_WIDTH,
  }: RackLayoutOptions = {},
): RackLayout {
  const slots = Math.max(1, count);
  const widthFor = (perRow: number) =>
    Math.min(maxTileWidth, Math.floor((availableWidth - gap * (perRow - 1)) / perRow));

  let rows = 1;
  let perRow = slots;
  // Never go past half a rack per tier: a third tier would hide the hand's shape.
  while (widthFor(perRow) < minTileWidth && rows < 2) {
    rows += 1;
    perRow = Math.ceil(slots / rows);
  }
  const tileWidth = Math.max(1, widthFor(perRow));
  const tileHeight = heightFor(tileWidth);
  const pitchX = tileWidth + gap;
  const pitchY = tileHeight + rowGap;
  rows = Math.ceil(slots / perRow);
  return {
    perRow,
    rows,
    tileWidth,
    tileHeight,
    pitchX,
    pitchY,
    width: perRow * tileWidth + (perRow - 1) * gap,
    height: rows * tileHeight + (rows - 1) * rowGap,
  };
}

/** Top-left corner of slot `index`. Tiers fill left to right, top to bottom. */
export function slotOrigin(layout: RackLayout, index: number): { x: number; y: number } {
  'worklet';
  return {
    x: (index % layout.perRow) * layout.pitchX,
    y: Math.floor(index / layout.perRow) * layout.pitchY,
  };
}

/**
 * The slot nearest to a tile whose top-left corner is at (x, y), clamped to
 * the `count` occupied slots. Used to decide where a dragged tile will land.
 */
export function slotAt(layout: RackLayout, count: number, x: number, y: number): number {
  'worklet';
  if (count <= 0) return 0;
  const col = Math.max(0, Math.min(layout.perRow - 1, Math.round(x / layout.pitchX)));
  const row = Math.max(0, Math.min(layout.rows - 1, Math.round(y / layout.pitchY)));
  return Math.min(count - 1, row * layout.perRow + col);
}
