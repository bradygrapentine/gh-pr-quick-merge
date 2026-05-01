#!/usr/bin/env bash
# Build a Firefox-flavored .zip for AMO upload.
#
# Chrome MV3 requires `background.service_worker`; Firefox MV3 requires
# `background.scripts`. The two are mutually exclusive in a single
# manifest. This script:
#
#   1. Backs up manifest.json.
#   2. Patches it to the Firefox shape.
#   3. Runs scripts/package.sh to produce dist/*.zip.
#   4. Renames the artifact with a -firefox suffix.
#   5. Restores the original manifest.
#
# The restore happens in a trap so a failed build doesn't leave the
# repo in the patched state.
#
# Usage:
#   ./scripts/package-firefox.sh
#   SENTRY_DSN=... ./scripts/package-firefox.sh   # for production
#
# Output: dist/gh_pr_quick_merge_firefox-<version>.zip

set -euo pipefail

cd "$(dirname "$0")/.."

MANIFEST="manifest.json"
BACKUP="${MANIFEST}.chrome-bak"

# Restore on any exit path so the working tree never stays patched.
restore_manifest() {
  if [ -f "$BACKUP" ]; then
    mv "$BACKUP" "$MANIFEST"
    echo "✓ restored Chrome manifest"
  fi
}
trap restore_manifest EXIT

# Snapshot the current (Chrome) manifest.
cp "$MANIFEST" "$BACKUP"

echo "→ patching manifest.json: background.service_worker → background.scripts"

# Use node so we don't have to grovel JSON in bash. The patch is
# idempotent: if Firefox shape is already present, leave it alone.
node -e '
  const fs = require("fs");
  const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  if (!m.background) {
    console.error("manifest has no background block — refusing to guess");
    process.exit(1);
  }
  const sw = m.background.service_worker;
  if (sw) {
    delete m.background.service_worker;
    m.background.scripts = [sw];
  } else if (Array.isArray(m.background.scripts) && m.background.scripts.length) {
    // already Firefox-shaped; nothing to do
  } else {
    console.error("background block is neither Chrome- nor Firefox-shaped");
    process.exit(1);
  }
  fs.writeFileSync("manifest.json", JSON.stringify(m, null, 2) + "\n");
'

# Build via the shared package.sh — it handles Sentry vendoring + web-ext.
bash scripts/package.sh

# Rename the artifact so Chrome and Firefox builds don't collide in dist/.
VERSION=$(node -e "console.log(require('./package.json').version)")
LATEST_ZIP=$(ls -t dist/*.zip 2>/dev/null | head -1)
if [ -z "$LATEST_ZIP" ]; then
  echo "package.sh produced no zip — aborting" >&2
  exit 1
fi
FIREFOX_ZIP="dist/gh-pr-quick-merge-firefox-${VERSION}.zip"
mv "$LATEST_ZIP" "$FIREFOX_ZIP"
echo "✓ Firefox artifact: $FIREFOX_ZIP"

# trap restore_manifest fires here — manifest.json reverts to Chrome shape.
