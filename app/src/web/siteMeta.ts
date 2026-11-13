// What the web app tells browsers, search engines and link previews about
// each page: titles, descriptions, Open Graph/Twitter tags, robots rules and
// the sitemap. It's the single source for <RouteHead> in the app and for
// scripts/write-web-files.mjs, which writes robots.txt and sitemap.xml after
// export. Node runs this file directly, so keep it self-contained: no imports,
// only erasable TypeScript. brand.test.ts keeps the colors in step with the palette.

export const SITE_NAME = 'Tile & Tea';
export const SITE_TAGLINE = 'Learn American Mah Jongg';
export const SITE_DESCRIPTION =
  'Learn American Mah Jongg at your own pace with gentle lessons, friendly practice drills and a patient coach. Beautiful tiles, clear explanations, no pressure.';

/** Felt jade: browser chrome, PWA splash and the share image backdrop. */
export const THEME_COLOR = '#0F3D33';

/**
 * Where the site lives when nobody sets EXPO_PUBLIC_SITE_URL: the EAS Hosting
 * address for this app's slug. Link previews need absolute URLs, so set the
 * variable when deploying to any other domain.
 */
export const DEFAULT_SITE_URL = 'https://tile-and-tea.expo.app';

/** The share image in public/, rendered by `npm run brand:share`. */
export const SHARE_IMAGE = {
  path: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Mah Jongg tiles fanned across green felt beside the words Tile & Tea, Learn American Mah Jongg.',
} as const;

export type RouteMeta = {
  /** Page title without the site name. Omit to use the site name alone. */
  title?: string;
  description: string;
  /** Listed in the sitemap and open to search engines. */
  indexed: boolean;
};

/**
 * Every web route. Unlisted paths (like a mistyped link) get NOT_FOUND_META,
 * and a test fails if a new screen in src/app/ is missing here.
 */
export const ROUTE_META: Readonly<Record<string, RouteMeta>> = {
  '/': {
    description: SITE_DESCRIPTION,
    indexed: true,
  },
  '/train': {
    title: 'Train',
    description:
      'Short Mah Jongg drills for the decisions that matter: which hand to play, what to pass in the Charleston, and what to discard.',
    indexed: true,
  },
  '/play': {
    title: 'Play',
    description:
      'Play American Mah Jongg against friendly computer opponents, from a gentle beginner table to a sharp club game.',
    indexed: true,
  },
  '/progress': {
    title: 'Progress',
    description:
      'See your Mah Jongg skills grow, with ratings for each skill, your practice streak and the games you have played.',
    indexed: true,
  },
  '/welcome': {
    title: 'Welcome',
    description:
      'Meet Tile & Tea: a calm, beautiful way to learn American Mah Jongg, one small step at a time.',
    indexed: true,
  },
  '/privacy': {
    title: 'Privacy',
    description:
      'How Tile & Tea counts visits without cookies, what it never collects, and how Do Not Track turns counting off.',
    indexed: true,
  },
  // One page per lesson (src/app/lesson/[id].tsx). Lessons sit behind the
  // welcome tour, so they stay out of search until M6.2's landing page.
  // siteMeta.test.ts checks this list against the lesson catalog.
  '/lesson/meet-the-tiles': {
    title: 'Meet the tiles',
    description:
      'A hands-on first lesson: the three suits, the Winds and Dragons, Flowers, and Jokers in an American Mah Jongg set.',
    indexed: false,
  },
  '/lesson/groups': {
    title: 'Pungs, kongs, quints & pairs',
    description:
      'Learn the groups every American Mah Jongg hand is built from: singles, pairs, pungs, kongs, and quints, and where Jokers fit.',
    indexed: false,
  },
  '/lesson/reading-a-card': {
    title: 'Reading a card',
    description:
      'How a line on a Mah Jongg card describes a hand: groups, suit colors, Dragon partners, and what X, C, and the value mean.',
    indexed: false,
  },
  '/lesson/jokers': {
    title: 'Jokers',
    description:
      'Where a Joker can stand in, why it never joins a single or a pair, and how to swap one back from an exposure.',
    indexed: false,
  },
  '/lesson/charleston': {
    title: 'The Charleston',
    description:
      'The passes before the first discard: right, across, left, the optional second Charleston, blind passes, and the courtesy pass.',
    indexed: false,
  },
  // One page per drill (src/app/drill/[id].tsx), behind the welcome tour like
  // the lessons. siteMeta.test.ts checks this list against the drill catalog.
  '/drill/name-the-hand': {
    title: 'Name that hand',
    description:
      'A quick card-reading drill: a finished American Mah Jongg hand is on the table, so find its line on the practice card.',
    indexed: false,
  },
  '/drill/best-hand': {
    title: 'Best hand',
    description:
      'A hand-choice drill: read a 13-tile American Mah Jongg rack against the practice card and pick the hand to go for.',
    indexed: false,
  },
  // Behind the welcome tour like the lessons, so out of search until M6.2.
  '/card': {
    title: '2027 Practice Card',
    description:
      'Forty original American Mah Jongg hands to practice with: year hands, 2468, like numbers, runs, quints, winds and dragons, and more.',
    indexed: false,
  },
  '/settings': {
    title: 'Settings',
    description: 'Adjust haptics and replay the welcome tour.',
    indexed: false,
  },
  '/dev/styleguide': {
    title: 'Styleguide',
    description: 'Design tokens and components, for development only.',
    indexed: false,
  },
  '/dev/share-card': {
    title: 'Share card',
    description: 'The link-preview image, for development only.',
    indexed: false,
  },
};

