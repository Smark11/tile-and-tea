# Analytics

Tile & Tea counts visits and a handful of product moments with **PostHog**, so we can see where people come from, which pages help them, and where they get stuck. Analytics is web-only for now (native is a silent stub until N.3).

The code is in `app/src/analytics/`. Call `track(event, props)` for product events. Page views are automatic.

## Privacy rules (don't break these)

- **Cookieless.** PostHog runs with `persistence: 'memory'`, so nothing is written to cookies or storage, and no consent banner is needed. Every page load counts as a new anonymous visitor, which means "unique visitors" in PostHog really means "visits".
- **Do Not Track and Global Privacy Control are honored.** If either is on, PostHog isn't even downloaded.
- **Only the events below.** Autocapture, session recording, heatmaps, surveys, feature flags, exception capture and remote scripts are all off.
- **No personal data in properties.** Properties are ids, enums, booleans and numbers, never free text, names or emails. The `EventProperties` type only allows primitives. Never call `identify`.
- The plain-English promise to visitors lives at `/privacy` (`app/src/components/legal/PrivacyPage.tsx`). If you change what's collected, update that page and its `PRIVACY_UPDATED` date in the same change.

## When analytics runs

It sends anything only when **all** of these are true. Otherwise `track` and `screen` are silent no-ops that load nothing:

- `EXPO_PUBLIC_POSTHOG_KEY` is set at build time
- it's a production build (`__DEV__` is false, so `npx expo start` and the screenshot harness never send)
- it's not running under Jest
- it's running on web in a real browser (not static export)
- the visitor hasn't turned on Do Not Track or Global Privacy Control

PostHog is loaded lazily on the first event, so it never delays first paint. Events fired while it loads are held (up to 50) and then sent in order. If it fails to load (an ad blocker, say), analytics switches off for the session and the app carries on.

## Setup

1. Create a free PostHog Cloud project (US or EU).
2. In **Project settings → General**, turn on **Discard client IP data**. The privacy page promises we don't keep visitors' internet addresses. PostHog still estimates the country before discarding the IP.
3. Copy the project API key (it starts with `phc_`; it's safe to ship in client code).
4. Set these at build time (in the EAS Hosting environment or your static host's build settings, or a local `app/.env` that is gitignored):

   | Variable | Value |
   | --- | --- |
   | `EXPO_PUBLIC_POSTHOG_KEY` | the `phc_…` project key |
   | `EXPO_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` (default) or `https://eu.i.posthog.com` |

5. `npm run build:web` and deploy. Expo inlines `EXPO_PUBLIC_*` values into the bundle, so you have to rebuild after changing them.

To check it's working, open the deployed site with Do Not Track off, then look at **Activity → Live events** in PostHog. A `$pageview` should appear within a few seconds.

## Reading traffic in PostHog

- **How many visits, and to which pages:** *Web analytics* (left sidebar). It's built from our `$pageview` events, and the top-pages table uses `$pathname`, which is the Expo Router path (`/`, `/train`, `/privacy`, …).
- **Where visitors come from:** in *Web analytics*, the *Referring domain* and *Channel* tables. Links carrying `utm_source`, `utm_medium` or `utm_campaign` (put them on every link you post, e.g. `?utm_source=facebook&utm_campaign=beta`) show up under *UTM sources/campaigns*. PostHog reads these from the landing page URL, which is recorded when the route changes.
- **Funnels:** *Product analytics → New insight → Funnel*, for example `$pageview` (`$pathname` = `/welcome`) → `onboarding_completed` → `lesson_started` → `lesson_completed`. Because there are no cookies, a funnel only spans a single visit. That's fine for "did first-time visitors start a lesson", but it can't measure next-day retention.
- **Drill accuracy:** a *Trends* insight on `drill_answered`, broken down by `skill`, filtered to `correct = true` versus all.
- **Sharing:** a *Trends* insight on `share_clicked`, broken down by `surface`.

## Events

Page views are sent automatically as `$pageview` every time the Expo Router path changes, carrying `$pathname` and `$current_url` (so UTM tags are included). Repeat renders of the same path don't count twice.

| Event | Properties | Fired when | Status |
| --- | --- | --- | --- |
| `onboarding_completed` | `via`: `'finished'` \| `'skipped'` | The player leaves the welcome tour through Get started or Skip. Replaying the tour from Settings fires it again. | Live (W.3) |
| `lesson_started` | `lesson_id`: string | A lesson opens. | Planned: M1.1 |
| `lesson_completed` | `lesson_id`: string | The last step of a lesson is done. | Planned: M1.1 |
| `drill_answered` | `skill`: string, `correct`: boolean | The player submits one drill answer. | Planned: M3.1 |
| `game_started` | `opponents`: bot level string | A new game is dealt. | Planned: M4.1/M4.2 |
| `game_finished` | `opponents`: string, `result`: `'won'` \| `'lost'` \| `'wall_game'` \| `'dead_hand'` \| `'abandoned'` | A game ends in any way. | Planned: M4.1/M4.2 |
| `share_clicked` | `surface`: `'lesson'` \| `'drill_streak'` \| `'game'` \| `'puzzle'` | The player taps Share. | Planned: M6.3 |

### Adding an event

1. Add it to `AnalyticsEvents` and `ANALYTICS_EVENT_NAMES` in `app/src/analytics/events.ts`. The compiler fails if the two disagree.
2. Add a row to the table above. A test fails if any event is missing from this file.
3. Call `track('your_event', { … })` from the UI. Use snake_case for names and properties, and keep properties to ids, enums, booleans and numbers.
4. If the event changes what we collect in a way visitors would care about, update `/privacy`.
