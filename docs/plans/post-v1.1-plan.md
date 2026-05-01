# Post-v1.1 Execution Plan

**Date:** 2026-05-01
**Source:** ROADMAP.md + BACKLOG.md + `docs/plans/v1.1-blockers-plan.md` (now closed)
**State at start:** v1.1.0 tagged + released; CWS/AMO uploads pending; main is clean.

---

## Synthesis — what the Backlog says vs. what's actually on main

The session that just shipped v1.1.0 closed many BACKLOG entries that haven't been marked shipped yet. Reconciling:

| BACKLOG ID | BACKLOG status | Actual status (2026-05-01) |
|---|---|---|
| QM-167 Dependabot | "Ready" | ✅ Config exists; vulnerability alerts + automated security fixes enabled |
| QM-168 Branch protection | "Ready" | ✅ Required checks `test`, `manifest-lint`, `e2e`; lock_branch off; admin enforcement on |
| QM-169 Sentry vendoring | "Ready" | ✅ `@sentry/browser` 8.55.2 vendored + DSN injection script + consent wiring (PR #67) |
| QM-170 Privacy policy URL | "Ready" | ✅ GitHub Pages live; linked from options + onboarding (PR #64) |
| QM-171 Bulk-close/label modal | "Ready" | ✅ Shipped via typed-confirm + label-picker |
| QM-172 Label-picker dropdown | "Ready" | ✅ Shipped (`lib/label-picker.js`) |
| QM-173 Sentry consent toggle | "Ready" | ✅ Shipped in PR #67 |
| QM-174 Onboarding tour | "Ready" | ⚠️ Onboarding panel exists; **3-step popover tour does not** |
| QM-175 Per-repo template binding UI | "Ready" | ✅ Shipped (per #38 commit message) |
| QM-176 Update-branch polling | "Ready" | ✅ Shipped (per #38 commit message) |
| QM-177 PostHog telemetry | "Ready" | ⏸ Deferred indefinitely |
| QM-178 Safari port assessment | "Ready" | ⏸ Post-1.0 |
| QM-220 Visual baselines | Epic 8 | ✅ Linux baselines committed; gate restored (PR #69) |

**Net:** §1 Ready should drop from 12 → 2 active items (`QM-174` and `Phase 5 store submission`). Everything else is shipped or deferred.

---

## Phase A — Backlog reconciliation (~30 min, all-Opus)

Cheap, mechanical, but needed so the next planning conversation doesn't re-derive shipped state.

| # | Task | Owner | Notes |
|---|------|-------|-------|
| A.1 | Run `/backlog-sync` | Opus | Reads git log + open PRs, rewrites §0 status board, promotes shipped stories to §7. Encoded as a skill — one shot. |
| A.2 | Manual cleanup of items the skill misses | Opus | QM-171/172/175/176 won't be auto-detected (they shipped under generic PR titles like #38 "v1.1 candidates: ..."). Mark them shipped explicitly. |
| A.3 | Mark Epic 8 / 10 / 11 fully shipped in §7 | Opus | Already partially noted in §0 from PR #63; ensure §7 has the merge-PR list per epic for audit. |

**Deliverable:** one PR titled `docs: backlog sync after v1.1 ship` updating BACKLOG.md.

---

## Phase B — Phase 5 finish (store submission, mostly Daisy-blocked)

| # | Task | Owner | Notes |
|---|------|-------|-------|
| B.1 | Render promo tile (440×280) | Daisy or Opus + frontend-design skill | Use brand mark + tagline. CWS won't accept submission without it. |
| B.2 | Capture 5 screenshots at 1280×800 | Daisy | Specs in `docs/store-listings/cws-listing-v1.1.0.md`. Live extension on `bradygrapentine/gh-pr-quick-merge` test PRs. |
| B.3 | CWS upload + listing form | **Daisy** | Account 2FA blocks Opus. Copy-paste from `docs/store-listings/cws-listing-v1.1.0.md`. Review queue ~few days. |
| B.4 | AMO upload + listing form | **Daisy** | Same. Source archive **not needed** if Sentry-free build (verified during Phase 5 prep). |
| B.5 | Post-deploy watch | Opus | Once approved, run `/post-deploy-watch` for 30 min on the staged rollout. Watches Sentry error rate + install funnel. |
| B.6 | Tweet / Show HN / r/programming launch posts | Daisy | Drafts in `docs/store-listings/*` already include tagline candidates. |

**Deliverable:** v1.1.0 live in both stores; install signals in PostHog (if enabled) or download counts.

---

## Phase C — QM-174 onboarding tour (~3 hrs, Opus + frontend-design skill)

The only un-shipped v1.1 candidate. Decision needed before starting:

**Option C.a — Build the 3-step popover tour.** First-run users see: (1) "Click here to set your token" pointing at the popup, (2) "Pick your favorite merge method" pointing at the row widget, (3) "Use Auto-Merge to ship without watching CI" pointing at the watch button. Dismissable; surfaces only on first install.

**Option C.b — Defer to v1.2.** Current single-card onboarding panel covers 80% of the value. Tour is polish, not blocker. Let real install signal drive whether it's worth building.

**Recommendation:** **C.b**. Ship v1.1.0 to the stores, watch what users actually struggle with based on bug reports / drop-off, then decide. Without telemetry (PostHog deferred), the tour would be guesswork.

**If we do C.a:** ~3 hrs Opus implementation + 1 visual baseline regen on Linux CI.

---

## Phase D — Epic 9 prep (v2.0 GitLab port — Phase 0 only)

Epic 9 is a 20-eng-day effort. The roadmap conditions Phase 0 on "v1.0 launched on both stores; v1.1 design refresh complete." v1.1 done; stores in flight.

**Phase 0 alone (~5 days)** is the refactor that makes the rest mechanical. It's safe to start *now* — it doesn't depend on store approval, only on a clean v1.1.0 main.

| Story | Title | Est | Status | Dep |
|---|---|---|---|---|
| QM-300 | Introduce `lib/hosts/index.js` + `HostAdapter` interface | M | ✅ Shipped (PR #39) | — |
| QM-301 | Move `lib/api.js` → `lib/hosts/github/api.js` | S | ✅ Shipped (PR #39) | QM-300 |
| QM-302 | `lib/hosts/github/adapter.js` implementing HostAdapter; route content.js through it | M | ⏸ **Not started** | QM-301 |
| QM-303 | Token storage migration → `tokens["github.com"]` | S | ⏸ Not started | QM-302 |
| QM-304 | Extract DOM selectors → `lib/hosts/github/selectors.js` | S | ✅ Shipped | QM-302 |
| QM-305 | Phase 0 regression sweep | S | ⏸ Not started | QM-300..304 |

So Phase 0 is **3 stories from done**: QM-302 (~half day), QM-303 (~half day), QM-305 (~quarter day). Total ~1.5 eng-days, single-PR each.

**Routing:**
- QM-302 — Opus (judgment call on adapter API surface; touches content.js wiring)
- QM-303 — Sonnet (mechanical migration with a one-shot upgrade hook; small)
- QM-305 — Opus (regression-sweep judgment + decide whether to start Phase 1 immediately)

**Deliverable after Phase D:** `lib/hosts/index.js` with `detect()` + `assertHostAdapterShape()`, a registered GitHub adapter, content.js calling `getAdapter().findPrAnchor()` etc., per-host token storage shape live, all tests green. **GitLab can be added by writing one new file** at that point.

---

## Phase E — Epic 9 Phase 1 (GitLab adapter, ~6 eng-days, parallelisable)

Only after Phase D + a clean post-deploy-watch on v1.1.0. Plans laid out in `plans/v2-gitlab-port.md`. Each story is a clean PR boundary; QM-306 (api.js) → QM-307 (selectors) → QM-308 (fetchMrState) are sequential, but QM-309..311 (doMerge / updateBranch / bulk close) parallelise once 308 lands.

**Parallelisation:**
- After QM-306 + 307 + 308 land, dispatch 3 subagents on QM-309 / 310 / 311 (each touches its own GitLab endpoint; zero file overlap).
- QM-312 (adapter wiring) is the convergence PR — Opus.

**Decision needed before starting Phase E:**
- Product rename ("PR Quick Merge" → "Quick Merge")? Roadmap recommends yes for SEO; subtitle preserved 6 months.
- Beta channel or all-users? Roadmap doesn't decide.

---

## Phase F — Strategic decision after Phase D ships

By the time Phase D is done, we'll have:
- v1.1.0 in stores (or rejected; in which case we fix and resubmit)
- HostAdapter Phase 0 complete
- ~2 weeks of install / crash signal

**Decision tree:**

```
                Phase D done
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Stores live   Stores live   Stores live
   + low usage   + good usage  + crashes
        │            │            │
        ▼            ▼            ▼
   Pause; review  Continue to   Patch + post-
   prioritisation  Phase E       deploy-watch
   (Safari? team
   features?)
```

Don't pre-commit to Phase E timing. The v1.1.0 install signal is the prioritisation input. If 50 users / week → Phase E worth it; if 5 users / week → consider Post-1.0 themes (GitHub App + team) instead.

---

## Recommended execution order (next 2 weeks)

1. **Today / tomorrow:** Phase A (backlog sync) — 30 min. PR.
2. **This week:** Phase B (store uploads). Daisy-blocked; Opus drafts the promo tile + screenshots if asked.
3. **In parallel with B:** Phase D (Epic 9 Phase 0 — 1.5 eng-days). Three small PRs.
4. **Two weeks out:** Phase B post-deploy-watch + Phase F strategic decision.
5. **Conditional:** Phase E (GitLab adapter) only if Phase F greenlights.
6. **Skip for now:** Phase C (onboarding tour) — defer to data.

---

## Cross-cutting requirements

1. Worktrees inside `<project>/worktrees/<slug>` per global rules.
2. Local green gate before any `gh pr ready`.
3. Branch protection now enforces `test`, `manifest-lint`, `e2e` — every PR will be gated.
4. Each PR ends with `**Open PRs**` block.
5. `gh pr merge --auto --squash` exactly once per PR.

---

## Open questions for Daisy

1. **Phase C onboarding tour:** Defer (recommended) or build now?
2. **Phase E start condition:** What install-rate threshold greenlights GitLab? Roadmap doesn't say; my default proposal is "≥30 weekly active installs after 4 weeks live".
3. **Product rename for v2.0:** OK to drop "PR" from the product name? Affects icons + manifest + listing copy.
4. **Promo tile:** Use the brand mark + "Merge from list" tagline I drafted, or different art direction?
