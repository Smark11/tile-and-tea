import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DrillComplete, DrillQuestionView } from '@/components/drill/DrillViews';
import { LessonComplete } from '@/components/lesson/LessonComplete';
import { FeedbackPanel, TapStepView, TilesStepView } from '@/components/lesson/LessonSteps';
import { LessonPath } from '@/components/lesson/path/LessonPath';
import {
  buildLessonPath,
  correctIndexes,
  emptyProgress,
  feedbackMessage,
  isSingleAnswer,
  lessonById,
  lessonReducer,
  LESSONS,
  type PlannedLesson,
  recordCompletion,
  saveSnapshot,
  startSession,
  type Lesson,
  type SessionAction,
  type TapStep,
} from '@/game/lessons';
import { Rack } from '@/components/rack/Rack';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Tile, type TileSize } from '@/components/tile/Tile';
import { bestHand, currentAnswer, currentQuestion, nameTheHand, roundReducer, startRound, type DrillQuestion } from '@/game/drills';
import type { BestHandData } from '@/game/drills/content/bestHand';
import { createRng } from '@/game/rng';
import {
  ALL_KINDS,
  createShuffledTileSet,
  RANKS,
  SUITS,
  tileKey,
  type Suit,
  type Tile as RackTileModel,
  type TileKind,
} from '@/game/tiles';
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
    <View style={styles.section} testID={`styleguide-${title.toLowerCase().replace(/\s+/g, '-')}`}>
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

const suitTitles: Record<Suit, string> = { bam: 'Bams', crak: 'Craks', dot: 'Dots' };
const honors = ALL_KINDS.filter((k) => k.type === 'wind' || k.type === 'dragon');
const sizes: TileSize[] = ['S', 'M', 'L'];
const sample: TileKind = { type: 'suited', suit: 'dot', rank: 5 };
const noop = () => {};

function TileRow({ children }: { children: ReactNode }) {
  return <View style={styles.tileRow}>{children}</View>;
}

function TileGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.tileGroup}>
      <Text variant="eyebrow" color="onFeltMuted">
        {title}
      </Text>
      {children}
    </View>
  );
}

function TileStateDemo({ label, ...state }: { label: string; selected?: boolean; hint?: boolean; disabled?: boolean }) {
  return (
    <View style={styles.stateItem}>
      <Tile kind={sample} size="L" onPress={noop} {...state} />
      <Text variant="caption">{label}</Text>
    </View>
  );
}

function TileGallery() {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(['crak-5']));
  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <>
      <Card tone="felt" elevation="high" style={styles.felt}>
        {SUITS.map((suit) => (
          <TileGroup key={suit} title={suitTitles[suit]}>
            {[RANKS.slice(0, 5), RANKS.slice(5)].map((ranks, i) => (
              <TileRow key={i}>
                {ranks.map((rank) => {
                  const key = `${suit}-${rank}`;
                  return (
                    <Tile
                      key={key}
                      kind={{ type: 'suited', suit, rank }}
                      selected={picked.has(key)}
                      onPress={() => toggle(key)}
                    />
                  );
                })}
              </TileRow>
            ))}
          </TileGroup>
        ))}
        <TileGroup title="Winds & Dragons">
          {[honors.slice(0, 4), honors.slice(4)].map((row, i) => (
            <TileRow key={i}>
              {row.map((kind) => (
                <Tile key={tileKey(kind)} kind={kind} />
              ))}
            </TileRow>
          ))}
        </TileGroup>
        <TileGroup title="Flowers & Joker">
          {[
            [0, 1, 2, 3],
            [4, 5, 6, 7],
          ].map((copies, i) => (
            <TileRow key={i}>
              {copies.map((copy) => (
                <Tile key={copy} kind={{ type: 'flower' }} copy={copy} />
              ))}
              {i === 1 && <Tile kind={{ type: 'joker' }} />}
            </TileRow>
          ))}
        </TileGroup>
        <Text variant="caption" color="onFeltMuted" align="center">
          Tap a suit tile to select it.
        </Text>
      </Card>

      <Card elevation="low" style={styles.tileStates}>
        <Text variant="headline">Sizes</Text>
        <View style={styles.sizeRow}>
          {sizes.map((size) => (
            <View key={size} style={styles.stateItem}>
              <Tile kind={{ type: 'joker' }} size={size} />
              <Text variant="caption">{size}</Text>
            </View>
          ))}
        </View>
        <Text variant="headline">States</Text>
        <View style={styles.stateRow}>
          <TileStateDemo label="Resting" />
          <TileStateDemo label="Selected" selected />
          <TileStateDemo label="Hint" hint />
          <TileStateDemo label="Disabled" disabled />
        </View>
      </Card>
    </>
  );
}

