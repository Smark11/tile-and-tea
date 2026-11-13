import { StyleSheet, View } from 'react-native';
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

function SuitMark({ ink }: { ink?: CardInk }) {
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
      <View style={styles.inlay} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.row}>
          <View style={styles.segments}>
            {line.segments.map((segment, i) => (
              <View key={i} style={styles.segment}>
                <Text style={[styles.glyphs, { color: segment.ink ? INK[segment.ink] : cardInks.plain }]}>
                  {segment.text}
                </Text>
                <SuitMark ink={segment.ink} />
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
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // A full line (14 characters, five groups) fits one row on a phone.
  segments: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: spacing.xs },
  segment: { alignItems: 'center', gap: 3 },
  glyphs: { fontFamily: fontFamilies.serif, fontSize: 20, lineHeight: 26, letterSpacing: 0.5 },
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
