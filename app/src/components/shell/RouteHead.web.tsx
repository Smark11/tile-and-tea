import { usePathname } from 'expo-router';

import { buildPageHead, resolveSiteUrl } from '@/web/siteMeta';

// Read once: Expo inlines EXPO_PUBLIC_* variables at build time.
const SITE_URL = resolveSiteUrl(process.env.EXPO_PUBLIC_SITE_URL);

/**
 * The page's <title>, description and link-preview tags for the current path.
 *
 * These are plain React 19 elements, which React hoists into <head> wherever
 * they render, during static export and in the browser alike. (expo-router's
 * <Head> only fills a context that SDK 58's static renderer never reads, so it
 * leaves exported pages without titles.) The root layout renders this before
 * fonts and preferences load, so every exported page carries its tags, and
 * crawlers and link unfurlers only ever read that HTML.
 */
export function RouteHead() {
  const pathname = usePathname();
  const { title, tags } = buildPageHead(pathname, SITE_URL);
  return (
    <>
      <title>{title}</title>
      {tags.map((t) => {
        if (t.tag === 'link') return <link key={`link:${t.rel}`} rel={t.rel} href={t.href} />;
        if ('property' in t) {
          return <meta key={`p:${t.property}`} property={t.property} content={t.content} />;
        }
        return <meta key={`n:${t.name}`} name={t.name} content={t.content} />;
      })}
    </>
  );
}
