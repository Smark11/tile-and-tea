// npm run screenshots
// Starts Expo web, then captures every static route at iPhone 15 size
// (393×852 @3x) and desktop size (1440×900 @2x) in light and dark mode into
// screenshots/ (gitignored).
//   SCREENSHOT_PORT=8099  dev server port (must be free)
//   SCREENSHOT_ROUTES=/,/dev/styleguide  capture only these routes
//   SCREENSHOT_DEVICES=phone  capture only these devices (phone, desktop)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

import { APP_ROOT, ONBOARDED_PREFERENCES, PREFERENCES_KEY, startExpoWeb } from './expo-web.mjs';

const require = createRequire(import.meta.url);
const { DEVICES, discoverRoutes, screenshotFile } = require('./routes.js');

const OUT_DIR = path.join(APP_ROOT, 'screenshots');
const PORT = Number(process.env.SCREENSHOT_PORT ?? 8099);
const SCHEMES = /** @type {const} */ (['light', 'dark']);
const FIRST_LOAD_TIMEOUT_MS = 180_000; // first request triggers the web bundle build
const SETTLE_MS = 1_000; // let entrance springs finish before capturing
const MAX_SCROLL_FRAMES = 10; // extra below-the-fold captures per long screen
const WELCOME_ROUTE = '/welcome';

function log(msg) {
  console.log(`[screenshots] ${msg}`);
}

async function capture(browser, baseUrl, route, scheme, device, timeout) {
  const { viewport, deviceScaleFactor, isMobile, hasTouch } = DEVICES[device];
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    colorScheme: scheme,
  });
  // A fresh browser hasn't seen the welcome tour, so every route would redirect
  // to /welcome. Mark it seen everywhere except the welcome route itself.
  if (route !== WELCOME_ROUTE) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [PREFERENCES_KEY, ONBOARDED_PREFERENCES],
    );
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  try {
    const res = await page.goto(baseUrl + route, { waitUntil: 'networkidle', timeout });
    if (res && !res.ok()) errors.push(`HTTP ${res.status()}`);
    await page.waitForFunction(() => document.getElementById('root')?.childElementCount, null, {
      timeout,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SETTLE_MS);
    const file = path.join(OUT_DIR, screenshotFile(route, scheme, device));
    await page.screenshot({ path: file });
    log(`✓ ${path.relative(APP_ROOT, file)}`);

    // RN-web ScrollViews scroll inside a div, so fullPage can't see below the
    // fold. Page through the tallest scroller one viewport at a time instead.
    for (let frame = 2; frame <= MAX_SCROLL_FRAMES; frame++) {
      const moved = await page.evaluate(() => {
        const scrollers = [...document.querySelectorAll('div')].filter(
          (el) => el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible',
        );
        const el = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
        if (!el) return false;
        const before = el.scrollTop;
        el.scrollTop = before + el.clientHeight * 0.9;
        return el.scrollTop > before;
      });
      if (!moved) break;
      await page.waitForTimeout(250);
      const frameFile = path.join(OUT_DIR, screenshotFile(route, scheme, device, frame));
      await page.screenshot({ path: frameFile });
      log(`✓ ${path.relative(APP_ROOT, frameFile)}`);
    }
  } finally {
    await context.close();
  }
  return errors;
}

async function main() {
  const routes = process.env.SCREENSHOT_ROUTES
    ? process.env.SCREENSHOT_ROUTES.split(',').map((r) => r.trim())
    : discoverRoutes(path.join(APP_ROOT, 'src', 'app'));
  if (routes.length === 0) throw new Error('No static routes found in src/app.');
  const devices = process.env.SCREENSHOT_DEVICES
    ? process.env.SCREENSHOT_DEVICES.split(',').map((d) => d.trim())
    : Object.keys(DEVICES);
  const unknown = devices.filter((d) => !(d in DEVICES));
  if (unknown.length) throw new Error(`Unknown device(s): ${unknown.join(', ')}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.png')) fs.rmSync(path.join(OUT_DIR, f));
  }

  log(`starting Expo web on port ${PORT}`);
  const { baseUrl, stop } = await startExpoWeb(PORT);

  let browser;
  const failures = [];
  try {
    browser = await chromium.launch();
    let timeout = FIRST_LOAD_TIMEOUT_MS;
    for (const route of routes) {
      for (const device of devices) {
        for (const scheme of SCHEMES) {
          const errors = await capture(browser, baseUrl, route, scheme, device, timeout);
          timeout = 30_000;
          if (errors.length) {
            failures.push(`${route} (${device}, ${scheme}):\n  ${errors.join('\n  ')}`);
          }
        }
      }
    }
  } finally {
    await browser?.close();
    stop();
  }

  log(`${routes.length} route(s) × ${devices.length} device(s) × ${SCHEMES.length} schemes → ${path.relative(process.cwd(), OUT_DIR) || '.'}/`);
  if (failures.length) {
    console.error(`[screenshots] errors while rendering:\n${failures.join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[screenshots] ${err.message}`);
  if (/Executable doesn't exist/.test(err.message)) {
    console.error('[screenshots] Run `npx playwright install chromium` once, then retry.');
  }
  process.exit(1);
});
