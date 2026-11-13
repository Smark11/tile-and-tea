import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { webStageCss } from '@/components/shell/webStage';
import { SITE_NAME, THEME_COLOR } from '@/web/siteMeta';

/**
 * The HTML document for every statically exported web page. It only runs in
 * Node at export time, so it can't use browser APIs or app state. The stage
 * (felt backdrop and centered column) is plain CSS for that reason: it's
 * correct on first paint, before any JavaScript loads or hydrates.
 *
 * `headNodes`/`bodyNodes` carry Expo's favicon, styles, fonts and the JS
 * bundles. Leaving them out exports a page that never boots.
 */
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta name="color-scheme" content="light dark" />
        {/* Install to the home screen: the manifest covers Chrome/Android and
            desktop; iOS Safari reads the apple-* tags and touch icon. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <meta name="application-name" content={SITE_NAME} />
        <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <ScrollViewStyleReset />
        <style id="tile-and-tea-stage" dangerouslySetInnerHTML={{ __html: webStageCss }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
