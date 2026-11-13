// npm run serve:web  (after npm run build:web)
// Serves dist/ the way static hosts do (EAS Hosting, Netlify, Cloudflare
// Pages): clean URLs (/train → train.html, /dev/styleguide → dev/styleguide.html),
// index.html for directories, and +not-found.html with a 404 for anything
// else. No dependencies, for local checks only and not for production.
//   PORT=4173  port to listen on
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Resolves a URL path to a file in dist/, or null. Never escapes dist/. */
function resolveFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const base = path.join(DIST, clean);
  if (!base.startsWith(DIST)) return null;
  for (const candidate of [base, `${base}.html`, path.join(base, 'index.html')]) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

if (!fs.existsSync(DIST)) {
  console.error('[serve] dist/ not found. Run `npm run build:web` first.');
  process.exit(1);
}

http
  .createServer((req, res) => {
    const file = resolveFile(req.url ?? '/');
    const target = file ?? path.join(DIST, '+not-found.html');
    res.writeHead(file ? 200 : 404, {
      'Content-Type': TYPES[path.extname(target)] ?? 'application/octet-stream',
    });
    fs.createReadStream(target).pipe(res);
  })
  .listen(PORT, () => console.log(`[serve] dist/ on http://localhost:${PORT}`));
