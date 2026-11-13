// The Tile & Tea mark: an ivory tile, built like the in-game tiles (jade back,
// ivory edge, lit face), bearing a jade tea leaf with a gold vein.
//
// It is a plain SVG string so a single source feeds both the app icons
// (scripts/generate-brand-assets.ts renders it with Playwright) and the web
// stage. This file must stay self-contained, using only erasable TypeScript and no
// imports, because Node runs it directly when the assets are generated. The
// colors mirror the palette and tile inks, and brand.test.ts keeps them in sync.

export const brandColors = {
  jadeFelt: '#0F3D33',
  feltLight: '#1C5A4B',
  jade: '#1F7A63',
  leaf: '#1D6A4B',
  leafLight: '#3E9C78',
  gold: '#C9A24B',
  ivory: '#F7F1E3',
  faceLight: '#FFFBF2',
  faceShade: '#EFE5CD',
  edgeLight: '#E6D9BA',
  edge: '#D9CBA8',
  edgeShade: '#C4B188',
} as const;

const c = brandColors;

/** One tile in a 100×140 box, drawn at the origin. `p` prefixes gradient ids. */
function tile(p: string): string {
  return `
  <rect x="0" y="6" width="100" height="134" rx="14" fill="url(#${p}back)"/>
  <rect x="0" y="0" width="100" height="131" rx="14" fill="url(#${p}edge)"/>
  <rect x="3" y="2" width="94" height="122" rx="11" fill="url(#${p}face)"/>
  <rect x="4" y="3" width="92" height="120" rx="10" fill="none" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="1.4"/>
  <rect x="3" y="2" width="94" height="122" rx="11" fill="none" stroke="${c.edgeShade}" stroke-opacity="0.45" stroke-width="0.8"/>
  <g transform="rotate(-24 50 64)">
    <path d="M50 22 C76 38 80 82 50 106 C20 82 24 38 50 22 Z" fill="url(#${p}leaf)"/>
    <path d="M50 28 C52 52 52 78 50 112" fill="none" stroke="${c.gold}" stroke-width="3.2" stroke-linecap="round"/>
    <clipPath id="${p}leafClip"><path d="M50 22 C76 38 80 82 50 106 C20 82 24 38 50 22 Z"/></clipPath>
    <path clip-path="url(#${p}leafClip)" d="M51 50 C58 46 63 42 66 38 M51 66 C59 62 66 57 70 52 M51 82 C58 79 64 75 67 71
             M50 50 C43 46 38 42 35 38 M50 66 C42 62 35 57 31 52 M50 82 C43 79 37 75 34 71"
          fill="none" stroke="${c.gold}" stroke-opacity="0.8" stroke-width="1.6" stroke-linecap="round"/>
  </g>`;
}

function tileDefs(p: string): string {
  return `
  <linearGradient id="${p}back" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c.jade}"/><stop offset="1" stop-color="${c.jadeFelt}"/>
  </linearGradient>
  <linearGradient id="${p}edge" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c.edgeLight}"/><stop offset="0.82" stop-color="${c.edge}"/><stop offset="1" stop-color="${c.edgeShade}"/>
  </linearGradient>
  <linearGradient id="${p}face" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c.faceLight}"/><stop offset="0.55" stop-color="${c.ivory}"/><stop offset="1" stop-color="${c.faceShade}"/>
  </linearGradient>
  <linearGradient id="${p}leaf" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c.leafLight}"/><stop offset="1" stop-color="${c.leaf}"/>
  </linearGradient>`;
}

export type MarkOptions = {
  /** Output size in px (the SVG is square). */
  size: number;
  /** Paint the jade felt behind the tile (app icon) or leave it transparent. */
  background?: boolean;
  /** Share of the square the tile's height takes up. */
  scale?: number;
  /** Draw a second, face-down tile tucked behind the first. */
  stack?: boolean;
  /** Prefix for gradient ids, so two marks can share one page. */
  idPrefix?: string;
};

/** The full-color mark as a standalone SVG document. */
export function tileMarkSvg({
  size,
  background = false,
  scale = 0.62,
  stack = true,
  idPrefix = 'tt',
}: MarkOptions): string {
  const p = idPrefix;
  const s = (1000 * scale) / 140; // tile units → 1000-unit canvas
  const tx = 500 - 50 * s;
  const ty = 500 - 70 * s;
  const felt = background
    ? `<rect width="1000" height="1000" fill="url(#${p}felt)"/>
       <rect width="1000" height="1000" filter="url(#${p}grain)" opacity="0.06"/>`
    : '';
  const back = stack
    ? `<g transform="translate(${tx} ${ty}) scale(${s}) rotate(9 50 70) translate(9 3)">
         <rect x="0" y="0" width="100" height="140" rx="14" fill="url(#${p}back)"/>
         <rect x="6" y="6" width="88" height="124" rx="9" fill="none" stroke="${c.gold}" stroke-opacity="0.55" stroke-width="1.6"/>
       </g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000">
  <defs>
    ${tileDefs(p)}
    <radialGradient id="${p}felt" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="${c.feltLight}"/><stop offset="1" stop-color="${c.jadeFelt}"/>
    </radialGradient>
    <filter id="${p}grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/>
    </filter>
    <filter id="${p}shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${14 * scale}" stdDeviation="${18 * scale}" flood-color="#04140F" flood-opacity="0.45"/>
    </filter>
  </defs>
  ${felt}
  <g filter="url(#${p}shadow)">
    ${back}
    <g transform="translate(${tx} ${ty}) scale(${s}) rotate(-5 50 70)">${tile(p)}</g>
  </g>
</svg>`;
}

/** The jade felt on its own: Android's adaptive-icon background layer. */
export function feltSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000">
  <defs>
    <radialGradient id="felt" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="${c.feltLight}"/><stop offset="1" stop-color="${c.jadeFelt}"/>
    </radialGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#felt)"/>
</svg>`;
}

/**
 * Single-color silhouette for Android's themed (monochrome) icon: the tile
 * shape with the leaf cut out, in white on transparent.
 */
export function tileMarkMonochromeSvg(size: number, scale = 0.5): string {
  const s = (1000 * scale) / 140;
  const tx = 500 - 50 * s;
  const ty = 500 - 70 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000">
  <defs>
    <mask id="cut">
      <rect width="1000" height="1000" fill="#fff"/>
      <g transform="translate(${tx} ${ty}) scale(${s}) rotate(-5 50 70) rotate(-24 50 64)">
        <path d="M50 22 C76 38 80 82 50 106 C20 82 24 38 50 22 Z" fill="#000"/>
      </g>
    </mask>
  </defs>
  <g mask="url(#cut)">
    <g transform="translate(${tx} ${ty}) scale(${s}) rotate(-5 50 70)">
      <rect x="0" y="0" width="100" height="140" rx="14" fill="#fff"/>
    </g>
  </g>
  <g transform="translate(${tx} ${ty}) scale(${s}) rotate(-5 50 70) rotate(-24 50 64)">
    <path d="M50 30 C52 52 52 78 50 104" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>
  </g>
</svg>`;
}
