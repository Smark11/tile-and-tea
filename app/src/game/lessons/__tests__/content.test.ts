// Rules checks on the shipped lesson content: the facts the lessons teach,
// and the answers they accept, must agree with American Mah Jongg rules.

import { copiesOf, sameKind, tileKey, type TileKind } from '../../tiles';
import { EVENS_LINE, LIKE_FIVES_LINE, WINDS_LINE } from '../content/cardLines';
import { bam, crak, dot, FLOWER, JOKER, NORTH, of, SOAP } from '../content/tiles';
import {
  HAND_SIZE,
  lessonById,
  LESSONS,
  MAX_CHOICES,
  PLANNED_LESSONS,
  validateLesson,
  type CardLine,
  type Lesson,
  type LessonStep,
  type TapStep,
} from '..';

const lesson = (id: string): Lesson => {
  const found = lessonById(id);
  if (!found) throw new Error(`no lesson ${id}`);
  return found;
};
const step = (lessonId: string, stepId: string): LessonStep => {
  const found = lesson(lessonId).steps.find((s) => s.id === stepId);
  if (!found) throw new Error(`no step ${lessonId} › ${stepId}`);
  return found;
};
const tap = (lessonId: string, stepId: string): TapStep => {
  const s = step(lessonId, stepId);
  if (s.kind !== 'tap') throw new Error(`${stepId} isn't a question`);
  return s;
};
const correctKeys = (s: TapStep) => [...new Set(s.choices.filter((c) => c.correct).map((c) => tileKey(c.tile)))].sort();
const allText = (l: Lesson) =>
  l.steps
    .map((s) => (s.kind === 'tap' ? `${s.prompt} ${s.hint} ${s.explanation}` : `${s.title} ${s.body}`))
    .join(' ');

/** Splits tiles into the display's groups. */
function groupsOf(tiles: readonly TileKind[], sizes: readonly number[]): TileKind[][] {
  const out: TileKind[][] = [];
  let at = 0;
  for (const size of sizes) {
    out.push(tiles.slice(at, at + size));
    at += size;
  }
  return out;
}

/** A group is legal if every real tile matches, and a Joker only joins groups of 3+. */
function isLegalGroup(group: readonly TileKind[]): boolean {
  const real = group.filter((t) => t.type !== 'joker');
  if (real.length < group.length && group.length < 3) return false;
  return real.every((t) => sameKind(t, real[0]));
}

describe('the lesson path', () => {
  it('ships lessons 1 to 5 in order, with nothing left planned', () => {
    expect(LESSONS.map((l) => l.id)).toEqual(['meet-the-tiles', 'groups', 'reading-a-card', 'jokers', 'charleston']);
    expect(PLANNED_LESSONS).toEqual([]);
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))('%s is a 3–6 minute interactive lesson', (_, l) => {
    expect(validateLesson(l)).toEqual([]);
    expect(l.minutes).toBeGreaterThanOrEqual(3);
    expect(l.minutes).toBeLessThanOrEqual(6);
    expect(l.steps.length).toBeGreaterThanOrEqual(9);
    expect(l.steps.filter((s) => s.kind === 'tap').length).toBeGreaterThanOrEqual(3);
  });

  it('never names the League or its card', () => {
    for (const l of LESSONS) expect(allText(l)).not.toMatch(/NMJL|National Mah ?Jongg League/i);
  });
});

