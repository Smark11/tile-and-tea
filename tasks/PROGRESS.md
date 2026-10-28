# Progress Log

Each loop iteration appends a short entry here.

## Setup
- Expo app scaffolded in `app/` from the default template (Expo Router, TypeScript, Reanimated). Template LICENSE removed (commercial app).
- Full Xcode isn't installed on this Mac (Command Line Tools only). Test via Expo Go / web, and use EAS for store builds.
- `npx tsc --noEmit` currently fails only in the template demo files (animated-icon.web.tsx, app-tabs.web.tsx, theme.ts global.css import). M0.1 should remove/replace these.
