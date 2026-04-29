# Wave groups — parallelizable plan combinations

This document maps each active plan to a **group ID** that `/wave <group-id>` can consume. Groups containing 2+ plans run those plans as parallel subagents (per `§3b` of the wave skill); single-plan groups just delegate to the underlying plan.

## Active plans

| Plan | Domain | Touches |
|---|---|---|
| `v0.3-integration-and-polish.md` (Phase 3+4 remaining) | extension UI | `options.html`/`options.js`, `popup.*`, `lib/import-export.js` (NEW), `test/content-integration.test.js` (NEW) |
| `v0.4-row-actions.md` | extension | `content.js`, `options.html`/`options.js`, `background.js`, `lib/update-branch.js`/`merge-queue.js`/`auto-rebase.js` (NEW) |
| `v0.4-bulk-stale-listmode.md` | extension | `content.js`, `options.html`/`options.js`, `styles.css`, `lib/bulk-ops.js`/`list-mode.js` (NEW) |
| `v1-distribution-and-marketing.md` | store ops + creative | `README.md` (slight), store dashboards, creative assets, privacy-policy hosting (separate) |
| `v1-observability.md` (Sentry subset) | extension infra | `background.js`, `scripts/package.sh`, `package.json`, `.github/workflows/test.yml` |
| `v1-quality-and-release-ops.md` (slimmed) | test/ops infra | `test/e2e/*` (NEW), `.github/workflows/e2e.yml` (NEW), `scripts/release.sh` (NEW), `docs/runbook-release.md` (NEW), `package.json` |
| `v1-donations.md` | extension UI + ops | `content.js`, `popup.*`, `options.html`, `README.md`, GitHub Sponsors dashboard |

## Conflict matrix

✅ = disjoint file scopes (can run in same parallel group)
⚠ = small overlap (manageable with explicit ownership)
❌ = heavy overlap (must serialize)

|  | v0.3 ph3+4 | v0.4 row | v0.4 bulk | distrib | obs | quality | donations |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **v0.3 ph3+4** | — | ❌ options | ❌ options | ✅ | ✅ | ✅ | ❌ popup, options.html |
| **v0.4 row** | ❌ | — | ❌ content.js, options | ✅ | ⚠ background.js | ✅ | ❌ content.js |
| **v0.4 bulk** | ❌ | ❌ | — | ✅ | ✅ | ✅ | ❌ content.js |
| **distrib** | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⚠ README.md |
| **obs** (Sentry) | ✅ | ⚠ | ✅ | ✅ | — | ⚠ package.json, scripts/ | ✅ |
| **quality** | ✅ | ✅ | ✅ | ✅ | ⚠ | — | ✅ |
| **donations** | ❌ | ❌ | ❌ | ⚠ | ✅ | ✅ | — |

## Groups

### `group-ext` — External assets & test infra (parallel-safe, ~5–8 days)

**Plans:** `v1-distribution-and-marketing.md` + `v1-quality-and-release-ops.md`

**Why parallel-safe:** P4 (distribution) only touches `README.md` (one section) plus new dirs (privacy-policy hosting, creative assets, store dashboards). P6 (quality) only touches new dirs (`test/e2e/`, `scripts/`) plus `package.json` (Playwright dep). Zero overlap.

**Dispatch:** 2 parallel Sonnet agents. P4 subagent writes store copy + screenshots + privacy policy; P6 subagent scaffolds Playwright + perf baseline + release runbook.

**Why this is the **first** group to run:** no dependencies on the central code path (`content.js`/`popup`/`options`), so it can land in parallel with anything else without risk.

### `group-ops` — Crash reporting + donations (parallel-safe, ~3 days)

**Plans:** `v1-observability.md` + `v1-donations.md`

**Why parallel-safe:** P5 (Sentry) owns `background.js` + `scripts/package.sh` + `package.json` + workflows. P7 (donations) owns `content.js` + `popup.*` + `options.html` + `README.md`. No shared files.

**Dispatch:** 2 parallel Sonnet agents.

**Sequencing note:** `group-ops` SHOULD NOT run concurrently with `group-v0.3-ui` or either `group-v0.4-*` because P7 (donations) edits `content.js` and those groups also edit it. Run `group-ops` between v0.3/v0.4 waves, OR before they start.

### `group-v0.3-ui` — v0.3 polish UI (single plan, internal phases)

**Plans:** `v0.3-integration-and-polish.md` (Phase 3 + Phase 4 only — Phases 1+2 already shipped via PR #16)

**Why single:** Phase 3 has internal parallel tracks (popup vs options) that the existing plan's `Dispatch Decision` already documents. No additional plan to pair with — v0.4 plans conflict on the same files; the donations plan also conflicts on popup + options.

**Dispatch:** the plan's existing 2-track parallel within Phase 3 (popup agent + options agent), then Phase 4 fixture-DOM tests serial last.

### `group-v0.4-a` — v0.4 row actions (single plan)

**Plans:** `v0.4-row-actions.md`

**Why single:** heavy `content.js` + `options` touches conflict with v0.3 polish AND v0.4 bulk plans. Must serialize. Has its own internal phasing (lib parallel, content.js integration serial).

### `group-v0.4-b` — v0.4 bulk + stale + listmode (single plan)

**Plans:** `v0.4-bulk-stale-listmode.md`

**Why single:** same as v0.4-a; both v0.4 plans contend for `content.js` and `options`. Run after `group-v0.4-a` merges.

## Recommended dispatch order

```
1. group-ext       (parallel: distribution + quality/release ops)
2. group-ops       (parallel: Sentry + donations) ← swap order if Sponsors profile is live first
3. group-v0.3-ui   (single — closes v0.3 backlog)
4. group-v0.4-a    (single — Update branch, merge-when-green, auto-rebase)
5. group-v0.4-b    (single — bulk close/label, stale row, list-mode)
```

Optional reorder if `group-ext`'s store submissions are blocked on review queues: kick off `group-ext` first, then proceed to `group-ops` and the v0.3/v0.4 work in parallel timelines while waiting for CWS/AMO reviews.

## How `/wave <group-id>` works

For multi-plan groups (`group-ext`, `group-ops`):
- The orchestrator (Opus) reads the group's meta-plan file (`plans/group-<id>.md`)
- Verifies base SHA matches `origin/main` (per wave skill §3b pre-dispatch checks)
- Dispatches one Sonnet subagent per plan in the group, each branched from the same base SHA, each with its own owned file set
- Subagents commit + push to a shared feature branch `wave-group-<id>` OR each to their own branch (prefer the latter — avoids the lock-guard issue we hit in v0.3 Phase 1)
- Orchestrator opens the PR(s) and arms auto-merge

For single-plan "groups" (`group-v0.3-ui`, `group-v0.4-a`, `group-v0.4-b`):
- Equivalent to `/wave <plan-filename>`. The group ID is just a stable alias.

## Subagent dispatch caveat (learned 2026-04-29)

Track B of v0.3 Phase 1 (a Sonnet subagent for QM-037) failed because the wave-lock-guard hook denied commits from a different session id on the locked branch. Workaround for parallel groups: each subagent commits on its OWN branch (e.g. `wave-group-ext-distrib` and `wave-group-ext-quality`), then the orchestrator either merges them locally and opens one PR, or arms auto-merge on each branch independently.

## When to add new groups

- A new plan lands → check the conflict matrix above; either (a) add to an existing group if disjoint, (b) create a new group, or (c) keep it as single-plan if it conflicts with everything currently parallel-safe.
- Update this file in the same PR that introduces the new plan.
