import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { maxContentWidth, spacing, useTheme } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  /** Scroll when content is taller than the screen (default true). */
  scroll?: boolean;
  /** `felt` paints the whole screen as the jade game table. */
  tone?: 'background' | 'felt';
  contentStyle?: StyleProp<ViewStyle>;
  /** Pad for the bottom safe area (default true). Tab screens sit above the tab bar, which already does. */
  insetBottom?: boolean;
};

/**
 * Root container for every screen: themed background, safe-area padding, and
 * a centered column that stays readable on tablets and web.
 */
export function Screen({
  children,
  scroll = true,
  tone = 'background',
  contentStyle,
  insetBottom = true,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing.xl,
    paddingBottom: (insetBottom ? insets.bottom : 0) + spacing.xxl,
    paddingLeft: insets.left + spacing.xl,
    paddingRight: insets.right + spacing.xl,
  };
  const column = [styles.column, contentStyle];
  const backgroundColor = tone === 'felt' ? colors.felt : colors.background;

  if (!scroll) {
    return (
      <View style={[styles.fill, padding, { backgroundColor }]}>
        <View style={[column, styles.fill]}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.fill, { backgroundColor }]}
      contentContainerStyle={padding}
      contentInsetAdjustmentBehavior="never"
    >
      <View style={column}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: spacing.lg,
  },
});
