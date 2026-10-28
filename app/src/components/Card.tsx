import { StyleSheet, View, type ViewProps } from 'react-native';

import { radii, spacing, useTheme, type Elevation } from '@/theme';

export type CardProps = ViewProps & {
  /** `surface` is the everyday card; `felt` is the jade game-table panel. */
  tone?: 'surface' | 'felt';
  elevation?: Elevation;
};

export function Card({ tone = 'surface', elevation = 'medium', style, ...rest }: CardProps) {
  const { colors, shadows } = useTheme();
  const toneStyle =
    tone === 'felt'
      ? {
          backgroundColor: colors.felt,
          borderColor: colors.feltInlay,
          boxShadow: `inset 0px 1px 0px rgba(247, 241, 227, 0.08), ${shadows[elevation]}`,
        }
      : {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          boxShadow: shadows[elevation],
        };
  return <View {...rest} style={[styles.card, toneStyle, style]} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.xl,
    gap: spacing.sm,
  },
});
