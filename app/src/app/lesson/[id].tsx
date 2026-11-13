import { LESSON_ORDER } from '@/game/lessons';

export { LessonScreen as default } from '@/components/lesson/LessonScreen';

/** Static web export writes one page per lesson. */
export function generateStaticParams(): { id: string }[] {
  return LESSON_ORDER.map((id) => ({ id }));
}
