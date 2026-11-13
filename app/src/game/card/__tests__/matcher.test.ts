import {
  CURRENT_CARD,
  declarationProblem,
  findMahJongg,
  handVariants,
  matchHand,
  MIN_JOKER_GROUP,
  type ConcreteUnit,
  type Declaration,
  type Exposure,
  type Hand,
  type HandVariant,
  parseHand,
} from '..';
import { createRng, shuffle, type Rng } from '../../rng';
import { ALL_KINDS, copiesOf, tileKey, type TileKind } from '../../tiles';

const card = CURRENT_CARD;
const JOKER: TileKind = { type: 'joker' };
const FLOWER: TileKind = { type: 'flower' };
const crak = (rank: number): TileKind => ({ type: 'suited', suit: 'crak', rank: rank as 1 });
const dot = (rank: number): TileKind => ({ type: 'suited', suit: 'dot', rank: rank as 1 });
const bam = (rank: number): TileKind => ({ type: 'suited', suit: 'bam', rank: rank as 1 });
const wind = (w: 'N' | 'E' | 'W' | 'S'): TileKind => ({ type: 'wind', wind: w });
const dragon = (d: 'red' | 'green' | 'white'): TileKind => ({ type: 'dragon', dragon: d });
const of = (n: number, kind: TileKind): TileKind[] => Array<TileKind>(n).fill(kind);

const hand = (id: string): Hand => {
  const h = card.hands.find((x) => x.id === id);
  if (!h) throw new Error(`no hand ${id}`);
  return h;
};
const variantsById = new Map(card.hands.map((h) => [h.id, handVariants(h.groups)]));
const variants = (h: Hand): HandVariant[] => variantsById.get(h.id) ?? [];
const isFlexible = (u: ConcreteUnit) => u.count >= MIN_JOKER_GROUP;

/**
 * Each unit's tiles, using real tiles while the set has them and Jokers past
 * that (a quint of 4 Craks is four 4 Craks and a Joker). `extraJokers[i]`
 * swaps that many more of unit i's real tiles for Jokers.
 */
function unitTiles(units: readonly ConcreteUnit[], extraJokers: readonly number[] = []): TileKind[][] {
  const used = new Map<string, number>();
  return units.map((u, i) => {
    const jokers = extraJokers[i] ?? 0;
    return Array.from({ length: u.count }, (_, j) => {
      if (j < jokers) return JOKER;
      const n = used.get(tileKey(u.kind)) ?? 0;
      if (n >= copiesOf(u.kind)) return JOKER;
      used.set(tileKey(u.kind), n + 1);
      return u.kind;
    });
  });
}

const concealedOnly = (groups: TileKind[][], rng?: Rng): Declaration => {
  const tiles = groups.flat();
  return { concealed: rng ? shuffle(tiles, rng) : tiles };
};

const ids = (d: Declaration) => findMahJongg(d, card).map((m) => m.hand.id);

/**
 * A second, deliberately different referee: try every way to pin each
 * exposure to a group of the same tile and size, then see whether the rack's
 * tiles can be placed one by one into the remaining slots (a bipartite
 * matching), where a Joker can only take a slot in a group of 3+.
 */
function referee(h: Hand, d: Declaration): boolean {
  const exposures = d.exposures ?? [];
  if (h.concealed && exposures.length > 0) return false;
  return variants(h).some((v) => {
    const pin = (e: number, taken: Set<number>): boolean => {
      if (e === exposures.length) return placeRack(v.units, taken, d.concealed);
      const exp = exposures[e];
      return v.units.some(
        (u, i) =>
          !taken.has(i) &&
          isFlexible(u) &&
          u.count === exp.length &&
          exp.every((k) => k.type === 'joker' || tileKey(k) === tileKey(u.kind)) &&
          pin(e + 1, new Set([...taken, i])),
      );
    };
    return pin(0, new Set());
  });
}

