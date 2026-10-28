const path = require('node:path');
const { routeForFile, routesFromFiles, screenshotName, discoverRoutes } = require('../routes');

describe('routeForFile', () => {
  it.each([
    ['index.tsx', '/'],
    ['settings.tsx', '/settings'],
    ['dev/styleguide.tsx', '/dev/styleguide'],
    ['learn/index.tsx', '/learn'],
    ['(tabs)/index.tsx', '/'],
    ['(tabs)/train.tsx', '/train'],
    ['(tabs)/(inner)/play/index.tsx', '/play'],
    ['about.web.tsx', '/about'],
    ['legacy.js', '/legacy'],
  ])('%s → %s', (file, route) => {
    expect(routeForFile(file)).toBe(route);
  });

  it.each([
    '_layout.tsx',
    '(tabs)/_layout.tsx',
    '+html.tsx',
    '+not-found.tsx',
    'api/hello+api.ts',
    'lesson/[id].tsx',
    '[...rest].tsx',
    'game/[id]/review.tsx',
    'about.ios.tsx',
    'about.android.tsx',
    'about.native.tsx',
    'home.test.tsx',
    'home.spec.ts',
    'README.md',
    'dev',
  ])('skips %s', (file) => {
    expect(routeForFile(file)).toBeNull();
  });
});

describe('routesFromFiles', () => {
  it('dedupes groups and platform variants and sorts the result', () => {
    expect(
      routesFromFiles([
        'index.tsx',
        '(tabs)/index.tsx',
        'about.tsx',
        'about.web.tsx',
        'about.ios.tsx',
        '_layout.tsx',
        'dev/styleguide.tsx',
      ]),
    ).toEqual(['/', '/about', '/dev/styleguide']);
  });

  it('accepts OS-native path separators', () => {
    expect(routesFromFiles([['dev', 'styleguide.tsx'].join(path.sep)])).toEqual([
      '/dev/styleguide',
    ]);
  });
});

describe('screenshotName', () => {
  it('names the root index and flattens nested paths', () => {
    expect(screenshotName('/')).toBe('index');
    expect(screenshotName('/learn')).toBe('learn');
    expect(screenshotName('/dev/styleguide')).toBe('dev-styleguide');
  });
});

describe('discoverRoutes', () => {
  it('finds the real app routes', () => {
    expect(discoverRoutes(path.join(__dirname, '..', '..', 'src', 'app'))).toContain('/');
  });
});
