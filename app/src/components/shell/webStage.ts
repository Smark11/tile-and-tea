// The web "stage": on phones the app fills the screen; on tablets and desktops
// it sits in a centered column over a felt-textured jade backdrop, like a
// device resting on the game table. This is plain CSS injected by +html.tsx,
// so the layout is right on first paint and can't mismatch during hydration.

import { brandColors, tileMarkSvg } from '@/brand/tileMark';

/** Wider than this, the app becomes a centered column. */
export const STAGE_BREAKPOINT = 600;
/** Width of the app column on tablet and desktop. */
export const STAGE_COLUMN_WIDTH = 520;
/** Taller than this, the column floats with margins and rounded corners. */
export const STAGE_FLOAT_MIN_HEIGHT = 640;
/** Wide enough to show the wordmark beside the column without crowding it. */
export const STAGE_WORDMARK_MIN_WIDTH = 1080;

function svgDataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' '))}")`;
}

// Fine fractal noise reads as the nap of baize felt. It's tiled small, so it
// costs almost nothing to paint.
const feltGrain = svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="4" stitchTiles="stitch"/>
  <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0"/></filter>
  <rect width="180" height="180" filter="url(#n)"/></svg>`);

const mark = svgDataUri(tileMarkSvg({ size: 64, scale: 0.9, stack: false, idPrefix: 'wm' }));

/** Gold, plus a felt-dark halo so the ring reads on ivory and on felt alike. */
const FOCUS_GOLD = brandColors.gold;
const FOCUS_HALO = '#0A2A23';

export const webStageCss = `
html, body { background-color: ${brandColors.jadeFelt}; }
body {
  margin: 0;
  background-image:
    radial-gradient(ellipse 70% 60% at 50% 38%, rgba(62, 156, 120, 0.20), transparent 72%),
    ${feltGrain},
    radial-gradient(ellipse 120% 100% at 50% 50%, transparent 55%, rgba(4, 20, 15, 0.55));
  background-attachment: fixed;
}
@media (prefers-color-scheme: dark) {
  html, body { background-color: #0A2A23; }
}

/* Keyboard focus: a gold ring with a dark halo inside it. Mouse and touch
   presses don't match :focus-visible, so taps never leave a ring behind. */
:focus { outline: none; }
:focus-visible {
  outline: 3px solid ${FOCUS_GOLD} !important;
  outline-offset: 3px;
}
:focus-visible::after {
  content: "";
  position: absolute;
  inset: -3px;
  border: 3px solid ${FOCUS_HALO};
  border-radius: inherit;
  pointer-events: none;
}

@media (min-width: ${STAGE_BREAKPOINT}px) {
  body { display: flex; align-items: center; justify-content: center; }
  #root {
    flex: 0 0 auto;
    width: ${STAGE_COLUMN_WIDTH}px;
    max-width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    /* Contains fixed-position overlays (sheets, toasts) inside the column. */
    transform: translateZ(0);
    box-shadow:
      0 0 0 1px rgba(201, 162, 75, 0.38),
      0 10px 24px rgba(2, 12, 9, 0.35),
      0 40px 90px rgba(2, 12, 9, 0.50);
  }
}
@media (min-width: ${STAGE_BREAKPOINT}px) and (min-height: ${STAGE_FLOAT_MIN_HEIGHT}px) {
  #root {
    height: min(calc(100% - 64px), 1000px);
    border-radius: 28px;
  }
}
@media (min-width: ${STAGE_WORDMARK_MIN_WIDTH}px) and (min-height: ${STAGE_FLOAT_MIN_HEIGHT}px) {
  /* Decorative wordmark in the corner of the table. The empty alt text after
     the slash keeps screen readers from announcing it twice. */
  body::before {
    content: "Tile & Tea" / "";
    position: fixed;
    top: 36px;
    left: 44px;
    padding-left: 46px;
    height: 40px;
    line-height: 40px;
    background: ${mark} left center / 38px 38px no-repeat;
    color: ${brandColors.ivory};
    font-family: Fraunces_600SemiBold, Georgia, serif;
    font-size: 22px;
    letter-spacing: 0.2px;
    opacity: 0.92;
    pointer-events: none;
  }
}
`;
