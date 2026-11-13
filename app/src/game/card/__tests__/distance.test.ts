import {
  cardDistances,
  CURRENT_CARD,
  declarationProblem,
  handDistance,
  handVariants,
  holdingProblem,
  matchHand,
  MIN_JOKER_GROUP,
  parseHand,
  type ConcreteUnit,
  type Exposure,
  type Hand,
  type HandDistance,
  type HandReach,
  type Holding,
} from '..';
import { createRng, shuffle, type Rng } from '../../rng';
import { ALL_KINDS, copiesOf, createTileSet, tileKey, type TileKind } from '../../tiles';

const card = CURRENT_CARD;
const JOKER: TileKind = { type: 'joker' };
const FLOWER: TileKind = { type: 'flower' };
const crak = (rank: number): TileKind => ({ type: 'suited', suit: 'crak', rank: rank as 1 });
const dot = (rank: number): TileKind => ({ type: 'suited', suit: 'dot', rank: rank as 1 });
const bam = (rank: number): TileKind => ({ type: 'suited', suit: 'bam', rank: rank as 1 });
const wind = (w: 'N' | 'E' | 'W' | 'S'): TileKind => ({ type: 'wind', wind: w });
const of = (n: number, kind: TileKind): TileKind[] => Array<TileKind>(n).fill(kind);
const isFlexible = (u: { count: number }) => u.count >= MIN_JOKER_GROUP;

const hand = (id: string): Hand => {
  const h = card.hands.find((x) => x.id === id);
  if (!h) throw new Error(`no hand ${id}`);
  return h;
};

/** Narrows to a reachable result, failing the test otherwise. */
function reachable(r: HandReach): HandDistance {
  if (r.tilesAway === null) throw new Error(`${r.hand.id} unreachable: ${r.reason}`);
  return r;
}
const away = (id: string, holding: Holding) => handDistance(hand(id), holding).tilesAway;

/** A variant's tiles: real tiles while the set has them, Jokers past that. */
function unitTiles(units: readonly ConcreteUnit[]): TileKind[][] {
  const used = new Map<string, number>();
  return units.map((u) =>
    Array.from({ length: u.count }, () => {
      const n = used.get(tileKey(u.kind)) ?? 0;
      if (n >= copiesOf(u.kind)) return JOKER;
      used.set(tileKey(u.kind), n + 1);
      return u.kind;
    }),
  );
}

const countOf = (tiles: readonly TileKind[], kind: TileKind) => tiles.filter((k) => tileKey(k) === tileKey(kind)).length;

describe('holdingProblem', () => {
  it('accepts any possible holding of up to 14 tiles', () => {
    expect(holdingProblem({ concealed: [] })).toBeNull();
    expect(holdingProblem({ concealed: [...of(8, FLOWER), ...of(6, JOKER)] })).toBeNull();
    expect(holdingProblem({ concealed: of(4, bam(1)), exposures: [[crak(2), JOKER, crak(2)]] })).toBeNull();
  });

  it('rejects more than 14 tiles, impossible copies and bad exposures', () => {
    expect(holdingProblem({ concealed: [...of(8, FLOWER), ...of(4, bam(1))], exposures: [of(3, crak(2))] })).toBe('tile-count');
    expect(holdingProblem({ concealed: of(5, dot(5)) })).toBe('too-many-copies');
    expect(holdingProblem({ concealed: of(2, dot(5)), exposures: [of(3, dot(5))] })).toBe('too-many-copies');
    expect(holdingProblem({ concealed: [], exposures: [of(2, dot(5))] })).toBe('exposure-too-small');
    expect(holdingProblem({ concealed: [], exposures: [[dot(5), dot(6), dot(5)]] })).toBe('exposure-mixed');
    expect(holdingProblem({ concealed: [], exposures: [of(3, JOKER)] })).toBe('exposure-all-jokers');
  });

  it('makes the distance functions throw rather than guess', () => {
    expect(() => handDistance(hand('odds-1'), { concealed: of(5, dot(5)) })).toThrow(RangeError);
    expect(() => cardDistances({ concealed: of(15, FLOWER) }, card)).toThrow(RangeError);
  });
});

