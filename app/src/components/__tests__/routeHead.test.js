// Plain JS: RouteHead.web renders DOM <title>/<meta>, which only react-dom can
// render (the RN test renderer rejects text in <title>), and the app's
// TypeScript has no react-dom types.
/* global jest, describe, it, expect */
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Jest resolves the iOS variant by default, so require the web file by name.
const { RouteHead } = require('../shell/RouteHead.web');
const { RouteHead: NativeRouteHead } = require('../shell/RouteHead');

let mockPathname = '/';
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));

const renderHead = (Component) => renderToStaticMarkup(createElement(Component));

describe('RouteHead (web)', () => {
  it('renders the title, description and share tags for the current route', () => {
    mockPathname = '/train';
    const html = renderHead(RouteHead);
    expect(html).toContain('<title>Train · Tile &amp; Tea</title>');
    expect(html).toContain('<meta name="description" content="Short Mah Jongg drills');
    expect(html).toContain('<meta property="og:title" content="Train · Tile &amp; Tea"/>');
    expect(html).toContain(
      '<meta property="og:image" content="https://tile-and-tea.expo.app/og-image.png"/>',
    );
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>');
    expect(html).toContain('<link rel="canonical" href="https://tile-and-tea.expo.app/train"/>');
  });

  it('follows the path as it changes', () => {
    mockPathname = '/settings';
    const html = renderHead(RouteHead);
    expect(html).toContain('<title>Settings · Tile &amp; Tea</title>');
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
  });
});

describe('RouteHead (native)', () => {
  it('renders nothing, since apps have no document head', () => {
    expect(renderHead(NativeRouteHead)).toBe('');
  });
});
