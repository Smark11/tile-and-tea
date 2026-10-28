// Maps Expo Router files in src/app/ to the static URL paths the screenshot
// harness can visit. Plain CommonJS so both Node and Jest load it directly.
const fs = require('node:fs');
const path = require('node:path');

const ROUTE_EXT = /\.(tsx|ts|jsx|js)$/;
const NON_WEB_PLATFORM = /\.(ios|android|native)$/;

/**
 * Converts one route file (relative to src/app, `/`-separated) to its URL
 * path. Returns null for files that aren't screens we can capture: layouts,
 * special `+` files, API routes, tests, native-only variants and dynamic
 * segments (those need params the harness can't invent).
 * @param {string} file
 * @returns {string | null}
 */
function routeForFile(file) {
  if (!ROUTE_EXT.test(file)) return null;
  let stem = file.replace(ROUTE_EXT, '');
  if (/\.(test|spec)$/.test(stem) || NON_WEB_PLATFORM.test(stem)) return null;
  stem = stem.replace(/\.web$/, '');

  const segments = stem.split('/');
  const name = segments[segments.length - 1];
  if (name.startsWith('_') || name.startsWith('+') || name.endsWith('+api')) return null;
  if (segments.some((s) => s.startsWith('['))) return null;

  const urlSegments = segments.filter((s) => !/^\(.*\)$/.test(s));
  if (urlSegments[urlSegments.length - 1] === 'index') urlSegments.pop();
  return '/' + urlSegments.join('/');
}

/**
 * @param {string[]} files route files relative to src/app
 * @returns {string[]} unique, sorted URL paths
 */
function routesFromFiles(files) {
  const routes = new Set();
  for (const file of files) {
    const route = routeForFile(file.split(path.sep).join('/'));
    if (route) routes.add(route);
  }
  return [...routes].sort();
}

/**
 * `/` → `index`, `/dev/styleguide` → `dev-styleguide`.
 * @param {string} route
 */
function screenshotName(route) {
  return route === '/' ? 'index' : route.slice(1).replace(/\//g, '-');
}

/** @param {string} appDir absolute path to src/app */
function discoverRoutes(appDir) {
  const files = fs.readdirSync(appDir, { recursive: true, encoding: 'utf8' });
  return routesFromFiles(files);
}

module.exports = { routeForFile, routesFromFiles, screenshotName, discoverRoutes };
