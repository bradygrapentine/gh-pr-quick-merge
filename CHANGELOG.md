# Changelog

All notable changes to **GitHub PR Quick Merge** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Empty — v1.1.0 absorbed the v0.3 / v0.4 / v1.0 / v1.1 candidates._

## [1.1.0] — 2026-05-01

Major release folding in three completed epics (Epic 8 v1.1 Design Refresh, Epic 10 v1.2 PR-page safety, Epic 11 v1.3 PR-list metadata + filters) plus the v1.0 launch-finish track and a v2.0 GitLab-port scaffold.

### Features

- **Design refresh (Epic 8):** new theme tokens + primitives, redesigned row widget (compact pill + caret + optimistic UI), redesigned popup, options side-nav, bulk bar, onboarding, toast, sponsor card, label picker.
- **Auto-Merge toggle:** single checkbox-style button that flips between Auto-Merge / 🟡 watching / ✅ merged / ❌ retry; clicking the watching state stops the watch (no separate Cancel pill).
- **Resolve Conflicts pill:** danger-tinted link surfaces on PRs whose `mergeable_state === "dirty"`, opening GitHub's web conflict editor.
- **Faster watcher:** merge-queue alarm 1 min → 30 s (Chrome MV3 minimum); watched PRs land within one refresh cycle.
- **PR-page safety (Epic 10):** always-visible rebase + inline approve on the PR detail page; fallback Merge / Squash buttons.
- **Filter bar + row metadata (Epic 11):** quick-filter chips (Mine / Ready / Hide bots / Stale / Small) with `<details>` "More" disclosure; row size + CI badges mounted inline with the title.
- **Auto-Rebase opt-in:** per-PR sticky checkbox; threshold-driven rebase before merge.
- **Onboarding privacy link:** beneath the connect-CTA, points at the GitHub Pages-hosted privacy policy.
- **Options page:** Sentry crash-report consent toggle wired to `chrome.storage.sync.qm_sentry_consent` (off by default; opt-in only); typed bulk-confirm dialog; per-repo template bindings; update-branch strategy + auto-rebase threshold; repo-name autocomplete.
- **GraphQL CI rollup:** single round-trip per row for CI status (was N requests).
- **HostAdapter scaffold:** `lib/hosts/index.js` + `lib/hosts/github/*` seam for the v2.0 GitLab port (ADR 0001 — keep with single consumer).

### Fixes

- **Manifest MV3 load:** drop `background.scripts` (Chrome MV3 rejects); alias `self.window = self` before importing the vendored Sentry CDN bundle that hard-references `window`.
- **Cross-platform lockfile:** `npm ci` fails on Linux when the lockfile is generated on macOS without the optional Linux deps (`@emnapi/core`, `@emnapi/runtime`); regenerate from a clean state.
- **innerHTML → DOM construction:** brand mark, caret chevron, sponsor-card badge, typed-confirm prompt, and bulk-bar shell now use `createElementNS` / `createElement` to satisfy AMO's `UNSAFE_VAR_ASSIGNMENT` linter.

### Infra & ops

- **Branch protection:** required checks `test`, `manifest-lint`, `e2e` enforced on `main`; `lock_branch` off; admin-bypass off.
- **Dependabot:** weekly npm + github-actions updates with grouped minor/patch; vulnerability alerts + automated security fixes enabled.
- **Sentry vendoring:** `@sentry/browser` 8.55.2 vendored via pinned-SHA `scripts/vendor-sentry.sh`; `SENTRY_DSN` injected at build via `scripts/package.sh`; sanitizer scrubs PII before upload; off by default.
- **Visual baselines:** Linux Playwright baselines committed; manual-trigger regen workflow at `.github/workflows/visual-baselines.yml`.
- **GitHub Pages privacy policy:** `docs/privacy-policy.md` published to `bradygrapentine.github.io/gh-pr-quick-merge/privacy-policy.html`; linked from options page + onboarding.
- **Coverage gate:** Vitest coverage threshold; E2E + perf specs gated.
- **CI workflows:** `e2e` runs on every PR (paths filter would silently block merges); `web-ext` Firefox AMO lint informational pending dual manifest (Phase 5).

### Docs

- ROADMAP.md / BACKLOG.md updated for v1.1 ship.
- `docs/adr/0001-hostadapter.md` + `docs/adr/README.md` (new ADR index).
- `docs/plans/v1.1-blockers-plan.md` + Opus adversarial review.
- `docs/status-2026-05-01.md` project audit.
- `plans/v2-gitlab-port.md` Epic 9 scaffold (31 stories).
- Runbooks + privacy policy + sponsor copy.

### Breaking

_None._ All v0.2 storage keys + APIs preserved. Existing tokens, templates, shortcuts, and per-repo defaults migrate cleanly.

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
