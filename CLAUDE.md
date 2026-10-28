# Mah Jongg Coach: instructions for the build agent

You are the builder in an automated build loop. Each run, you complete **exactly one** backlog task, verify it, record it, and stop. Three independent reviewers (`reviewers/design.md`, `rules.md`, `code.md`) then judge your work. Read their criteria, because they will reject anything below a world-class bar. The loop commits only after all three approve.

## Read first
- `docs/PRODUCT.md`: design direction, rules scope, tech stack. Follow it.
- `docs/BUSINESS.md` §4: the NMJL card constraint. **Never reproduce hands from any National Mah Jongg League card.** Only use our original practice card.
- `app/AGENTS.md`: Expo-specific rules (use `npx expo install`, versioned docs, no hand-editing `ios/`/`android/`).
- `tasks/PROGRESS.md`: notes left by previous iterations.

## Each iteration
1. Open `tasks/BACKLOG.md` and pick the **first** `[ ]` task. If a `## 🛑 CHECKPOINT` line comes before it, do nothing and print `CHECKPOINT_REACHED`.
2. Implement it inside `app/`. Keep game logic pure TypeScript in `app/src/game/` with unit tests. Keep UI in `app/src/components/` and routes in `app/src/app/`.
3. Verify in `app/`: `npx tsc --noEmit`, `npx expo lint`, `npm test` must all pass. Fix failures, and don't weaken or skip tests to get green.
4. If the task touched UI and the screenshot harness exists, run `npm run screenshots` so the design reviewer can see your work. Open the PNGs yourself first and polish anything that isn't stunning.
5. Mark the task `[x]` in the backlog. Append 2–5 lines to `tasks/PROGRESS.md`: what you built, decisions made, anything the next iteration should know.
6. **Do not commit.** The loop commits after review.
7. If you're truly blocked (it needs human accounts or keys, or a rules ambiguity you can't settle), mark the task `[!]` with a one-line reason, record it in PROGRESS.md, and print `BLOCKED`.

## Quality bar
- **Visually stunning** is a requirement, not a nice-to-have. Use spring animations, careful spacing, the Jade Parlor palette, and real depth on tiles. Make it feel premium.
- **Rules correctness** is sacred. The audience will notice mistakes. When unsure about a rule, choose the standard American Mah Jongg interpretation and note it in PROGRESS.md.
- Accessible by default: a11y labels on tiles, Dynamic Type, Reduce Motion.
- Keep tasks scoped. Don't start the next task, and don't refactor unrelated code.
- Never push to a remote, never run `eas build/submit`, never add paid services or secrets.
