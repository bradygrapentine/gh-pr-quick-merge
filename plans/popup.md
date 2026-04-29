# Plan — Toolbar popup (QM-021)

**Milestone:** v0.2
**Estimate:** M
**Dependencies:** none
**Parallel-safe with:** Plan B (repo-defaults integration), Plan C (stale-PR module)

## Goal

Click the extension icon → small popup listing pinned repos and the count of mergeable PRs in each. Each row links to that repo's PR list.

## File ownership (exclusive)

- **NEW:** `popup.html`, `popup.js`, `popup.css`
- **NEW:** `lib/popup-data.js` — pure aggregator (testable, no DOM)
- **NEW:** `test/popup-data.test.js`
- **EDIT (one-line):** `manifest.json` — add `"action": { "default_popup": "popup.html", "default_title": "PR Quick Merge" }`

No other files touched.

## TDD spec for `lib/popup-data.js`

Exports:
- `aggregateMergeable(repoFetchResults)` — input: array of `{ owner, repo, prs: [{ number, mergeable_state, title }] }`. Output: `[{ owner, repo, mergeableCount, totalCount, prs: [...] }]` sorted by `mergeableCount` descending, then by `owner/repo` alphabetically.
- `formatPopupRow(entry)` — returns `{ label: "owner/repo", subtitle: "3 of 7 ready to merge", url: "https://github.com/owner/repo/pulls" }`.
- `EMPTY_STATE_HINT` — constant string for first-run.

Dual CJS + `window.QM_POPUP_DATA` export, matching the pattern in `lib/pr-helpers.js`.

### Tests (target: 12+)

1. `aggregateMergeable([])` → `[]`
2. Single repo, all mergeable → count == total
3. Single repo, mixed states → count counts only `mergeable_state` in `["clean", "has_hooks", "unstable"]`
4. Multiple repos, sorted by mergeableCount desc
5. Tie-break by `owner/repo` alpha
6. PRs with `mergeable_state: null` (pending) excluded from count but included in total
7. `formatPopupRow` happy path
8. `formatPopupRow` handles 0 mergeable: subtitle "0 of N ready"
9. `formatPopupRow` handles total=0: subtitle "no open PRs"
10. URL matches `https://github.com/{owner}/{repo}/pulls` exactly
11. `aggregateMergeable` is pure (does not mutate input)
12. Long owner/repo names not truncated by aggregator (UI handles overflow)

## Popup UI (`popup.html` + `popup.js` + `popup.css`)

- Width 360px, max-height 480px, scrollable.
- Reads `chrome.storage.sync.pinnedRepos` (array of `"owner/repo"` strings); empty → show `EMPTY_STATE_HINT` + a "Manage pinned repos" button that opens the options page.
- For each pinned repo, fetch `GET /repos/{owner}/{repo}/pulls?state=open&per_page=30` using the token from `chrome.storage.local.token`.
- Pass results to `aggregateMergeable`, render as a list. Each row is an anchor to the repo's PRs page.
- Loading state, error state (token missing → "Sign in via Options" link).

## Verify

```bash
npm test                          # all tests green, including 12+ new in test/popup-data.test.js
node --check popup.js manifest.json
```

Manual: load unpacked → click icon → popup opens → empty state shows → add a pinned repo via storage edit → re-open popup → count appears.

## Risks

- Pinned-repo list management UI deferred to a follow-up plan (out of scope here — store config only).
- Rate-limit: 30 PRs × N pinned repos × per-popup-open. Acceptable for v0.2; cache is a v0.3 optimization.
