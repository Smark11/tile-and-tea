# Deploying the web app

The app is a static site: `npm run build:web` (in `app/`) writes `dist/`, and any
static host can serve it. Two settings tell the build where it will live:

| Variable | Meaning | Example |
| --- | --- | --- |
| `EXPO_PUBLIC_SITE_URL` | The public URL, used for canonical/Open Graph tags, `sitemap.xml` and `robots.txt`. | `https://smark11.github.io/tile-and-tea` |
| `EXPO_PUBLIC_BASE_PATH` | Only when the site sits in a sub-folder of its domain. Prefixes every bundle, route and asset URL (`app.config.js`, `+html.tsx`, the manifest). Leave unset at a domain root. | `/tile-and-tea` |

Analytics stay silent unless `EXPO_PUBLIC_POSTHOG_KEY` (and optionally
`EXPO_PUBLIC_POSTHOG_HOST`) are set at build time. See `docs/ANALYTICS.md`.

## GitHub Pages (current hosting)

`.github/workflows/pages.yml` builds and publishes on every push to `main`
(and on demand from the Actions tab). The site is served at
`https://<owner>.github.io/<repo>/`, and the workflow derives both variables
above from the repository name, so renaming the repo is all it takes to move it.

One-time setup, already done for `Smark11/tile-and-tea`:
1. Repository → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Optional: add `EXPO_PUBLIC_POSTHOG_KEY` as an Actions **secret** and
   `EXPO_PUBLIC_POSTHOG_HOST` as an Actions **variable** to turn analytics on.

What the post-export step (`scripts/write-web-files.mjs`) adds for Pages:
- `.nojekyll`, because Pages would otherwise drop the `_expo/` bundle folder.
- `404.html`, a copy of Expo's not-found page. Pages has no rewrite rules, so any
  path without a file gets it; the page carries the whole app, so the router
  still renders the right screen (a trailing-slash link, for instance). A real
  unknown path shows the not-found screen.
- The manifest's paths get the base path.

Checking a build locally the way Pages serves it: run `npm run build:web` with
the two variables set, then serve `dist/` under the same sub-folder. Every page
and deep link should load with no 404s for bundles or icons.

## Any other static host

Netlify, Cloudflare Pages, Vercel or EAS Hosting all work at a domain root:
- Build command: `npm run build:web` in `app/`, publish directory `app/dist`.
- Set `EXPO_PUBLIC_SITE_URL` to the final URL. Leave `EXPO_PUBLIC_BASE_PATH` unset.
- Clean URLs on: `/train` must serve `train.html`. Point the host's 404 fallback at
  `404.html` (or `+not-found.html`).

EAS Hosting (`npx eas-cli deploy`) needs an Expo account and is run by a human;
the backlog's M6.4 covers writing those exact steps.
