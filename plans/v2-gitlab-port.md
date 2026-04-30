# Plan — v2.0 GitLab port

**Milestone:** v2.0
**Estimate:** XL — ~20 eng-days end-to-end (parallelisable into ~12 calendar days with one engineer)
**Dependencies:** v1.0 launched on Chrome Web Store + Firefox AMO; v1.1 design refresh merged
**Parallel-safe with:** Post-1.0 GitHub Marketplace work, design polish

---

## Goal

Ship the **same product** on GitLab. A user installs **one** extension and gets row-level merge buttons on `github.com/pulls`, `gitlab.com/group/project/-/merge_requests`, and any self-hosted GitLab instance they configure. Same merge ergonomic, same toolbar popup, same options page — just two host targets.

The point is to retain the existing GitHub user base and broaden the addressable audience. GitLab has ~30M users; even single-digit-percent adoption is meaningful for a free, donation-funded extension.

---

## Why one extension, not two

Considered and rejected:

- **Separate extension** ("MR Quick Merge"): doubles the maintenance surface — two listings, two stores per platform (= 4 total), two release pipelines, two SECURITY.md, two backlogs. Users with both GitLab and GitHub work installed one tool today; they'd need two.
- **Fork the codebase**: drift problem is worse over time. Bug fixes on GitHub side don't reach GitLab side without manual cherry-picks; design refreshes diverge.

**Chosen: a single extension with a host-abstracted core**. Per-host adapters (GitHub adapter, GitLab adapter) under `lib/hosts/` implement a small interface (`detectHost`, `parseRowAnchor`, `fetchPrState`, `doMerge`, `updateBranch`, `enqueue`, etc.). `content.js` becomes host-agnostic; the existing `lib/api.js` stays GitHub-specific and is renamed `lib/hosts/github/api.js` while a sibling `lib/hosts/gitlab/api.js` mirrors the contract.

The downside: a refactor pass before any GitLab-specific code can land. It's bounded — `lib/api.js` already centralises most fetches; `content.js` already calls helpers rather than inlining auth headers. The diff is mechanical.

---

## Concept mapping — GitHub ↔ GitLab

| Concept | GitHub | GitLab |
|---|---|---|
| Code-review unit | Pull Request (PR) | Merge Request (MR) |
| List page URL | `github.com/pulls`, `github.com/{owner}/{repo}/pulls` | `gitlab.com/dashboard/merge_requests`, `gitlab.com/{group}/{project}/-/merge_requests` |
| Single MR URL | `…/pull/{n}` | `…/-/merge_requests/{iid}` |
| API root | `https://api.github.com` | `https://gitlab.com/api/v4` (or self-hosted) |
| Auth | OAuth Device Flow / PAT | PAT or OAuth2 (GitLab supports device flow on 16.0+) |
| Project identifier | `{owner}/{repo}` | numeric `id` OR url-encoded `{namespace}/{project}` path |
| Merge endpoint | `PUT /repos/:o/:r/pulls/:n/merge` | `PUT /api/v4/projects/:id/merge_requests/:iid/merge` |
| Squash merge | separate endpoint param: `merge_method=squash` | merge endpoint param: `squash=true` |
| Merge commit | default | default |
| Rebase | separate endpoint: `update-branch` with `merge_method=rebase` | separate endpoint: `PUT /api/v4/projects/:id/merge_requests/:iid/rebase` |
| Mergeable state | `mergeable_state` field (`clean`, `behind`, `blocked`, `dirty`) | `merge_status` (`can_be_merged`, `cannot_be_merged`, `unchecked`) + `detailed_merge_status` (recent API) |
| Status checks | `/commits/:sha/check-runs` | `/projects/:id/repository/commits/:sha/statuses` |
| Labels | `POST /issues/:n/labels` | `PUT /merge_requests/:iid` with `add_labels=…` |
| Close MR | `PATCH /pulls/:n` `{state: closed}` | `PUT /merge_requests/:iid` `{state_event: close}` |
| Sponsor analogue | GitHub Sponsors | Open Collective / direct (no native GitLab sponsorship) |