describe('handDistance: worked examples', () => {
  // honors-1: NNN EEEE WWWW SSS
  const honors = [...of(3, wind('N')), ...of(4, wind('E')), ...of(4, wind('W')), ...of(3, wind('S'))];

  it('is 0 for a finished hand, with every place filled', () => {
    const r = reachable(handDistance(hand('honors-1'), { concealed: honors }));
    expect(r.tilesAway).toBe(0);
    expect(r.units.every((u) => u.missing === 0 && u.jokers === 0 && u.exposure === null)).toBe(true);
    expect(r.mustBeJokers).toBe(0);
  });

  it('counts the tiles still needed, from 13 tiles or 14', () => {
    expect(away('honors-1', { concealed: honors.slice(1) })).toBe(1);
    expect(away('honors-1', { concealed: honors.slice(3) })).toBe(3);
    // 14 tiles with one stray: swap it out for one draw.
    expect(away('honors-1', { concealed: [...honors.slice(1), dot(5)] })).toBe(1);
    expect(away('honors-1', { concealed: [] })).toBe(14);
  });

  it('ignores copies past what the hand holds', () => {
    // Four Norths, but the hand has a pung: the fourth is a stray.
    expect(away('honors-1', { concealed: [...of(4, wind('N')), ...honors.slice(3, 12)] })).toBe(2);
  });

  it('lets Jokers fill pungs and kongs, but never a single or pair', () => {
    // honors-1 is all pungs and kongs: Jokers count fully.
    expect(away('honors-1', { concealed: [...of(4, JOKER), ...honors.slice(4, 13)] })).toBe(1);
    // pairs-1 (NN EE WW SS xx xx+1 xx+2) is all pairs: Jokers are dead weight.
    const pairs = [...of(2, wind('N')), ...of(2, wind('E')), ...of(2, wind('W')), ...of(2, wind('S')), ...of(2, bam(4)), ...of(2, bam(5))];
    expect(away('pairs-1', { concealed: [...pairs, bam(6)] })).toBe(1);
    expect(away('pairs-1', { concealed: [...pairs, JOKER] })).toBe(2);
    expect(away('pairs-1', { concealed: [...pairs.slice(2), JOKER, JOKER, JOKER] })).toBe(4);
  });

  it('places real tiles in singles and pairs before Jokers can fill the groups', () => {
    // evens-2: 2468:a 2222:b 4444:b DD:b. Both Jokers go into the 4 Bam kong;
    // the Green pair takes only real Greens, so it still needs one.
    const greens: TileKind = { type: 'dragon', dragon: 'green' };
    const holding = { concealed: [crak(2), crak(4), crak(6), crak(8), ...of(4, bam(2)), bam(4), JOKER, JOKER, greens] };
    const r = reachable(handDistance(hand('evens-2'), holding));
    expect(r.tilesAway).toBe(2);
    expect(r.units.map((u) => [u.naturals, u.jokers, u.missing])).toEqual([
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
      [4, 0, 0],
      [1, 2, 1],
      [1, 0, 1],
    ]);
  });

  it('picks the suits and numbers closest to the rack', () => {
    // like-1: FF xxxx:a xxxx:b xxxx:c. Sevens in every suit point at x = 7.
    const holding = { concealed: [FLOWER, ...of(3, crak(7)), ...of(2, dot(7)), bam(7), bam(2), dot(3), crak(9), JOKER, wind('N'), wind('E')] };
    const r = reachable(handDistance(hand('like-1'), holding));
    expect(r.variant.x).toBe(7);
    expect(r.tilesAway).toBe(14 - 1 - 3 - 2 - 1 - 1);
  });

  it('counts exposures as done and the rack around them', () => {
    // odds-3: 333:a 5555:a 777:b 9999:b
    const exposures: Exposure[] = [[crak(5), JOKER, crak(5), crak(5)], [dot(7), dot(7), JOKER]];
    const r = reachable(handDistance(hand('odds-3'), { concealed: [crak(3), crak(3), dot(9), JOKER], exposures }));
    expect(r.tilesAway).toBe(3);
    expect(r.variant.suits).toEqual({ a: 'crak', b: 'dot' });
    expect(r.units.map((u) => u.exposure)).toEqual([null, 0, 1, null]);
    expect(r.units[1]).toMatchObject({ naturals: 3, jokers: 1, missing: 0 });
  });

  it('cannot make a concealed hand once anything is exposed', () => {
    const r = handDistance(hand('pairs-2'), { concealed: [dot(1), dot(1)], exposures: [of(3, wind('N'))] });
    expect(r).toMatchObject({ tilesAway: null, reason: 'concealed-hand' });
  });

  it('cannot make a hand that an exposure does not belong to', () => {
    // honors-1 has no Dots, and its North group is a pung, not a kong.
    expect(handDistance(hand('honors-1'), { concealed: [], exposures: [of(3, dot(5))] })).toMatchObject({ reason: 'exposures-dont-fit' });
    expect(handDistance(hand('honors-1'), { concealed: [], exposures: [of(4, wind('N'))] })).toMatchObject({ reason: 'exposures-dont-fit' });
    // Two exposed kongs of East, but the hand has only one.
    expect(handDistance(hand('honors-1'), { concealed: [], exposures: [[wind('E'), JOKER, JOKER], [wind('E'), wind('E'), JOKER]] })).toMatchObject({
      reason: 'exposures-dont-fit',
    });
  });

  it('cannot finish a pair whose last copies are already exposed', () => {
    const custom = parseHand({ id: 'test-gone', notation: '333:a 33:a 6666:a 99999:a', concealed: false, value: 25 }, 'threes');
    // Three 3 Dots exposed and one on the rack: none left for the pair's second tile.
    expect(handDistance(custom, { concealed: [dot(3), dot(6)], exposures: [of(3, dot(3))] })).toMatchObject({ tilesAway: null, reason: 'tiles-gone' });
    // With a Joker in the exposure, a 3 Dot is still out there.
    expect(handDistance(custom, { concealed: [dot(3), dot(6)], exposures: [[dot(3), dot(3), JOKER]] }).tilesAway).toBe(14 - 3 - 2);
  });

  it('says which missing tiles can only be Jokers', () => {
    // quints-1: xxxxx:a FFFF xxxxx:b. Every quint needs a Joker, since a set
    // has only four of a tile; past that, real 5 Dots can still be drawn.
    const r = reachable(handDistance(hand('quints-1'), { concealed: [...of(4, crak(5)), ...of(2, dot(5)), FLOWER] }));
    expect(r.tilesAway).toBe(7);
    expect(r.mustBeJokers).toBe(2);
    // A rack Joker takes one of those Joker-only places: the Crak quint's, where
    // no real 5 Crak is left to draw.
    const withJoker = reachable(handDistance(hand('quints-1'), { concealed: [...of(4, crak(5)), ...of(2, dot(5)), FLOWER, JOKER] }));
    expect(withJoker.mustBeJokers).toBe(1);
    expect(withJoker.units.find((u) => tileKey(u.kind) === 'crak-5')).toMatchObject({ naturals: 4, jokers: 1, missing: 0 });
    // The Dot quint stays short of one tile that can only be a Joker.
    expect(withJoker.units.find((u) => tileKey(u.kind) === 'dot-5')).toMatchObject({ naturals: 2, jokers: 0, missing: 3 });
  });
});

