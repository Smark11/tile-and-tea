# Winning strategy: the doctrine behind the coach

**North star:** a player who follows Tile & Tea's coaching should win more often at a real table. Every lesson, drill, scenario, hint and bot decision exists to raise the player's win rate, and the build loop judges new work against that goal (`reviewers/strategy.md`).

"Win rate" means, for a player at a four-seat American Mah Jongg table: the share of hands they declare Mah Jongg on, then points won minus points paid. Both are measured by the simulator (S.2 in `tasks/BACKLOG.md`) with the advisor playing "the student who follows the coach" against the bot tiers in `app/src/game/bots/`.

## Three rules for everything the coach says

1. **The engine decides, the author explains.** Verdicts and explanations shown to the player come from tested code: hand distance (`game/card/distance.ts`), dead tiles and exposure reads (`game/card/reads.ts`, `game/drills/content/discards.ts`), and the Charleston and hand-choice evaluators. Authored text may name a principle, but a test must prove the engine agrees with the taught move (`game/scenarios/__tests__/content.test.ts` does this for every scenario).
2. **Measured, never asserted.** A principle earns a place here when the simulator shows a bot that follows it wins more than one that doesn't, or when a drill statistic shows players who learn it answer better. Until S.2 ships, principles below are marked *engine-backed* (the engine's verdicts embody them) or *to measure*.
3. **Honest with the player.** Explain odds and trade-offs in plain words. Never promise a win, never say "guaranteed safe".

## The curriculum: principles, in the order a player meets them

Each principle names the scenario or drill that teaches it. Scenarios live in `app/src/game/scenarios/content/`; drills in `app/src/game/drills/content/`.

### The Charleston
| # | Principle | Taught by | Status |
| --- | --- | --- | --- |
| C1 | Pairs are gold: a Joker never fills a single or a pair, so a pair is work already done. Pass the tiles that touch nothing. | Scenario *Pass what touches nothing*; Charleston drill | engine-backed |
| C2 | A lone Flower is worth more than a lone number: 16 of the card's 40 hands use Flowers, most as a pair. Check your closest hand before passing an honor tile. | Scenario *A Flower is not a stray* | engine-backed |
| C3 | Keep several doors open on the first pass: prefer a pass that leaves two or three hands within a tile of each other over one that commits early. | Charleston drill (its `good` verdict is exactly this) | engine-backed |
| C4 | Jokers never travel in the Charleston. | Lesson 5; drills lock them | rule |

### Choosing a hand
| # | Principle | Taught by | Status |
| --- | --- | --- | --- |
| H1 | Count tiles, not points. The closest hand is the one you'll finish; a finished 25 beats an unfinished 50. | Scenario *Closest beats richest*; Best hand drill | engine-backed; *to measure* (points per hand by strategy) |
| H2 | Count your Jokers into the distance: each closes one gap in a pung, kong or quint, never in a single or pair. Then take the closest hand; open Joker seats only break ties. (Singles & Pairs hands get nothing from Jokers.) | Scenario *Jokers want big groups* | engine-backed |
| H3 | Dragons have suits (Green–Bams, Red–Craks, Soap–Dots). A D printed in a suit's color is that suit's Dragon. | Scenario *Dragons have suits*; Lesson 3 | rule + engine-backed |
| H4 | Switch hands only when another line is now closer, counting the table. | Best hand drill, Discards drill | engine-backed |

### At the table
| # | Principle | Taught by | Status |
| --- | --- | --- | --- |
| T1 | Count what's gone before you count what's close: when the last copy a single or pair needs is on the table, the hand is dead. Release it and its tiles. | Scenario *Count what's gone*; Discards drill (dead tiles) | engine-backed |
| T2 | Two exposures tell a story. Find the lines that fit both, list what they still need, and never throw those tiles while a safe throw keeps your hand equally close. | Scenario *Two exposures tell a story*; Discards drill (danger) | engine-backed |
| T3 | Among equal throws, prefer the tile with the most copies already visible: fewer players can still be collecting it. | Discards drill (`recommended`) | engine-backed; *to measure* |
| T4 | Call a discard only when the exposure leaves a card hand fitting all your exposures and brings the hand closer. An all-Joker call is rarely worth it. | Table UI call offers (`game/table/calls.ts`) | engine-backed |
| T5 | Swap an exposed Joker whenever you hold the real tile and it costs your hand nothing. | Bots (`jokerSwap`); hint planned (M5.3) | engine-backed |

### Planned (needs S.2 to validate)
- **Late-game defense:** when the wall is short and you're three or more away, throw only tiles already visible three times, or tiles no exposed hand can use, even at the cost of your own hand.
- **Reading discards, not just exposures:** a player who throws Winds early isn't on Winds & Dragons; use discards to narrow hands.
- **When to go for a concealed hand:** the distance threshold after the Charleston at which Singles & Pairs becomes the better gamble.

## How the loop uses this file
- New coaching content must map to a row here (add one if it's new). The strategy reviewer checks.
- When S.2's simulator lands, record its results in a table below, and move principles from *to measure* to *measured* with the win-rate delta.

## Simulator results
*None yet. S.2 adds `npm run winrate` and fills this in.*
