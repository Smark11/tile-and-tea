import { router } from 'expo-router';
import { useMemo } from 'react';

import { track } from '@/analytics';
import { DrillList } from '@/components/drill/DrillList';
import { NextMoveHero } from '@/components/playbook/NextMoveHero';
import { PlaybookLink } from '@/components/playbook/PlaybookLink';
import { ScenarioList } from '@/components/scenario/ScenarioList';
import { ScenarioOfTheDay } from '@/components/scenario/ScenarioOfTheDay';
import { TabScreen } from '@/components/shell/TabScreen';
import { DRILLS, drillPath, type AnyDrill } from '@/game/drills';
import { nextMove, type NextMove } from '@/game/playbook/nextMove';
import { scenarioOfTheDay, scenarioPath, type Scenario } from '@/game/scenarios';
import { useDrillProgress } from '@/state/drillProgress';
import { useScenarioProgress } from '@/state/scenarioProgress';

const openDrill = (drill: AnyDrill) => router.push(drillPath(drill.id));
const openScenario = (scenario: Scenario) => router.push(scenarioPath(scenario.id));

function openNextMove(move: NextMove) {
  track('next_move_opened', { kind: move.kind, reason: move.reason, skill: move.standing.skill });
  if (move.kind === 'scenario') openScenario(move.scenario);
  else openDrill(move.drill);
}

export function TrainTab() {
  const completed = useScenarioProgress((s) => s.completed);
  const ratings = useDrillProgress((s) => s.ratings);
  const move = useMemo(() => nextMove({ scenarios: completed, ratings }), [completed, ratings]);
  const today = scenarioOfTheDay(new Date());
  return (
    <TabScreen eyebrow="Train" title="Sharpen your game">
      <NextMoveHero move={move} onOpen={openNextMove} />
      <ScenarioOfTheDay scenario={today} record={completed[today.id]} onOpen={openScenario} />
      <ScenarioList completed={completed} onOpen={openScenario} />
      <PlaybookLink from="train" />
      <DrillList drills={DRILLS} onOpen={openDrill} intro="Endless practice for the same skills, with a rating that moves as you improve." />
    </TabScreen>
  );
}