// A seeded deal, so the rack looks the same in every screenshot.
const DEALT_HAND = createShuffledTileSet(createRng('styleguide-rack')).slice(0, 14);

function RackDemo() {
  const [tiles, setTiles] = useState<readonly RackTileModel[]>(DEALT_HAND);
  const [picked, setPicked] = useState<ReadonlySet<number>>(() => new Set([DEALT_HAND[4].id]));
  const hints = useMemo(() => new Set([DEALT_HAND[9].id]), []);
  const toggle = useCallback(
    (tile: RackTileModel) =>
      setPicked((prev) => {
        const next = new Set(prev);
        if (!next.delete(tile.id)) next.add(tile.id);
        return next;
      }),
    [],
  );

  return (
    <View style={styles.rackDemo}>
      <Rack
        tiles={tiles}
        onReorder={setTiles}
        onToggleSelect={toggle}
        selectedIds={picked}
        hintIds={hints}
      />
      <Text variant="caption" color="textMuted" align="center">
        Tap to select. Slide a tile sideways to move it.
      </Text>
    </View>
  );
}

/**
 * The lesson path partway along, so every node state shows at once: finished,
 * under way, locked, and (in the second path) reached but still being written.
 * A sample planned lesson stands in for one still being written.
 */
const SAMPLE_PLANNED: readonly PlannedLesson[] = [
  { id: 'calling', title: 'Calling and exposing', summary: 'Claiming a discard to finish a group.' },
];

function LessonPathDemo() {
  const written = LESSONS.slice(0, 3);
  const at = new Date('2026-11-12T10:00:00Z');
  const one = recordCompletion(emptyProgress, LESSONS[0].id, { firstTry: 3, questions: 3 }, at);
  const midway = saveSnapshot(one, written[1].id, { stepIndex: 5, results: {} });
  const reached = recordCompletion(one, written[1].id, { firstTry: 2, questions: 4 }, at);
  const open = () => {};
  return (
    <View style={styles.lessonDemo}>
      <Text variant="caption">Partway through lesson 2</Text>
      <LessonPath nodes={buildLessonPath(midway, written)} onOpen={open} />
      <Text variant="caption">A finished lesson, and one still being written</Text>
      <LessonPath nodes={buildLessonPath(reached, written.slice(0, 2), SAMPLE_PLANNED)} onOpen={open} />
    </View>
  );
}

/** Every lesson page state, frozen, so each can be reviewed without playing through. */
function LessonDemo() {
  const lesson = LESSONS[0];
  const questions = lesson.steps.filter((s): s is TapStep => s.kind === 'tap');
  const single = questions.find(isSingleAnswer)!;
  const many = questions.find((s) => !isSingleAnswer(s))!;
  const tiles = lesson.steps.find((s) => s.kind === 'tiles')!;
  // Card lines, grouped hands, and questions about given tiles, from later lessons.
  const pick = (lessonId: string, stepId: string) => lessonById(lessonId)!.steps.find((s) => s.id === stepId)!;
  const extras = [
    { label: 'A card line over its hand, in three suits', step: pick('reading-a-card', 'colors-are-suits') },
    { label: 'A concealed line, grouped', step: pick('reading-a-card', 'x-or-c') },
    { label: 'A question about given tiles', step: pick('groups', 'make-a-pung') },
    { label: 'A question about a card line', step: pick('charleston', 'choose-a-pass') },
  ];
  const after = (step: TapStep, taps: number[], extra: SessionAction[] = []) => {
    const demo: Lesson = { ...lesson, steps: [step] };
    const reduce = lessonReducer(demo);
    const actions: SessionAction[] = [...taps.map((index) => ({ type: 'tap' as const, index })), ...extra];
    return actions.reduce(reduce, startSession(demo));
  };
  const wrong = single.choices.findIndex((c) => !c.correct);
  const right = single.choices.findIndex((c) => c.correct);
  const manyRight = correctIndexes(many);
  const states = [
    { label: 'Answered', step: single, state: after(single, [right]) },
    { label: 'A nudge after a miss', step: many, state: after(many, [manyRight[0]], [{ type: 'check' }]) },
    { label: 'Answer shown after two misses', step: single, state: after(single, [wrong], [{ type: 'retry' }, { type: 'tap', index: wrong }]) },
  ];
  return (
    <View style={styles.lessonDemo}>
      {tiles.kind === 'tiles' && <TilesStepView step={tiles} />}
      {extras.map(({ label, step }) => (
        <View key={label} style={styles.lessonState}>
          <Text variant="caption">{label}</Text>
          {step.kind === 'tiles' && <TilesStepView step={step} />}
          {step.kind === 'tap' && (
            <TapStepView step={step} selected={[]} revealAnswer={false} settled={false} singleAnswer={isSingleAnswer(step)} onTap={() => {}} />
          )}
        </View>
      ))}
      {states.map(({ label, step, state }) => {
        const message = feedbackMessage(step, state);
        return (
          <View key={label} style={styles.lessonState}>
            <Text variant="caption">{label}</Text>
            <TapStepView
              step={step}
              selected={state.selected}
              revealAnswer={state.feedback === 'revealed'}
              settled={state.feedback === 'correct' || state.feedback === 'revealed'}
              singleAnswer={isSingleAnswer(step)}
              onTap={() => {}}
            />
            {message && <FeedbackPanel message={message} />}
          </View>
        );
      })}
      <LessonComplete lesson={lesson} score={{ firstTry: 2, questions: 3 }} onReplay={() => {}} />
    </View>
  );
}

