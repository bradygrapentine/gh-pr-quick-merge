# GitHub PR Quick Merge — Backlog

## §0 Status board

- Ready: 13
- In progress: 0
- In review: 0
- Blocked: 0
- Done (Wave 1): 9

## §1 Ready

| ID | Title | Milestone | Estimate | Dependencies |
|----|-------|-----------|----------|--------------|
| QM-010 | Integration tests for row-injection against fixture HTML | v0.2 | M | QM-009 |
| QM-011 | GitHub Actions CI: lint + typecheck + test on PR | v0.2 | S | QM-009 |
| QM-012 | Per-repo default merge method storage + read path | v0.3 | M | — |
| QM-013 | Per-repo default merge method UI in options page | v0.3 | M | QM-012 |
| QM-014 | Apply per-repo default to row buttons (highlight default) | v0.3 | S | QM-012 |
| QM-015 | Custom merge-commit template engine (`{title}`, `{pr_number}`, `{author}`) | v0.3 | M | — |
| QM-016 | Template editor UI in options page with live preview | v0.3 | M | QM-015 |
| QM-017 | Keyboard shortcut handler (s/m/r on focused row) | v0.3 | M | — |
| QM-018 | Focus-ring styling + a11y announcements for shortcut activation | v0.3 | S | QM-017 |
| QM-019 | SECURITY.md follow-ups (placeholder — security agent owns the concrete items) | v0.2 | S | — |
| QM-020 | web-ext lint integration (Firefox AMO pre-flight) in dev workflow + CI | v0.2 | S | QM-011 |
| QM-021 | Toolbar popup (`popup.html`) with mergeable-PR summary across pinned repos | v0.2 | M | — |
| QM-022 | Wave 2 integration glue — wire `lib/repo-defaults`, `lib/templates`, `lib/shortcuts` into `content.js` | v0.3 | M | QM-012, QM-015, QM-017 |

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
- QM-009 — Vitest + jsdom set up; 17 unit tests passing against `lib/pr-helpers.js`

## §7 Shipped

_(empty until first public release)_