function placeRack(units: readonly ConcreteUnit[], taken: Set<number>, rack: readonly TileKind[]): boolean {
  const slots = units.flatMap((u, i) => (taken.has(i) ? [] : of(u.count, u.kind).map((k) => ({ key: tileKey(k), flexible: isFlexible(u) }))));
  if (slots.length !== rack.length) return false;
  const fits = (tile: TileKind, s: number) => (tile.type === 'joker' ? slots[s].flexible : tileKey(tile) === slots[s].key);
  const owner: number[] = slots.map(() => -1);
  const augment = (t: number, seen: boolean[]): boolean => {
    for (let s = 0; s < slots.length; s++) {
      if (seen[s] || !fits(rack[t], s)) continue;
      seen[s] = true;
      if (owner[s] < 0 || augment(owner[s], seen)) {
        owner[s] = t;
        return true;
      }
    }
    return false;
  };
  return rack.every((_, t) => augment(t, slots.map(() => false)));
}

describe('declarationProblem', () => {
  const good = concealedOnly(unitTiles(variants(hand('honors-1'))[0].units));

  it('accepts a real 14-tile declaration', () => {
    expect(declarationProblem(good)).toBeNull();
  });

  it('needs exactly 14 tiles, counting exposures', () => {
    expect(declarationProblem({ concealed: good.concealed.slice(1) })).toBe('tile-count');
    expect(declarationProblem({ concealed: [...good.concealed, JOKER] })).toBe('tile-count');
    expect(declarationProblem({ concealed: good.concealed.slice(3), exposures: [of(4, wind('E'))] })).toBe('tile-count');
    expect(declarationProblem({ concealed: [] })).toBe('tile-count');
  });

  it('rejects more of a tile than the set holds, across rack and exposures', () => {
    expect(declarationProblem({ concealed: [...of(5, crak(4)), ...of(9, crak(5))] })).toBe('too-many-copies');
    expect(declarationProblem({ concealed: [...of(9, JOKER), ...of(5, FLOWER)] })).toBe('too-many-copies');
    expect(declarationProblem({ concealed: [...of(9, FLOWER), ...of(5, JOKER)] })).toBe('too-many-copies');
    expect(
      declarationProblem({ concealed: [crak(4), ...of(3, dot(2)), ...of(3, dot(3)), ...of(3, dot(4))], exposures: [of(4, crak(4))] }),
    ).toBe('too-many-copies');
    // Eight Flowers and eight Jokers are fine.
    expect(declarationProblem({ concealed: [...of(8, FLOWER), ...of(6, JOKER)] })).toBeNull();
  });

  it('only allows exposures of 3 or more of one real tile, Jokers aside', () => {
    const rest = (n: number) => [...of(4, bam(1)), ...of(4, bam(2)), ...of(4, bam(3)), ...of(4, bam(4))].slice(0, n);
    expect(declarationProblem({ concealed: rest(12), exposures: [of(2, crak(4))] })).toBe('exposure-too-small');
    expect(declarationProblem({ concealed: rest(11), exposures: [[crak(4), crak(4), crak(5)]] })).toBe('exposure-mixed');
    expect(declarationProblem({ concealed: rest(11), exposures: [[crak(4), JOKER, dot(4)]] })).toBe('exposure-mixed');
    expect(declarationProblem({ concealed: rest(11), exposures: [of(3, JOKER)] })).toBe('exposure-all-jokers');
    expect(declarationProblem({ concealed: rest(11), exposures: [[JOKER, crak(4), JOKER]] })).toBeNull();
  });

  it('makes the matchers say no rather than guess', () => {
    const bad = { concealed: [...of(5, crak(4)), ...of(9, crak(5))] };
    expect(findMahJongg(bad, card)).toEqual([]);
    expect(card.hands.every((h) => matchHand(h, bad) === null)).toBe(true);
  });
});

describe('every hand on the card, played with real tiles', () => {
  it.each(card.hands.map((h) => [h.id, h] as const))('%s: every variant is Mah Jongg for that hand alone', (_, h) => {
    const rng = createRng(h.id);
    for (const v of variants(h)) {
      const d = concealedOnly(unitTiles(v.units), rng);
      const matches = findMahJongg(d, card);
      expect(matches.map((m) => m.hand.id)).toEqual([h.id]);
      const [m] = matches;
      expect(m.variant.key).toBe(v.key);
      expect(m.units.map((u) => [tileKey(u.kind), u.count])).toEqual(v.units.map((u) => [tileKey(u.kind), u.count]));
      // Only quints need Jokers when every real tile is used.
      expect(m.jokers).toBe(d.concealed.filter((k) => k.type === 'joker').length);
    }
  });
});

