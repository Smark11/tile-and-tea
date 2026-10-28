import { colors, type ColorScheme, type ThemeColors } from '../colors';
import { contrastRatio, parseHex, relativeLuminance } from '../contrast';
import { fontAssets } from '../fonts';
import { getTheme } from '../index';
import { fontFamilies, minTouchTarget, typography } from '../tokens';

describe('contrast helpers', () => {
  it('parses short and long hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#0F3D33')).toEqual([15, 61, 51]);
    expect(() => parseHex('rgba(0,0,0,1)')).toThrow();
  });

  it('matches WCAG reference values', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(contrastRatio('#000000', '#FFFFFF'));
  });
});

// Every foreground/background pair the components actually use.
const textPairs: [keyof ThemeColors, keyof ThemeColors][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceSunken'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceSunken'],
  ['primaryText', 'background'],
  ['primaryText', 'surface'],
  ['primaryText', 'surfaceSunken'],
  ['goldText', 'background'],
  ['goldText', 'surface'],
  ['dangerText', 'background'],
  ['dangerText', 'surface'],
  ['onPrimary', 'primary'],
  ['onPrimary', 'primaryPressed'],
  ['onDanger', 'danger'],
  ['onFelt', 'felt'],
  ['onFeltMuted', 'felt'],
];

describe.each<ColorScheme>(['light', 'dark'])('%s colors', (scheme) => {
  it.each(textPairs)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrastRatio(colors[scheme][fg], colors[scheme][bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the brand tile colors in both modes', () => {
    expect(colors[scheme].tileFace).toBe('#F7F1E3');
    expect(colors[scheme].tileEdge).toBe('#D9CBA8');
  });
});

describe('dark mode', () => {
  it('is built on lacquer black', () => {
    expect(colors.dark.background).toBe('#121513');
  });
});

describe('getTheme', () => {
  it('returns a stable object per scheme', () => {
    expect(getTheme('light')).toBe(getTheme('light'));
    expect(getTheme('dark').colors).toBe(colors.dark);
  });
});

describe('typography', () => {
  it('never sets reading text below 17pt', () => {
    for (const v of ['body', 'bodyEmphasis', 'headline', 'callout', 'button'] as const) {
      expect(typography[v].fontSize).toBeGreaterThanOrEqual(17);
    }
  });

  it('only uses font families that are loaded at startup', () => {
    const loaded = new Set(Object.keys(fontAssets));
    for (const style of Object.values(typography)) {
      expect(loaded.has(style.fontFamily as string)).toBe(true);
    }
    expect(Object.keys(fontAssets).sort()).toEqual(Object.values(fontFamilies).sort());
  });

  it('keeps line height at least as tall as the font', () => {
    for (const style of Object.values(typography)) {
      expect(style.lineHeight!).toBeGreaterThanOrEqual(style.fontSize!);
    }
  });
});

it('touch targets are at least 44pt', () => {
  expect(minTouchTarget).toBeGreaterThanOrEqual(44);
});
