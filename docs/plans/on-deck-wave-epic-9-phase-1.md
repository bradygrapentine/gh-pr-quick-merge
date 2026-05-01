# On-Deck Wave — Epic 9 Phase 1 (GitLab adapter)

**Resume target.** When the next session opens this repo, this is the wave to start.

**Date drafted:** 2026-05-01 (session end)
**Status:** waiting on QM-305 (Phase 0 regression sweep) + PR #77 (onboarding tour)

---

## Preflight (mandatory; do before any code)

1. `git fetch origin && git log origin/main..HEAD` — local main equals remote.
2. `gh pr list --state open --json number,title --jq '.[] | "#\(.number) \(.title)"'` — confirm #77 has merged. If still open, **finish #77 first** (review CI, merge).
3. `npm test && npm run test:e2e:visual` (or rely on CI) — confirm Phase 0's QM-302 + QM-303 didn't regress anything when integrated. **This is QM-305.** If anything fails, fix before starting Phase 1.
4. Read `lib/hosts/index.js` + `lib/hosts/github/adapter.js` to refresh on the contract Phase 1 has to satisfy.

If any preflight step is red → halt and report. Do not start Phase 1 on a broken Phase 0.

---

## Plan summary

GitLab adapter implementation, mirroring `lib/hosts/github/*`. Six stories, ~6 eng-days, parallelisable across the endpoint files once the api shim lands.

| ID | Title | Owner | Deps | Files |
|---|---|---|---|---|
| QM-306 | `lib/hosts/gitlab/api.js` — apiGet/apiPost/apiPut against `gitlab.com/api/v4` | **Opus** | — | `lib/hosts/gitlab/api.js`, `test/gitlab-api.test.js` |
| QM-307 | `lib/hosts/gitlab/selectors.js` — `parseRowAnchor` for `.merge-request` rows | **Sonnet** | QM-306 | `lib/hosts/gitlab/selectors.js`, `test/gitlab-selectors.test.js` |
| QM-308 | `fetchMrState` — normalise GitLab `merge_status`/`detailed_merge_status` into the shared shape | **Opus** | QM-306 | `lib/hosts/gitlab/mr-state.js`, `test/gitlab-mr-state.test.js` |
| QM-309 | `doMerge` — squash via `squash=true`; respect project-level `merge_method` | **Sonnet** | QM-306 + QM-308 | `lib/hosts/gitlab/api.js` (extends apiPut wrapper) |
| QM-310 | `updateBranch` — `PUT /merge_requests/:iid/rebase`, poll `rebase_in_progress` | **Sonnet** | QM-306 | `lib/hosts/gitlab/api.js` |
| QM-311 | Bulk close + label — `PUT /merge_requests/:iid` with `state_event: close` and `add_labels` | **Sonnet** | QM-306 | `lib/hosts/gitlab/api.js` |
| QM-312 | `lib/hosts/gitlab/adapter.js` — implements `HostAdapter`; passes the contract tests | **Opus** | QM-306..311 | `lib/hosts/gitlab/adapter.js`, `test/gitlab-adapter.test.js` |

---

## Sequencing

```
QM-306 (api shim)           ← serial, must land first
   ├─ QM-307 (selectors)    ← can run alongside the next three
   ├─ QM-308 (mr-state)     ← serial dep for QM-309
   │     └─ QM-309 (doMerge)
   ├─ QM-310 (updateBranch) ← parallel after QM-306
   └─ QM-311 (bulk ops)     ← parallel after QM-306
                                              ↓
                              QM-312 (adapter wiring) ← convergence PR
```

**Dispatch decision:** **Direct implementation by Opus** for QM-306, QM-308, QM-312 (judgment-heavy: response-shape normalisation, contract surface). **Sonnet via /dispatch** for QM-307 / 309 / 310 / 311 once QM-306 merges (mechanical endpoint wrappers with pinned signatures).

If using `/dispatch` for the parallel three: each branch off the same base SHA, file ownership is non-overlapping (each owns its own logical addition to api.js or its own new file), merge order is QM-309 → QM-310 → QM-311 → rebase any survivors.

---

## Contract test (write FIRST — QM-328 is the parity gate)

Before starting QM-306, scaffold `test/host-adapter-contract.test.js` that runs the **same** test suite against the GitHub adapter (existing) and the GitLab adapter (under construction). The GitLab side will fail until QM-312 lands; that's the desired pull. This is QM-328 from BACKLOG, but it earns its keep by anchoring Phase 1 — Phase 1 ships the moment the contract suite goes green for both adapters.

Suite covers:
- `findPrAnchor` returns null on rows that don't match
- `parsePrLink` parses canonical URL → `{owner, repo, num}` shape
- `api.apiGet` returns parsed JSON; throws structured error on non-2xx
- `api.apiPut` echoes the body back from a fixture
- (out of scope here, in Phase 2): host-aware `injectRowActions` integration

---

## Out of scope for Phase 1

- Self-hosted GitLab runtime permissions (Phase 3, QM-318+)
- Manifest content_scripts.matches expansion (Phase 2, QM-313)
- Popup / options / store-listing copy refresh (Phase 2 + 4)
- Product rename to "QuickMerge" (Phase 4, QM-322)

---

## Decisions to make before resuming

1. **Should I land QM-305 (Phase 0 regression sweep) as a no-op marker PR**, or just run the suite locally and proceed? Cost of the marker PR: 5 minutes; benefit: backlog hygiene.
2. **Are Sonnet dispatches OK** for QM-307/309/310/311, or do you want all-Opus (smaller diff, slower wallclock)?
3. **Bot account for GitLab CI** — Phase 5 (QM-326) needs a GitLab-side `gh-pr-qm-bot` analogue with project-level access. Worth provisioning during Phase 1 so Playwright e2e specs can land alongside QM-312.
4. **Product rename timing.** The CWS + AMO listings are tied to "PR Quick Merge" and the v1.1 listings are about to be submitted. Renaming to "QuickMerge" before v1.1 ships in stores would force a re-submission. Recommendation: **defer rename to v2.0 launch**, not v1.1.

---

## Resume command

When opening this repo next session, the user can paste:

```
Resume Epic 9 Phase 1 from docs/plans/on-deck-wave-epic-9-phase-1.md.
Run the preflight, then start with QM-306.
```

I'll read this file, run the preflight checks, ask which dispatch mode you want, and start QM-306 immediately on green.
