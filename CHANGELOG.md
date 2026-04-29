# Changelog

All notable changes to **GitHub PR Quick Merge** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- QM-019 — close remaining 7 SECURITY findings (gates the v0.2.0 final tag)
- QM-022 — wire `lib/templates` and `lib/shortcuts` into `content.js` (repo-defaults already wired in v0.2.0-rc.1)
- Housekeeping Wave 2 (lint cleanup, simplify pass, test-gaps fill-in)

## [0.2.0-rc.1] — 2026-04-29

### Added

- **OAuth Device Flow** (`auth.js`) — sign in via GitHub instead of pasting a PAT, with options-page UI for Client ID + device-code prompt + countdown ([#1](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/1) earlier work, hardening in [#1](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/1)).
- **Bulk-merge action bar** — multi-select checkbox per row, sticky bottom bar with method picker and "Merge selected" button, gated behind a Pro modal placeholder.
- **Pure helper modules** with unit tests:
  - `lib/pr-helpers.js` (URL parsing, mergeability classification)
  - `lib/repo-defaults.js` (per-repo default merge method)
  - `lib/templates.js` (commit-message template engine)
  - `lib/shortcuts.js` (keyboard shortcut parsing)
  - `lib/stale-pr.js` (PR staleness classification)
  - `lib/popup-data.js` (popup aggregation)
- **Toolbar popup** (`popup.html`) — extension-icon click opens a 360px popup listing pinned repos with mergeable-PR counts ([#3](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/3)).
- **Per-repo default merge method** — UI in options page; ring + dot indicator on the matching button per row; auto-select in bulk-merge dropdown when all selected PRs share a default ([#5](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/5)).
- **GitHub Actions CI** (`.github/workflows/test.yml`) — `npm test` on Node 20 + `web-ext lint` for every PR ([#1](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/1)).
- **Real PNG icons** at 16/48/128 px (green merge disc with git-merge glyph).
- **MV3 background service worker** (`background.js`) relaying `chrome.management` queries from content scripts.
- **Sign-out / clear-token** button in options page.
- **OAuth client-id phishing warning** in options page.
- **Vitest test suite** — 124 tests across 7 files at v0.2.0-rc.1 cut.
- **Documentation:** `README.md`, `SETUP.md`, `ROADMAP.md`, `BACKLOG.md`, `WAVE-2-PLAN.md`, `SECURITY.md`, `CHANGELOG.md` (this file), and per-feature plans under `plans/`.
- **`npm run package`** script — builds a Chrome Web Store / AMO–compatible zip via `web-ext build`.

### Changed

- **Token storage moved** from `chrome.storage.sync` → `chrome.storage.local` to prevent credentials roaming across browser profiles (SECURITY F-01).
- **`parsePrLink`** now validates `host === "github.com"` and `protocol === "https:"`; protocol-relative URLs no longer parse as PR links (SECURITY F-09).
- **Storage `onChanged` listener** in `content.js` now scoped to `areaName === "local"` to avoid spurious re-renders when only `clientId` (sync area) changes.
- **Manifest** declares an explicit `content_security_policy` and `rel="noopener noreferrer"` on all `target=_blank` anchors (SECURITY F-11, F-12).

### Security

- Closed 8 of 15 findings from the initial security review (F-01, F-02, F-04, F-07, F-08, F-09, F-11, F-12).
- The "Enable Pro (dev)" affordance is now gated on `chrome.management.getSelf().installType === "development"` — no longer present in production unpacked installs (F-02).
- 7 findings remain open and tracked under **QM-019** (F-03 narrow `host_permissions`, F-05 `slow_down` interval cap, F-06 typed-confirmation for bulk merge, F-10 client-side Pro flag, F-15 error string sanitization, plus two infos).

### Known limitations

- Bulk-merge gated behind a placeholder Pro modal; no actual paywall enforcement (planned for v1.0).
- Popup uses a coarse mergeability proxy from the `/pulls` list endpoint (which doesn't return `mergeable_state`); full mergeability still computed in the content script on the PR-list page.
- `web-ext lint` job in CI runs with `continue-on-error: true`. Wave 2 housekeeping flips it to required.

## [0.1.0] — 2026-04-28

Initial commit baseline. MV3 manifest, content script with row-injected Squash / Merge / Rebase buttons, MutationObserver re-injection on list re-renders, options page with PAT entry, basic CSS, README with install steps + monetization strategy doc.

[Unreleased]: https://github.com/bradygrapentine/gh-pr-quick-merge/compare/v0.2.0-rc.1...HEAD
[0.2.0-rc.1]: https://github.com/bradygrapentine/gh-pr-quick-merge/releases/tag/v0.2.0-rc.1
[0.1.0]: https://github.com/bradygrapentine/gh-pr-quick-merge/commit/e38d837