/**
 * A drill question after a miss (the pick and the answer both marked, with the
 * coach's explanation) and after a best answer, then a finished round.
 * Seeded, so it looks the same in every screenshot.
 */
function DrillDemo() {
  const reduce = roundReducer(nameTheHand);
  const start = startRound(nameTheHand, 2027);
  const answerOf = (i: number) => (start.questions[i].data as { answer: number }).answer;
  const missed = reduce(start, { type: 'tap', index: (answerOf(0) + 1) % 3 });
  const second = reduce(reduce(missed, { type: 'next' }), { type: 'tap', index: answerOf(1) });
  const states = [
    { label: 'After a miss', state: missed },
    { label: 'After the best answer', state: second },
  ];
  return (
    <View style={styles.lessonDemo}>
      {states.map(({ label, state }) => (
        <View key={label} style={styles.lessonState}>
          <Text variant="caption">{label}</Text>
          <DrillQuestionView question={currentQuestion(state)} selected={state.selected} answer={currentAnswer(state)} onTap={() => {}} />
        </View>
      ))}
      <DrillComplete
        title={nameTheHand.title}
        verdicts={['best', 'miss', 'best', 'good', 'best']}
        score={{ best: 3, good: 1, miss: 1, questions: 5, score: 0.7 }}
        onAgain={() => {}}
        onLeave={() => {}}
      />
    </View>
  );
}

/**
 * "Best hand": a fresh rack waiting for a pick, then a rack after a pick the
 * coach calls close but not best (or a miss, if no line is one tile further).
 */
function BestHandDemo() {
  const reduce = roundReducer(bestHand);
  const start = startRound(bestHand, 2027);
  const question = start.questions[1] as DrillQuestion<BestHandData>;
  const verdictOf = (i: number) => bestHand.evaluate(question, [i]).verdict;
  const nearly = question.choices.findIndex((_, i) => verdictOf(i) === 'good');
  const fallback = question.choices.findIndex((_, i) => verdictOf(i) === 'miss');
  const answered = reduce(reduce(start, { type: 'tap', index: 0 }), { type: 'next' });
  const picked = reduce(answered, { type: 'tap', index: nearly >= 0 ? nearly : fallback });
  const states = [
    { label: 'Waiting for a pick', state: start },
    { label: nearly >= 0 ? 'After a close pick' : 'After a miss', state: picked },
  ];
  return (
    <View style={styles.lessonDemo}>
      {states.map(({ label, state }) => (
        <View key={label} style={styles.lessonState}>
          <Text variant="caption">{label}</Text>
          <DrillQuestionView question={currentQuestion(state)} selected={state.selected} answer={currentAnswer(state)} onTap={() => {}} />
        </View>
      ))}
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

      <Section title="Tiles">
        <TileGallery />
      </Section>

      <Section title="Rack">
        <RackDemo />
      </Section>

      <Section title="Lesson path">
        <LessonPathDemo />
      </Section>

      <Section title="Lesson pages">
        <LessonDemo />
      </Section>

      <Section title="Drill pages">
        <DrillDemo />
      </Section>

      <Section title="Best hand drill">
        <BestHandDemo />
      </Section>

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
  felt: { gap: spacing.xl, paddingHorizontal: spacing.lg },
  lessonDemo: { gap: spacing.xxl },
  lessonState: { gap: spacing.md },
  rackDemo: { gap: spacing.md },
  tileGroup: { gap: spacing.md },
  tileRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  tileStates: { gap: spacing.lg },
  sizeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xl },
  stateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md },
  stateItem: { alignItems: 'center', gap: spacing.sm },
});
