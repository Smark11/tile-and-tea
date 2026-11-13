import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Text } from '@/components/Text';
import type { CardInk, CardLine } from '@/game/lessons';
import { cardInks, fontFamilies, radii, spacing, useTheme } from '@/theme';

// One hand printed the way a card prints it, on a slip of ivory paper. Each
// suit color also has its own mark under its groups (circle, diamond, square)
// so the suits can be told apart without color. Screen readers hear the
// line's spoken version instead of the characters.

const INK: Record<CardInk, string> = { 1: cardInks.suit1, 2: cardInks.suit2, 3: cardInks.suit3 };
const MARK = 10;

/** Spoken name of each suit mark, for the legend under a multi-color line. */
export const SUIT_MARK_NAMES: Record<CardInk, string> = { 1: 'circle', 2: 'diamond', 3: 'square' };

export function SuitMark({ ink }: { ink?: CardInk }) {
  if (!ink) return <View style={styles.mark} />;
  const fill = INK[ink];
  return (
    <Svg width={MARK} height={MARK} viewBox="0 0 10 10" style={styles.mark}>
      {ink === 1 && <Circle cx={5} cy={5} r={4} fill={fill} />}
      {ink === 2 && <Path d="M5 0.6 L9.4 5 L5 9.4 L0.6 5 Z" fill={fill} />}
      {ink === 3 && <Rect x={1.2} y={1.2} width={7.6} height={7.6} rx={1} fill={fill} />}
    </Svg>
  );
}

/** Lines with this many groups or more print a little tighter so they fit one row on a phone. */
const DENSE_SEGMENTS = 6;
const GAP = 10;
const DENSE_GAP = 6;

/**
 * Splits groups into the fewest balanced rows that fit `width`, so a line that
 * has to wrap (large Dynamic Type, narrow screens) breaks 4 + 3, never 6 + 1.
 * Returns a single row until every width has been measured.
 */
export function balanceRows<T>(items: T[], widths: number[], width: number, gap: number): T[][] {
  const measured =
    items.length > 0 && width > 0 && widths.length === items.length && widths.every((w) => w > 0);
  if (!measured) return [items];
  const span = (ws: number[]) => ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  for (let rows = 1; rows <= items.length; rows++) {
    const widthRows = split(widths, rows);
    if (rows === items.length || widthRows.every((ws) => span(ws) <= width + 0.5)) return split(items, rows);
  }
  return [items];
}

/** `rows` consecutive slices whose lengths differ by at most one, longer first (7 → 4+3, 3+2+2). */
function split<T>(items: T[], rows: number): T[][] {
  const base = Math.floor(items.length / rows);
  const extra = items.length % rows;
  const out: T[][] = [];
  let start = 0;
  for (let r = 0; r < rows; r++) {
    const size = base + (r < extra ? 1 : 0);
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}

/**
 * The printed line itself: colored groups with their marks, X or C and the
 * value, and the note. It's hidden from screen readers; whoever places it
 * gives the spoken version.
 */
export function CardLineBody({ line }: { line: CardLine }) {
  const dense = line.segments.length >= DENSE_SEGMENTS;
  const gap = dense ? DENSE_GAP : GAP;
  const [width, setWidth] = useState(0);
  const [widths, setWidths] = useState<number[]>([]);

  const onSegment = (i: number) => (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidths((prev) => {
      if (Math.abs((prev[i] ?? 0) - w) < 0.5) return prev;
      const next = prev.slice();
      next[i] = w;
      return next;
    });
  };

  const indexed = line.segments.map((segment, i) => ({ segment, i }));
  const rows = balanceRows(indexed, widths, width, gap);

  return (
    <View style={styles.body} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.row}>
        <View style={styles.segments} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {rows.map((row, r) => (
            <View key={r} style={[styles.segmentRow, { columnGap: gap }]}>
              {row.map(({ segment, i }) => (
                <View key={i} style={styles.segment} onLayout={onSegment(i)}>
                  <Text
                    style={[
                      styles.glyphs,
                      dense && styles.glyphsDense,
                      { color: segment.ink ? INK[segment.ink] : cardInks.plain },
                    ]}
                  >
                    {segment.text}
                  </Text>
                  <SuitMark ink={segment.ink} />
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={styles.terms}>
          <Text style={styles.termLetter}>{line.concealed ? 'C' : 'X'}</Text>
          <Text style={styles.value}>{line.value}</Text>
        </View>
      </View>
      {line.note && <Text style={styles.note}>{line.note}</Text>}
    </View>
  );
}

export function CardLineView({ line, testID }: { line: CardLine; testID?: string }) {
  const { shadows } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Card line. ${line.spoken}`}
      testID={testID}
      style={[styles.card, { boxShadow: shadows.low }]}
    >
      <View style={styles.inlay}>
        <CardLineBody line={line} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: cardInks.paper,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    padding: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: cardInks.paperShade,
  },
  // A fine gold rule set in from the edge, like a printed border.
  inlay: {
    borderWidth: 1,
    borderColor: cardInks.rule,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  body: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Rows come from balanceRows: a line wraps only when it must, and evenly.
  segments: { flex: 1, rowGap: spacing.xs },
  segmentRow: { flexDirection: 'row' },
  segment: { alignItems: 'center', gap: 3 },
  glyphs: { fontFamily: fontFamilies.serif, fontSize: 20, lineHeight: 26, letterSpacing: 0.5 },
  glyphsDense: { fontSize: 18, letterSpacing: 0 },
  mark: { width: MARK, height: MARK },
  terms: {
    alignItems: 'center',
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: cardInks.rule,
    minWidth: 40,
  },
  termLetter: { fontFamily: fontFamilies.sansSemiBold, fontSize: 15, lineHeight: 20, letterSpacing: 1, color: cardInks.muted },
  value: { fontFamily: fontFamilies.serif, fontSize: 22, lineHeight: 28, color: cardInks.plain },
  note: { fontFamily: fontFamilies.serifItalic, fontSize: 15, lineHeight: 20, color: cardInks.muted },
});
