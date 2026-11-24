import { SCENARIO_ORDER } from '@/game/scenarios';

export { ScenarioScreen as default } from '@/components/scenario/ScenarioScreen';

/** Static web export writes one page per scenario. */
export function generateStaticParams(): { id: string }[] {
  return SCENARIO_ORDER.map((id) => ({ id }));
}