describe('Jokers', () => {
  /** Every way to put Jokers into a variant's groups of 3+, as Jokers per unit. */
  function jokerPatterns(units: readonly ConcreteUnit[]): number[][] {
    let out: number[][] = [[]];
    for (const u of units) out = out.flatMap((p) => Array.from({ length: isFlexible(u) ? u.count + 1 : 1 }, (_, j) => [...p, j]));
    return out;
  }

  it.each(card.hands.map((h) => [h.id, h] as const))('%s: fill any group of 3+, up to all 8', (_, h) => {
    const v = variants(h)[0];
    let tried = 0;
    for (const pattern of jokerPatterns(v.units)) {
      const groups = unitTiles(v.units, pattern);
      const jokers = groups.flat().filter((k) => k.type === 'joker').length;
      if (jokers > 8) continue;
      tried += 1;
      const m = matchHand(h, concealedOnly(groups));
      expect(m).not.toBeNull();
      expect(m?.jokers).toBe(jokers);
      m?.units.forEach((u, i) => {
        expect(u.naturals + u.jokers).toBe(u.count);
        if (!isFlexible(v.units[i])) expect(u.jokers).toBe(0);
      });
    }
    expect(tried).toBeGreaterThan(0);
  });

  it.each(card.hands.filter((h) => variants(h)[0].units.some((u) => !isFlexible(u))).map((h) => [h.id, h] as const))(
    '%s: never stand in for a single or a pair',
    (_, h) => {
      for (const v of variants(h)) {
        v.units.forEach((u, i) => {
          if (isFlexible(u)) return;
          const groups = unitTiles(v.units);
          groups[i] = [JOKER, ...groups[i].slice(1)];
          expect(matchHand(h, concealedOnly(groups))).toBeNull();
        });
      }
    },
  );

  it('can complete more than one hand, listed highest value first', () => {
    // 333 666 in Craks and 8 Jokers: 333 666 999 FFFFF (threes-4, 35) or
    // 333 666 9999 DDDD (threes-2, 30) or 333 4444 555 6666 (runs-1, 25).
    const two = { concealed: [...of(3, crak(3)), ...of(3, crak(6)), ...of(8, JOKER)] };
    expect(ids(two)).toEqual(['threes-4', 'threes-2', 'runs-1']);
    const [best] = findMahJongg(two, card);
    expect(best.units.map((u) => [tileKey(u.kind), u.naturals, u.jokers])).toEqual([
      ['crak-3', 3, 0],
      ['crak-6', 3, 0],
      ['crak-9', 0, 3],
      ['flower', 0, 5],
    ]);
    // NNN SSS and 8 Jokers: NNN EEEE WWWW SSS (honors-1) or NNN SSS DDDD DDDD
    // (honors-2). Both pay 25, so card order breaks the tie.
    const tie = { concealed: [...of(3, wind('N')), ...of(3, wind('S')), ...of(8, JOKER)] };
    expect(ids(tie)).toEqual(['honors-1', 'honors-2']);
    // One more real tile settles it.
    const settled = { concealed: [...of(3, wind('N')), ...of(3, wind('S')), wind('E'), ...of(7, JOKER)] };
    expect(ids(settled)).toEqual(['honors-1']);
  });

  it('lay out real tiles first and Jokers in the gaps', () => {
    // FF 3333 4444 7777 with two Jokers among the 7s.
    const m = matchHand(hand('addition-1'), { concealed: [...of(2, FLOWER), ...of(4, crak(3)), ...of(4, crak(4)), crak(7), crak(7), JOKER, JOKER] });
    expect(m?.units.map((u) => [u.naturals, u.jokers])).toEqual([
      [2, 0],
      [4, 0],
      [4, 0],
      [2, 2],
    ]);
  });
});

