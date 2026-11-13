import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import type { DrillTable, TableSeat } from '@/game/drills';
import { spacing, useTheme } from '@/theme';

const SEAT_LABELS: Record<TableSeat, string> = { left: 'Left', across: 'Across', right: 'Right' };
/** Discards per row at the widest; small tiles, like a real discard pile, so the rack stays the star. */
const PILE_PER_ROW = 12;
const MIN_TILE = 26;
const MAX_TILE = 40;
const GAP = 3;

/** Small tiles sized to fit `perRow` across the available width. */
function smallTileWidth(available: number, perRow: number): number {
  const fit = Math.floor((available - GAP * (perRow - 1)) / perRow);
  return Math.max(MIN_TILE, Math.min(MAX_TILE, fit));
}

/**
 * The rest of the table mid-game: each opponent's exposures, labeled by seat,
 * and the discard pile. Screen readers hear the caption in one stop instead of
 * every small tile.
 */
export function TableView({ table }: { table: DrillTable }) {
  const { colors } = useTheme();
  const [available, setAvailable] = useState(0);
  const width = smallTileWidth(available > 0 ? available : 320, PILE_PER_ROW);
  const onLayout = (e: LayoutChangeEvent) => setAvailable(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={styles.table}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`On the table. ${table.caption}`}
      testID="drill-table"
    >
      {table.exposures.map((e) => (
        <View key={e.seat} style={styles.section} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text variant="callout" color="onFeltMuted">
            {SEAT_LABELS[e.seat]} · exposed
          </Text>
          <View style={styles.wrap}>
            {e.groups.map((group, g) => (
              <View key={g} style={styles.cluster}>
                {group.map((kind, i) => (
                  <Tile key={i} kind={kind} width={width} />
                ))}
              </View>
            ))}
          </View>
        </View>
      ))}
      <View style={styles.section} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text variant="callout" color="onFeltMuted">
          Discards
        </Text>
        <View style={[styles.wrap, styles.pile]}>
          {table.discards.map((kind, i) => (
            <Tile key={i} kind={kind} width={width} />
          ))}
        </View>
      </View>
      <View style={[styles.rule, { backgroundColor: colors.onFeltMuted }]} />
      <Text
        variant="callout"
        color="onFeltMuted"
        align="center"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        Your rack · 14 tiles after the draw
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { gap: spacing.md, alignSelf: 'stretch' },
  section: { gap: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, rowGap: spacing.sm },
  pile: { gap: GAP, rowGap: GAP + 2 },
  cluster: { flexDirection: 'row', gap: 2 },
  rule: { height: StyleSheet.hairlineWidth * 2, opacity: 0.35, marginTop: spacing.xs },
});
