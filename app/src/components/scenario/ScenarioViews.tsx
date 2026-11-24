import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/Card';
import { TableView } from '@/components/drill/TableView';
import { CardLineView } from '@/components/lesson/CardLineView';
import { TileDisplayView } from '@/components/lesson/LessonSteps';
import { Text } from '@/components/Text';
import { rackGroups } from '@/game/drills/content/bestHand';
import { handById } from '@/game/drills/content/words';
import type { AnsweredQuestion, DrillQuestion } from '@/game/drills';
import { moveTiles, moveWords, stageInfo, type Scenario } from '@/game/scenarios';
import { radii, spacing, useTheme } from '@/theme';

// The pages of a scenario around its move: the scene that sets it up, and the
// strategy that follows. Presentational, like the lesson steps, so the
// styleguide and tests can render each on its own.

function Paragraphs({ body }: { body: string }) {
  return (
    <View style={styles.paragraphs}>
      {body.split(/\n\s*\n/).map((p, i) => (
        <Text key={i}>{p.trim()}</Text>
      ))}
    </View>
  );
}

/** The rack the scenario hands the player, in suit groups with a spoken caption. */
function rackDisplay(scenario: Scenario) {
  const rack = scenario.setup.kind === 'discard' ? scenario.setup.data.rack : scenario.setup.rack;
  const { groups, caption } = rackGroups(rack);
  return { tiles: rack, groups, caption };
}

/** The scene: how the table got here, and a look at it before the question is asked. */
export function ScenarioScene({ scenario, question }: { scenario: Scenario; question: DrillQuestion }) {
  const { colors } = useTheme();
  return (
    <View style={styles.page} testID="scenario-scene">
      <Text variant="eyebrow">Scenario · {stageInfo(scenario.stage).title}</Text>
      <Text variant="title1">{scenario.title}</Text>
      <View style={[styles.rule, { backgroundColor: colors.gold }]} />
      <Paragraphs body={scenario.story} />
      <Card tone="felt" elevation="high" style={styles.mat}>
        {question.scene.table && <TableView table={question.scene.table} />}
        <TileDisplayView display={rackDisplay(scenario)} />
      </Card>
      <Text variant="callout" color="textMuted" align="center">
        Take a moment. What would you do?
      </Text>
    </View>
  );
}

function CheckMark() {
  const { colors } = useTheme();
  return (
    <View style={[styles.check, { backgroundColor: colors.primary }]}>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path d="M5 12.5l4.4 4.4L19 7.4" fill="none" stroke={colors.onPrimary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** A numbered step of the checklist, read as one item. */
function ChecklistItem({ index, text }: { index: number; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.item} accessible accessibilityLabel={`${index}. ${text}`}>
      <View style={[styles.numeral, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
        <Text variant="headline" color="primaryText" maxFontSizeMultiplier={1.4}>
          {index}
        </Text>
      </View>
      <Text style={styles.itemText}>{text}</Text>
    </View>
  );
}

type StrategyProps = {
  scenario: Scenario;
  /** The player's answer to the move, for the recap. */
  answer: AnsweredQuestion;
};

/** The strategy: the principle, why it wins, what to do next time, and the move in one line. */
export function ScenarioStrategy({ scenario, answer }: StrategyProps) {
  const { colors } = useTheme();
  const move = moveWords(scenario);
  const tiles = moveTiles(scenario);
  const line = 'handId' in scenario.move ? handById(scenario.move.handId).line : null;
  const verdict = answer.evaluation.verdict;
  const yours =
    verdict === 'best'
      ? 'That was your move too.'
      : verdict === 'good'
        ? 'Your move was sound; this one is a shade stronger.'
        : 'Not your move this time. Now you know the pattern.';
  return (
    <View style={styles.page} testID="scenario-strategy">
      <Text variant="eyebrow">The strategy</Text>
      <Text variant="title1">{scenario.strategy.principle}</Text>
      <View style={[styles.rule, { backgroundColor: colors.gold }]} />
      <Paragraphs body={scenario.strategy.body} />

      <Card tone="felt" elevation="high" style={styles.recap}>
        <Text variant="eyebrow" color="onFeltMuted">
          The move
        </Text>
        {tiles.length > 0 ? (
          <TileDisplayView display={{ tiles, caption: move }} />
        ) : (
          <>
            {line && <CardLineView line={line} testID="scenario-move-line" />}
            <Text variant="callout" color="onFeltMuted" align="center">
              {move}
            </Text>
          </>
        )}
        <View style={styles.yours}>
          <CheckMark />
          <Text color="onFelt" style={styles.yoursText}>
            {yours}
          </Text>
        </View>
      </Card>

      <Card elevation="low" style={styles.checklist} accessibilityRole="list">
        <Text variant="title3">When this happens</Text>
        {scenario.strategy.checklist.map((text, i) => (
          <ChecklistItem key={i} index={i + 1} text={text} />
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  paragraphs: { gap: spacing.md },
  // A short gold inlay under a page title, like the edge of a game table.
  rule: { width: 48, height: 3, borderRadius: radii.pill },
  mat: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.lg },
  recap: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.md },
  yours: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.xs },
  yoursText: { flexShrink: 1 },
  check: { width: 24, height: 24, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  checklist: { gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemText: { flex: 1 },
  numeral: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -3,
  },
});
