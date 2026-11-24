# Winning strategy: the doctrine behind the coach

**North star:** a player who follows Tile & Tea's coaching should win more often at a real table. Every lesson, drill, scenario, hint and bot decision exists to raise the player's win rate, and the build loop judges new work against that goal (`reviewers/strategy.md`).

"Win rate" means, for a player at a four-seat American Mah Jongg table: the share of hands they declare Mah Jongg on, then points won minus points paid. Both are measured by the simulator (S.2 in `tasks/BACKLOG.md`) with the advisor playing "the student who follows the coach" against the bot tiers in `app/src/game/bots/`.

## Three rules for everything the coach says

1. **The engine decides, the author explains.** Verdicts and explanations shown to the player come from tested code: hand distance (`game/card/distance.ts`), dead tiles and exposure reads (`game/card/reads.ts`, `game/drills/content/discards.ts`), and the Charleston and hand-choice evaluators. Authored text may name a principle, but a test must prove the engine agrees with the taught move (`game/scenarios/__tests__/content.test.ts` does this for every scenario).
2. **Measured, never asserted.** A principle earns a place here when the simulator shows a bot that follows it wins more than one that doesn't, or when a drill statistic shows players who learn it answer better. Principles below are marked *measured* (with the simulator's delta, see "Simulator results"), *engine-backed* (the engine's verdicts embody them, but the simulator has no switch for them yet), or *rule*. A principle measured as "not distinguishable" stays in the curriculum only when it costs nothing to follow, and the row says so.
3. **Honest with the player.** Explain odds and trade-offs in plain words. Never promise a win, never say "guaranteed safe".

## The curriculum: principles, in the order a player meets them

Each principle names the scenario or drill that teaches it. Scenarios live in `app/src/game/scenarios/content/`; drills in `app/src/game/drills/content/`.

### The Charleston
| # | Principle | Taught by | Status |
| --- | --- | --- | --- |
| C1 | Pairs are gold: a Joker never fills a single or a pair, so a pair is work already done. Pass the tiles that touch nothing. | Scenario *Pass what touches nothing*; Charleston drill | engine-backed |
| C2 | A lone Flower is worth more than a lone number: 16 of the card's 40 hands use Flowers, most as a pair. Check your closest hand before passing an honor tile. | Scenario *A Flower is not a stray* | engine-backed |
| C3 | Keep several doors open on the first pass: prefer a pass that leaves two or three hands within a tile of each other over one that commits early. | Charleston drill (its `good` verdict is exactly this) | engine-backed; *measured*: +5.1 pp Mah Jongg rate at a Club table (net points not distinguishable); no detectable effect at Beginner or Shark tables |
| C4 | Jokers never travel in the Charleston. | Lesson 5; drills lock them | rule |

### Choosing a hand
| # | Principle | Taught by | Status |
| --- | --- | --- | --- |
| H1 | Count tiles, not points. The closest hand is the one you'll finish; a finished 25 beats an unfinished 50. | Scenario *Closest beats richest*; Best hand drill | engine-backed; *measured*: the strongest principle we have. Chasing points costs +11 to +25 pp of Mah Jongg rate and 18 to 35 net points per game, at every table. The hands it does finish average only about 3 points more (33.5 vs 30.6 at a Club table), while it finishes fewer than half as many |
| H2 | Count your Jokers into the distance: each closes one gap in a pung, kong or quint, never in a single or pair. Then take the closest hand; open Joker seats only break ties. (Singles & Pairs hands get nothing from Jokers.) | Scenario *Jokers want big groups* | engine-backed |
| H3 | Dragons have suits (Green–Bams, Red–Craks, Soap–Dots). A D printed in a suit's color is that suit's Dragon. | Scenario *Dragons have suits*; Lesson 3 | rule + engine-backed |
| H4 | Switch hands only when another line is now closer, counting the table. | Best hand drill, Discards drill | engine-backed |

### At the table
| # | Principle | Taught by | Status |
| --- | --- | --- | --- |
| T1 | Count what's gone before you count what's close: when the last copy a single or pair needs is on the table, the hand is dead. Release it and its tiles. | Scenario *Count what's gone*; Discards drill (dead tiles) | engine-backed; *measured*: +6.1 net points per game vs Beginners, +3.8 vs Club; not distinguishable vs Sharks |
| T2 | Two exposures tell a story. Find the lines that fit both, list what they still need, and never throw those tiles while a safe throw keeps your hand equally close. | Scenario *Two exposures tell a story*; Discards drill (danger) | engine-backed; *measured*: **no detectable effect on net points** (within ±4 per game at every table). It does cut how often the student throws the winning tile (6.3% vs 8.4% of games at a Club table, 12.3% vs 15.8% at a Shark table), but a fed win only costs the discarder one extra hand value, so that saving is about a point per game. It stays because the taught rule costs nothing (it only picks among throws that keep the hand equally close). The Shark's costlier defense (giving up a tile late or against 3 exposures) is switched off in the same ablation and doesn't measure either; S.3's late-game defense work must find a defense rule that does before teaching more of it |
| T3 | Among equal throws, prefer the tile with the most copies already visible: fewer players can still be collecting it. | Discards drill (`recommended`) | engine-backed; *measured*: not distinguishable (+1.4 pp Mah Jongg rate at Beginner and Club tables, intervals cross zero). A free tie-break, so it stays as one, never as a reason to break a hand |
| T4 | Call a discard only when the exposure leaves a card hand fitting all your exposures and brings the hand closer. An all-Joker call is rarely worth it. | Table UI call offers (`game/table/calls.ts`) | engine-backed; *measured*: calling exposures that don't bring the hand closer costs +1.9 to +4.1 pp of Mah Jongg rate and 3 to 7 net points per game, at every table |
| T5 | Swap an exposed Joker whenever you hold the real tile and it costs your hand nothing. | Bots (`jokerSwap`); hint planned (M5.3) | engine-backed; *measured*: +2.1 to +12.1 pp Mah Jongg rate and 3 to 17 net points per game, at every table (largest against Beginners, who leave Jokers in their exposures) |

### Planned (each needs a simulator switch and a measured delta before it's taught; S.3)
- **Late-game defense:** when the wall is short and you're three or more away, throw only tiles already visible three times, or tiles no exposed hand can use, even at the cost of your own hand.
- **Reading discards, not just exposures:** a player who throws Winds early isn't on Winds & Dragons; use discards to narrow hands.
- **When to go for a concealed hand:** the distance threshold after the Charleston at which Singles & Pairs becomes the better gamble.

## How the loop uses this file
- New coaching content must map to a row here (add one if it's new). The strategy reviewer checks.
- A new principle gets a switch in `app/src/game/sim/policies.ts` (an ablation of the student), a fresh `npm run winrate`, and its row in the table below. `scripts/__tests__/winrate.test.js` fails if an ablation has no row here.

## Simulator results

**How it's measured.** `npm run winrate` (pure TS in `app/src/game/sim/`) seats "the student" in one chair and three bots of one level in the others, and plays seeded games through the real game engine (Charleston, courtesy pass, calls, Joker swaps, Mah Jongg, wall games, standard American settlement). The student is the Shark policy, the same distance, dead-tile and exposure-read engine that grades the drills and scenarios. Game *i* uses seed `winrate-i` and seat *i* mod 4, so every policy plays the same deals from the same chairs, and each ablation is compared with the student game by game (paired 95% intervals). Shares use Wilson intervals; means use the normal approximation. A seat's fair share is a quarter of the games anyone won.

**Run recorded here:** 2026-11-23, `npm run winrate -- --games 2000` (2,000 games per policy per table, 48,000 games, 15 minutes on 9 worker threads). The test guards a fast mode of the first 100 seeds (`scripts/__tests__/winrate.test.js`).

| Table | Games | Mah Jongg rate (95% CI) | Wall games | Fed the winner | Net points / game (95% CI) | Mean winning hand |
| --- | --- | --- | --- | --- | --- | --- |
| beginner bots | 2000 | 48.0% (45.9% to 50.2%; fair share 12.2%) | 51.3% | 0.1% | +71.4 (+67.9 to +74.8) | 30.5 |
| club bots | 2000 | 33.7% (31.7% to 35.8%; fair share 18.5%) | 25.9% | 6.3% | +30.5 (+26.5 to +34.6) | 30.6 |
| shark bots | 2000 | 20.3% (18.6% to 22.1%; fair share 21.5%) | 14.0% | 12.3% | −2.0 (−5.8 to +1.8) | 31.0 |

What it says: following the coach wins about four times a fair share against Beginners and nearly twice against Club players. Against Sharks it breaks even, as it should, since a Shark plays the same policy. The coaching edge is real, and it comes from the opponents' mistakes the coach avoids.

Each row switches one principle off and replays the same deals. Deltas are the full student minus the ablation (positive: the principle wins games or points), with 95% paired intervals.

| Principle | Switched off | Table | Δ Mah Jongg rate | Δ net points / game | Verdict (net) |
| --- | --- | --- | --- | --- | --- |
| T1 | Ignores dead tiles (counts every copy as still drawable) | beginner | +3.7 pp (+1.7 to +5.7) | +6.1 (+2.8 to +9.3) | helps ✅ |
| T1 | Ignores dead tiles (counts every copy as still drawable) | club | +2.3 pp (+0.6 to +4.0) | +3.8 (+0.4 to +7.1) | helps ✅ |
| T1 | Ignores dead tiles (counts every copy as still drawable) | shark | +0.9 pp (−0.4 to +2.3) | +1.4 (−1.5 to +4.3) | not distinguishable |
| T2 | Ignores exposures (throws tiles other players want) | beginner | −0.1 pp (−2.1 to +2.0) | +0.7 (−2.6 to +4.0) | not distinguishable |
| T2 | Ignores exposures (throws tiles other players want) | club | +0.4 pp (−1.4 to +2.1) | +1.6 (−1.8 to +5.0) | not distinguishable |
| T2 | Ignores exposures (throws tiles other players want) | shark | +0.2 pp (−1.2 to +1.6) | +0.8 (−2.2 to +3.7) | not distinguishable |
| T3 | Among equal safe throws, ignores how many copies are visible | beginner | +1.4 pp (−0.6 to +3.4) | +2.8 (−0.4 to +6.0) | not distinguishable |
| T3 | Among equal safe throws, ignores how many copies are visible | club | +1.4 pp (−0.3 to +3.0) | +2.4 (−0.9 to +5.7) | not distinguishable |
| T3 | Among equal safe throws, ignores how many copies are visible | shark | +0.5 pp (−0.8 to +1.9) | +0.6 (−2.3 to +3.5) | not distinguishable |
| T4 | Calls any exposure that fits, even when it brings the hand no closer | beginner | +3.9 pp (+2.0 to +5.7) | +6.2 (+3.3 to +9.1) | helps ✅ |
| T4 | Calls any exposure that fits, even when it brings the hand no closer | club | +4.1 pp (+2.5 to +5.7) | +6.6 (+3.5 to +9.7) | helps ✅ |
| T4 | Calls any exposure that fits, even when it brings the hand no closer | shark | +1.9 pp (+0.7 to +3.1) | +3.2 (+0.7 to +5.7) | helps ✅ |
| T5 | Never swaps for an exposed Joker | beginner | +12.1 pp (+10.3 to +13.9) | +16.7 (+13.8 to +19.7) | helps ✅ |
| T5 | Never swaps for an exposed Joker | club | +6.2 pp (+4.9 to +7.4) | +9.2 (+6.6 to +11.8) | helps ✅ |
| T5 | Never swaps for an exposed Joker | shark | +2.1 pp (+1.3 to +3.0) | +2.9 (+1.1 to +4.8) | helps ✅ |
| C3 | Keeps no backup hands (ties broken at random, not by doors left open) | beginner | +0.4 pp (−2.4 to +3.3) | +0.9 (−3.6 to +5.5) | not distinguishable |
| C3 | Keeps no backup hands (ties broken at random, not by doors left open) | club | +5.1 pp (+2.6 to +7.6) | +4.9 (−0.2 to +10.0) | not distinguishable |
| C3 | Keeps no backup hands (ties broken at random, not by doors left open) | shark | +0.5 pp (−1.7 to +2.7) | +0.6 (−4.2 to +5.4) | not distinguishable |
| H1 | Chases points: each 10 points over 25 counts as a tile nearer | beginner | +25.1 pp (+22.5 to +27.7) | +34.8 (+30.5 to +39.2) | helps ✅ |
| H1 | Chases points: each 10 points over 25 counts as a tile nearer | club | +19.1 pp (+16.8 to +21.5) | +28.3 (+23.5 to +33.0) | helps ✅ |
| H1 | Chases points: each 10 points over 25 counts as a tile nearer | shark | +11.3 pp (+9.3 to +13.3) | +18.5 (+14.2 to +22.8) | helps ✅ |

**Reading it.** Measured and winning, largest first: count tiles, not points (H1), swap for exposed Jokers (T5), call only exposures that bring you closer (T4), count dead tiles (T1). Backup hands (C3) win more hands at a Club table but not a measurable number of points. Defense (T2) and the visible-copies tie-break (T3) cost nothing but don't measurably win against these bots, so the coach keeps them as tie-breaks and must not sell them as more than that. What the simulator can't see yet: C1, C2, H2–H4 (no switch; the engine that grades them is the same distance engine the student plays by), and human opponents, who may read the table differently from our bots.