describe('cardDistances', () => {
  it('lists every hand once, closest first, then the unreachable ones', () => {
    const holding = { concealed: [crak(1), crak(1), crak(3), crak(3), crak(3), crak(5), crak(7), crak(9)], exposures: [of(3, crak(5))] };
    const all = cardDistances(holding, card);
    expect(all.map((r) => r.hand.id).sort()).toEqual(card.hands.map((h) => h.id).sort());
    const firstNull = all.findIndex((r) => r.tilesAway === null);
    expect(firstNull).toBeGreaterThan(0);
    expect(all.slice(firstNull).every((r) => r.tilesAway === null)).toBe(true);
    const distances = all.slice(0, firstNull).map((r) => r.tilesAway as number);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    // odds-1 (11 333 555 777 999) is the natural target.
    expect(all[0]).toMatchObject({ tilesAway: 4 });
    expect(all[0].hand.id).toBe('odds-1');
    // Concealed hands are out once something is exposed.
    expect(all.filter((r) => r.hand.concealed).every((r) => r.tilesAway === null && r.reason === 'concealed-hand')).toBe(true);
  });

  it('agrees with handDistance for each hand', () => {
    const rng = createRng('card-vs-hand');
    for (let n = 0; n < 20; n++) {
      const holding = { concealed: randomRack(rng, 13) };
      for (const r of cardDistances(holding, card)) expect(handDistance(r.hand, holding)).toEqual(r);
    }
  });
});

// ---------------------------------------------------------------------------
// Fuzzing against an independent referee.

const SET = createTileSet().map((t) => t.kind);
const randomRack = (rng: Rng, n: number) => shuffle(SET, rng).slice(0, n);

/**
 * A holding near some hand: a random variant built (sometimes with groups
 * exposed and Jokers swapped in), then a few tiles dropped and random ones
 * added, as a real rack in play would look.
 */
