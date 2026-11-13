import { DRILL_ORDER } from '@/game/drills';

export { DrillScreen as default } from '@/components/drill/DrillScreen';

/** Static web export writes one page per drill. */
export function generateStaticParams(): { id: string }[] {
  return DRILL_ORDER.map((id) => ({ id }));
}