GitLab's `merge_method` is a project-level setting — squash/rebase/merge-commit availability depends on the project's config. The extension's per-PR method choice for GitLab will be **what the project allows**; methods the project disabled are greyed out.

---

## Architectural changes

### 1. Host adapter layer

**New directory:** `lib/hosts/`

```
lib/hosts/
  index.js              — host detection + adapter dispatch
  github/
    adapter.js          — GitHub interface impl
    api.js              — moved from lib/api.js (renamed exports unchanged)
    selectors.js        — DOM selectors for github.com pages
  gitlab/
    adapter.js          — GitLab interface impl
    api.js              — gitlab.com/api/v4 wrappers
    selectors.js        — DOM selectors for gitlab.com pages
```

**Adapter interface (TypeScript-ish for clarity):**

```ts
interface HostAdapter {
  // Detection
  matches(location: URL): boolean;           // is this URL ours?
  hostName(): "github" | "gitlab";
  parseRowAnchor(rowEl): { project, number, url } | null;

  // PR/MR state
  fetchPrState(ref, token): Promise<PrState>;
  isReady(state: PrState): boolean;
  isBehind(state: PrState): boolean;

  // Mutations
  doMerge(ref, method, token, opts): Promise<MergeResult>;
  updateBranch(ref, token): Promise<void>;
  closePR(ref, token): Promise<void>;
  applyLabels(ref, labels, token): Promise<void>;

  // Auth
  authPath(): { type: "oauth-device" | "pat", endpoints: {...} };
}
```

Both adapters return the same normalised shapes so `content.js` and `lib/merge-queue.js` are host-agnostic.

### 2. Multi-host token storage

`chrome.storage.local.token` becomes:

```js
{
  tokens: {
    "github.com": "ghp_…",
    "gitlab.com": "glpat-…",
    "gitlab.example.com": "glpat-…",
  }
}
```

A migration step on first run after upgrade reads the old `token` field (assumed GitHub) and slots it under `"github.com"`.

### 3. Self-hosted GitLab support

Self-hosted GitLab is a major part of the GitLab user base (estimated >50% of active GitLab use is on `gitlab.example.com` instances). The extension needs:

- An "Add self-hosted GitLab instance" UI on the Options page.
- Manifest `host_permissions` request via `chrome.permissions.request` at runtime — we cannot pre-declare every possible self-hosted domain.
- Per-instance token storage (per the multi-host shape above).

Privacy implication: each added host increases the trust surface. The disclosure copy needs to make it explicit that the token is sent only to that instance.

### 4. Content-script matching

Manifest `content_scripts.matches` already covers `github.com`. Add `gitlab.com/*` and use `chrome.permissions` for self-hosted. The same `content.js` runs on both; host detection in `lib/hosts/index.js` picks the adapter.

### 5. Naming

The product name **"PR Quick Merge"** is GitHub-flavoured. v2.0 is a good moment to rename:

- Option A — keep "PR Quick Merge", note that "PR" generalises to "pull/merge request" (some users say "MR" for GitLab).
- Option B — rename to **"Quick Merge"** (drop "PR"). Less precise, but works for both platforms.
- Option C — rename to **"Merge Quick"** — cleaner, but loses the brand recognition we'll have built by then.

**Recommendation: B (Quick Merge).** The display surface in popup / options uses the new wordmark from the v1.1 design refresh, and a clean two-word name reads well there. The CWS and AMO listings can be updated; the underlying extension ID stays the same so existing installs auto-update through the rename.

---

## Phases

### Phase 0 — Refactor for multi-host (~5 days)

No GitLab code yet; only restructure the existing GitHub code so a sibling adapter can plug in.

**Stories:** QM-300..305

- QM-300: introduce `lib/hosts/index.js` + `HostAdapter` interface contract (JSDoc types).
- QM-301: move `lib/api.js` → `lib/hosts/github/api.js`; thin re-export at old path for backwards compat through this PR; remove the re-export in QM-303.
- QM-302: write `lib/hosts/github/adapter.js` implementing `HostAdapter`; wire `content.js` to call adapter methods instead of direct API helpers.
- QM-303: token storage migration — old `chrome.storage.local.token` → new `tokens["github.com"]` shape; transparent fallback; remove the temporary re-export from QM-301.
- QM-304: extract DOM selectors from `content.js` into `lib/hosts/github/selectors.js`.
- QM-305: regression sweep — full Playwright + unit suites green; manual smoke against real github.com.