function nearHolding(rng: Rng): Holding | null {
  const h = card.hands[Math.floor(rng() * card.hands.length)];
  const vs = handVariants(h.groups);
  const groups = unitTiles(vs[Math.floor(rng() * vs.length)].units).map((g) =>
    g.length >= MIN_JOKER_GROUP ? g.map((k, i) => (i > 0 && rng() < 0.2 ? JOKER : k)) : g,
  );
  const exposures: TileKind[][] = [];
  let concealed: TileKind[] = [];
  for (const g of groups) {
    if (!h.concealed && g.length >= MIN_JOKER_GROUP && g.some((k) => k.type !== 'joker') && rng() < 0.25) exposures.push(g);
    else concealed.push(...g);
  }
  concealed = shuffle(concealed, rng).slice(Math.floor(rng() * 5));
  const room = 14 - concealed.length - exposures.flat().length;
  concealed.push(...randomRack(rng, Math.floor(rng() * (room + 1))));
  const holding = { concealed, exposures };
  return holdingProblem(holding) ? null : holding;
}

/**
 * A deliberately different referee: for every variant and every way to pin
 * the exposures, lay rack tiles into slots one at a time (bipartite matching,
 * real tiles before Jokers, single/pair slots offered first), then check the
 * open slots can be filled from what's left in the set.
 */
function refereeAway(h: Hand, holding: Holding): number | null {
  const exposures = holding.exposures ?? [];
  if (h.concealed && exposures.length > 0) return null;
  const all = [...holding.concealed, ...exposures.flat()];
  const rack = [...holding.concealed.filter((k) => k.type !== 'joker'), ...holding.concealed.filter((k) => k.type === 'joker')];
  const found: number[] = [];
  for (const v of handVariants(h.groups)) {
    const pin = (e: number, taken: Set<number>) => {
      if (e === exposures.length) {
        const a = placeAndFill(v.units, taken, rack, all);
        if (a !== null) found.push(a);
        return;
      }
      const exp = exposures[e];
      v.units.forEach((u, i) => {
        if (!taken.has(i) && isFlexible(u) && u.count === exp.length && exp.every((k) => k.type === 'joker' || tileKey(k) === tileKey(u.kind))) {
          pin(e + 1, new Set([...taken, i]));
        }
      });
    };
    pin(0, new Set());
  }
  return found.length === 0 ? null : Math.min(...found);
}

/** Returns the variant's distance given pinned exposures, or null if the open slots can't be filled. */
function placeAndFill(units: readonly ConcreteUnit[], taken: Set<number>, rack: readonly TileKind[], all: readonly TileKind[]): number | null {
  const slots = units
    .flatMap((u, i) => (taken.has(i) ? [] : of(u.count, u.kind).map((k) => ({ key: tileKey(k), flexible: isFlexible(u) }))))
    .sort((a, b) => Number(a.flexible) - Number(b.flexible));
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
  let matched = 0;
  rack.forEach((_, t) => (matched += augment(t, slots.map(() => false)) ? 1 : 0));

  const left = new Map(ALL_KINDS.map((k) => [tileKey(k), copiesOf(k) - countOf(all, k)]));
  for (let s = 0; s < slots.length; s++) {
    if (owner[s] >= 0) continue;
    const n = left.get(slots[s].key) ?? 0;
    if (n > 0) left.set(slots[s].key, n - 1);
    else if (slots[s].flexible && (left.get('joker') ?? 0) > 0) left.set('joker', (left.get('joker') ?? 0) - 1);
    else return null;
  }
  return slots.length - matched;
}

/**
 * Finishes the plan the way a player would: each missing tile is a real one
 * while any copy is left to draw (singles and pairs first, since only real
 * tiles fit them), a Joker past that. Returns the final 14 tiles.
 */
function complete(r: HandDistance, holding: Holding): { declaration: Holding; wallJokers: number } {
  const exposures = holding.exposures ?? [];
  const left = new Map(ALL_KINDS.map((k) => [tileKey(k), copiesOf(k) - countOf([...holding.concealed, ...exposures.flat()], k)]));
  const concealed: TileKind[] = [];
  let wallJokers = 0;
  const order = r.units.map((u, i) => i).sort((a, b) => Number(isFlexible(r.units[a])) - Number(isFlexible(r.units[b])));
  for (const i of order) {
    const u = r.units[i];
    if (u.exposure !== null) continue;
    concealed.push(...of(u.naturals, u.kind), ...of(u.jokers, JOKER));
    for (let m = 0; m < u.missing; m++) {
      const n = left.get(tileKey(u.kind)) ?? 0;
      if (n > 0) {
        left.set(tileKey(u.kind), n - 1);
        concealed.push(u.kind);
      } else {
        wallJokers += 1;
        concealed.push(JOKER);
      }
    }
  }
  return { declaration: { concealed, exposures }, wallJokers };
}

