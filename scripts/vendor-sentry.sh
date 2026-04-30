#!/usr/bin/env bash
# Vendor a single-file Sentry browser bundle for the MV3 service worker.
#
# Sentry stopped shipping UMD bundles via npm (build/bundles/ was removed
# around v8). The CDN at browser.sentry-cdn.com still publishes them and is
# the only realistic path for a no-bundler project. We pin the version and
# the SHA-256 here so a swap mid-supply-chain is loud, not silent.
#
# Source:  https://browser.sentry-cdn.com/<VERSION>/bundle.min.js
# Target:  lib/vendor/sentry.min.js
#
# Run via `npm run vendor:sentry` or implicitly by scripts/package.sh when
# SENTRY_DSN is set.

set -euo pipefail

cd "$(dirname "$0")/.."

# Pinned upstream version + sha256 of the exact bundle we ship. To bump:
#   1. Update VERSION
#   2. Run this script (it'll fail the sha check)
#   3. Verify the new hash matches the official Sentry release notes
#   4. Update EXPECTED_SHA256
VERSION="8.55.2"
EXPECTED_SHA256="d8e888c3e22a0790e84734d688e3f59347d555efc1f4a4c2ebac39738087e9b6"

DEST_DIR="lib/vendor"
DEST_FILE="${DEST_DIR}/sentry.min.js"
SRC_URL="https://browser.sentry-cdn.com/${VERSION}/bundle.min.js"

mkdir -p "$DEST_DIR"

echo "→ fetching @sentry/browser ${VERSION} from ${SRC_URL}"
TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

if command -v curl >/dev/null 2>&1; then
  curl -sSfL "$SRC_URL" -o "$TMP_FILE"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TMP_FILE" "$SRC_URL"
else
  echo "✗ neither curl nor wget available" >&2
  exit 1
fi

# SHA verification — both for tamper-detection and to fail loudly when the
# CDN content drifts under a pinned version.
if command -v shasum >/dev/null 2>&1; then
  ACTUAL_SHA256=$(shasum -a 256 "$TMP_FILE" | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
  ACTUAL_SHA256=$(sha256sum "$TMP_FILE" | awk '{print $1}')
else
  echo "✗ no sha256 tool available (need shasum or sha256sum)" >&2
  exit 1
fi

if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
  echo "✗ sha256 mismatch for @sentry/browser ${VERSION}" >&2
  echo "  expected: $EXPECTED_SHA256" >&2
  echo "  actual:   $ACTUAL_SHA256" >&2
  echo "  refusing to vendor — bump EXPECTED_SHA256 deliberately if upstream truly rotated." >&2
  exit 1
fi

# Stamp + move into place atomically so a partial download never lands.
{
  echo "/* @sentry/browser ${VERSION} — vendored by scripts/vendor-sentry.sh */"
  echo "/* sha256: ${EXPECTED_SHA256} */"
  cat "$TMP_FILE"
} > "${DEST_FILE}.tmp" && mv "${DEST_FILE}.tmp" "$DEST_FILE"

echo "✓ vendored @sentry/browser ${VERSION} → ${DEST_FILE} ($(wc -c < "$DEST_FILE") bytes)"
