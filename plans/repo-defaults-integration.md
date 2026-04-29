# Plan — Per-repo defaults integration (QM-012 / QM-013 / QM-014)

**Milestone:** v0.3 (advances Wave 2 Part A)
**Estimate:** M
**Dependencies:** `lib/repo-defaults.js` (already shipped, 15 tests green)
**Parallel-safe with:** Plan A (popup — disjoint files), Plan C (stale-PR module — new files only)

## Goal

Wire the existing `lib/repo-defaults.js` module into the runtime: highlight a repo's default merge button on every PR row, and let the user manage defaults via the options page.

## File ownership (exclusive)

- **EDIT:** `content.js`, `options.html`, `options.js`, `styles.css`
- **NEW:** `test/repo-defaults-integration.test.js`

The other plans don't touch any of these files (Plan A only edits a single new key in `manifest.json`; Plan C is new files only). No conflicts.

## TDD spec

### 1. Content-script integration

- On startup, load `repoDefaults` map from `chrome.storage.sync` and stash on `state.repoDefaults`.
- In `injectRow`, after computing `pr`, look up `getDefault(pr.owner, pr.repo, store)`. If a default exists, add CSS class `qm-btn-default` to the matching button (`squash` / `merge` / `rebase`).
- Subscribe to `chrome.storage.onChanged` (sync area) — on `repoDefaults` change, re-style all visible rows.
- In the bulk-merge bar: when all selected PRs share the same default method, auto-select that option in the dropdown. If they diverge, leave whatever the user picked.

### 2. Options page UI

- New section: "Per-repo default merge method".
- List current entries: `owner/repo → method` with a "Remove" button per row.
- Add row: `owner/repo` text input + method dropdown (squash/merge/rebase) + "Add" button.
- On Add: call `setDefault(owner, repo, method, syncStore)`; reject if already exists (prompt overwrite).
- On Remove: call `clearDefault(owner, repo, syncStore)`; UI updates immediately.

### 3. Tests for `test/repo-defaults-integration.test.js` (target: 8+)

Use a fake DOM via the existing vitest setup or pure unit tests on extracted helpers. Suggested helper: extract `pickDefaultForBulk(selectedPrs, defaultsMap)` into `lib/repo-defaults.js` and test it.

1. `pickDefaultForBulk` — all share `squash` → returns `"squash"`
2. `pickDefaultForBulk` — mixed defaults → returns `null`
3. `pickDefaultForBulk` — none have defaults → returns `null`
4. `pickDefaultForBulk` — empty selection → returns `null`
5. `pickDefaultForBulk` — some have, some don't → returns `null` (any divergence fails the check)
6. Defaults map respected when only a subset of selection is in the map (returns `null`)
7. Adding a default fires the storage change handler (mock)
8. Removing a default with `clearDefault` reflects in `listDefaults` immediately

## CSS (in `styles.css`)

- `.qm-btn-default` — bolder border + ring outline; preserves the existing color per kind.
- Optional: small dot indicator in the corner.

## Verify

```bash
npm test                          # full suite green; ~85+ tests after
```

Manual:
1. Open options → Per-repo defaults → add `bradygrapentine/scratch` → squash.
2. Visit `github.com/bradygrapentine/scratch/pulls`. The squash button on each row has the new ring.
3. Multi-select → bulk-merge dropdown auto-set to "Squash & merge".
4. Remove the default → ring disappears on next render.

## Risks

- `repoDefaults` lives in `chrome.storage.sync` (correct — it's a preference, not a credential). Keep it there.
- Conflict with Plan A: only if Plan A's manifest edit changes more than `action.*`. It won't.
- A11y: the `qm-btn-default` ring should be visible at the same contrast across light/dark themes. Test both.

## Out of scope

- Autocomplete on `owner/repo` input (pull from `/user/repos`) — future plan.
- Per-repo template overrides (templates plan handles this separately).
