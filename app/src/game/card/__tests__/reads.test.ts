import { createRng, shuffle } from '../../rng';
import { ALL_KINDS, copiesOf, createShuffledTileSet, sameKind, type TileKind } from '../../tiles';
import { cardDistances, CURRENT_CARD, handDistance, readExposures, seenProblem, variantsOf, wantedBy } from '..';

const N = (rank: number, suit: 'bam' | 'crak' | 'dot' = 'dot'): TileKind => ({ type: 'suited', suit, rank: rank as 1 });
const NORTH: TileKind = { type: 'wind', wind: 'N' };
const JOKER: TileKind = { type: 'joker' };
const times = (kind: TileKind, n: number) => Array.from({ length: n }, () => kind);

describe('hand distance with tiles seen elsewhere', () => {
  const pairHand = CURRENT_CARD.hands.find((h) =>
    variantsOf(h).every((v) => v.units.some((u) => u.count === 2 && sameKind(u.kind, NORTH))),
  );

  it('counts no seen tiles exactly as before', () => {
    const rng = createRng(7);
    for (let i = 0; i < 40; i++) {
      const rack = createShuffledTileSet(rng)
        .slice(0, 13)
        .map((t) => t.kind);
      expect(cardDistances({ concealed: rack }, CURRENT_CARD, [])).toEqual(cardDistances({ concealed: rack }, CURRENT_CARD));
    }
  });

  it('kills a hand whose pair needs a tile that is all on the table', () => {
    expect(pairHand).toBeDefined();
    if (!pairHand) return;
    const rack = [NORTH, N(1), N(2), N(3)];
    expect(handDistance(pairHand, { concealed: rack }).tilesAway).not.toBeNull();
    expect(handDistance(pairHand, { concealed: rack }, times(NORTH, 3))).toMatchObject({
      tilesAway: null,
      reason: 'tiles-gone',
    });
    // One North still unseen: the pair can be finished.
    expect(handDistance(pairHand, { concealed: rack }, times(NORTH, 2)).tilesAway).not.toBeNull();
  });

  it('never brings a hand closer or revives one', () => {
    const rng = createRng(99);
    for (let i = 0; i < 60; i++) {
      const tiles = createShuffledTileSet(rng).map((t) => t.kind);
      const rack = tiles.slice(0, 13);
      const seen = tiles.slice(13, 13 + Math.floor(rng() * 40));
      const without = cardDistances({ concealed: rack }, CURRENT_CARD);
      const withSeen = cardDistances({ concealed: rack }, CURRENT_CARD, seen);
      for (const r of withSeen) {
        const before = without.find((w) => w.hand === r.hand)!;
        if (r.tilesAway !== null) {
          expect(before.tilesAway).not.toBeNull();
          // Seen tiles can kill the closest choice of suits, pushing the hand back, never forward.
          expect(r.tilesAway).toBeGreaterThanOrEqual(before.tilesAway!);
        }
      }
    }
  });

  it('runs out of Jokers once every unseen one would be needed', () => {
    // A quint of 5 Dots: holding none of them and with all four real ones gone, it needs five Jokers.
    const quint = CURRENT_CARD.hands.find((h) =>
      variantsOf(h).some((v) => v.units.some((u) => u.count === 5 && u.kind.type === 'suited')),
    );
    expect(quint).toBeDefined();
    if (!quint) return;
    const variant = variantsOf(quint).find((v) => v.units.some((u) => u.count === 5 && u.kind.type === 'suited'))!;
    const unit = variant.units.find((u) => u.count === 5)!;
    const realGone = times(unit.kind, copiesOf(unit.kind));
    const reachFew = handDistance(quint, { concealed: [] }, [...realGone, ...times(JOKER, 4)]);
    const reachNone = handDistance(quint, { concealed: [] }, [...realGone, ...times(JOKER, 8)]);
    // With every Joker seen, no variant needing that quint can be finished; other variants may still be.
    if (reachNone.tilesAway !== null) expect(reachNone.variant.units.some((u) => u.count === 5 && sameKind(u.kind, unit.kind))).toBe(false);
    expect(reachFew.tilesAway).not.toBeNull();
  });

  it('refuses more copies than a set has', () => {
    expect(seenProblem({ concealed: times(N(5), 2) }, times(N(5), 3))).toBe('too-many-copies');
    expect(seenProblem({ concealed: times(N(5), 2) }, times(N(5), 2))).toBeNull();
    expect(() => cardDistances({ concealed: times(N(5), 2) }, CURRENT_CARD, times(N(5), 3))).toThrow(RangeError);
  });
});

describe('readExposures', () => {
  /** Two groups of 3+ from a random exposed hand, plus random other visible tiles. */
  function table(seed: number) {
    const rng = createRng(seed);
    const open = CURRENT_CARD.hands.filter((h) => !h.concealed);
    for (;;) {
      const v = shuffle(variantsOf(open[Math.floor(rng() * open.length)]), rng)[0];
      const groups = shuffle(
        v.units.filter((u) => u.count >= 3),
        rng,
      ).slice(0, 2);
      if (groups.length < 2) continue;
      const exposures = groups.map((u) => times(u.kind, u.count));
      const left = new Map<string, number>();
      const all = createShuffledTileSet(rng).map((t) => t.kind);
      const ok = exposures.flat().every((k) => {
        const key = JSON.stringify(k);
        left.set(key, (left.get(key) ?? 0) + 1);
        return left.get(key)! <= copiesOf(k);
      });
      if (!ok) continue;
      const pool = [...all];
      for (const k of exposures.flat()) pool.splice(pool.findIndex((x) => sameKind(x, k)), 1);
      return { exposures, seen: pool.slice(0, 10 + Math.floor(rng() * 30)) };
    }
  }

  it('finds exactly the hands hand distance says the exposures can still make (an independent referee)', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { exposures, seen } = table(seed);
      const read = readExposures(exposures, seen, CURRENT_CARD);
      const referee = CURRENT_CARD.hands.filter(
        (h) => handDistance(h, { concealed: [], exposures }, seen).tilesAway !== null,
      );
      expect(read.hands).toEqual(referee);
    }
  });

  it('wants only tiles with an open place in a possible hand, and never a Joker', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { exposures, seen } = table(seed);
      const read = readExposures(exposures, seen, CURRENT_CARD);
      expect(wantedBy(read, JOKER)).toBeNull();
      for (const kind of ALL_KINDS) {
        const wanted = wantedBy(read, kind);
        const places = read.possible.filter((p) => p.open.some((u) => sameKind(u.kind, kind)));
        if (!wanted) {
          expect(places).toEqual([]);
          continue;
        }
        expect(wanted.hands).toEqual([...new Set(places.map((p) => p.hand))]);
        const group = places.some((p) => p.open.some((u) => sameKind(u.kind, kind) && u.count >= 3));
        expect(wanted.use).toBe(group ? 'group' : 'pair');
      }
    }
  });

  it('reads the same exposures the same way however often it is asked', () => {
    const { exposures, seen } = table(5);
    expect(readExposures(exposures, seen, CURRENT_CARD)).toEqual(readExposures(exposures, seen, CURRENT_CARD));
  });
});
