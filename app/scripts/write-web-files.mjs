// Runs after `expo export` (see `npm run build:web`). Writes dist/robots.txt
// and dist/sitemap.xml from the route list in src/web/siteMeta.ts, so they
// can't drift from the page tags. Absolute URLs use EXPO_PUBLIC_SITE_URL,
// read from the environment or .env files in the same order Expo reads them.
import fs from 'node:fs';
import path from 'node:path';

import { APP_ROOT } from './expo-web.mjs';
import { manifestForBasePath, resolveSiteUrl, robotsTxt, sitemapXml } from '../src/web/siteMeta.ts';

const DIST = path.join(APP_ROOT, 'dist');

// Highest priority first; loadEnvFile never overwrites a variable that's already set.
for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  const p = path.join(APP_ROOT, file);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}
const siteUrl = resolveSiteUrl(process.env.EXPO_PUBLIC_SITE_URL);

const home = path.join(DIST, 'index.html');
if (!fs.existsSync(home)) {
  console.error('[web-files] dist/index.html not found. Run `expo export --platform web` first.');
  process.exit(1);
}
// The app baked its own site URL into each page's canonical tag. If the two
// disagree, the sitemap would point somewhere the pages don't.
const canonical = fs.readFileSync(home, 'utf8').match(/<link rel="canonical" href="([^"]+)"/)?.[1];
if (canonical !== `${siteUrl}/`) {
  console.error(
    `[web-files] dist/index.html is canonical to ${canonical ?? '(none)'}, but the site URL is ${siteUrl}/. ` +
      'Set EXPO_PUBLIC_SITE_URL the same way for both steps.',
  );
  process.exit(1);
}

fs.writeFileSync(path.join(DIST, 'robots.txt'), robotsTxt(siteUrl));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapXml(siteUrl));
console.log(`[web-files] ✓ dist/robots.txt and dist/sitemap.xml for ${siteUrl}`);

// Plain static hosts (GitHub Pages) need three more things:
// 1. `.nojekyll`: Pages runs Jekyll by default, and Jekyll drops folders that
//    start with an underscore, which is where Expo writes its bundles (_expo/).
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
// 2. `404.html`: with no rewrite rules, Pages serves it for any path that has
//    no file. Expo's not-found page carries the whole app, so a deep link to a
//    dynamic route still boots the router and renders the right screen.
const notFound = path.join(DIST, '+not-found.html');
if (!fs.existsSync(notFound)) {
  console.error('[web-files] dist/+not-found.html not found; 404.html not written.');
  process.exit(1);
}
fs.copyFileSync(notFound, path.join(DIST, '404.html'));
// 3. The manifest's paths get the base path when the site lives in a sub-folder
//    (EXPO_PUBLIC_BASE_PATH, see app.config.js). The HTML pages already carry it.
const basePath = (process.env.EXPO_PUBLIC_BASE_PATH ?? '').trim().replace(/\/+$/, '');
if (basePath) {
  const manifestFile = path.join(DIST, 'manifest.webmanifest');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  fs.writeFileSync(manifestFile, JSON.stringify(manifestForBasePath(manifest, basePath), null, 2) + '\n');
}
console.log(`[web-files] ✓ dist/.nojekyll, dist/404.html${basePath ? `, manifest under ${basePath}` : ''}`);
