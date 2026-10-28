import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  palette,
  radii,
  spacing,
  typography,
  useTheme,
  type Elevation,
  type PaletteName,
  type ThemeColors,
  type TypeVariant,
} from '@/theme';

const paletteLabels: Record<PaletteName, string> = {
  jadeFelt: 'Jade felt',
  jade: 'Jade',
  ivory: 'Ivory tile',
  tileEdge: 'Tile edge',
  gold: 'Warm gold',
  lacquerRed: 'Lacquer red',
  ink: 'Ink',
  lacquer: 'Lacquer',
};

const typeSamples: Record<TypeVariant, string> = {
  display: 'Jade Parlor',
  title1: 'Learn the tiles',
  title2: 'The Charleston',
  title3: 'Pungs and kongs',
  headline: 'Today’s drill',
  body: 'Jokers can stand in for any tile in a group of three or more.',
  bodyEmphasis: 'Keep the pair of 3 Bams.',
  callout: 'Nice! That kept two hands open.',
  eyebrow: 'Lesson 2',
  caption: 'About 4 minutes',
  button: 'Continue',
};

const elevations: Elevation[] = ['low', 'medium', 'high'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title2">{title}</Text>
      {children}
    </View>
  );
}

function Swatch({ name, value, detail }: { name: string; value: string; detail?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.swatch}
      accessible
      accessibilityLabel={`${name}, ${value}${detail ? `, ${detail}` : ''}`}
    >
      <View style={[styles.swatchChip, { backgroundColor: value, borderColor: colors.border }]} />
      <Text variant="headline" numberOfLines={1}>
        {name}
      </Text>
      <Text variant="caption" numberOfLines={1}>
        {detail ?? value}
      </Text>
    </View>
  );
}

export function Styleguide() {
  const { colors, scheme, shadows } = useTheme();
  const semantic = Object.entries(colors) as [keyof ThemeColors, string][];

  return (
    <Screen>
      <View style={styles.hero}>
        <Text variant="eyebrow">Design system · {scheme} mode</Text>
        <Text variant="display">Jade Parlor</Text>
        <Text variant="callout" color="textMuted">
          A sunlit game room: ivory tiles on jade felt, touched with gold.
        </Text>
      </View>

      <Section title="Brand palette">
        <View style={styles.grid}>
          {(Object.keys(palette) as PaletteName[]).map((key) => (
            <Swatch key={key} name={paletteLabels[key]} value={palette[key]} />
          ))}
        </View>
      </Section>

      <Section title="Theme colors">
        <Card elevation="low" style={styles.list}>
          {semantic.map(([key, value], i) => (
            <View
              key={key}
              style={[styles.row, i > 0 && { borderTopColor: colors.border, ...styles.rowDivider }]}
              accessible
              accessibilityLabel={`${key}, ${value}`}
            >
              <View
                style={[styles.rowChip, { backgroundColor: value, borderColor: colors.border }]}
              />
              <Text variant="bodyEmphasis" style={styles.rowName} numberOfLines={1}>
                {key}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Typography">
        <Card elevation="low" style={styles.typeCard}>
          {(Object.keys(typeSamples) as TypeVariant[]).map((variant) => (
            <View key={variant} style={styles.typeRow}>
              <Text variant="caption">
                {variant} · {typography[variant].fontSize}/{typography[variant].lineHeight}
              </Text>
              <Text variant={variant} accessibilityRole="text">
                {typeSamples[variant]}
              </Text>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Spacing">
        <Card elevation="low">
          {(Object.keys(spacing) as (keyof typeof spacing)[]).map((key) => (
            <View
              key={key}
              style={styles.spaceRow}
              accessible
              accessibilityLabel={`spacing ${key}, ${spacing[key]} points`}
            >
              <Text variant="caption" style={styles.spaceLabel}>
                {key} · {spacing[key]}
              </Text>
              <View
                style={[styles.spaceBar, { width: spacing[key] * 4, backgroundColor: colors.primary }]}
              />
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Radii">
        <View style={styles.grid}>
          {(Object.keys(radii) as (keyof typeof radii)[]).map((key) => (
            <View
              key={key}
              style={styles.radiusItem}
              accessible
              accessibilityLabel={`radius ${key}, ${radii[key]} points`}
            >
              <View
                style={[
                  styles.radiusBox,
                  {
                    borderRadius: Math.min(radii[key], 36),
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    boxShadow: shadows.low,
                  },
                ]}
              />
              <Text variant="caption">
                {key} · {radii[key]}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Elevation">
        <View style={styles.elevationRow}>
          {elevations.map((e) => (
            <Card key={e} elevation={e} style={styles.elevationCard}>
              <Text variant="headline" align="center">
                {e}
              </Text>
            </Card>
          ))}
        </View>
      </Section>

      <Section title="Buttons">
        <Card elevation="low" style={styles.buttons}>
          <Button title="Start lesson" block />
          <Button title="Practice instead" variant="secondary" block />
          <Button title="Not now" variant="quiet" block />
          <Button title="Unavailable" disabled block />
        </Card>
      </Section>

      <Section title="Cards">
        <Card>
          <Text variant="eyebrow">Lesson 2 · 4 min</Text>
          <Text variant="title3">Pungs, kongs, and quints</Text>
          <Text color="textMuted">Learn the groups every hand is built from.</Text>
        </Card>
        <Card tone="felt" elevation="high">
          <Text variant="eyebrow" color="onFeltMuted">
            Coach’s note
          </Text>
          <Text variant="title3" color="onFelt">
            Keep your pairs early
          </Text>
          <Text color="onFeltMuted">Jokers can’t fill a pair, so a natural pair is worth holding.</Text>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, paddingBottom: spacing.sm },
  section: { gap: spacing.md, marginTop: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg, columnGap: spacing.md },
  swatch: { width: '30%', flexGrow: 1, gap: spacing.xxs },
  swatchChip: {
    height: 64,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: spacing.xs,
  },
  list: { paddingVertical: spacing.xs, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  rowChip: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  rowName: { flex: 1 },
  typeCard: { gap: spacing.lg },
  typeRow: { gap: spacing.xxs },
  spaceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
  spaceLabel: { width: 96 },
  spaceBar: { height: 12, borderRadius: radii.pill },
  radiusItem: { width: '30%', flexGrow: 1, alignItems: 'center', gap: spacing.sm },
  radiusBox: { width: 72, height: 72, borderWidth: StyleSheet.hairlineWidth * 2 },
  elevationRow: { flexDirection: 'row', gap: spacing.md },
  elevationCard: { flex: 1, paddingHorizontal: spacing.sm, alignItems: 'center' },
  buttons: { gap: spacing.md },
});
