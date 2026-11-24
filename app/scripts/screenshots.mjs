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
import { ROUTE_META } from '../src/web/siteMeta.ts';

const require = createRequire(import.meta.url);
const { DEVICES, discoverDynamicPatterns, discoverRoutes, matchesPattern, screenshotFile } = require('./routes.js');

const OUT_DIR = path.join(APP_ROOT, 'screenshots');
const PORT = Number(process.env.SCREENSHOT_PORT ?? 8099);
const SCHEMES = /** @type {const} */ (['light', 'dark']);
const FIRST_LOAD_TIMEOUT_MS = 180_000; // first request triggers the web bundle build
const SETTLE_MS = 1_000; // let entrance springs finish before capturing
const MAX_SCROLL_FRAMES = 44; // extra below-the-fold captures per long screen (the styleguide is the longest)
const WELCOME_ROUTE = '/welcome';
/** The saved-game store's key (src/state/savedGame.ts) and a mid-game save for the resume states. */
const SAVED_GAME_KEY = 'mjc.game';
const SAVED_GAME_FIXTURE = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'scripts', 'fixtures', 'saved-game.json'), 'utf8'));
/** Saved scenario and skill progress, one save per store key, for the mastered playbook (pinned in playbook.test.ts). */
const PLAYBOOK_PROGRESS = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'scripts', 'fixtures', 'playbook-progress.json'), 'utf8'));
/** Every scenario played, Discards rated lowest with a scenario last finished short of best (pinned in nextMove.test.ts). */
const NEXT_MOVE_PROGRESS = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'scripts', 'fixtures', 'next-move-progress.json'), 'utf8'));

/**
 * Screens whose answered state needs its own capture. The route loads with a
 * fixed seed, the frames above are taken unanswered, then the script taps the
 * picks and Check and pages through the result as the following frames.
 * charleston.test.ts pins this fixture: a miss that shares one tile with the
 * coach's pass, on a rack with a Joker. discards.test.ts pins its fixture: a
 * throw that keeps the hand but could be called by the exposed player.
 */
const ANSWERED = {
  '/drill/charleston': { seed: 2, picks: [0, 1, 2] },
  '/drill/discards': { seed: 2, picks: [0] },
};

/**
 * Extra states of a screen, each captured as its own file (route + `-name`).
 * The game table opens on the Charleston, so the mid-game tables come from
 * `?demo=` (src/game/table/demo.ts): East to discard with a tile picked, a
 * discard still open to a call, and West's turn.
 */
const STATES = {
  // `storage`: seed these saves first. Two principles mastered (C1, C3), others half done.
  '/playbook': [{ name: 'progress', query: '', storage: PLAYBOOK_PROGRESS, ready: 'playbook-mastered' }],
  '/progress': [{ name: 'playbook', query: '', storage: PLAYBOOK_PROGRESS, ready: 'playbook-link-progress' }],
  // "Your next move" with saved progress: an unplayed scenario on the lowest skill, then a replay once all are played.
  '/train': [
    { name: 'next-scenario', query: '', storage: PLAYBOOK_PROGRESS, ready: 'next-move' },
    { name: 'next-replay', query: '', storage: NEXT_MOVE_PROGRESS, ready: 'next-move' },
  ],
  // `saved`: seed the fixture save first (scripts/fixtures/saved-game.json, pinned in saved.test.ts).
  '/play': [{ name: 'resume', query: '', saved: true, ready: 'play-resume' }],
  // A scenario opens on its scene; `?step=` opens the move, or the strategy with the taught move made.
  '/scenario/pass-what-touches-nothing': [
    { name: 'move', query: 'step=move', ready: 'scenario-move' },
    { name: 'strategy', query: 'step=strategy', ready: 'scenario-strategy' },
  ],
  '/scenario/call-the-kong': [
    { name: 'move', query: 'step=move', ready: 'scenario-move' },
    { name: 'strategy', query: 'step=strategy', ready: 'scenario-strategy' },
  ],
  '/scenario/swap-the-spare': [{ name: 'move', query: 'step=move', ready: 'scenario-move' }],
  '/scenario/count-whats-gone': [
    { name: 'move', query: 'step=move', ready: 'scenario-move' },
    { name: 'strategy', query: 'step=strategy', ready: 'scenario-strategy' },
  ],
  '/game': [
    { name: 'play-resumed', query: '', saved: true },
    { name: 'play-yours', query: 'demo=yours', tap: '[data-testid^="table-rack-tile-"]:not([aria-label*="Joker"])', waitFor: 'table-discard' },
    { name: 'play-open', query: 'demo=open' },
    { name: 'play-theirs', query: 'demo=theirs' },
    { name: 'play-call', query: 'demo=call', waitFor: 'table-call-actions' },
    { name: 'play-swap', query: 'demo=swap', waitFor: 'table-swaps' },
  ],
};

