# Product & Design Spec

## Design direction: "Jade Parlor"

The look should feel like a sunlit, upscale game room, not a casino.

- **Palette:** deep jade felt `#0F3D33`, jade accent `#1F7A63`, ivory tile `#F7F1E3`, tile edge `#D9CBA8`, warm gold `#C9A24B`, lacquer red `#B23A3A`, ink `#1B1B1B`. Include a dark mode built around near-black lacquer `#121513`.
- **Type:** an elegant serif for headings (e.g. Fraunces or Cormorant, free via expo-google-fonts) and a highly legible sans for body text. Base size ≥ 17pt. Respect Dynamic Type.
- **Tiles are the hero.** They're drawn in code (SVG/Skia), not stock images: ivory faces, soft bevel, a subtle drop shadow, and a crisp, readable suit glyph. Tiles lift and tilt slightly when touched, snap into the rack with spring physics, and give a light haptic tick.
- **Motion:** calm and physical. Use spring animations (Reanimated), avoid flashing, and honor Reduce Motion.
- **Feedback tone:** encouraging and specific. "Nice! Keeping the pair of 3 Bams kept two hands open." Never "WRONG."
- **Accessibility:** every tile has a VoiceOver/TalkBack label ("Three of Bamboo"). Color is never the only signal. Offer a large-tile mode.
- **Sound:** soft tile clacks (optional, off by default in public places).

## Information architecture (tabs)

1. **Learn**: a lesson path (cards on a winding jade trail).
2. **Train**: drill categories with skill meters.
3. **Play**: start a game vs. a bot, choose difficulty, resume.
4. **Progress**: skill ratings, streak, history, achievements.
5. Profile/settings live in a sheet: sound, haptics, large tiles, subscription.

## Game rules scope (American Mah Jongg)

- **152 tiles:** 3 suits (Bams, Craks, Dots) 1–9 ×4, Winds ×4 each, Dragons (Red, Green, Soap/White) ×4 each, 8 Flowers, 8 Jokers.
- Deal 13 tiles each (14 for East). Charleston: first (right, over, left), optional second (left, over, right), optional courtesy pass. Blind passing is allowed on the last pass of each Charleston.
- Jokers can stand in for any tile in a group of 3+ (pung, kong, quint, sextet). They can never be used in singles or pairs. A joker exposed on the table can be swapped for the real tile it represents.
- Calling discards for exposures (not for singles/pairs except to declare Mah Jongg).
- Dead hands, wall game, and scoring by hand value (from the practice card).
- **Practice card:** our own original ~40 hands, grouped into the familiar categories. Stored as data (`src/game/card/practice-card.ts`) and never copied from any NMJL card.

## Coaching engine (the moat)

- **Hand fit score:** for a rack, rank every card hand by tiles-needed (distance) with joker-aware matching. Shows "Top 3 hands you can go for."
- **Charleston advisor:** recommends passes that keep the most promising hands alive and explains why.
- **Discard advisor:** a weighted combination of hand-distance change, tiles already visible (dead tiles), and danger (what opponents' exposures suggest).
- **Bot tiers:** Beginner (random-ish but legal), Club (uses the advisor with noise), Shark (full advisor + defense).
- All advice is **deterministic, offline, and unit-tested**. No server needed for v1.

## Tech stack

- Expo SDK (see `app/package.json`) + Expo Router + TypeScript (strict)
- React Native Reanimated + Gesture Handler for motion; react-native-svg or @shopify/react-native-skia for tiles
- Zustand for state; MMKV or expo-sqlite for local persistence
- Jest + @testing-library/react-native for tests. The game engine is pure TS with ≥ 90% coverage
- RevenueCat (`react-native-purchases`) for subscriptions (M6)
- EAS Build/Submit for store builds (no local Xcode required)
