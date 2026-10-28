# Build Backlog

The build loop (`scripts/loop.sh`) works through this file top to bottom.

Status markers: `[ ]` todo · `[x]` done · `[!]` blocked (add a one-line reason underneath)
A line `## 🛑 CHECKPOINT` means: stop the loop, so the human can try the app before continuing.

---

## M0: Foundation

- [x] **M0.1 Clean template + tooling.** Remove Expo template demo screens/components that won't be used. Add Jest (jest-expo preset), a `test` and `typecheck` script, strict TS. *Done when:* `npm test`, `npx tsc --noEmit`, `npx expo lint` all pass.
- [x] **M0.1b Screenshot harness.** `npm run screenshots`: start Expo web, use Playwright to capture every route at iPhone 15 size (393×852, light + dark) into `app/screenshots/` (gitignored). Lets the design reviewer see the UI. *Done when:* running it produces PNGs of the current screens.
- [x] **M0.2 Design system.** `src/theme/` with the Jade Parlor palette (light + dark), spacing, radii, shadows, typography (load serif + sans via expo-google-fonts). Themed `Text`, `Button`, `Card`, `Screen` components. *Done when:* a hidden `/dev/styleguide` route shows every token and component.
- [x] **M0.3 Tile model.** `src/game/tiles.ts`: types for all 152 tiles, full-set generator, shuffle (seedable RNG), human/a11y names. *Done when:* unit tests prove counts (152, 8 jokers, 8 flowers, etc.) and seeded shuffles are deterministic.
- [ ] **M0.4 Tile component.** Gorgeous code-drawn `<Tile>` (SVG or Skia) for every tile type, sizes S/M/L, selected/disabled/hint states, press-lift animation, haptics, a11y label. *Done when:* the styleguide shows all 42 distinct faces + joker + flower and they look premium.
- [ ] **M0.5 Rack component.** A horizontal rack of 13–14 tiles: drag-to-reorder, tap-to-select, auto-sort by suit. *Done when:* it works smoothly on device-size layouts and has component tests.
- [ ] **M0.6 Navigation shell.** Four tabs (Learn, Train, Play, Progress) with placeholder screens in the Jade Parlor style, a settings sheet, and onboarding (3 swipeable welcome screens, shown once).

## 🛑 CHECKPOINT: try the app in Expo Go / dev build. Do tiles look stunning?

## M1: Learn

- [ ] **M1.1 Lesson engine.** Data-driven lesson format (steps: text, tile illustration, interactive "tap the X" question). Progress persisted locally.
- [ ] **M1.2 Lesson path UI.** Winding trail of lesson nodes with locked/available/complete states and celebratory completion animation.
- [ ] **M1.3 Lessons 1–5 content.** (1) Meet the tiles (2) Pungs, kongs, quints & pairs (3) Reading a card (practice card) (4) Jokers (5) The Charleston. Each 3–6 minutes, interactive.

## M2: Rules engine

- [ ] **M2.1 2027 Practice Card.** An original set of ~40 hands across the generic categories (2027 year hands, 2468, Like Numbers, Addition, Quints, Consecutive Run, 13579, Winds & Dragons, 369, Singles & Pairs), with a hand notation DSL and values (concealed/exposed). Card data is versioned by year (`practice-card-2027.ts`) so a new card can ship each year. Write every hand from scratch. Never consult, adapt, or "project from" any NMJL card. Give the in-app card view its own Jade Parlor design, not the NMJL card's look.
- [ ] **M2.2 Hand matcher.** Given 14 tiles (+ exposures), decide whether it's a valid Mah Jongg for any card hand, joker-aware. Exhaustive tests.
- [ ] **M2.3 Hand distance.** For a partial rack, compute tiles-away for every card hand (joker-aware). Fast enough for real-time (<16ms for one rack on mid-range phone; benchmark test).
- [ ] **M2.4 Game state machine.** Deal → Charleston (both + courtesy) → play/call/expose/joker-swap → Mah Jongg / wall game / dead hand. Pure TS reducer, fully tested.

## 🛑 CHECKPOINT: review the practice card and rules accuracy with a real player.

## M3: Train

- [ ] **M3.1 Drill framework.** Drill = generator (seeded) + question UI + evaluator + explanation. Daily free limit hook (not enforced yet).
- [ ] **M3.2 "Best Hand" drill.** Show a rack → pick the top hand to pursue → explain using hand distance.
- [ ] **M3.3 Charleston drill.** Choose 3 tiles to pass → advisor scores it → explanation.
- [ ] **M3.4 Discard drill.** Mid-game snapshot → choose a discard → explanation incl. dead tiles & danger.
- [ ] **M3.5 Skill ratings.** Per-skill Elo-like rating, updated by drills; shown on Progress tab with animated meters.

## M4: Play

- [ ] **M4.1 Table UI.** Four-seat table, walls, discards, exposures, turn indicator; animated draws/discards.
- [ ] **M4.2 Bots.** Beginner / Club / Shark using the advisor.
- [ ] **M4.3 Calling & joker swaps UX.** Clear, forgiving, with a call window timer (adjustable/off for beginners).
- [ ] **M4.4 Save/resume games.**

## 🛑 CHECKPOINT: play 3 full games on device.

## M5: Coach

- [ ] **M5.1 Decision log.** Record each human decision + advisor evaluation during play.
- [ ] **M5.2 Post-game review.** Replay highlighting top 3 mistakes/great plays with explanations.
- [ ] **M5.3 Hints in play.** Optional "coach whisper" button (limited on free tier).

## M6: Ship

- [ ] **M6.1 Paywall + RevenueCat.** Free/Plus gating, trial, restore purchases, gorgeous paywall. (Requires human: RevenueCat keys → mark `[!]` until provided in `.env`.)
- [ ] **M6.2 Polish pass.** Sound, haptics audit, Reduce Motion, Dynamic Type, VoiceOver audit, large-tile mode.
- [ ] **M6.3 App icon, splash, store screenshots, store copy.** Write `docs/STORE_LISTING.md`.
- [ ] **M6.4 Privacy policy + terms** (`docs/PRIVACY.md`), analytics opt-in (if any).
- [ ] **M6.5 EAS config.** `eas.json` with development/preview/production profiles. (Human runs `eas build` / `eas submit` with their accounts.)

## 🛑 CHECKPOINT: TestFlight + Play internal testing with the beta group.
