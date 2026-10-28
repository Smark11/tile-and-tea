import { colors, type ColorScheme, type ThemeColors } from './colors';
import { radii, shadows, spacing, typography, type Elevation } from './tokens';
import { useColorScheme } from './useColorScheme';

export * from './colors';
export * from './palette';
export * from './tokens';

export type Theme = {
  scheme: ColorScheme;
  colors: ThemeColors;
  shadows: Record<Elevation, string>;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
};

const themes: Record<ColorScheme, Theme> = {
  light: { scheme: 'light', colors: colors.light, shadows: shadows.light, spacing, radii, typography },
  dark: { scheme: 'dark', colors: colors.dark, shadows: shadows.dark, spacing, radii, typography },
};

export function getTheme(scheme: ColorScheme): Theme {
  return themes[scheme];
}

/** The theme for the system appearance. Returns a stable object per scheme. */
export function useTheme(): Theme {
  return getTheme(useColorScheme() === 'dark' ? 'dark' : 'light');
}
