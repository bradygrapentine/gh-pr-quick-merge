# GitHub PR Quick Merge — Backlog

## §0 Status board

- Ready: 16
- In progress: 0
- In review: 0
- Blocked: 0
- Done (Wave 1 + Wave 2 partial): 14

## §1 Ready

| ID | Title | Milestone | Estimate | Dependencies | Plan |
|----|-------|-----------|----------|--------------|------|
| QM-010 | Integration tests for row-injection against fixture HTML | v0.2 | M | QM-009 | — |
| QM-013 | Per-repo default merge method UI in options page | v0.3 | M | QM-012 (lib done) | [plans/repo-defaults-integration.md](plans/repo-defaults-integration.md) |
| QM-014 | Apply per-repo default to row buttons (highlight default) | v0.3 | S | QM-012 (lib done) | [plans/repo-defaults-integration.md](plans/repo-defaults-integration.md) |
| QM-016 | Template editor UI in options page with live preview | v0.3 | M | QM-015 (lib done) | — |
| QM-018 | Focus-ring styling + a11y announcements for shortcut activation | v0.3 | S | QM-017 (lib done) | — |
| QM-019 | SECURITY.md follow-ups: F-03, F-05, F-06, F-10, F-15 (8/15 closed in PR #1) | v0.2 | S | — | — |
| QM-021 | Toolbar popup (`popup.html`) with mergeable-PR summary across pinned repos | v0.2 | M | — | [plans/popup.md](plans/popup.md) |
| QM-022 | Wave 2 integration glue — wire `lib/repo-defaults`, `lib/templates`, `lib/shortcuts` into `content.js` | v0.3 | M | QM-013/014, QM-016, QM-018 | — |
| QM-023 | Stale-PR detection pure module (`lib/stale-pr.js`) | v0.3 | S | — | [plans/stale-pr-module.md](plans/stale-pr-module.md) |
| QM-024 | Per-row "Update branch" button (rebase/merge base into PR branch) | v0.3 | M | — | — |
| QM-025 | Merge-when-green: schedule a merge to fire once required checks pass | v0.4 | L | QM-022 | — |
| QM-026 | Bulk close / bulk label (extend bulk-action bar with non-merge ops) | v0.4 | M | — | — |
| QM-027 | Stale-PR badge integration into `content.js` rows | v0.3 | S | QM-023 | — |
| QM-028 | Pinned-repo management UI in options page | v0.2 | S | QM-021 | — |
| QM-029 | Token-rotation reminder (badge after N days) | v0.3 | S | — | — |
| QM-030 | License-key validation server (Cloudflare Worker + Stripe) | v1.0 | XL | QM-022 | — |

## §2 In progress

_(empty)_

## §3 In review

_(empty)_

## §4 Blocked

_(empty)_

## §5 Icebox

- Merge-queue integration (queue PR for merge once checks pass)
- AI-suggested merge timing (predict CI flakiness, off-hours risk)
- JIRA / Linear ticket linkage + auto-transition on merge
- Cross-repo batch ops dashboard
- Slack / Discord notification on bulk merges
- Toolbar popup summarizing mergeable PRs across pinned repos
- Opt-in cheaper list-endpoint mode for very long PR lists
- Team admin console (seat management, audit log)
- Analytics dashboard (merge throughput, stuck PRs)
- Safari extension port
- Conventional-commit linter on merge-commit templates
- Auto-rebase before merge if behind base by N commits

## §6 Done

**v0.1 baseline:**
- Manifest v3 with content-script matches for `github.com/pulls`, `github.com/<owner>/<repo>/pulls`, `github.com/issues`
- Content script (`content.js`) — per-row Squash/Merge/Rebase buttons
- `MutationObserver` re-injection on list re-renders
- GitHub API client: `GET /pulls/:num` mergeability check, `PUT /pulls/:num/merge` action
- Options page (`options.html` + `options.js`) for PAT entry, stored via `chrome.storage.sync`
- Basic CSS (`styles.css`) matching GitHub list styling
- README with install steps (Chrome/Edge/Brave/Arc + Firefox), token scopes, how-it-works
- Monetization strategy doc (in README)

**Wave 1 (v0.2-dev, 2026-04-29):**
- QM-001 — Real PNG icons (16/48/128) designed and added to `icons/`
- QM-002 — Icons wired into `manifest.json`
- QM-003 — OAuth device flow client (`auth.js`): poll + token exchange
- QM-004 — OAuth path added to options page; PAT retained as fallback
- QM-005 — Pure helpers extracted to `lib/pr-helpers.js` and consumed by `content.js` (token-storage / parsing surface)
- QM-006 — Multi-select checkbox column injected into PR rows
- QM-007 — Bulk-merge action bar (sticky, count + method picker)
- QM-008 — Bulk-merge gated behind "Pro" placeholder modal (intent capture only, no payment)
- QM-009 — Vitest set up; 17 unit tests passing against `lib/pr-helpers.js`

**Wave 1.5 — pure lib modules + tests (2026-04-29):**
- QM-012 — `lib/repo-defaults.js` (15 tests, integration pending in QM-013/QM-014)
- QM-015 — `lib/templates.js` (21 tests, integration pending in QM-016)
- QM-017 — `lib/shortcuts.js` (21 tests, integration pending in QM-018)

**Wave 2 partial — CI + security (PR #1, merged 2026-04-29):**
- QM-011 — GitHub Actions CI workflow (`.github/workflows/test.yml`) running `npm test` on Node 20 for every PR + push to main
- QM-020 — `web-ext lint` job added to CI (Firefox AMO pre-flight, continue-on-error)
- SECURITY F-01, F-02, F-04, F-07, F-08, F-09, F-11, F-12 — closed (token → `storage.local`, dev-only Pro button, client-id warning, sign-out, host validation, CSP, rel=noopener)
- `background.js` MV3 service worker added to relay `chrome.management` lookups
- v0.3/v0.4 product narrative ("Everything you wish the GitHub PR list did") added to ROADMAP.md

## §7 Shipped

_(empty until first public release)_
