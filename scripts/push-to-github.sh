#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "No git repo found. Run this from the mycoffee folder."
  exit 1
fi

read -r -p "Your GitHub username: " GH_USER
REMOTE="https://github.com/${GH_USER}/mycoffee.git"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

echo ""
echo "Before pushing, create an empty repo at:"
echo "  https://github.com/new?name=mycoffee"
echo ""
echo "Leave README, .gitignore, and license unchecked. Then press Enter."
read -r _

echo "Pushing to $REMOTE ..."
git push -u origin main

echo ""
echo "Done. Next in Netlify:"
echo "  1. Add new site -> Import from Git -> GitHub -> mycoffee"
echo "  2. Build command: npm run build (auto from netlify.toml)"
echo "  3. Publish directory: dist (auto from netlify.toml)"
echo "  4. Site settings -> Environment variables:"
echo "       VITE_MAPS_BROWSER_KEY = same value as your .env.local"
echo "  5. Deploy, then add https://YOUR-SITE.netlify.app/* to Google key referrers"
