#!/usr/bin/env bash
# Produce both Chrome and Firefox zips in one run, with consistent naming.
#
# Order matters: build Chrome FIRST, then Firefox. The Firefox script
# patches manifest.json in-place (with a trap that restores it), and if
# the Chrome build runs second it would pick up Sentry artifacts from
# the Firefox build's intermediate state.
#
# Both builds honor SENTRY_DSN identically — set it once before this
# script and both zips ship with the same Sentry config; leave it
# unset and both zips ship Sentry-free (and AMO won't ask for source).
#
# Usage:
#   npm run package:both
#   SENTRY_DSN=... npm run package:both

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -e "console.log(require('./package.json').version)")
CHROME_ZIP="dist/gh-pr-quick-merge-chrome-${VERSION}.zip"
FIREFOX_ZIP="dist/gh-pr-quick-merge-firefox-${VERSION}.zip"

# Drop any prior builds so the rename below is unambiguous.
rm -f "$CHROME_ZIP" "$FIREFOX_ZIP"

echo "════════ Building Chrome zip ════════"
bash scripts/package.sh

# package.sh emits dist/<web-ext-default-name>-<version>.zip; rename.
LATEST_CHROME=$(ls -t dist/*.zip 2>/dev/null | head -1)
if [ -z "$LATEST_CHROME" ]; then
  echo "Chrome build produced no zip" >&2
  exit 1
fi
mv "$LATEST_CHROME" "$CHROME_ZIP"
echo "✓ $CHROME_ZIP"

echo
echo "════════ Building Firefox zip ════════"
bash scripts/package-firefox.sh

echo
echo "════════ Done ════════"
ls -lh "$CHROME_ZIP" "$FIREFOX_ZIP"