/** Pages through the tallest scroller from the top, capturing frames from `first` on; returns the next frame number. */
async function captureScrollFrames(page, route, scheme, device, first) {
  let frame = first;
  for (; frame <= MAX_SCROLL_FRAMES; frame++) {
    // RN-web ScrollViews scroll inside a div, so fullPage can't see below the
    // fold. Page through the tallest scroller one viewport at a time instead.
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
  return frame;
}

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
  const answered = ANSWERED[route];
  const url = baseUrl + route + (answered ? `?seed=${answered.seed}` : '');
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout });
    if (res && !res.ok()) errors.push(`HTTP ${res.status()}`);
    await page.waitForFunction(() => document.getElementById('root')?.childElementCount, null, {
      timeout,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SETTLE_MS);
    const file = path.join(OUT_DIR, screenshotFile(route, scheme, device));
    await page.screenshot({ path: file });
    log(`✓ ${path.relative(APP_ROOT, file)}`);

    const next = await captureScrollFrames(page, route, scheme, device, 2);

    if (answered) {
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('div')) el.scrollTop = 0;
      });
      for (const i of answered.picks) await page.getByTestId(`drill-choice-${i}`).click();
      // A one-pick question answers on the tap; more picks need Check.
      if (answered.picks.length > 1) await page.getByTestId('drill-primary').click();
      await page.getByTestId('drill-tile-key').waitFor({ timeout });
      await page.waitForTimeout(SETTLE_MS);
      // The player scrolls to the feedback after Check; start from the top so
      // the frames show the whole felt (the picks and stars) before the feedback.
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('div')) el.scrollTop = 0;
      });
      await page.waitForTimeout(250);
      const file = path.join(OUT_DIR, screenshotFile(route, scheme, device, next));
      await page.screenshot({ path: file });
      log(`✓ ${path.relative(APP_ROOT, file)} (answered)`);
      await captureScrollFrames(page, route, scheme, device, next + 1);
    }

    let seeded = false;
    for (const state of STATES[route] ?? []) {
      if (state.saved && !seeded) {
        // Every later load in this context starts from the fixture save, made "4 minutes ago".
        await context.addInitScript(
          ([key, game]) =>
            window.localStorage.setItem(
              key,
              JSON.stringify({ state: { game: { ...game, savedAt: Date.now() - 4 * 60_000 } }, version: 1 }),
            ),
          [SAVED_GAME_KEY, SAVED_GAME_FIXTURE],
        );
        seeded = true;
      }
      if (state.storage) {
        await context.addInitScript((entries) => {
          for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, JSON.stringify(value));
        }, state.storage);
      }
      await page.goto(`${baseUrl}${route}${state.query ? `?${state.query}` : ''}`, { waitUntil: 'networkidle', timeout });
      await page.getByTestId(state.ready ?? 'table-prompt').first().waitFor({ timeout });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(SETTLE_MS);
      if (state.tap) {
        await page.locator(state.tap).last().click();
        if (state.waitFor) await page.getByTestId(state.waitFor).waitFor({ timeout });
        await page.waitForTimeout(SETTLE_MS);
      }
      const stateRoute = `${route}-${state.name}`;
      const file = path.join(OUT_DIR, screenshotFile(stateRoute, scheme, device));
      await page.screenshot({ path: file });
      log(`✓ ${path.relative(APP_ROOT, file)}`);
      await captureScrollFrames(page, stateRoute, scheme, device, 2);
    }
  } finally {
    await context.close();
  }
  return errors;
}

async function main() {
  const appDir = path.join(APP_ROOT, 'src', 'app');
  // Dynamic screens (like /lesson/[id]) are captured through the pages
  // siteMeta lists for them.
  const patterns = discoverDynamicPatterns(appDir);
  const dynamicPages = Object.keys(ROUTE_META).filter((route) =>
    patterns.some((p) => matchesPattern(route, p)),
  );
  const routes = process.env.SCREENSHOT_ROUTES
    ? process.env.SCREENSHOT_ROUTES.split(',').map((r) => r.trim())
    : [...discoverRoutes(appDir), ...dynamicPages];
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
