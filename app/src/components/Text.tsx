import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { headingVariants, maxFontScale, useTheme, type ThemeColors, type TypeVariant } from '@/theme';

export type TextColor = Extract<
  keyof ThemeColors,
  | 'text'
  | 'textMuted'
  | 'primaryText'
  | 'goldText'
  | 'dangerText'
  | 'onPrimary'
  | 'onFelt'
  | 'onFeltMuted'
  | 'onDanger'
  | 'felt'
>;

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
};

const defaultColor: Partial<Record<TypeVariant, TextColor>> = {
  eyebrow: 'goldText',
  caption: 'textMuted',
};

/**
 * Themed text. Headings are announced as headers to screen readers, and all
 * sizes follow the system text size (capped only for the largest headings).
 */
export function Text({ variant = 'body', color, align, style, ...rest }: TextProps) {
  const { colors, typography } = useTheme();
  const isHeading = headingVariants.includes(variant);
  return (
    <RNText
      accessibilityRole={isHeading ? 'header' : undefined}
      maxFontSizeMultiplier={maxFontScale[variant]}
      {...rest}
      style={[
        typography[variant],
        { color: colors[color ?? defaultColor[variant] ?? 'text'] },
        align && { textAlign: align },
        style,
      ]}
    />
  );
}