export const NOT_FOUND_META: RouteMeta = {
  title: 'Page not found',
  description: 'That page isn’t on the table. Head back to Tile & Tea to keep learning.',
  indexed: false,
};

/** Paths kept out of search engines entirely (robots.txt Disallow). */
export const DISALLOWED_PREFIXES = ['/dev/'] as const;

/**
 * The site origin with no trailing slash. Falls back to DEFAULT_SITE_URL when
 * the value is missing or isn't an absolute http(s) URL.
 */
export function resolveSiteUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_SITE_URL;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_SITE_URL;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** Trailing slashes and query strings don't make a different page. */
export function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '');
  return path.startsWith('/') ? path || '/' : `/${path}`;
}

export function routeMeta(pathname: string): RouteMeta {
  return ROUTE_META[normalizePath(pathname)] ?? NOT_FOUND_META;
}

export function pageTitle(meta: RouteMeta): string {
  return meta.title ? `${meta.title} · ${SITE_NAME}` : `${SITE_NAME} · ${SITE_TAGLINE}`;
}

export type HeadTag =
  | { tag: 'meta'; name: string; content: string }
  | { tag: 'meta'; property: string; content: string }
  | { tag: 'link'; rel: string; href: string };

export type PageHead = { title: string; tags: HeadTag[] };

/** The <title> and every tag a page's <head> needs for search and sharing. */
export function buildPageHead(pathname: string, siteUrl: string): PageHead {
  const meta = routeMeta(pathname);
  const known = normalizePath(pathname) in ROUTE_META;
  const title = pageTitle(meta);
  const url = siteUrl + (normalizePath(pathname) === '/' ? '/' : normalizePath(pathname));
  const image = siteUrl + SHARE_IMAGE.path;
  const tags: HeadTag[] = [
    { tag: 'meta', name: 'description', content: meta.description },
    { tag: 'meta', name: 'robots', content: meta.indexed ? 'index, follow' : 'noindex, follow' },
    { tag: 'meta', property: 'og:type', content: 'website' },
    { tag: 'meta', property: 'og:site_name', content: SITE_NAME },
    { tag: 'meta', property: 'og:locale', content: 'en_US' },
    { tag: 'meta', property: 'og:title', content: title },
    { tag: 'meta', property: 'og:description', content: meta.description },
    { tag: 'meta', property: 'og:image', content: image },
    { tag: 'meta', property: 'og:image:type', content: 'image/png' },
    { tag: 'meta', property: 'og:image:width', content: String(SHARE_IMAGE.width) },
    { tag: 'meta', property: 'og:image:height', content: String(SHARE_IMAGE.height) },
    { tag: 'meta', property: 'og:image:alt', content: SHARE_IMAGE.alt },
    { tag: 'meta', name: 'twitter:card', content: 'summary_large_image' },
    { tag: 'meta', name: 'twitter:title', content: title },
    { tag: 'meta', name: 'twitter:description', content: meta.description },
    { tag: 'meta', name: 'twitter:image', content: image },
    { tag: 'meta', name: 'twitter:image:alt', content: SHARE_IMAGE.alt },
  ];
  // A missing page has no address of its own to advertise.
  if (known) {
    tags.push(
      { tag: 'meta', property: 'og:url', content: url },
      { tag: 'link', rel: 'canonical', href: url },
    );
  }
  return { title, tags };
}

/** Indexed paths, in a stable order. */
export function sitemapPaths(): string[] {
  return Object.entries(ROUTE_META)
    .filter(([, meta]) => meta.indexed)
    .map(([path]) => path)
    .sort();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sitemapXml(siteUrl: string): string {
  const urls = sitemapPaths()
    .map((path) => `  <url><loc>${escapeXml(siteUrl + path)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function robotsTxt(siteUrl: string): string {
  const disallow = DISALLOWED_PREFIXES.map((p) => `Disallow: ${p}`).join('\n');
  return `User-agent: *
Allow: /
${disallow}

Sitemap: ${siteUrl}/sitemap.xml
`;
}