describe('tiles shown in lessons', () => {
  const displays = LESSONS.flatMap((l) =>
    l.steps.flatMap((s) => {
      if (s.kind === 'tiles') return [{ where: `${l.id} › ${s.id}`, display: s }];
      if (s.kind === 'tap' && s.given) return [{ where: `${l.id} › ${s.id}`, display: s.given }];
      return [];
    }),
  );

  it('never show more copies of a tile than a set holds', () => {
    for (const { where, display } of displays) {
      const counts = new Map<string, number>();
      for (const t of display.tiles) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
      for (const [key, n] of counts) {
        const kind = display.tiles.find((t) => tileKey(t) === key)!;
        expect({ where, key, n: Math.min(n, copiesOf(kind)) }).toEqual({ where, key, n });
      }
    }
  });

  it('only group tiles legally, except where a lesson is sorting tiles or showing what is not allowed', () => {
    const illegalOnPurpose = new Set([
      // Tiles sorted by type, not groups in a hand.
      'meet-the-tiles › winds-and-dragons',
      'reading-a-card › dragon-partners',
      // The point of the step: a Joker can't make a pair.
      'jokers › never-pairs',
    ]);
    for (const { where, display } of displays) {
      if (!display.groups) continue;
      const legal = groupsOf(display.tiles, display.groups).every(isLegalGroup);
      expect({ where, legal }).toEqual({ where, legal: !illegalOnPurpose.has(where) });
    }
  });

  it('keep every question small enough to fit a phone', () => {
    for (const l of LESSONS) {
      for (const s of l.steps) if (s.kind === 'tap') expect(s.choices.length).toBeLessThanOrEqual(MAX_CHOICES);
    }
  });
});

describe('card lines', () => {
  const lines: [string, CardLine][] = [
    ['evens', EVENS_LINE],
    ['like fives', LIKE_FIVES_LINE],
    ['winds', WINDS_LINE],
  ];

  it.each(lines)('%s is a full 14-tile hand', (_, line) => {
    expect(line.segments.reduce((n, s) => n + s.text.length, 0)).toBe(HAND_SIZE);
  });

  it.each(lines)('%s prints each group as one repeated character', (_, line) => {
    for (const s of line.segments) expect(new Set(s.text).size).toBe(1);
  });

  it('gives Flowers and Winds no suit color, and numbers and Dragons one', () => {
    for (const [, line] of lines) {
      for (const s of line.segments) {
        const suitless = /^[FNEWS]+$/.test(s.text);
        expect({ text: s.text, colored: s.ink !== undefined }).toEqual({ text: s.text, colored: !suitless });
      }
    }
  });

  it('show the laid-out hand group for group under each line', () => {
    for (const l of LESSONS) {
      for (const s of l.steps) {
        if (s.kind !== 'tiles' || !s.card) continue;
        expect(s.tiles).toHaveLength(HAND_SIZE);
        expect(s.groups).toEqual(s.card.segments.map((seg) => seg.text.length));
      }
    }
  });
});

describe('Lesson 2: groups', () => {
  it('a Joker can make a pung or a kong, but never a pair', () => {
    expect(correctKeys(tap('groups', 'make-a-pung'))).toEqual(['dot-7', 'joker']);
    expect(correctKeys(tap('groups', 'make-a-kong'))).toEqual(['bam-9', 'joker']);
    expect(correctKeys(tap('groups', 'pair-the-five'))).toEqual(['dot-5']);
  });

  it('any two Flowers pair, and the two shown have different prints', () => {
    const q = tap('groups', 'pair-of-flowers');
    expect(correctKeys(q)).toEqual(['flower']);
    expect(q.choices.filter((c) => c.tile.type === 'flower')).toHaveLength(2);
  });

  it('a quint of suit tiles needs a Joker, since there are only four of each', () => {
    expect(copiesOf(crak(4))).toBe(4);
    expect(copiesOf(FLOWER)).toBe(8);
    const quint = step('groups', 'quint');
    expect(quint.kind === 'tiles' && quint.tiles.filter((t) => t.type === 'joker')).toHaveLength(1);
  });
});

describe('Lesson 3: reading a card', () => {
  it('pairs each suit with its own Dragon', () => {
    expect(correctKeys(tap('reading-a-card', 'crak-dragon'))).toEqual(['dragon-red']);
    expect(correctKeys(tap('reading-a-card', 'which-dragons'))).toEqual(['dragon-green', 'dragon-red']);
    const body = (step('reading-a-card', 'dragon-partners') as { body: string }).body;
    expect(body).toContain('Green goes with Bams, Red with Craks, and Soap with Dots');
  });

  it('the evens line in Dots uses exactly Flowers and the 2, 4, 6, and 8 Dots', () => {
    expect(correctKeys(tap('reading-a-card', 'tiles-on-the-line'))).toEqual(
      ['dot-2', 'dot-4', 'dot-6', 'dot-8', 'flower'].sort(),
    );
  });

  it('finds the pairs on the winds line', () => {
    expect(correctKeys(tap('reading-a-card', 'find-the-pairs'))).toEqual(['flower', 'wind-E']);
  });

  it('teaches that a concealed hand may only call its last tile, for Mah Jongg', () => {
    expect(WINDS_LINE.concealed).toBe(true);
    expect((step('reading-a-card', 'x-or-c') as { body: string }).body).toMatch(
      /only discard you may call is your last tile, for Mah Jongg/,
    );
  });
});

