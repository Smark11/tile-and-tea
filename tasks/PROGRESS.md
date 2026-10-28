# Progress Log

Each loop iteration appends a short entry here.

## Setup
- Expo app scaffolded in `app/` from the default template (Expo Router, TypeScript, Reanimated). Template LICENSE removed (commercial app).
- Full Xcode isn't installed on this Mac (Command Line Tools only). Test via Expo Go / web, and use EAS for store builds.
- `npx tsc --noEmit` currently fails only in the template demo files (animated-icon.web.tsx, app-tabs.web.tsx, theme.ts global.css import). M0.1 should remove/replace these.

## M0.1 Clean template + tooling
- Removed all Expo template demo code (explore route, animated splash overlay, app-tabs, themed-text/view, hint-row, web-badge, collapsible, constants/theme.ts, hooks, global.css, reset-project script, demo images). Kept the icon/splash/favicon assets that app.json references. The template splash color `#208AEF` is still set; M6.3 owns the splash.
- `_layout.tsx` is now a bare headerless Stack. `index.tsx` is a temporary jade placeholder for M0.2/M0.6 to replace.
- Jest uses the `jest-expo` preset (set in the package.json `jest` key) with `@testing-library/react-native` v14, where `render` is async (`await render(...)`). Scripts: `npm test`, `npm run typecheck`. `expo lint` auto-installed ESLint 9 + eslint-config-expo (flat `eslint.config.js`).
- TS 6 defaults `types` to empty, so tsconfig sets `"types": ["jest"]`. Add more entries there (e.g. `node`) if globals go missing.
- **Never put test files under `src/app/`**, because Expo Router treats them as routes. Put tests in `src/__tests__/` or next to modules in `src/game/` and `src/components/`.

## M0.1b Screenshot harness
- `npm run screenshots` (`scripts/screenshots.mjs`) starts `expo start --web` on port 8099 (override with `SCREENSHOT_PORT`; it refuses a busy port), waits for Metro's `/status`, then uses Playwright Chromium to capture each route at 393×852 @3x (1179×2556, the real iPhone 15) in light and dark mode into `app/screenshots/<route>-<scheme>.png`. It clears old PNGs first and stops the dev server's process group afterward.
- Routes are found automatically from `src/app/` (`scripts/routes.js`, unit-tested in `scripts/__tests__/`). It skips layouts, `+` files, API routes, native-only variants, and dynamic `[param]` routes. Groups are stripped. Set `SCREENSHOT_ROUTES=/,/dev/styleguide` to capture a subset. Dynamic routes need a future harness option if we want them.
- Page JS errors and console errors make the run exit 1, so a broken screen can't pass silently. There's a 1s settle delay for entrance springs.
- One-time setup on a new machine: `npx playwright install chromium` (the script prints this hint if the browser is missing). Playwright is a devDependency.

## M0.2 Design system
- `src/theme/`: `palette.ts` (raw brand colors), `colors.ts` (semantic light/dark `ThemeColors`; use these, never raw hex), `tokens.ts` (spacing, radii, `boxShadow` elevations per scheme, typography, `minTouchTarget` 48, `maxContentWidth`), `fonts.ts`, and `useTheme()`. Fonts are Fraunces (serif headings) and Inter (sans body), loaded per weight. Each face is its own family name (`Inter_600SemiBold`), so set `fontFamily`, not `fontWeight`. The root layout holds the splash until fonts load.
- `theme.test.ts` asserts WCAG AA (4.5:1) for every text/background pair the components use. Add new pairs there when adding color tokens. Gold and red have separate `goldText`/`dangerText` variants because the brand values fail AA as text on light backgrounds.
- Components: `Text` (variants; headings auto-announce as headers; only big headings cap Dynamic Type scaling), `Button` (primary/secondary/quiet, Reanimated press spring skipped under Reduce Motion; use `sv.get()/set()` because the React Compiler lint rejects `.value` writes), `Card` (surface/felt), `Screen` (safe area + centered column). The styleguide lives in `components/dev/Styleguide.tsx`, and the `/dev/styleguide` route redirects home in release builds.
- Web is SSR (`web.output: server`), so `theme/useColorScheme.web.ts` returns light until hydration to avoid mismatch errors. Jest: `jest.setup.js` mocks safe-area and has a **minimal hand-written Reanimated mock**, because Reanimated 4's bundled mock boots native Worklets and fails under jest-expo. Extend that mock when you use more of the Reanimated API. RNTL v14's `fireEvent` is async, so `await` it.
- Screenshot harness now also pages through long scroll views, writing `<route>-<scheme>-2.png`, `-3.png`, and so on, so reviewers see below the fold.
