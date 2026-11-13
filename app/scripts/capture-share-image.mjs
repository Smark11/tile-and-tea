// npm run brand:share
// Renders the link-preview image (src/components/dev/ShareCard.tsx, made of
// the real in-app tiles) to public/og-image.png at 1200×630. Re-run after
// changing the card or the tiles, and commit the PNG it writes.
//   SHARE_PORT=8098  dev server port (must be free)
import path from 'node:path';
import { chromium } from 'playwright';

import { APP_ROOT, ONBOARDED_PREFERENCES, PREFERENCES_KEY, startExpoWeb } from './expo-web.mjs';

const PORT = Number(process.env.SHARE_PORT ?? 8098);
const OUT = path.join(APP_ROOT, 'public', 'og-image.png');
const SIZE = { width: 1200, height: 630 }; // keep in sync with SHARE_IMAGE in src/web/siteMeta.ts

// Let the card fill the page: drop the web stage's centered column and wordmark.
const FULL_BLEED_CSS = `
  body { display: block !important; background: #0F3D33 !important; }
  body::before { display: none !important; }
  #root { width: 100% !important; height: 100% !important; border-radius: 0 !important;
          box-shadow: none !important; transform: none !important; }
`;

console.log(`[share] starting Expo web on port ${PORT}`);
const { baseUrl, stop } = await startExpoWeb(PORT);
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1 });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [PREFERENCES_KEY, ONBOARDED_PREFERENCES],
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`${baseUrl}/dev/share-card?capture=1`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.addStyleTag({ content: FULL_BLEED_CSS });
  const card = page.getByTestId('share-card');
  await card.waitFor({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const box = await card.boundingBox();
  if (!box || Math.round(box.width) !== SIZE.width || Math.round(box.height) !== SIZE.height) {
    throw new Error(`Share card rendered at ${box?.width}×${box?.height}, expected ${SIZE.width}×${SIZE.height}.`);
  }
  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
  await card.screenshot({ path: OUT });
  console.log(`[share] ✓ ${path.relative(APP_ROOT, OUT)} (${SIZE.width}×${SIZE.height})`);
} finally {
  await browser?.close();
  stop();
}
