import { bam, crak, dot, EAST, GREEN, JOKER, NORTH, SOUTH, WEST } from '../../lessons/content/tiles';
import { analyzeCall, analyzeSwap, callQuestion, evaluateCall, evaluateSwap, moveVerdict, swapQuestion, type CallData } from '../content/tableMoves';

// Pungs of 3 and 5 Bams, 7 and 9 Craks: 13579 #3 wants 5555 and 9999.
const odds = [bam(3), bam(3), bam(3), bam(5), bam(5), bam(5), crak(7), crak(7), crak(7), crak(9), crak(9), NORTH, EAST];

describe('calls', () => {
  it('offers letting it go and each exposure the rack can make, real tiles first', () => {
    const data: CallData = { rack: [...odds.slice(0, 11), JOKER, JOKER], offered: crak(9), from: 'right', discards: [], exposures: [] };
    const q = callQuestion(data);
    expect(q.choices.map((c) => (c.kind === 'action' ? c.id : '?'))).toEqual(['pass', 'pung', 'kong', 'quint']);
    const kong = q.choices[2];
    expect(kong.kind === 'action' && kong.tiles).toEqual([crak(9), crak(9), crak(9), JOKER]);
    expect(q.scene.table?.offered).toEqual({ tile: crak(9), from: 'right' });
  });

  it('calls a call that brings the hand no closer a miss, even when it fits', () => {
    // A third 7 Crak is no use: the rack already has the 777.
    const data: CallData = { rack: odds, offered: crak(7), from: 'left', discards: [], exposures: [] };
    const a = analyzeCall(data);
    expect(a.best.id).toBe('pass');
    const kong = a.outcomes.find((o) => o.id === 'kong');
    if (kong) expect(moveVerdict(kong, a)).toBe('miss');
    const pung = a.outcomes.find((o) => o.id === 'pung');
    if (pung) expect(moveVerdict(pung, a)).toBe('miss');
  });

  it('leaves out an all-Joker call that brings the hand no closer', () => {
    const data: CallData = {
      rack: [...odds.slice(0, 11), JOKER, JOKER],
      offered: WEST,
      from: 'left',
      discards: [],
      exposures: [],
    };
    expect(analyzeCall(data).outcomes.map((o) => o.id)).toEqual(['pass']);
  });

  it('refuses a pick that isn’t one move', () => {
    const q = callQuestion({ rack: odds, offered: crak(9), from: 'left', discards: [], exposures: [] });
    expect(() => evaluateCall(q, [])).toThrow(RangeError);
    expect(() => evaluateCall(q, [9])).toThrow(RangeError);
  });
});

describe('Joker swaps', () => {
  const rack = [...odds.slice(0, 11), dot(4), NORTH, SOUTH];
  const exposed = { seat: 'across' as const, groups: [[dot(4), dot(4), JOKER], [GREEN, GREEN, GREEN]] };

  it('offers one swap per exposure holding a Joker whose tile is on the rack, then keeping your tiles', () => {
    const q = swapQuestion({ rack, discards: [], exposures: [exposed, { seat: 'left', groups: [[dot(8), dot(8), JOKER]] }] });
    expect(q.choices.map((c) => (c.kind === 'action' ? c.id : '?'))).toEqual(['swap-across-0', 'keep']);
  });

  it('takes a free Joker over keeping your tiles, and explains it from the distances', () => {
    const q = swapQuestion({ rack, discards: [], exposures: [exposed] });
    const a = analyzeSwap(q.data);
    expect(a.best.id).toBe('swap-across-0');
    expect(a.best.closest).toBe(a.outcomes[1].closest - 1);
    const keep = evaluateSwap(q, [1]);
    expect(keep.verdict).toBe('miss');
    expect(keep.best).toEqual([0]);
    expect(keep.explanation).toMatch(/^Swapping your 4 Dot for the Joker brings 13579 #3 to two tiles away, from three tiles away/);
    expect(keep.explanation).toMatch(/Keeping your tiles leaves 13579 #3, three tiles away\./);
  });

  it('calls keeping your tiles sound, not a miss, when the swap gains nothing but the Joker', () => {
    // A real swap that gains nothing is rare (an unfinished hand nearly always has a seat for the Joker),
    // so check the tie rule on an analysis with the swap's distance set equal.
    const q = swapQuestion({ rack, discards: [], exposures: [exposed] });
    const a = analyzeSwap(q.data);
    const tie = { ...a, best: { ...a.best, closest: a.outcomes[1].closest } };
    expect(moveVerdict(a.outcomes[1], tie)).toBe('good');
  });
});