describe('exposures', () => {
  const exposedHands = card.hands.filter((h) => !h.concealed);
  const concealedHands = card.hands.filter((h) => h.concealed);

  it.each(exposedHands.map((h) => [h.id, h] as const))('%s: any set of its pungs and kongs may be exposed, Jokers and all', (_, h) => {
    for (const v of variants(h)) {
      const flex = v.units.map((u, i) => (isFlexible(u) ? i : -1)).filter((i) => i >= 0);
      for (let mask = 1; mask < 1 << flex.length; mask++) {
        const exposed = flex.filter((_, b) => mask & (1 << b));
        // A Joker in each exposure (beside its called tile) when there's room.
        const groups = unitTiles(v.units, v.units.map((u, i) => (exposed.includes(i) ? 1 : 0)));
        const d: Declaration = {
          concealed: groups.filter((_, i) => !exposed.includes(i)).flat(),
          exposures: exposed.map((i) => groups[i]),
        };
        const m = matchHand(h, d);
        expect(m).not.toBeNull();
        expect(m?.units.filter((u) => u.exposure !== null).map((u) => u.exposure)).toEqual(exposed.map((_, e) => e));
      }
    }
  });

  it('the card’s concealed hands are singles and pairs, with nothing to expose', () => {
    expect(concealedHands.map((h) => h.id)).toEqual(['year-4', 'pairs-1', 'pairs-2', 'pairs-3', 'pairs-4']);
    expect(concealedHands.every((c) => variants(c).every((v) => v.units.every((u) => !isFlexible(u))))).toBe(true);
  });

  it('a concealed hand with pungs wins only when nothing was exposed', () => {
    const c = parseHand({ id: 'test-c', notation: '333:a 666:a 9999:a DDDD:a', concealed: true, value: 50 }, 'threes');
    const held = [...of(3, crak(3)), ...of(3, crak(6)), ...of(4, crak(9)), ...of(3, dragon('red')), JOKER];
    expect(matchHand(c, { concealed: held })).not.toBeNull();
    expect(matchHand(c, { concealed: held.slice(3), exposures: [of(3, crak(3))] })).toBeNull();
    // The same tiles complete the card's exposed twin of that hand.
    expect(matchHand(hand('threes-2'), { concealed: held.slice(3), exposures: [of(3, crak(3))] })).not.toBeNull();
  });

  it('three of a tile held as singles can’t be exposed as a pung', () => {
    // FF 2027 2027 2027 has three Soaps, as singles; laid out as a pung, it isn't the hand.
    const v = variants(hand('year-4')).find((x) => x.suits.a === 'bam' && x.suits.b === 'crak');
    const tiles = unitTiles(v?.units ?? []).flat();
    expect(matchHand(hand('year-4'), { concealed: tiles })).not.toBeNull();
    const rest = tiles.filter((k) => tileKey(k) !== 'dragon-white');
    expect(matchHand(hand('year-4'), { concealed: rest, exposures: [of(3, dragon('white'))] })).toBeNull();
  });

  it('must be exactly one of the hand’s groups: same tile, same size', () => {
    // NNN EEEE WWWW SSS
    const rack = [...of(4, wind('E')), ...of(4, wind('W')), ...of(3, wind('S'))];
    const h = hand('honors-1');
    expect(matchHand(h, { concealed: rack, exposures: [of(3, wind('N'))] })).not.toBeNull();
    // A kong of Easts exposed as only a pung, the fourth East held, isn't the kong.
    const split = { concealed: [...of(3, wind('N')), wind('E'), ...of(4, wind('W')), ...of(3, wind('S'))], exposures: [of(3, wind('E'))] };
    expect(declarationProblem(split)).toBeNull();
    expect(matchHand(h, split)).toBeNull();
    // A pung exposed where the hand wants a pung, plus a Joker held for it, isn't a kong either.
    expect(matchHand(h, { concealed: [JOKER, ...rack.slice(4)], exposures: [of(3, wind('E')), of(3, wind('N'))] })).toBeNull();
  });

  it('can’t be a pair or single dressed up, even with a Joker', () => {
    // runs-3: xx xx+1 xx+2 NNNN SSSS. Exposing 4 Crak, 4 Crak, Joker can't be the pair of 4s.
    const h = hand('runs-3');
    const d = {
      concealed: [crak(5), crak(5), crak(6), crak(6), ...of(4, wind('N')), ...of(3, wind('S'))],
      exposures: [[crak(4), crak(4), JOKER]],
    };
    expect(declarationProblem(d)).toBeNull();
    expect(matchHand(h, d)).toBeNull();
    // The same tiles all held, Joker swapped for a South, are a win.
    expect(matchHand(h, { concealed: [crak(4), crak(4), crak(5), crak(5), crak(6), crak(6), ...of(4, wind('N')), ...of(4, wind('S'))] })).not.toBeNull();
  });

  it('pin down suits: an exposure in one suit rules out variants that need it elsewhere', () => {
    // evens-3: 4444:a DDD:a 8888:b DDD:b. Exposing a Red pung (Craks' Dragon)
    // means the Craks must hold the 4s or the 8s.
    const h = hand('evens-3');
    const ok = { concealed: [...of(4, crak(4)), ...of(4, dot(8)), ...of(3, dragon('white'))], exposures: [of(3, dragon('red'))] };
    const m = matchHand(h, ok);
    expect(m?.variant.suits).toEqual({ a: 'crak', b: 'dot' });
    const wrong = { concealed: [...of(4, bam(4)), ...of(4, dot(8)), ...of(3, dragon('white'))], exposures: [of(3, dragon('red'))] };
    expect(matchHand(h, wrong)).toBeNull();
  });
});