function fuzzHoldings(seed: string, n: number): Holding[] {
  const rng = createRng(seed);
  const out: Holding[] = [];
  while (out.length < n) {
    const roll = rng();
    const h = roll < 0.7 ? nearHolding(rng) : { concealed: randomRack(rng, roll < 0.85 ? 13 : 14) };
    if (h) out.push(h);
  }
  return out;
}

describe('handDistance: fuzzed against a referee', () => {
  const holdings = fuzzHoldings('distance-fuzz', 400);

  it('finds the same distance as an exhaustive matching, for every hand', () => {
    let reached = 0;
    for (const holding of holdings) {
      for (const r of cardDistances(holding, card)) {
        expect([r.hand.id, r.tilesAway]).toEqual([r.hand.id, refereeAway(r.hand, holding)]);
        if (r.tilesAway !== null && r.tilesAway <= 3) reached += 1;
      }
    }
    // The fuzz really does exercise close racks, not just hopeless ones.
    expect(reached).toBeGreaterThan(200);
  });

  it('is 0 exactly when the 14 tiles are Mah Jongg', () => {
    let wins = 0;
    for (const holding of holdings) {
      if (holding.concealed.length + (holding.exposures ?? []).flat().length !== 14) continue;
      for (const r of cardDistances(holding, card)) {
        expect([r.hand.id, r.tilesAway === 0]).toEqual([r.hand.id, matchHand(r.hand, holding) !== null]);
        if (r.tilesAway === 0) wins += 1;
      }
    }
    expect(wins).toBeGreaterThan(10);
  });

  it('gives a plan that uses only the holding and finishes into a real Mah Jongg', () => {
    for (const holding of holdings) {
      const exposures = holding.exposures ?? [];
      for (const r of cardDistances(holding, card)) {
        if (r.tilesAway === null) continue;
        expect(r.units.reduce((n, u) => n + u.missing, 0)).toBe(r.tilesAway);
        for (const u of r.units) {
          expect(u.naturals + u.jokers + u.missing).toBe(u.count);
          if (!isFlexible(u)) expect(u.jokers).toBe(0);
          if (u.exposure !== null) {
            expect(u.missing).toBe(0);
            expect(exposures[u.exposure].length).toBe(u.count);
          }
        }
        expect(new Set(r.units.flatMap((u) => (u.exposure === null ? [] : [u.exposure]))).size).toBe(exposures.length);
        const rackUnits = r.units.filter((u) => u.exposure === null);
        for (const kind of ALL_KINDS) {
          if (kind.type === 'joker') continue;
          const placed = rackUnits.filter((u) => tileKey(u.kind) === tileKey(kind)).reduce((n, u) => n + u.naturals, 0);
          expect(placed).toBeLessThanOrEqual(countOf(holding.concealed, kind));
        }
        expect(rackUnits.reduce((n, u) => n + u.jokers, 0)).toBeLessThanOrEqual(countOf(holding.concealed, JOKER));

        const { declaration, wallJokers } = complete(r, holding);
        expect(declarationProblem(declaration)).toBeNull();
        expect(matchHand(r.hand, declaration)).not.toBeNull();
        expect(wallJokers).toBe(r.mustBeJokers);
      }
    }
  });

  it('moves by at most one tile per draw', () => {
    const rng = createRng('distance-steps');
    for (const holding of holdings.slice(0, 120)) {
      const total = holding.concealed.length + (holding.exposures ?? []).flat().length;
      if (total === 0 || total > 13) continue;
      const pool = SET.filter((k) => countOf([...holding.concealed, ...(holding.exposures ?? []).flat()], k) < copiesOf(k));
      const drawn = { ...holding, concealed: [...holding.concealed, pool[Math.floor(rng() * pool.length)]] };
      const before = cardDistances(holding, card);
      const after = new Map(cardDistances(drawn, card).map((r) => [r.hand.id, r.tilesAway]));
      for (const r of before) {
        const a = after.get(r.hand.id);
        if (r.tilesAway === null || a === null || a === undefined) continue;
        expect(r.tilesAway - a).toBeGreaterThanOrEqual(0);
        expect(r.tilesAway - a).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('cardDistances: speed', () => {
  it('ranks the whole card for a rack well inside a 16 ms frame', () => {
    const racks = fuzzHoldings('distance-bench', 300);
    cardDistances(racks[0], card); // compile every hand once, as the app does at first use
    const times = racks.map((holding) => {
      const start = performance.now();
      cardDistances(holding, card);
      return performance.now() - start;
    });
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];
    // A mid-range phone runs JS several times slower than a dev machine or CI,
    // so hold desktop numbers to a fraction of the 16 ms budget.
    expect(median).toBeLessThan(2);
    expect(p95).toBeLessThan(4);
  });
});