describe('Lesson 4: Jokers', () => {
  it('only fills the groups of three or more on a line', () => {
    const q = tap('jokers', 'where-jokers-fit');
    expect(q.card).toBe(EVENS_LINE);
    expect(correctKeys(q)).toEqual(['bam-4', 'bam-8', 'flower']);
  });

  it('the fifth tile of a quint is a Joker, and only the real tile redeems one', () => {
    expect(correctKeys(tap('jokers', 'quint-needs-joker'))).toEqual(['joker']);
    expect(correctKeys(tap('jokers', 'which-swap'))).toEqual(['crak-9']);
  });

  it('states the joker rules plainly', () => {
    const text = allText(lesson('jokers'));
    expect(text).toMatch(/can’t be a single tile, and it can’t be part of a pair/);
    expect(text).toMatch(/Swap only on your turn/);
    expect(text).toMatch(/never pass one in the Charleston/);
  });

  it('shows a Soap and a Joker only as what is not allowed', () => {
    const s = step('jokers', 'never-pairs');
    expect(s.kind === 'tiles' && isLegalGroup(s.tiles)).toBe(false);
    expect(s.kind === 'tiles' && s.caption).toMatch(/do not make a pair/);
  });
});

describe('Lesson 5: the Charleston', () => {
  it('teaches the passes in the right order', () => {
    const text = allText(lesson('charleston'));
    expect(text).toMatch(/to the player on your right.*across from you.*on your left/s);
    expect(text).toMatch(/Pass left, then across, then right/);
    expect(text).toMatch(/second Charleston is optional/);
    expect(text).toMatch(/none, one, two, or three/);
    expect(text).toMatch(/the first left, and the second right/);
    expect(text).toMatch(/East discards first/);
  });

  it('sends East’s first pass to South, on East’s right', () => {
    expect(correctKeys(tap('charleston', 'pass-right'))).toEqual(['wind-S']);
  });

  it('never lets a Joker be passed', () => {
    expect(correctKeys(tap('charleston', 'never-pass'))).toEqual(['joker']);
    const choose = tap('charleston', 'choose-a-pass');
    expect(choose.choices.some((c) => c.tile.type === 'joker' && !c.correct)).toBe(true);
  });

  it('passes exactly the three tiles the line has no use for', () => {
    const q = tap('charleston', 'choose-a-pass');
    expect(q.choices.filter((c) => c.correct)).toHaveLength(3);
    expect(correctKeys(q)).toEqual(['bam-9', 'crak-5', 'wind-N']);
    // Everything kept is on the line (in Dots), or a Joker.
    const kept = q.choices.filter((c) => !c.correct).map((c) => tileKey(c.tile));
    const onLine = new Set(['flower', 'dot-2', 'dot-4', 'dot-6', 'dot-8', 'joker']);
    for (const k of kept) expect(onLine.has(k)).toBe(true);
  });
});

describe('test helpers', () => {
  it('judge groups the way the rules do', () => {
    expect(isLegalGroup(of(3, dot(7)))).toBe(true);
    expect(isLegalGroup([dot(7), dot(7), JOKER])).toBe(true);
    expect(isLegalGroup([SOAP, JOKER])).toBe(false);
    expect(isLegalGroup([JOKER])).toBe(false);
    expect(isLegalGroup([bam(3), crak(3), dot(3)])).toBe(false);
    expect(isLegalGroup([NORTH])).toBe(true);
  });
});
