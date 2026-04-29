# Wave 2 Plan — Integration & v0.2 Polish

**Wave window:** 2026-04-29 → 2026-05-04 (started early; tracking ahead of plan)
**Goal:** ship v0.2 to Chrome Web Store dev channel. Wire the three pure modules built in Wave 1.5 (`lib/repo-defaults.js`, `lib/templates.js`, `lib/shortcuts.js`) into `content.js` and the options page, add the toolbar popup, stand up CI, and clear all Critical/High security findings.

**Status as of 2026-04-29:** A, D, E shipped. F shipped 8 of 15 findings (remaining 7 → QM-019). B, C, G remain.

---

## Wave 1.5 recap (completed by parallel TDD agents — 2026-04-29)

| Module | Lines | Tests | Status |
|---|---|---|---|
| `lib/repo-defaults.js` | ~50 | 15 | ✅ green |
| `lib/templates.js`      | ~80 | 21 | ✅ green |
| `lib/shortcuts.js`      | ~70 | 21 | ✅ green |
| `lib/stale-pr.js` (added later) | ~70 | 22 | ✅ green |
| `lib/popup-data.js` (added later) | ~50 | 14 | ✅ green |

Each module is pure (no DOM, no chrome.* coupling — store is injected). Test suite total: **124 tests** as of v0.2.0-rc.1.

---

## Wave 2 parts

### Part A — Repo-defaults integration ✅ shipped (PR [#5](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/5))
**Files:** `content.js`, `options.html`, `options.js`, `styles.css`, `lib/repo-defaults.js`, `test/repo-defaults-integration.test.js`
- Read `repoDefaults` map at content-script start; cache in `state.repoDefaults`. ✅
- Highlight the default merge-method button per row via `qm-btn-default` (outline + accent dot). ✅
- Auto-select that method in the bulk-merge dropdown when all selected PRs share a default. ✅
- "Per-repo default merge method" section in options (list/add/remove). ✅
- New tests: `test/repo-defaults-integration.test.js`. ✅

### Part B — Template integration (remaining)
**Files (exclusive):** `content.js` (merge-call only), `options.html`, `options.js`
**Deliverable:**
- New "Merge-commit templates" section in options: textarea for squash template + textarea for merge template, with live preview using a sample PR fixture (title, number, body, author).
- Defaults from `lib/templates.js` shown as placeholders when empty.
- Validation errors surfaced inline (red border + message) using `validateTemplate`.
- `doMerge` reads the template and passes `commit_title` / `commit_message` to GitHub's merge API when applicable (squash+merge support these; rebase ignores them).
**Verify:** `test/templates-integration.test.js` — happy path + invalid template falls back to GitHub default + repo override beats user default.

### Part C — Shortcut integration (remaining)
**Files (exclusive):** `content.js`, `options.html`, `options.js`
**Deliverable:**
- Global `keydown` listener on `document` (with input/textarea bail-out).
- Default bindings from `DEFAULT_BINDINGS` wired to actions: select all visible mergeable rows, merge selected, squash selected, rebase selected, clear selection.
- "Keyboard shortcuts" section in options listing each binding with a "Press a key…" rebind button.
- Custom bindings persist to `chrome.storage.sync.shortcuts`.
- Visible focus ring on the row currently bound to keyboard actions (per-row, follows mouse hover or explicit Tab).
**Verify:** `test/shortcut-integration.test.js` — keydown dispatches correct action; modifier-only key doesn't fire; focused-textarea bails.

> **B and C both touch `content.js` and `options.html`.** Sequential merge order: B → C. Don't dispatch in parallel — the central files are too contended.

### Part D — Toolbar popup ✅ shipped (PR [#3](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/3))
**Files:** `popup.html`, `popup.js`, `popup.css`, `lib/popup-data.js`, `test/popup-data.test.js`, `manifest.json` (action.default_popup)
- Click extension icon → 360px popup listing pinned repos and count of mergeable PRs in each. ✅
- Empty state CTA opening Options. ✅
- Each row links to the repo's `/pulls` page with `target=_blank rel="noopener noreferrer"`. ✅
- 14 new aggregator tests. ✅
- **Pinned-repo management UI** (QM-028) deferred — popup currently reads `chrome.storage.sync.pinnedRepos` directly; UI to manage is a follow-up.

