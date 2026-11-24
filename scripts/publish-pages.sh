#!/usr/bin/env bash
# Builds the web app and publishes app/dist to the gh-pages branch, which
# GitHub Pages serves at https://<owner>.github.io/<repo>/. This is the manual
# path for when GitHub Actions can't run (.github/workflows/pages.yml does the
# same on every push to main when it can). Needs `gh auth login` done once.
set -euo pipefail
cd "$(dirname "$0")/.."

remote="$(git remote get-url origin)"
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
owner="${repo%%/*}"; name="${repo##*/}"
site="https://$(echo "$owner" | tr '[:upper:]' '[:lower:]').github.io/$name"
sha="$(git rev-parse --short HEAD)"

echo "▶ Building for $site"
(cd app && EXPO_PUBLIC_SITE_URL="$site" EXPO_PUBLIC_BASE_PATH="/$name" npm run build:web)

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp -R app/dist/. "$work/"
git -C "$work" init -q -b gh-pages
git -C "$work" config user.name "$(git config user.name)"
git -C "$work" config user.email "$(git config user.email)"
git -C "$work" config credential.helper '!gh auth git-credential'
git -C "$work" add -A
git -C "$work" commit -q -m "Publish web build $sha"
echo "▶ Pushing gh-pages"
git -C "$work" push -f "$remote" gh-pages
gh api -X POST "repos/$repo/pages/builds" >/dev/null || true
echo "✓ Published. Pages rebuilds in about a minute: $site/"
