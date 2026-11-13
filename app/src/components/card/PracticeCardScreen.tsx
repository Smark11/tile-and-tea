import { router } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { CardLineBody, SuitMark } from '@/components/lesson/CardLineView';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { CURRENT_CARD, type CardInk, type CardSection } from '@/game/card';
import { cardInks, fontFamilies, radii, spacing, useTheme } from '@/theme';

// The whole practice card, printed as one sheet of ivory card stock: a
// masthead, then each category with its hands. It is paper, so it looks the
// same in light and dark mode, and it borrows nothing from any official card's
// layout or colors: our inks, our shape marks, our gold rules.

const LEGEND: { ink: CardInk; label: string }[] = [
  { ink: 1, label: 'First suit' },
  { ink: 2, label: 'Second suit' },
  { ink: 3, label: 'Third suit' },
];

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** A short gold rule with a diamond in the middle, between sections. */
function Ornament() {
  return (
    <View style={styles.ornament} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.ornamentRule} />
      <View style={styles.ornamentDiamond} />
      <View style={styles.ornamentRule} />
    </View>
  );
}

function Section({ section }: { section: CardSection }) {
  return (
    <View style={styles.section} testID={`card-section-${section.id}`}>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {section.title}
        </Text>
        <Text style={styles.sectionBlurb}>{section.blurb}</Text>
      </View>
      {section.hands.map((hand, i) => (
        <Fragment key={hand.id}>
          {i > 0 && <View style={styles.handRule} />}
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${section.title}, hand ${i + 1} of ${section.hands.length}. ${hand.line.spoken}`}
            testID={`card-hand-${hand.id}`}
            style={styles.hand}
          >
            <CardLineBody line={hand.line} />
          </View>
        </Fragment>
      ))}
    </View>
  );
}

/** The practice card at /card. */
export function PracticeCardScreen() {
  const { shadows } = useTheme();
  const card = CURRENT_CARD;
  return (
    <Screen>
      <View style={styles.titles}>
        <Text variant="eyebrow">Practice card</Text>
        {/* Back sits centered on the title line, not the eyebrow + title block. */}
        <View style={styles.titleRow}>
          <Text variant="title1" style={styles.title}>{`Your ${card.year} card`}</Text>
          <Button title="Back" variant="quiet" onPress={goBack} />
        </View>
      </View>
      <Text color="textMuted">
        {`${card.hands.length} hands to learn on. Each line is one way to win: collect its 14 tiles and call Mah Jongg.`}
      </Text>

      <View style={[styles.sheet, { boxShadow: shadows.medium }]} testID="practice-card">
        <View style={styles.border}>
          <View style={styles.masthead}>
            <Text style={styles.mastheadKicker}>Tile & Tea</Text>
            <Text accessibilityRole="header" style={styles.mastheadTitle}>
              {card.title}
            </Text>
            <Text style={styles.mastheadNote}>Our own hands, written for practice.</Text>
          </View>

          <View style={styles.key} accessible accessibilityLabel="How to read it. Each color is a different suit, and you choose which. A circle, diamond, or square under each group tells the colors apart. X means you may expose; C means concealed. The number is the hand’s value.">
            <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {LEGEND.map(({ ink, label }) => (
                <View key={ink} style={styles.legendItem}>
                  <SuitMark ink={ink} />
                  <Text style={styles.keyText}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.keyLines} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text style={styles.keyText}>X: you may expose · C: concealed</Text>
              <Text style={styles.keyText}>The number at right is the value</Text>
            </View>
          </View>

          {card.sections.map((section, i) => (
            <Fragment key={section.id}>
              {i > 0 && <Ornament />}
              <Section section={section} />
            </Fragment>
          ))}
        </View>
      </View>

      <Text variant="caption" align="center">
        {`The Tile & Tea ${card.year} Practice Card is our own, for learning. It isn’t affiliated with any league and doesn’t predict any official card.`}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titles: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  // Card stock: ivory paper, a shaded bottom edge, and a gold rule set in.
  sheet: {
    backgroundColor: cardInks.paper,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    padding: spacing.sm,
    borderBottomWidth: 3,
    borderBottomColor: cardInks.paperShade,
    marginTop: spacing.xs,
  },
  border: {
    borderWidth: 1.5,
    borderColor: cardInks.rule,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  masthead: { alignItems: 'center', gap: spacing.xxs, paddingBottom: spacing.lg },
  mastheadKicker: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: cardInks.muted,
  },
  mastheadTitle: { fontFamily: fontFamilies.serif, fontSize: 28, lineHeight: 34, color: cardInks.plain, textAlign: 'center' },
  mastheadNote: { fontFamily: fontFamilies.serifItalic, fontSize: 15, lineHeight: 20, color: cardInks.muted, textAlign: 'center' },
  key: {
    gap: spacing.xs,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: cardInks.rule,
    marginBottom: spacing.lg,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.lg, rowGap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  keyLines: { alignItems: 'center', gap: spacing.xxs },
  keyText: { fontFamily: fontFamilies.sans, fontSize: 17, lineHeight: 24, color: cardInks.muted, textAlign: 'center' },
  section: { gap: spacing.sm },
  sectionHead: { gap: spacing.xxs, paddingBottom: spacing.xs },
  sectionTitle: { fontFamily: fontFamilies.serif, fontSize: 24, lineHeight: 30, color: cardInks.plain },
  sectionBlurb: { fontFamily: fontFamilies.serifItalic, fontSize: 17, lineHeight: 24, color: cardInks.muted },
  hand: { paddingVertical: spacing.xs },
  handRule: { height: 1, backgroundColor: cardInks.paperShade },
  ornament: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  ornamentRule: { width: 56, height: 1, backgroundColor: cardInks.rule },
  ornamentDiamond: { width: 7, height: 7, backgroundColor: cardInks.rule, transform: [{ rotate: '45deg' }] },
});
