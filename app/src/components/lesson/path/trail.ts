// Geometry for the winding trail down the left of the lesson path. Medallions
// alternate between two lanes in the gutter, and the trail joins them with
// S-curves that leave and arrive vertically, like a garden path.

/** Width of the gutter the trail winds through. */
export const GUTTER = 96;
/** Medallion diameter. */
export const MEDALLION = 56;
/** How far each lane sits from the middle of the gutter. */
export const SWAY = 16;
/** Gap from the top of a row to the top of its medallion. */
export const MEDALLION_TOP = 14;

export type Point = { readonly x: number; readonly y: number };

/** The medallion's center x in the gutter: lanes alternate, starting left. */
export function laneX(index: number): number {
  return GUTTER / 2 + (index % 2 === 0 ? -SWAY : SWAY);
}

/** Medallion center for a row that starts at `rowY`. */
export function medallionCenter(index: number, rowY: number): Point {
  return { x: laneX(index), y: rowY + MEDALLION_TOP + MEDALLION / 2 };
}

const r = (n: number) => Math.round(n * 10) / 10;

/** SVG path for the S-curve from one medallion center to the next. */
export function segmentPath(from: Point, to: Point): string {
  const pull = (to.y - from.y) / 2;
  return `M${r(from.x)} ${r(from.y)} C${r(from.x)} ${r(from.y + pull)} ${r(to.x)} ${r(to.y - pull)} ${r(to.x)} ${r(to.y)}`;
}

/**
 * The segments between consecutive centers, or none until every row has
 * been measured (a half-drawn trail would point at nothing).
 */
export function trailSegments(rowYs: readonly (number | undefined)[]): { from: Point; to: Point; d: string }[] {
  if (rowYs.length < 2 || rowYs.some((y) => y === undefined)) return [];
  const centers = (rowYs as number[]).map((y, i) => medallionCenter(i, y));
  return centers.slice(1).map((to, i) => ({ from: centers[i], to, d: segmentPath(centers[i], to) }));
}
