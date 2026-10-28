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