### Part E — CI workflow ✅ shipped (PR [#1](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/1))
**File:** `.github/workflows/test.yml`
- `npm test` on Node 20 for every PR + push to main. ✅
- `web-ext lint` job (currently `continue-on-error: true` — flipped to required in housekeeping Wave 2). ⚠️ partial

### Part F — Security follow-ups ✅ partially shipped (PR [#1](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/1))
**Closed:** F-01 (token → `storage.local`), F-02 (dev-only Pro button), F-04 (client-id warning), F-07 (no token in DOM), F-08 (sign-out), F-09 (host validation), F-11 (CSP), F-12 (rel=noopener) — **8 of 15**.
**Remaining:** F-03 (narrow `host_permissions`), F-05 (`slow_down` interval cap), F-06 (typed-confirmation for bulk), F-10 (client-side Pro flag — v1.0 license server), F-15 (error-string sanitization). Tracked under **QM-019**.

### Part G — Tag v0.2.0 (remaining, gated on QM-019)
- `manifest.json` and `package.json` are stamped `0.2.0-rc.1` as of housekeeping Wave 1.
- Final `v0.2.0` tag waits on QM-019 closing the remaining 7 findings.
- Then: `git tag v0.2.0`, push, create GitHub release with auto-generated notes, attach the zip from `npm run package`.

---

## Merge order (revised)

```
Wave 1.5 modules merged   ✅
        │
        ▼
   E (CI)                 ✅  PR #1
        │
        ▼
   F (security partial)   ✅  PR #1 (8 of 15) — remaining → QM-019
        │
        ▼
   A (repo-defaults)      ✅  PR #5
        │
        ▼
   D (popup)              ✅  PR #3 (in parallel with A)
        │
        ▼
   Housekeeping W1        ⏳  doc sync + version bump → 0.2.0-rc.1
        │
        ▼
   Housekeeping W2        ⏳  lint cleanup, simplify, test gaps
        │
        ▼
   B (templates)          ⏳
        │
        ▼
   C (shortcuts)          ⏳  serial after B (both touch content.js + options)
        │
        ▼
   QM-019 (security 2)    ⏳  closes remaining 7 findings
        │
        ▼
   G (tag v0.2.0)         ⏳
```

---

## Risk log

| Risk | Likelihood | Mitigation |
|---|---|---|
| GitHub PR-list DOM changes break selectors | Medium | Fixture-based integration tests planned (QM-010) |
| OAuth client ID rate-limits in heavy dev | Low | Each contributor registers their own dev OAuth app per SETUP.md |
| Pro modal bypassable via DevTools storage edit | Known / accepted | v0.2 is intent-capture only; license-key validation lands in v1.0 (QM-030) |
| Vitest 4 ESM / CJS interop quirks | Low | Pinned working pattern — CJS `module.exports` in lib, ESM `import` in tests |
| Security findings push v0.2 ship date | Medium | 8 closed in PR #1; triage of remaining 7 is QM-019's job |

---

## Definition of done (v0.2)

- [x] CI green on main (passing on every PR since #1)
- [x] All test files passing (124 tests as of v0.2.0-rc.1; target was 80+, exceeded)
- [x] `npm run package` produces a valid zip (added in housekeeping Wave 1)
- [x] manifest + package.json version stamped `0.2.0-rc.1`
- [ ] Templates integration (Part B) merged
- [ ] Shortcuts integration (Part C) merged
- [ ] Remaining 7 SECURITY findings closed (QM-019)
- [ ] Tag `v0.2.0` exists with release notes
- [ ] CHANGELOG.md `[Unreleased]` block reconciled into a `[0.2.0]` block on tag

---

## Open questions (resolved)

1. ~~Should "Enable Pro (dev)" persist across reloads or be session-only?~~ **Resolved** in PR #1 — moved to `chrome.storage.local.pro` and gated on `installType === "development"`.
2. ~~Per-repo defaults UI: free-text owner/repo input vs autocompleted?~~ **Resolved** — free-text in v0.2 (shipped PR #5); autocomplete is a v0.3 nice-to-have.
3. ~~Keyboard shortcut conflicts with GitHub's own shortcuts?~~ **Resolved** — `lib/shortcuts.js` ships `Shift+`-prefixed defaults (Shift+A/M/S/R + Escape).
