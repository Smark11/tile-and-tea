import { useMemo } from 'react';

import { playbookProgress, type PrincipleProgress } from '@/game/playbook';
import { useDrillProgress } from '@/state/drillProgress';
import { useLessonProgress } from '@/state/lessonProgress';
import { useScenarioProgress } from '@/state/scenarioProgress';

/** The player's standing on every principle, from saved scenarios, skill ratings and lessons. */
export function usePlaybook(): { progress: PrincipleProgress[]; mastered: number } {
  const scenarios = useScenarioProgress((s) => s.completed);
  const ratings = useDrillProgress((s) => s.ratings);
  const lessons = useLessonProgress((s) => s.completed);
  return useMemo(() => {
    const progress = playbookProgress({ scenarios, ratings, lessons });
    return { progress, mastered: progress.filter((p) => p.mastered).length };
  }, [scenarios, ratings, lessons]);
}
