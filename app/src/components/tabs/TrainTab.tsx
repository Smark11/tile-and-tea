import { router } from 'expo-router';

import { DrillList } from '@/components/drill/DrillList';
import { ScenarioList } from '@/components/scenario/ScenarioList';
import { FeltHero } from '@/components/shell/Preview';
import { TabScreen } from '@/components/shell/TabScreen';
import { DRILLS, drillPath, type AnyDrill } from '@/game/drills';
import { ScenarioOfTheDay } from '@/components/scenario/ScenarioOfTheDay';
import { scenarioOfTheDay, SCENARIOS, scenarioPath, type Scenario } from '@/game/scenarios';
import type { TileKind } from '@/game/tiles';
import { nextUnfinished, useScenarioProgress } from '@/state/scenarioProgress';

const HERO_TILES: readonly TileKind[] = [
  { type: 'suited', suit: 'dot', rank: 3 },
  { type: 'suited', suit: 'dot', rank: 3 },
  { type: 'suited', suit: 'dot', rank: 3 },
  { type: 'joker' },
];

const openDrill = (drill: AnyDrill) => router.push(drillPath(drill.id));
const openScenario = (scenario: Scenario) => router.push(scenarioPath(scenario.id));

export function TrainTab() {
  const completed = useScenarioProgress((s) => s.completed);
  const next = nextUnfinished(completed);
  const allDone = SCENARIOS.every((s) => completed[s.id]);
  const today = scenarioOfTheDay(new Date());
  return (
    <TabScreen eyebrow="Train" title="Sharpen your game">
      <FeltHero
        tiles={HERO_TILES}
        tilesLabel="A kong of Three Dots, made with three dots and a joker"
        title="Learn to win, one moment at a time"
        body="Each scenario drops you into a real moment at the table, asks what you’d do, then teaches the principle behind the strongest play."
        action={{ title: allDone ? `Replay: ${next.title}` : `Start: ${next.title}`, onPress: () => openScenario(next) }}
      />
      <ScenarioOfTheDay scenario={today} record={completed[today.id]} onOpen={openScenario} />
      <ScenarioList completed={completed} onOpen={openScenario} />
      <DrillList drills={DRILLS} onOpen={openDrill} intro="Endless practice for the same skills, with a rating that moves as you improve." />
    </TabScreen>
  );
}
