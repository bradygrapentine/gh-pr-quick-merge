# Wave 2 Plan — Integration & v0.2 Polish

**Wave window:** 2026-04-30 → 2026-05-04
**Goal:** ship v0.2 to Chrome Web Store dev channel. Wire the three pure modules built in Wave 1.5 (`lib/repo-defaults.js`, `lib/templates.js`, `lib/shortcuts.js`) into `content.js` and the options page, add the toolbar popup, stand up CI, and clear all Critical/High security findings.

---

## Wave 1.5 recap (completed by parallel TDD agents)

| Module | Lines | Tests | Status |
|---|---|---|---|
| `lib/repo-defaults.js` | ~50 | 15 | ✅ green |
| `lib/templates.js`      | ~80 | 21 | ✅ green |
| `lib/shortcuts.js`      | ~70 | ~14 | ✅ green |

Each module is pure (no DOM, no chrome.* coupling — store is injected). Total test suite: ~67 tests.

---

## Wave 2 parts

### Part A — Repo-defaults integration (owner: agent A)
**Files (exclusive):** `content.js`, `options.html`, `options.js`
**Deliverable:**
- Read `repoDefaults` map at content-script start; cache in `state.repoDefaults`.
- Highlight the default merge-method button per row (CSS class `qm-btn-default`).
- Auto-select that method in the bulk-merge dropdown when all selected PRs share a default.
- New "Per-repo defaults" section in options: list current entries, allow add (owner/repo + method dropdown) and remove. No bulk import in v0.2.
**Verify:** new tests `test/repo-defaults-integration.test.js` exercising the merge-method picker logic against a fake DOM (jsdom). Existing tests remain green.

### Part B — Template integration (owner: agent B)
**Files (exclusive):** `content.js` (merge-call only), `options.html`, `options.js`
**Deliverable:**
- New "Merge-commit templates" section in options: textarea for squash template + textarea for merge template, with live preview using a sample PR fixture (title, number, body, author).
- Defaults from `lib/templates.js` shown as placeholders when empty.
- Validation errors surfaced inline (red border + message) using `validateTemplate`.
- `doMerge` reads the template and passes `commit_title` / `commit_message` to GitHub's merge API when applicable (squash+merge support these; rebase ignores them).
**Verify:** `test/templates-integration.test.js` — happy path + invalid template falls back to GitHub default + repo override beats user default.

### Part C — Shortcut integration (owner: agent C)
**Files (exclusive):** `content.js`, `options.html`, `options.js`
**Deliverable:**
- Global `keydown` listener on `document` (with input/textarea bail-out).
- Default bindings from `DEFAULT_BINDINGS` wired to actions: select all visible mergeable rows, merge selected, squash selected, rebase selected, clear selection.
- "Keyboard shortcuts" section in options listing each binding with a "Press a key…" rebind button.
- Custom bindings persist to `chrome.storage.sync.shortcuts`.
- Visible focus ring on the row currently bound to keyboard actions (per-row, follows mouse hover or explicit Tab).
**Verify:** `test/shortcut-integration.test.js` — keydown dispatches correct action; modifier-only key doesn't fire; focused-textarea bails.

> **A/B/C all touch `content.js` and `options.html`.** Sequential merge order: A → B → C. Don't dispatch in parallel — the central files are too contended. Plan for serial agent runs with explicit base SHA hand-off.

### Part D — Toolbar popup (owner: agent D, parallel-safe)
**Files (exclusive):** `popup.html`, `popup.js`, `popup.css`, `manifest.json` (action.default_popup), `lib/popup-data.js`
**Deliverable:**
- Click extension icon → small popup listing pinned repos and count of mergeable PRs in each.
- "Pinned repos" managed in options; first run lists `chrome.storage.sync.pinnedRepos` empty → call to action.
- Each row in popup is a link to the PR list for that repo.
**Verify:** `test/popup-data.test.js` — aggregator handles empty list, single repo, mixed mergeability.

### Part E — CI workflow (owner: me, foreground)
**File:** `.github/workflows/test.yml`
**Deliverable:**
- On every PR: run `npm ci && npm test` on Node 20, fail on any test failure.
- Upload test output as artifact.
- Add a `web-ext lint` job (Firefox AMO check).
**Verify:** open a no-op PR, see green check.

### Part F — Security follow-ups (owner: me, foreground after security agent reports)
**Files:** wherever the SECURITY.md findings point.
- Resolve every Critical / High finding before tagging v0.2.
- Triage Medium / Low into BACKLOG entries (`QM-0??-sec-*`).
- Specifically expected: replace remaining `innerHTML` blocks (Pro modal, bulk bar) with `createElement` patterns; tighten host_permissions; add `content_security_policy` field to manifest.

### Part G — Tag v0.2 (owner: me, foreground, last)
- Bump `manifest.json` version to `0.2.0`.
- Bump `package.json` version to `0.2.0`.
- `git tag v0.2.0`, push, create GitHub release with auto-generated notes.
- Build a zip via `web-ext build` and attach to the release.

---

## Merge order

```
Wave 1.5 modules merged   ← already on main
        │
        ▼
   E (CI)            ← can land first; gives green-check infra to subsequent PRs
        │
        ▼
   F (security fixes)  ← in parallel with A
        │
        ▼
   A (repo-defaults integration)
        │
        ▼
   B (templates integration)
        │
        ▼
   C (shortcuts integration)   ← integration trio is serial because they all touch content.js + options
        │
        ▼
   D (popup)           ← can run in parallel with B and C (disjoint files)
        │
        ▼
   G (tag v0.2.0)
```

---

## Risk log

| Risk | Likelihood | Mitigation |
|---|---|---|
| GitHub PR-list DOM changes break selectors | Medium | Add fixture-based integration tests in Part A; flag for monthly re-test |
| OAuth client ID rate-limits in heavy dev | Low | Each contributor registers their own dev OAuth app per SETUP.md |
| Pro modal bypassable via DevTools storage edit | Known / accepted | v0.2 is intent-capture only; license-key validation lands in v1.0 (QM-014 in roadmap) |
| Vitest 4 ESM / CJS interop quirks | Low | Pinned working pattern — CJS `module.exports` in lib, ESM `import` in tests |
| Security findings push v0.2 ship date | Medium | Triage at end of Part F: ship-blockers vs deferable |

---

## Definition of done (v0.2)

- [ ] All Critical + High security findings resolved
- [ ] CI green on main for 5 consecutive commits
- [ ] All test files passing (target: 80+ tests after integration)
- [ ] `npm run package` produces a valid zip (manual unpack & load works)
- [ ] README updated to remove "v0.2-dev" and point to first GitHub release
- [ ] Tag `v0.2.0` exists with release notes

---

## Open questions

1. Should "Enable Pro (dev)" persist across reloads or be session-only? Currently persists in `chrome.storage.sync.pro` — that may sync to other devices, embarrassing. Recommendation: switch to `chrome.storage.local.pro` for v0.2.
2. Per-repo defaults UI: free-text owner/repo input vs autocompleted from API? Free-text in v0.2; autocomplete is a v0.3 nice-to-have.
3. Keyboard shortcut conflicts with GitHub's own shortcuts (`s`, `m`, `r` are likely taken). Default to `Shift+`-prefixed bindings as suggested by the shortcuts module.
