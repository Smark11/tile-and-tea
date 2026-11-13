// Checks that tie src/web/siteMeta.ts to files on disk: the route list, the PWA
// manifest, and the install and share images in public/. (Plain JS like the
// other script tests, because the app's TypeScript has no Node types.)
const fs = require('node:fs');
const path = require('node:path');

const appJson = require('../../app.json');
const { discoverRoutes } = require('../routes');
const {
  ROUTE_META,
  SHARE_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  THEME_COLOR,
} = require('../../src/web/siteMeta');
const { palette } = require('../../src/theme/palette');

const APP_ROOT = path.join(__dirname, '..', '..');
const PUBLIC_DIR = path.join(APP_ROOT, 'public');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file) {
  const buf = fs.readFileSync(file);
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('route metadata', () => {
  const routes = discoverRoutes(path.join(APP_ROOT, 'src', 'app'));

  it('covers every screen in src/app, so no page ships without a title', () => {
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) expect(Object.keys(ROUTE_META)).toContain(route);
  });

  it('only lists routes that exist', () => {
    for (const route of Object.keys(ROUTE_META)) expect(routes).toContain(route);
  });
});

describe('web install and share assets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'manifest.webmanifest'), 'utf8'));

  it('keeps the manifest in step with the site metadata and palette', () => {
    expect(manifest.name).toBe(SITE_NAME);
    expect(manifest.short_name).toBe(SITE_NAME);
    expect(manifest.description).toBe(SITE_DESCRIPTION);
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe(THEME_COLOR);
    expect(manifest.background_color).toBe(THEME_COLOR);
    expect(THEME_COLOR).toBe(palette.jadeFelt);
    expect(appJson.expo.web.themeColor).toBe(THEME_COLOR);
  });

  it('ships every manifest icon at its declared size, including a maskable one', () => {
    for (const icon of manifest.icons) {
      const [width, height] = icon.sizes.split('x').map(Number);
      expect(pngSize(path.join(PUBLIC_DIR, icon.src))).toEqual({ width, height });
    }
    expect(manifest.icons.map((i) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('ships a 180px apple-touch-icon and the 1200×630 share image', () => {
    expect(pngSize(path.join(PUBLIC_DIR, 'icons', 'apple-touch-icon.png'))).toEqual({
      width: 180,
      height: 180,
    });
    expect(pngSize(path.join(PUBLIC_DIR, SHARE_IMAGE.path))).toEqual({
      width: SHARE_IMAGE.width,
      height: SHARE_IMAGE.height,
    });
  });
});
