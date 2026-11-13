import { tileKey } from '../tiles';

import type { CardLine, Lesson, TileDisplay } from './types';

/** URL-safe ids: lowercase words joined by single hyphens. */
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A hand on the card is always 14 tiles, and each printed character is one tile. */
export const HAND_SIZE = 14;

/** More choices than this won't fit a phone-width mat at a tappable size. */
export const MAX_CHOICES = 10;

function displayErrors(display: TileDisplay, at: string): string[] {
  const errors: string[] = [];
  if (display.tiles.length === 0) errors.push(`${at}: no tiles to show`);
  if (!display.caption.trim()) errors.push(`${at}: tiles need a caption`);
  if (display.groups) {
    if (display.groups.some((g) => !Number.isInteger(g) || g < 1)) errors.push(`${at}: group sizes must be whole and positive`);
    const total = display.groups.reduce((a, b) => a + b, 0);
    if (total !== display.tiles.length) {
      errors.push(`${at}: groups add up to ${total}, but there are ${display.tiles.length} tiles`);
    }
  }
  return errors;
}

function cardErrors(card: CardLine, at: string): string[] {
  const errors: string[] = [];
  if (card.segments.length === 0) errors.push(`${at}: card line has no groups`);
  if (card.segments.some((s) => !/^\S+$/.test(s.text))) errors.push(`${at}: card groups must be printed without spaces`);
  const count = card.segments.reduce((n, s) => n + s.text.length, 0);
  if (count !== HAND_SIZE) errors.push(`${at}: card line has ${count} tiles, not ${HAND_SIZE}`);
  if (!(card.value > 0)) errors.push(`${at}: card line needs a value`);
  if (!card.spoken.trim()) errors.push(`${at}: card line needs a spoken version`);
  return errors;
}

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
        errors.push(...displayErrors(step, where(step.id)));
        if (step.card) {
          errors.push(...cardErrors(step.card, where(step.id)));
          // Tiles shown under a line are that line laid out, group for group.
          const sizes = step.card.segments.map((s) => s.text.length).join(',');
          if (step.groups && step.groups.join(',') !== sizes) {
            errors.push(`${where(step.id)}: tile groups ${step.groups.join(',')} don't match the card line's ${sizes}`);
          }
        }
        break;
      case 'tap': {
        if (!step.prompt.trim()) errors.push(`${where(step.id)}: empty prompt`);
        if (!step.hint.trim()) errors.push(`${where(step.id)}: empty hint`);
        if (!step.explanation.trim()) errors.push(`${where(step.id)}: empty explanation`);
        const correct = step.choices.filter((c) => c.correct).length;
        if (step.choices.length < 2) errors.push(`${where(step.id)}: needs at least 2 choices`);
        if (step.choices.length > MAX_CHOICES) errors.push(`${where(step.id)}: more than ${MAX_CHOICES} choices won't fit`);
        if (step.given) errors.push(...displayErrors(step.given, where(step.id)));
        if (step.card) errors.push(...cardErrors(step.card, where(step.id)));
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
