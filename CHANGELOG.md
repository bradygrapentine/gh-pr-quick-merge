# Changelog

All notable changes to **GitHub PR Quick Merge** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- QM-022 — wire `lib/templates` and `lib/shortcuts` into `content.js` (repo-defaults already wired in 0.2.0)
- v0.3 cluster — per-row "Update branch", merge-when-green, bulk close/label, stale-PR badge integration

## [0.2.0] — 2026-04-29

First public release. Folds in `0.2.0-rc.1` plus the QM-019 security closeout and the Wave 2 housekeeping (web-ext lint required, simplify pass, test-gaps fill-in).

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
- **Vitest test suite** — 149 tests across 10 files at the v0.2.0 cut.
- **Documentation:** `README.md`, `SETUP.md`, `ROADMAP.md`, `BACKLOG.md`, `WAVE-2-PLAN.md`, `SECURITY.md`, `CHANGELOG.md` (this file), and per-feature plans under `plans/`.
- **`npm run package`** script — builds a Chrome Web Store / AMO–compatible zip via `web-ext build`.

### Changed

- **Token storage moved** from `chrome.storage.sync` → `chrome.storage.local` to prevent credentials roaming across browser profiles (SECURITY F-01).
- **`parsePrLink`** now validates `host === "github.com"` and `protocol === "https:"`; protocol-relative URLs no longer parse as PR links (SECURITY F-09).
- **Storage `onChanged` listener** in `content.js` now scoped to `areaName === "local"` to avoid spurious re-renders when only `clientId` (sync area) changes.
- **Manifest** declares an explicit `content_security_policy` and `rel="noopener noreferrer"` on all `target=_blank` anchors (SECURITY F-11, F-12).

### Security

- Closed 12 of 15 findings from the initial security review:
  - PR #1 — F-01 (token → `storage.local`), F-02 (dev-only Pro gate), F-04 (client-id phishing warning), F-07 (no token in DOM), F-08 (sign-out), F-09 (host validation), F-11 (CSP), F-12 (rel=noopener)
  - PR #12 — F-03 (`host_permissions` narrowed to `api.github.com/*` + 2 `/login/*` endpoints), F-05 (`slow_down` cap at 60s + honor server-supplied `interval`), F-06 (typed-confirmation modal `MERGE N` for bulk merges of 3+ PRs), F-15 (sanitized error strings — no token leak via `String(e)`)
- F-10 deferred to v1.0 (needs license server — tracked as QM-030).
- F-13 + F-14 are informational — current `innerHTML` usage is over static literals; no runtime npm dependencies ship to users.

### Tooling

- **GitHub Actions CI** runs `npm test` + `web-ext lint` for every PR; lint is **required-to-pass** as of housekeeping Wave 2.
- **Manifest lint** clean (0 errors, 2 expected non-blocking warnings).

### Known limitations

- Bulk-merge gated behind a placeholder Pro modal; no actual paywall enforcement (planned for v1.0).
- Popup uses a coarse mergeability proxy from the `/pulls` list endpoint (which doesn't return `mergeable_state`); full mergeability still computed in the content script on the PR-list page.
- Merge-commit templates and keyboard shortcuts: pure modules ship and are tested, but UI integration is queued for v0.3 (QM-016, QM-018).

## [0.1.0] — 2026-04-28

Initial commit baseline. MV3 manifest, content script with row-injected Squash / Merge / Rebase buttons, MutationObserver re-injection on list re-renders, options page with PAT entry, basic CSS, README with install steps + monetization strategy doc.

[Unreleased]: https://github.com/bradygrapentine/gh-pr-quick-merge/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/bradygrapentine/gh-pr-quick-merge/releases/tag/v0.2.0
[0.1.0]: https://github.com/bradygrapentine/gh-pr-quick-merge/commit/e38d837
