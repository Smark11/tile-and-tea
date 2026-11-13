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
- [x] **M0.4 Tile component.** Gorgeous code-drawn `<Tile>` (SVG or Skia) for every tile type, sizes S/M/L, selected/disabled/hint states, press-lift animation, haptics, a11y label. *Done when:* the styleguide shows all 42 distinct faces + joker + flower and they look premium.
- [x] **M0.5 Rack component.** A horizontal rack of 13–14 tiles: drag-to-reorder, tap-to-select, auto-sort by suit. *Done when:* it works smoothly on device-size layouts and has component tests.
- [x] **M0.6 Navigation shell.** Four tabs (Learn, Train, Play, Progress) with placeholder screens in the Jade Parlor style, a settings sheet, and onboarding (3 swipeable welcome screens, shown once).

## ✅ CHECKPOINT PASSED: try the app in Expo Go / dev build. Do tiles look stunning?

## W: Web launch foundation (web is the primary platform for now; native must keep working)

- [x] **W.1 Web-ready app.** Switch `app.json` web output to `"static"` (pure static hosting, no server). Rename the app from the template's "app" (name "Tile & Tea", slug `tile-and-tea`, scheme `tileandtea`), and replace the template's blue splash/favicon/icons with Jade Parlor ones (a code-generated tile mark is fine). Make it responsive: on phones it's full width; on tablet/desktop the app sits in a centered column (max ~520px) over a felt-textured jade background, with nothing stretched. Mouse and keyboard work everywhere (drag in rack, hover states, focus rings, Enter/Space activate). Add a `build:web` script (`expo export --platform web` → `dist/`). Extend the screenshot harness to also capture desktop (1440×900). *Done when:* `npm run build:web` succeeds, `npx serve dist` (or equivalent) loads every route including deep links, and screenshots look polished at both sizes.
- [x] **W.2 Web presence.** Per-route `<title>`/meta description via Expo Router `Head`. Add Open Graph + Twitter card tags with a beautiful 1200×630 share image (a rendered tile spread on jade), PWA manifest + theme color + apple-touch-icon so people can "Add to Home Screen", `robots.txt` and `sitemap.xml`. *Done when:* the exported HTML has correct tags for every public route and the share image looks premium.
- [x] **W.3 Traffic & product analytics.** A thin `src/analytics/` wrapper (`track(event, props)`, `screen(name)`) with a **PostHog** web implementation (`posthog-js`), configured from `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST`. It's a silent no-op when the key is missing, in tests, and in dev. Use cookieless mode (`persistence: 'memory'`) so no cookie banner is needed, and respect Do Not Track. Automatically track page views for every route change (Expo Router pathname) plus referrer/UTM (PostHog does this). Track key events: `onboarding_completed`, `lesson_started`, `lesson_completed`, `drill_answered` (skill, correct), `game_started`, `game_finished`, `share_clicked`. Keep the event list in `docs/ANALYTICS.md`, and add new events there as later features ship. Native can be a no-op stub for now. Add a short plain-English privacy page at `/privacy`. *Done when:* unit tests prove the no-op behavior and event shapes, and `docs/ANALYTICS.md` explains how to read traffic in PostHog.

## M1: Learn

- [x] **M1.1 Lesson engine.** Data-driven lesson format (steps: text, tile illustration, interactive "tap the X" question). Progress persisted locally.
- [x] **M1.2 Lesson path UI.** Winding trail of lesson nodes with locked/available/complete states and celebratory completion animation.
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
- [ ] **M5.3 Hints in play.** Optional "coach whisper" button (a per-day limit hook, not enforced yet).

## M6: Web launch

- [ ] **M6.1 Polish pass.** Sound (off by default), Reduce Motion, text scaling, screen-reader audit (VoiceOver/NVDA on web), large-tile mode, loading states, empty states, a 404 page. Lighthouse on the exported site: Accessibility ≥ 95, Performance ≥ 85 (mobile).
- [ ] **M6.2 Home / landing experience.** First-time web visitors arriving at `/` see a gorgeous one-screen intro (what it is, "Start learning free", a live interactive tile moment) before onboarding. Returning users go straight to their path. Track `landing_cta_clicked`.
- [ ] **M6.3 Sharing hooks.** After a lesson, drill streak, or game, offer "Share" (Web Share API with a copy-link fallback) with a nice share card. A "Puzzle of the day" deep link (`/puzzle/<date>`) that works without onboarding. These are the organic growth loops.
- [ ] **M6.4 Deploy config.** `docs/DEPLOY.md` with exact steps for EAS Hosting (`npx eas-cli deploy`) plus a fallback for any static host (Netlify/Cloudflare Pages: build command + `dist/` + SPA/deep-link notes). Include the PostHog env setup. The human runs the deploy with their own accounts.

## 🛑 CHECKPOINT: deploy the web app; share with the beta group; watch analytics.

## Later: native apps & monetization (not now)

- [ ] **N.1 Paywall + RevenueCat.** Free/Plus gating, trial, restore purchases, gorgeous paywall. On web, use Stripe or RevenueCat Web Billing. Needs human accounts and keys.
- [ ] **N.2 App icon, splash, store screenshots, store copy.** Write `docs/STORE_LISTING.md`.
- [ ] **N.3 EAS build config + native analytics.** `eas.json` profiles; PostHog React Native implementation behind the same wrapper. (The human runs `eas build` / `eas submit`.)
