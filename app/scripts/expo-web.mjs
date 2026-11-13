// Starts and stops `expo start --web` for scripts that drive the app in a
// browser (screenshots, share image). Metro runs in its own process group so
// stopping it also stops its workers.
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_TIMEOUT_MS = 120_000;

/** Must match PREFERENCES_STORAGE_KEY and the persist version in src/state/preferences.ts. */
export const PREFERENCES_KEY = 'mjc.preferences';
export const ONBOARDED_PREFERENCES = JSON.stringify({ state: { onboarded: true }, version: 1 });

export function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });
}

function stopServer(server) {
  if (server.exitCode !== null) return;
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

async function waitForServer(server, baseUrl, output) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Expo exited early (code ${server.exitCode}):\n${output()}`);
    }
    try {
      const res = await fetch(`${baseUrl}/status`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Expo web didn't start within ${SERVER_TIMEOUT_MS / 1000}s:\n${output()}`);
}

/**
 * Starts Expo web on `port` and waits until it answers. Returns its base URL
 * and a `stop()` that's safe to call more than once. Ctrl-C stops Metro too.
 * @param {number} port
 */
export async function startExpoWeb(port) {
  if (await portInUse(port)) {
    throw new Error(`Port ${port} is busy. Stop that process or pick another port.`);
  }
  const baseUrl = `http://localhost:${port}`;
  const server = spawn('npx', ['expo', 'start', '--web', '--port', String(port)], {
    cwd: APP_ROOT,
    env: { ...process.env, CI: '1', BROWSER: 'none', EXPO_NO_TELEMETRY: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let output = '';
  const collect = (chunk) => {
    output = (output + chunk).slice(-8_000);
  };
  server.stdout.on('data', collect);
  server.stderr.on('data', collect);

  const stop = () => stopServer(server);
  const onSignal = () => {
    stop();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    await waitForServer(server, baseUrl, () => output);
  } catch (err) {
    stop();
    throw err;
  }
  return { baseUrl, stop };
}
