// npm run brand:assets
// Renders the Tile & Tea mark (src/brand/tileMark.ts) into every icon and
// splash PNG that app.json references. Re-run after changing the mark, and
// commit the PNGs it writes. Needs Node 22.18+ for TypeScript type stripping.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { feltSvg, tileMarkMonochromeSvg, tileMarkSvg } from '../src/brand/tileMark.ts';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES = path.join(APP_ROOT, 'assets', 'images');

/** file → [pixel size, SVG]. */
const ASSETS = {
  // iOS + store icon: opaque, full-bleed felt (iOS rounds the corners itself).
  'icon.png': [1024, tileMarkSvg({ size: 1024, background: true, scale: 0.64 })],
  // Splash: the mark alone over the felt splash color set in app.json.
  'splash-icon.png': [512, tileMarkSvg({ size: 512, scale: 0.86 })],
  // Favicon: one bold tile, no stack, so it reads at 16–32px.
  'favicon.png': [196, tileMarkSvg({ size: 196, scale: 0.88, stack: false })],
  // Android adaptive icon layers; the launcher masks to the middle ~66%.
  'android-icon-foreground.png': [1024, tileMarkSvg({ size: 1024, scale: 0.5 })],
  'android-icon-background.png': [1024, feltSvg(1024)],
  'android-icon-monochrome.png': [1024, tileMarkMonochromeSvg(1024)],
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [file, [size, svg]] of Object.entries(ASSETS)) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg}</body></html>`,
    );
    await page.locator('svg').screenshot({ path: path.join(IMAGES, file), omitBackground: true });
    console.log(`[brand] ✓ assets/images/${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
