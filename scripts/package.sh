#!/usr/bin/env bash
# Build a CRX/zip-style artifact for upload to Chrome Web Store / Firefox AMO.
# Output lands in dist/. The dist/ dir is gitignored.

set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p dist
echo "→ building extension zip with web-ext…"
npx --yes web-ext@8 build \
  --source-dir . \
  --artifacts-dir dist/ \
  --overwrite-dest \
  --ignore-files \
    "node_modules/**" \
    "test/**" \
    "scripts/**" \
    "plans/**" \
    "*.md" \
    "*.log" \
    ".github/**" \
    ".claude/**" \
    ".memsearch/**" \
    "package*.json" \
    "vitest.config.*" \
    ".gitignore" \
    "dist/**"

echo "→ stripping any *.map files from artifact (defensive — repo currently produces none)"
for zip in dist/*.zip; do
  [ -f "$zip" ] || continue
  if zipinfo -1 "$zip" 2>/dev/null | grep -q '\.map$'; then
    zip -d "$zip" '*.map' >/dev/null
    echo "  removed source maps from $(basename "$zip")"
  fi
done

echo "→ artifact:"
ls -lh dist/*.zip 2>/dev/null || { echo "(no zip produced)"; exit 1; }
