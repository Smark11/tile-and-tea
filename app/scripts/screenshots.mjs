// npm run screenshots
// Starts Expo web, then captures every static route at iPhone 15 size
// (393×852 @3x) in light and dark mode into screenshots/ (gitignored).
//   SCREENSHOT_PORT=8099  dev server port (must be free)
//   SCREENSHOT_ROUTES=/,/dev/styleguide  capture only these routes
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { discoverRoutes, screenshotName } = require('./routes.js');

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(APP_ROOT, 'screenshots');
const PORT = Number(process.env.SCREENSHOT_PORT ?? 8099);
const BASE_URL = `http://localhost:${PORT}`;
const VIEWPORT = { width: 393, height: 852 };
const SCHEMES = /** @type {const} */ (['light', 'dark']);
const SERVER_TIMEOUT_MS = 120_000;
const FIRST_LOAD_TIMEOUT_MS = 180_000; // first request triggers the web bundle build
const SETTLE_MS = 1_000; // let entrance springs finish before capturing

function log(msg) {
  console.log(`[screenshots] ${msg}`);
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });
}

function startServer() {
  const server = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
    cwd: APP_ROOT,
    env: { ...process.env, CI: '1', BROWSER: 'none', EXPO_NO_TELEMETRY: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // own process group so we can stop Metro and its workers together
  });
  let output = '';
  const collect = (chunk) => {
    output = (output + chunk).slice(-8_000);
  };
  server.stdout.on('data', collect);
  server.stderr.on('data', collect);
  return { server, output: () => output };
}

function stopServer(server) {
  if (server.exitCode !== null) return;
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

async function waitForServer(server, output) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Expo exited early (code ${server.exitCode}):\n${output()}`);
    }
    try {
      const res = await fetch(`${BASE_URL}/status`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Expo web didn't start within ${SERVER_TIMEOUT_MS / 1000}s:\n${output()}`);
}

async function capture(browser, route, scheme, timeout) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  try {
    const res = await page.goto(BASE_URL + route, { waitUntil: 'networkidle', timeout });
    if (res && !res.ok()) errors.push(`HTTP ${res.status()}`);
    await page.waitForFunction(() => document.getElementById('root')?.childElementCount, null, {
      timeout,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SETTLE_MS);
    const file = path.join(OUT_DIR, `${screenshotName(route)}-${scheme}.png`);
    await page.screenshot({ path: file });
    log(`✓ ${path.relative(APP_ROOT, file)}`);
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
  if (await portInUse(PORT)) {
    throw new Error(`Port ${PORT} is busy. Stop that process or set SCREENSHOT_PORT.`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.png')) fs.rmSync(path.join(OUT_DIR, f));
  }

  log(`starting Expo web on ${BASE_URL}`);
  const { server, output } = startServer();
  const onSignal = () => {
    stopServer(server);
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  let browser;
  const failures = [];
  try {
    await waitForServer(server, output);
    browser = await chromium.launch();
    let timeout = FIRST_LOAD_TIMEOUT_MS;
    for (const route of routes) {
      for (const scheme of SCHEMES) {
        const errors = await capture(browser, route, scheme, timeout);
        timeout = 30_000;
        if (errors.length) failures.push(`${route} (${scheme}):\n  ${errors.join('\n  ')}`);
      }
    }
  } finally {
    await browser?.close();
    stopServer(server);
  }

  log(`${routes.length} route(s) × ${SCHEMES.length} schemes → ${path.relative(process.cwd(), OUT_DIR) || '.'}/`);
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
