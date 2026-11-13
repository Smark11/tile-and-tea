import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import type { TileKind } from '@/game/tiles';
import { minTouchTarget, radii, spacing, useTheme } from '@/theme';

// Building blocks for the tabs while their features are on the way: a felt
// hero that says what's coming, and a quiet list previewing what's inside.
// Nothing here is tappable, so nothing promises an action it can't take.

/** A small "Coming soon" label with a gold edge. */
export function ComingSoon({ onFelt = false }: { onFelt?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { borderColor: colors.gold }]}>
      <Text variant="eyebrow" color={onFelt ? 'onFelt' : 'goldText'} maxFontSizeMultiplier={1.6}>
        Coming soon
      </Text>
    </View>
  );
}

type FeltHeroProps = {
  tiles: readonly TileKind[];
  /** Spoken in place of the tile names, which read as noise here. */
  tilesLabel: string;
  title: string;
  body: string;
  /** A real action in place of the "Coming soon" label, once the tab has one. */
  action?: { title: string; onPress: () => void };
};

/** The jade-felt card at the top of each tab, with a few tiles laid on it. */
export function FeltHero({ tiles, tilesLabel, title, body, action }: FeltHeroProps) {
  return (
    <Card tone="felt" elevation="high" style={styles.hero}>
      <View style={styles.tiles} accessible accessibilityRole="image" accessibilityLabel={tilesLabel}>
        {tiles.map((kind, i) => (
          <Tile key={i} kind={kind} size="M" />
        ))}
      </View>
      {!action && <ComingSoon onFelt />}
      <Text variant="title3" color="onFelt">
        {title}
      </Text>
      <Text color="onFeltMuted">{body}</Text>
      {action && (
        <View style={styles.heroAction}>
          <Button title={action.title} variant="ivory" block onPress={action.onPress} />
        </View>
      )}
    </Card>
  );
}

export type PreviewItem = {
  title: string;
  detail: string;
  /** Leading art: a tile, or a numeral for an ordered list. */
  tile?: TileKind;
};

type PreviewListProps = {
  heading: string;
  items: readonly PreviewItem[];
  numbered?: boolean;
};

/** A heading and a grouped list of what the tab will hold. */
export function PreviewList({ heading, items, numbered = false }: PreviewListProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="title3">{heading}</Text>
      <Card elevation="low" style={styles.list}>
        {items.map((item, i) => (
          <Fragment key={item.title}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            <PreviewRow item={item} index={numbered ? i + 1 : undefined} />
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

function PreviewRow({ item, index }: { item: PreviewItem; index?: number }) {
  const { colors } = useTheme();
  let leading: ReactNode = null;
  if (index !== undefined) {
    leading = (
      <View style={[styles.numeral, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
        <Text variant="headline" color="primaryText" maxFontSizeMultiplier={1.4}>
          {index}
        </Text>
      </View>
    );
  } else if (item.tile) {
    leading = <Tile kind={item.tile} size="S" />;
  }
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${index !== undefined ? `${index}. ` : ''}${item.title}. ${item.detail}`}
    >
      {leading && <View style={styles.leading}>{leading}</View>}
      <View style={styles.rowText}>
        <Text variant="headline">{item.title}</Text>
        <Text variant="caption">{item.detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.md, paddingVertical: spacing.xl },
  heroAction: { marginTop: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  section: { gap: spacing.md, marginTop: spacing.md },
  list: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: minTouchTarget + spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: minTouchTarget,
  },
  leading: { width: minTouchTarget, alignItems: 'center' },
  numeral: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: spacing.xxs },
});
