#!/usr/bin/env bash
# Semi-automated release helper for PR Quick Merge.
#
# Usage:
#   bash scripts/release.sh <version>
#
# Performs:
#   1. Pre-flight: clean working tree, on main, up to date with origin
#   2. Run unit tests (vitest)
#   3. Bump version in manifest.json + package.json
#   4. Run npm run package to produce the .zip + .xpi artifacts
#   5. Print SHA256 of artifacts and the next manual steps from the runbook
#
# Does NOT: tag, push, or upload to either store. The runbook covers those
# steps explicitly because each requires interactive consent.

set -euo pipefail

VERSION=${1:-}
if [[ -z "$VERSION" ]]; then
  echo "usage: bash scripts/release.sh <version>" >&2
  exit 64
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]]; then
  echo "ERROR: '$VERSION' does not look like a semver string (e.g. 1.0.0 or 1.0.0-rc1)" >&2
  exit 64
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# 1. Pre-flight
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is dirty. Commit or stash before releasing." >&2
  git status --short >&2
  exit 65
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "WARNING: not on main (current: $CURRENT_BRANCH). Continue? [y/N]"
  read -r ans
  [[ "$ans" =~ ^[Yy]$ ]] || exit 1
fi

git fetch origin
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$CURRENT_BRANCH")"
if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  echo "ERROR: local $CURRENT_BRANCH ($LOCAL_SHA) != origin ($REMOTE_SHA). Pull or push first." >&2
  exit 65
fi

# 2. Tests
echo "==> Running unit tests"
npm test

# 3. Version bump
echo "==> Bumping version to $VERSION in manifest.json + package.json"
node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  m.version = '$VERSION';
  fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2) + '\n');
"
npm pkg set version="$VERSION"

# 4. Package
echo "==> Building artifacts"
npm run package

ZIP="$(ls -t web-ext-artifacts/*.zip 2>/dev/null | head -1 || true)"
if [[ -z "$ZIP" ]]; then
  echo "ERROR: no .zip produced under web-ext-artifacts/" >&2
  exit 70
fi

# 5. Hashes + next steps
SHA="$(shasum -a 256 "$ZIP" | awk '{print $1}')"

cat <<EOF

=== Release $VERSION built ===

Artifact: $ZIP
SHA256:   $SHA

Next steps (manual — see docs/runbook-release.md):
  1. Commit the version bump:
       git add manifest.json package.json package-lock.json
       git commit -m "release: v$VERSION"
       git tag -a "v$VERSION" -m "v$VERSION"
       git push origin main --tags

  2. Create a GitHub release attaching the artifact above and recording the SHA256.

  3. Submit to Chrome Web Store (see docs/store-submission-guide.md, QM-104 section).

  4. Submit to Firefox AMO + source-disclosure zip (see docs/store-submission-guide.md, QM-108 section).

  5. After both stores publish: follow docs/runbook-release.md "Post-release checks".

EOF