### Phase 1 — GitLab adapter (~6 days)

**Stories:** QM-306..312

- QM-306: `lib/hosts/gitlab/api.js` — `apiGet/apiPost/apiPut` against `https://gitlab.com/api/v4`; PAT auth via `PRIVATE-TOKEN` header. 12+ unit tests.
- QM-307: `lib/hosts/gitlab/selectors.js` + `parseRowAnchor` — anchor on `.merge-request` rows on `gitlab.com/.../-/merge_requests`; extract `{ project, iid }`.
- QM-308: `fetchMrState` — normalise GitLab's `merge_status` + `detailed_merge_status` into the same `{ ready, behind, blocked, draft, head_sha, behind_by }` shape used by the GitHub adapter.
- QM-309: `doMerge` — handles squash via `squash=true` parameter (not a separate endpoint); respects project's allowed `merge_method`. Falls back to a friendly error if the user picks a method the project disabled.
- QM-310: `updateBranch` — `PUT /api/v4/projects/:id/merge_requests/:iid/rebase`; polls until `rebase_in_progress` is false.
- QM-311: bulk close + label — `PUT /merge_requests/:iid` with `state_event: close` and `add_labels` params.
- QM-312: `lib/hosts/gitlab/adapter.js` — implements the `HostAdapter` interface; passes the same contract tests Phase 0 wrote for the GitHub adapter.

### Phase 2 — Host detection + UI surfacing (~3 days)

**Stories:** QM-313..317

- QM-313: `manifest.json` content_scripts `matches` adds `gitlab.com/*`; runtime permissions for self-hosted instances.
- QM-314: host-aware injection — `content.js` calls `lib/hosts/index.js#detect()`, picks adapter, injects the row widget using the same `injectRowActions` API.
- QM-315: per-host status pill copy — the row widget's READY/BEHIND/BLOCKED/DRAFT pill maps to GitLab's vocabulary where it differs (`DRAFT` is the same word; `BEHIND` is "needs rebase" on GitLab — we keep the English neutral).
- QM-316: popup — pinned-list rows tagged with host icon; "10 mergeable across 4 repos" → "10 mergeable across 4 projects" when GitLab instance is the only one (mixed: stay with "repos" for parsimony).
- QM-317: options page — new "Hosts" pane: GitHub (sign-in state), GitLab.com (sign-in state), "Add self-hosted GitLab…" button.

### Phase 3 — Self-hosted GitLab (~3 days)

**Stories:** QM-318..321

- QM-318: `chrome.permissions.request` flow when the user adds a self-hosted host. Per-host disclosure modal explaining the token will be sent only to that domain.
- QM-319: per-host token storage shape; sign-in / sign-out flows operate on the right slot.
- QM-320: settings export/import (`lib/import-export.js`) gains `tokens` map (still excluded from export) and `hosts` array (included).
- QM-321: documentation updates — `docs/runbook-external-services.md` adds GitLab PAT instructions; SECURITY.md adds the per-instance disclosure to the threat model.

### Phase 4 — Distribution + launch (~3 days)

**Stories:** QM-322..325

- QM-322: rename product display name to "Quick Merge" (or stay with "PR Quick Merge" — see §Naming above). Update `manifest.json` `name` + `short_name`. Extension ID unchanged so installs auto-update.
- QM-323: store-listing copy refresh — new screenshots showing both github.com and gitlab.com rows, updated CWS + AMO descriptions, new tagline ("One-click merge for GitHub and GitLab pull requests").
- QM-324: launch posts — Show HN and r/programming framed around "GitLab adds parity with GitHub on this developer-tool surface".
- QM-325: privacy-policy update — explicitly mention each host the extension talks to.

### Phase 5 — Quality + ops (~2 days)

**Stories:** QM-326..330

