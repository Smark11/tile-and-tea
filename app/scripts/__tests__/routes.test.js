const path = require('node:path');
const {
  DEVICES,
  routeForFile,
  routesFromFiles,
  screenshotName,
  screenshotFile,
  discoverRoutes,
  dynamicPatternForFile,
  discoverDynamicPatterns,
  matchesPattern,
} = require('../routes');

describe('screenshotFile', () => {
  it('keeps phone names, and marks desktop captures and scroll frames', () => {
    expect(screenshotFile('/', 'light', 'phone')).toBe('index-light.png');
    expect(screenshotFile('/train', 'dark', 'phone', 3)).toBe('train-dark-3.png');
    expect(screenshotFile('/', 'light', 'desktop')).toBe('index-light-desktop.png');
    expect(screenshotFile('/dev/styleguide', 'dark', 'desktop', 2)).toBe(
      'dev-styleguide-dark-desktop-2.png',
    );
  });

  it('captures an iPhone 15 and a 1440×900 desktop', () => {
    expect(DEVICES.phone.viewport).toEqual({ width: 393, height: 852 });
    expect(DEVICES.desktop.viewport).toEqual({ width: 1440, height: 900 });
  });
});

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

describe('dynamic routes', () => {
  it.each([
    ['lesson/[id].tsx', '/lesson/[id]'],
    ['(tabs)/game/[id]/review.tsx', '/game/[id]/review'],
    ['puzzle/[date]/index.tsx', '/puzzle/[date]'],
  ])('%s → %s', (file, pattern) => {
    expect(dynamicPatternForFile(file)).toBe(pattern);
  });

  it.each([
    'settings.tsx',
    '[...rest].tsx',
    'lesson/[id].test.tsx',
    'lesson/_layout.tsx',
    'lesson/[id].ios.tsx',
  ])('skips %s', (file) => {
    expect(dynamicPatternForFile(file)).toBeNull();
  });

  it('matches concrete paths to patterns', () => {
    expect(matchesPattern('/lesson/meet-the-tiles', '/lesson/[id]')).toBe(true);
    expect(matchesPattern('/lesson', '/lesson/[id]')).toBe(false);
    expect(matchesPattern('/lesson/', '/lesson/[id]')).toBe(false);
    expect(matchesPattern('/lessons/x', '/lesson/[id]')).toBe(false);
    expect(matchesPattern('/lesson/x/y', '/lesson/[id]')).toBe(false);
  });

  it('finds the lesson route in src/app', () => {
    expect(discoverDynamicPatterns(path.join(__dirname, '..', '..', 'src', 'app'))).toEqual([
      '/lesson/[id]',
    ]);
  });
});
