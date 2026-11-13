import { DRILLS, drillPath } from '@/game/drills';
import { LESSONS, lessonPath } from '@/game/lessons';

import {
  buildPageHead,
  DEFAULT_SITE_URL,
  normalizePath,
  NOT_FOUND_META,
  pageTitle,
  resolveSiteUrl,
  robotsTxt,
  ROUTE_META,
  routeMeta,
  SHARE_IMAGE,
  SITE_NAME,
  sitemapPaths,
  sitemapXml,
  type HeadTag,
} from '../siteMeta';

// Checks against files on disk (routes, manifest, images) are in
// scripts/__tests__/web-files.test.js.

const SITE = 'https://example.com';

function content(tags: HeadTag[], key: string): string | undefined {
  const tag = tags.find(
    (t) => ('name' in t && t.name === key) || ('property' in t && t.property === key),
  );
  return tag && 'content' in tag ? tag.content : undefined;
}

describe('resolveSiteUrl', () => {
  it.each([
    [undefined, DEFAULT_SITE_URL],
    ['', DEFAULT_SITE_URL],
    ['   ', DEFAULT_SITE_URL],
    ['not a url', DEFAULT_SITE_URL],
    ['ftp://example.com', DEFAULT_SITE_URL],
    ['https://example.com', 'https://example.com'],
    ['https://example.com/', 'https://example.com'],
    [' https://example.com// ', 'https://example.com'],
    ['https://example.com/mahjong/', 'https://example.com/mahjong'],
    ['https://example.com/?utm=x#top', 'https://example.com'],
    ['http://localhost:4173', 'http://localhost:4173'],
  ])('%p → %p', (input, expected) => {
    expect(resolveSiteUrl(input)).toBe(expected);
  });
});