- QM-326: Playwright e2e for GitLab — fixture project under `gh-pr-qm-bot` (or new `qm-gitlab-bot`); merge-when-green, update-branch, bulk-close lifecycle parity.
- QM-327: update SECURITY.md threat model for multi-host.
- QM-328: contract tests — both adapters exercised against the same `HostAdapter` test suite to enforce interface parity.
- QM-329: shared MR/PR fixture data so visual snapshots cover both hosts.
- QM-330: release runbook update — staged rollout SOP unchanged but smoke-test checklist adds GitLab steps.

---

## Out of scope

- **Bitbucket / Gitea / Forgejo support.** The adapter pattern would extend cleanly, but the audience is much smaller than GitHub + GitLab combined and the maintenance burden is real. Defer.
- **GitLab CI integration / pipeline UI.** Mergeable state is enough; we don't render checks beyond a pass/fail dot.
- **GitLab "merge train" support.** Niche feature used by very large GitLab instances. Document as a known limitation; revisit if usage data shows demand.
- **Project-level merge-method config UI.** GitLab projects' allowed methods come from the project settings; the extension reads + respects them but doesn't manage them.
- **OAuth Device Flow on self-hosted GitLab < 16.0.** Older instances only support PAT or web-flow OAuth. PAT remains the universal fallback.

---

## Risks

- **Self-hosted GitLab versioning.** The GitLab API changes between major versions. Test against 16.0+ for v2.0; document the supported floor.
- **CSP on self-hosted instances.** Some enterprises run GitLab behind strict CSPs that may block content-script extensions from making API calls. Documented limitation; users with this constraint can switch to PAT-only mode.
- **Token blast radius.** A GitLab PAT with `api` scope is full-account access (no fine-grained equivalent of GitHub's PATs as of 2026-04). The disclosure copy must be explicit. Recommend project-scoped PATs where possible.
- **Brand recognition risk on rename.** If we go from "PR Quick Merge" → "Quick Merge", we lose the SEO + word-of-mouth from v1.0/v1.1 marketing. Mitigation: keep "PR Quick Merge" as a bracketed subtitle in the listing for the first 6 months, then drop.

---

## Verify

```bash
npm test                       # all green; Phase 0 contract tests + Phase 1 GitLab adapter unit tests
npm run test:coverage          # ≥ 95% lines (per v1.0 gate)
npm run test:e2e               # green against gh-pr-qm-bot fixture project on github.com
PLAYWRIGHT_HOST=gitlab npm run test:e2e   # green against qm-gitlab-bot fixture on gitlab.com
node --check lib/hosts/**/*.js
```

Manual smoke (load unpacked):

- Navigate to `gitlab.com/{your-group}/{project}/-/merge_requests` → row widget appears on each MR row, mergeable state matches GitLab UI.
- Click Merge on an MR → squash/merge/rebase respects project's allowed methods → MR closes → toast confirms.
- Open popup → mixed list of pinned GitHub repos + GitLab projects.
- Add a self-hosted GitLab instance via Options → consent prompt fires → after approval, instance appears in the Hosts pane.

## DoD

- All 30 stories merged.
- Both adapters pass the same `HostAdapter` contract test suite.
- Coverage ≥ 95 % across the host-agnostic core; per-adapter coverage ≥ 90 %.
- Manual smoke complete on github.com **and** gitlab.com **and** at least one self-hosted instance.
- CWS + AMO listings updated; v2.0 tag cut; staged rollout begins.
- README, ROADMAP, BACKLOG, SECURITY.md, and runbook docs reflect multi-host reality.

---

## Open questions

1. **Naming** — "PR Quick Merge" vs "Quick Merge" vs other? Decide before Phase 4 starts. Recommendation in §Naming above.
2. **Launch sequencing** — release a "GitLab beta" channel first (separate CWS listing key, behind a flag) or ship to all users at once? Beta = safer, harder to manage two listings; flag = simpler but risks GitLab regressions on GitHub-only users.
3. **Funding** — does GitLab port unlock a sponsorship tier (e.g. "GitLab Pro" donor tier)? Or stays free with the existing tiers?
4. **Sentry tagging** — when crash reporting fires, tag events with `host: github | gitlab` for easier triage. Add to `lib/sentry-sanitize.js` once Sentry SDK is vendored.