describe('near misses', () => {
  it.each(card.hands.map((h) => [h.id, h] as const))('%s: one wrong tile is no Mah Jongg for that hand', (_, h) => {
    const rng = createRng(`miss-${h.id}`);
    for (const v of variants(h)) {
      const tiles = unitTiles(v.units).flat();
      const i = Math.floor(rng() * tiles.length);
      const inHand = new Set(v.units.map((u) => tileKey(u.kind)));
      const stranger = ALL_KINDS.filter((k) => k.type !== 'joker' && !inHand.has(tileKey(k)));
      tiles[i] = stranger[Math.floor(rng() * stranger.length)];
      expect(matchHand(h, { concealed: tiles })).toBeNull();
    }
  });

  it('a random rack from a shuffled wall is almost never Mah Jongg', () => {
    const rng = createRng('walls');
    const pool = ALL_KINDS.flatMap((k) => of(copiesOf(k), k));
    let wins = 0;
    for (let n = 0; n < 300; n++) {
      const d = { concealed: shuffle(pool, rng).slice(0, 14) };
      const matches = findMahJongg(d, card);
      wins += matches.length > 0 ? 1 : 0;
      for (const m of matches) expect(referee(m.hand, d)).toBe(true);
    }
    expect(wins).toBe(0);
  });
});

describe('agrees with an independent referee', () => {
  it('on thousands of seeded near-winning declarations, exposures included', () => {
    const rng = createRng('referee');
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
    let checked = 0;
    let wins = 0;
    for (let n = 0; n < 2500; n++) {
      const h = pick(card.hands);
      const v = pick(variants(h));
      const groups = unitTiles(
        v.units,
        v.units.map((u) => (isFlexible(u) && rng() < 0.35 ? Math.floor(rng() * (u.count + 1)) : 0)),
      );
      // Expose some groups of 3+ (on a C hand too: the referee must refuse it).
      const exposed = v.units.map((u, i) => (isFlexible(u) && rng() < 0.3 ? i : -1)).filter((i) => i >= 0 && groups[i].some((k) => k.type !== 'joker'));
      let rack = groups.filter((_, i) => !exposed.includes(i)).flat();
      // Then spoil it, sometimes: swap rack tiles for random tiles or Jokers.
      for (let s = rng() < 0.5 ? Math.floor(rng() * 3) : 0; s > 0 && rack.length > 0; s--) {
        rack[Math.floor(rng() * rack.length)] = pick(ALL_KINDS);
      }
      rack = shuffle(rack, rng);
      const d: Declaration = { concealed: rack, exposures: exposed.map((i) => groups[i] as Exposure) };
      if (declarationProblem(d)) continue;
      checked += 1;
      for (const other of [h, pick(card.hands), pick(card.hands)]) {
        const ours = matchHand(other, d) !== null;
        expect([other.id, ours]).toEqual([other.id, referee(other, d)]);
        if (ours) wins += 1;
      }
    }
    // The sample really does exercise both answers.
    expect(checked).toBeGreaterThan(2000);
    expect(wins).toBeGreaterThan(500);
  });

  it('decides a whole card quickly enough for a live game', () => {
    const v = variants(hand('quints-4'))[0];
    const d = concealedOnly(unitTiles(v.units));
    const start = Date.now();
    for (let n = 0; n < 200; n++) findMahJongg(d, card);
    expect((Date.now() - start) / 200).toBeLessThan(16);
  });
});