describe('normalizePath', () => {
  it.each([
    ['/', '/'],
    ['', '/'],
    ['/train/', '/train'],
    ['train', '/train'],
    ['/train?utm_source=x', '/train'],
    ['/play#rules', '/play'],
    ['/dev/styleguide/', '/dev/styleguide'],
  ])('%p → %p', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe('route metadata', () => {
  it('gives each page a distinct title and description that fit in search results', () => {
    const metas = Object.values(ROUTE_META);
    expect(new Set(metas.map(pageTitle)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.description)).size).toBe(metas.length);
    for (const meta of metas) {
      expect(pageTitle(meta).length).toBeLessThanOrEqual(60);
      expect(meta.description.length).toBeGreaterThanOrEqual(30);
      expect(meta.description.length).toBeLessThanOrEqual(160);
    }
  });

  it('keeps settings and developer pages out of search', () => {
    expect(ROUTE_META['/settings'].indexed).toBe(false);
    expect(ROUTE_META['/dev/styleguide'].indexed).toBe(false);
    expect(ROUTE_META['/dev/share-card'].indexed).toBe(false);
  });

  it('falls back to the not-found page for unknown paths', () => {
    expect(routeMeta('/nope')).toBe(NOT_FOUND_META);
    expect(routeMeta('/train/')).toBe(ROUTE_META['/train']);
  });

  it('titles the home page with the tagline and other pages with the site name', () => {
    expect(pageTitle(ROUTE_META['/'])).toBe('Tile & Tea · Learn American Mah Jongg');
    expect(pageTitle(ROUTE_META['/train'])).toBe('Train · Tile & Tea');
  });
});

describe('buildPageHead', () => {
  it('builds absolute Open Graph and Twitter tags for a public page', () => {
    const { title, tags } = buildPageHead('/train', SITE);
    expect(title).toBe('Train · Tile & Tea');
    expect(content(tags, 'description')).toBe(ROUTE_META['/train'].description);
    expect(content(tags, 'robots')).toBe('index, follow');
    expect(content(tags, 'og:title')).toBe(title);
    expect(content(tags, 'og:description')).toBe(ROUTE_META['/train'].description);
    expect(content(tags, 'og:url')).toBe('https://example.com/train');
    expect(content(tags, 'og:site_name')).toBe(SITE_NAME);
    expect(content(tags, 'og:type')).toBe('website');
    expect(content(tags, 'og:image')).toBe('https://example.com/og-image.png');
    expect(content(tags, 'og:image:width')).toBe('1200');
    expect(content(tags, 'og:image:height')).toBe('630');
    expect(content(tags, 'og:image:alt')).toBe(SHARE_IMAGE.alt);
    expect(content(tags, 'twitter:card')).toBe('summary_large_image');
    expect(content(tags, 'twitter:title')).toBe(title);
    expect(content(tags, 'twitter:image')).toBe('https://example.com/og-image.png');
    expect(tags).toContainEqual({ tag: 'link', rel: 'canonical', href: 'https://example.com/train' });
  });

  it('points the home page at the bare origin with a trailing slash', () => {
    const { tags } = buildPageHead('/', SITE);
    expect(content(tags, 'og:url')).toBe('https://example.com/');
  });

  it('canonicalizes trailing slashes and query strings', () => {
    const { tags } = buildPageHead('/play/?utm_source=mail', SITE);
    expect(tags).toContainEqual({ tag: 'link', rel: 'canonical', href: 'https://example.com/play' });
  });

  it('marks private pages noindex', () => {
    expect(content(buildPageHead('/settings', SITE).tags, 'robots')).toBe('noindex, follow');
  });

  it('gives unknown paths a noindex not-found head with no canonical URL', () => {
    const { title, tags } = buildPageHead('/no-such-page', SITE);
    expect(title).toBe('Page not found · Tile & Tea');
    expect(content(tags, 'robots')).toBe('noindex, follow');
    expect(content(tags, 'og:url')).toBeUndefined();
    expect(tags.some((t) => t.tag === 'link')).toBe(false);
  });

  it('never repeats a tag', () => {
    const keys = buildPageHead('/', SITE).tags.map((t) =>
      t.tag === 'link' ? t.rel : 'name' in t ? t.name : t.property,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('sitemap and robots', () => {
  it('lists exactly the indexed pages', () => {
    expect(sitemapPaths()).toEqual(['/', '/play', '/privacy', '/progress', '/train', '/welcome']);
  });

  it('writes a valid sitemap with absolute URLs', () => {
    const xml = sitemapXml(SITE);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<url><loc>https://example.com/</loc></url>');
    expect(xml).toContain('<url><loc>https://example.com/train</loc></url>');
    expect(xml).not.toContain('settings');
    expect(xml).not.toContain('/dev/');
  });

  it('escapes XML special characters in URLs', () => {
    expect(sitemapXml('https://example.com/a&b')).toContain('https://example.com/a&amp;b/train');
  });

  it('allows everything but developer pages and points to the sitemap', () => {
    expect(robotsTxt(SITE)).toBe(
      'User-agent: *\nAllow: /\nDisallow: /dev/\n\nSitemap: https://example.com/sitemap.xml\n',
    );
  });
});

describe('drill pages', () => {
  const drillRoutes = Object.keys(ROUTE_META).filter((route) => route.startsWith('/drill/'));

  it('lists exactly one unindexed page per drill, titled with the drill name', () => {
    expect(drillRoutes.sort()).toEqual(DRILLS.map((d) => drillPath(d.id)).sort());
    for (const drill of DRILLS) {
      expect(ROUTE_META[drillPath(drill.id)]).toMatchObject({ title: drill.title, indexed: false });
    }
  });
});

describe('lesson pages', () => {
  // Checked here because siteMeta.ts can't import the catalog (Node runs it bare).
  const lessonRoutes = Object.keys(ROUTE_META).filter((route) => route.startsWith('/lesson/'));

  it('lists exactly one page per lesson, titled with the lesson name', () => {
    expect(lessonRoutes.sort()).toEqual(LESSONS.map((l) => lessonPath(l.id)).sort());
    for (const lesson of LESSONS) expect(ROUTE_META[lessonPath(lesson.id)].title).toBe(lesson.title);
  });

  it('keeps lessons out of search while they sit behind the welcome tour', () => {
    for (const route of lessonRoutes) expect(ROUTE_META[route].indexed).toBe(false);
  });
});
