import { tileKey } from '../tiles';

import type { Lesson } from './types';

/** URL-safe ids: lowercase words joined by single hyphens. */
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Everything wrong with a lesson's data, as readable messages; empty when it's
 * sound. A test runs this over every shipped lesson.
 */
export function validateLesson(lesson: Lesson): string[] {
  const errors: string[] = [];
  const where = (stepId: string) => `${lesson.id} › ${stepId}`;

  if (!ID_PATTERN.test(lesson.id)) errors.push(`lesson id "${lesson.id}" isn't URL-safe`);
  if (!lesson.title.trim()) errors.push(`${lesson.id}: missing title`);
  if (!lesson.summary.trim()) errors.push(`${lesson.id}: missing summary`);
  if (!(lesson.minutes > 0)) errors.push(`${lesson.id}: minutes must be positive`);
  if (lesson.steps.length === 0) errors.push(`${lesson.id}: has no steps`);

  const seen = new Set<string>();
  for (const step of lesson.steps) {
    if (!ID_PATTERN.test(step.id)) errors.push(`${where(step.id)}: step id isn't URL-safe`);
    if (seen.has(step.id)) errors.push(`${where(step.id)}: duplicate step id`);
    seen.add(step.id);

    switch (step.kind) {
      case 'text':
        if (!step.title.trim() || !step.body.trim()) errors.push(`${where(step.id)}: empty text`);
        break;
      case 'tiles':
        if (!step.title.trim() || !step.body.trim()) errors.push(`${where(step.id)}: empty text`);
        if (step.tiles.length === 0) errors.push(`${where(step.id)}: no tiles to show`);
        if (!step.caption.trim()) errors.push(`${where(step.id)}: tiles need a caption`);
        break;
      case 'tap': {
        if (!step.prompt.trim()) errors.push(`${where(step.id)}: empty prompt`);
        if (!step.hint.trim()) errors.push(`${where(step.id)}: empty hint`);
        if (!step.explanation.trim()) errors.push(`${where(step.id)}: empty explanation`);
        const correct = step.choices.filter((c) => c.correct).length;
        if (step.choices.length < 2) errors.push(`${where(step.id)}: needs at least 2 choices`);
        if (correct === 0) errors.push(`${where(step.id)}: no correct choice`);
        if (correct === step.choices.length) {
          errors.push(`${where(step.id)}: every choice is correct, so there's nothing to tell apart`);
        }
        // Two tiles of the same kind look identical, so they must agree.
        const verdicts = new Map<string, boolean>();
        for (const choice of step.choices) {
          const key = tileKey(choice.tile);
          const isCorrect = choice.correct === true;
          if (verdicts.has(key) && verdicts.get(key) !== isCorrect) {
            errors.push(`${where(step.id)}: two ${key} tiles disagree on whether they're correct`);
          }
          verdicts.set(key, isCorrect);
        }
        break;
      }
    }
  }
  return errors;
}

/** Problems across a whole catalog: each lesson's own, plus duplicate ids. */
export function validateCatalog(lessons: readonly Lesson[]): string[] {
  const errors = lessons.flatMap(validateLesson);
  const ids = new Set<string>();
  for (const lesson of lessons) {
    if (ids.has(lesson.id)) errors.push(`duplicate lesson id "${lesson.id}"`);
    ids.add(lesson.id);
  }
  return errors;
}
