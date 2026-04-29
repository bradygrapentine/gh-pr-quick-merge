# GitHub PR Quick Merge — Backlog

_Last `/backlog-sync`: 2026-04-29 (post-scope-slim — donation-funded v1.0)_

The backlog is organized by **Epic** (matching `ROADMAP.md`). Each Epic decomposes into Features, which decompose into Stories with `QM-NNN` IDs. Per-Epic implementation plans live in [`plans/`](./plans/).

**ID ranges (reserved):**

| Epic | Range | Plan |
|---|---|---|
| 1 — v0.3 Power-user features | QM-031..050 | [plans/v0.3-integration-and-polish.md](./plans/v0.3-integration-and-polish.md) |
| 2 — v0.4 "Everything you wish the GitHub PR list did" | QM-051..070 | [plans/v0.4-row-actions.md](./plans/v0.4-row-actions.md), [plans/v0.4-bulk-stale-listmode.md](./plans/v0.4-bulk-stale-listmode.md) |
| ~~3 — License & payment infrastructure~~ | ~~QM-071..100~~ | _deferred — see donation infra_ |
| 4 — Distribution (slimmed) | QM-101..120 | [plans/v1-distribution-and-marketing.md](./plans/v1-distribution-and-marketing.md) |
| 5 — Crash reporting (slimmed) | QM-121..140 | [plans/v1-observability.md](./plans/v1-observability.md) |
| 6 — Quality & release ops (slimmed) | QM-141..160 | [plans/v1-quality-and-release-ops.md](./plans/v1-quality-and-release-ops.md) |
| 7 — Donation infrastructure | QM-161..170 | [plans/v1-donations.md](./plans/v1-donations.md) |

**Scope simplification:** v1.0 ships donation-funded via GitHub Sponsors. Epic 3 (license server / Pro paywall) is deferred indefinitely; plans retained on disk as scaffolding. Epics 4, 5, 6 slimmed to drop license-server-coupled stories.

---

## §0 Status board

- Ready: 69 (across Epics 1, 2, 4, 5, 6, 7)
- Deferred: 21 (Epic 3 — license & payment infra)
- In progress: 0
- In review: 0
- Blocked: 0
- Done (pre-Epic): 14
- Shipped (v0.2.0): 5

**v0.2 leftover IDs absorbed into Epic structure** — QM-010, QM-016, QM-018, QM-022, QM-024..029 absorbed into Epic 1/2 stories; QM-030 retired as Epic 3 scope (now deferred).

**Effort floor:** ~25 eng-days (down from 60 pre-slim). Operating cost: ~$1.25/mo (domain only).

---

## §1 Ready

### Epic 1 — v0.3: Power-user features

**Plan:** [`plans/v0.3-integration-and-polish.md`](./plans/v0.3-integration-and-polish.md) · **Outcome:** 2k WAU, ≥30% customized, D7 ≥40%

| ID | Title | Feature | Est | Deps | Notes |
|----|-------|---------|-----|------|-------|
| QM-031 | Wire `lib/templates` into `content.js` merge action | F1.1 | M | QM-022 | Send `commit_title` / `commit_message` from `applyTemplate` |
| QM-032 | Template storage helpers (load/save per-repo + global) | F1.1 | S | QM-031 | CRUD over `chrome.storage.local.templates.<repo>` |
| QM-033 | Template editor UI in options page | F1.1 | M | QM-032 | **Closes QM-016**. Live preview + `validateTemplate` inline errors |
| QM-034 | Attach `keydown` listener using `lib/shortcuts` | F1.2 | M | QM-022 | Guard against input/textarea focus |
| QM-035 | Focus-ring + a11y for shortcut activation | F1.2 | S | QM-034 | **Closes QM-018**. `:focus-visible` + `aria-live` |
| QM-036 | Shortcut customization UI in options page | F1.2 | M | QM-034, QM-032 | Conflict detection on remap |
| QM-037 | Repo-name autocomplete in defaults UI | F1.3 | S | QM-013 | `<datalist>` from stored repo keys |
| QM-038 | Import/export for repo defaults + templates | F1.3 | M | QM-032, QM-037 | JSON schema + conflict UX |
| QM-039 | Inject stale-PR badge into rows | F1.4 | S | QM-022 | **Closes QM-027**. Calls `lib/stale-pr` |
| QM-040 | Stale-threshold config UI in options page | F1.4 | S | QM-039 | Per-repo override optional |
| QM-041 | Pinned-repo management UI in popup | F1.5 | M | QM-021 | **Closes QM-028**. Add/remove inline |
| QM-042 | Manual refresh + empty/error states in popup | F1.5 | S | QM-041 | Refresh icon, error banner |
| QM-043 | Token-rotation reminder badge + options CTA | F1.6 | S | — | **Closes QM-029**. 60-day threshold |
| QM-044 | Multi-account hint in options page | F1.6 | S | QM-043 | Dismissible banner |
| QM-045 | Wave 2 integration glue — wire all libs into content.js | F1.7 | M | QM-031, QM-034, QM-039 | **Closes QM-022**. Convergence commit |
| QM-046 | Fixture-DOM integration test suite | F1.7 | M | QM-045 | **Closes QM-010**. 15+ assertions |

**Epic 1 totals:** 16 stories · 3×S + 8×M + 0×L = ~6–8 eng-days

### Epic 2 — v0.4: "Everything you wish the GitHub PR list did"

**Plans:** [`plans/v0.4-row-actions.md`](./plans/v0.4-row-actions.md), [`plans/v0.4-bulk-stale-listmode.md`](./plans/v0.4-bulk-stale-listmode.md)

| ID | Title | Feature | Est | Deps | Notes |
|----|-------|---------|-----|------|-------|
| QM-051 | `lib/update-branch.js` — pure wrapper around `POST /pulls/:n/update-branch` | F2.1 | S | — | **Closes QM-024 partial**. Handles 422/403 |
| QM-052 | Inject "Update" button into rows when `behind_by > 0` | F2.1 | M | QM-051 | Shows only when behind base |
| QM-053 | Strategy toggle (rebase vs merge) in options | F2.1 | S | — | Stored in `chrome.storage.sync` |
| QM-054 | `lib/merge-queue.js` — pure queue with `chrome.storage.local` | F2.2 | S | — | **Closes QM-025 partial**. Idempotent |
| QM-055 | Background alarm poller — fires merge on all-green | F2.2 | L | QM-054 | Uses `chrome.alarms` |
| QM-056 | Row badge (🟡/✅/❌) reading queue state | F2.2 | M | QM-054 | Reads from `chrome.storage.local` |
| QM-057 | "Cancel watch" button on queued rows | F2.2 | S | QM-056 | Removes entry from queue |
| QM-058 | `lib/bulk-ops.js` — `closePRs` + `labelPRs` | F2.3 | M | — | **Closes QM-026 partial**. Serial w/ back-off |
| QM-059 | "Close selected" in bulk-action bar w/ confirmation | F2.3 | S | QM-058 | Confirmation modal |
| QM-060 | "Label selected" w/ label picker dropdown | F2.3 | M | QM-058 | Caches `GET /labels` once |
| QM-061 | Per-row result feedback (✓/✗ + tooltip) | F2.3 | S | QM-059, QM-060 | No page reload |
| QM-062 | Wire `lib/stale-pr` into row injector | F2.4 | S | — | Reads `updated_at` from list JSON |
| QM-063 | Per-repo stale threshold UI in options | F2.4 | S | QM-062 | `chrome.storage.sync.stale.<repo>` |
| QM-064 | Stale badge tooltip + a11y (`aria-label`) | F2.4 | S | QM-062 | `role=status` |
| QM-065 | `lib/list-mode.js` — parse list-endpoint PR objects | F2.5 | M | — | Best-effort mergeability |
| QM-066 | `chrome.storage.sync.listModeEnabled` + content.js branch | F2.5 | M | QM-065 | Skip per-row fetch when on |
| QM-067 | Options page toggle "Fast mode" | F2.5 | S | QM-066 | Tooltip explains tradeoff |
| QM-068 | `lib/auto-rebase.js` — `shouldAutoRebase` + orchestrator | F2.6 | M | QM-051 | Polls until head SHA changes |
| QM-069 | Config in options — auto-rebase threshold | F2.6 | S | QM-068 | 0 = disabled |
| QM-070 | UX: "Rebasing…" spinner on row button | F2.6 | S | QM-068 | Spinner during pre-merge phase |

**Epic 2 totals:** 20 stories · 11×S + 8×M + 1×L = ~10–14 eng-days

### Epic 3 — License & payment infrastructure — DEFERRED

**Status:** all 21 stories (QM-071..QM-091) deferred indefinitely as of 2026-04-29. v1.0 ships donation-funded via GitHub Sponsors (Epic 7) instead. Plans `plans/v1-license-server.md` and `plans/v1-license-extension.md` remain on disk as scaffolding if a paid tier becomes warranted later. SECURITY F-10 closure is reframed: the cosmetic Pro flag becomes a cosmetic donation prompt — no enforcement needed because there is no paywall.

If/when this Epic is reactivated, see those plan files for the complete decomposition.

### Epic 4 — Distribution & marketing (v1.0)

**Plan:** [`plans/v1-distribution-and-marketing.md`](./plans/v1-distribution-and-marketing.md)

**Preconditions:** domain registered, CWS developer account ($5), AMO developer account, Stripe live, production OAuth client-id.

| ID | Title | Feature | Est | Deps | Notes |
|----|-------|---------|-----|------|-------|
| QM-101 | CWS store copy (descriptions, keywords, perm justifications) | F4.1 | S | — | [creative] |
| QM-102 | CWS screenshots (3-5 × 1280×800 or 640×400) | F4.1 | M | — | [creative] Figma + real captures |
| QM-103 | CWS promotional tile + marquee banner | F4.1 | S | — | [creative] Figma |
| QM-104 | Submit to CWS review + monitor + respond | F4.1 | M | QM-101..103, QM-109 | [store-ops] HUMAN-IN-LOOP. 1-7 day review |
| QM-105 | Handle CWS rejection / resubmit | F4.1 | S | QM-104 | [store-ops] Contingent |
| QM-106 | AMO listing copy (stricter tone, source-disclosure note) | F4.2 | S | — | [creative] |
| QM-107 | AMO source-code disclosure package | F4.2 | M | — | [ext] Unminified zip + `SOURCE_REVIEW.md` |
| QM-108 | Submit to AMO (unlisted → listed) | F4.2 | M | QM-106, QM-107, QM-109 | [store-ops] HUMAN-IN-LOOP. Days-to-weeks |
| QM-109 | Privacy policy | F4.3 | S | — | Hosted as static page (Cloudflare Pages or GH Pages); required by both stores |
| QM-118 | Demo video (60-90 sec, Loom + edit + YouTube unlisted) | F4.6 | M | — | [creative] |
| QM-119 | Show HN + r/programming + newsletter outreach drafts | F4.6 | M | QM-104, QM-108, QM-118 | [creative] Coordinated post day |
| QM-120 | Animated demo GIF for store listings + README | F4.6 | S | — | [creative] ezgif/gifski; <2MB |

**Epic 4 totals:** 12 stories (slimmed from 20) · 7×S + 5×M = ~5–8 eng-days. Retired: QM-110 (ToS), QM-111 (refund policy), QM-112..QM-117 (marketing site, pricing page, docs site).

### Epic 5 — Observability (v1.0)

**Plan:** [`plans/v1-observability.md`](./plans/v1-observability.md) — note plan is mostly deferred; only the Sentry subset below is retained.

| ID | Title | Feature | Est | Deps | Notes |
|----|-------|---------|-----|------|-------|
| QM-126 | Sentry SDK bootstrap + F-15 sanitization | F5.2 | M | — | [ext] Opt-in, token regex strip in `beforeSend` |
| QM-127 | Structured error capture at merge call sites | F5.2 | S | QM-126 | [ext] Extends F-15 closure |
| QM-128 | Sentry release tagging + source maps in CI | F5.2 | S | QM-126 | [ext] `npm run package` strips maps from zip |

**Epic 5 totals:** 3 stories (slimmed from 20) · 2×S + 1×M = ~1–2 eng-days. Retired: QM-121..QM-125 (PostHog telemetry), QM-129..QM-132 (conversion funnel — no funnel without paid tier), QM-133..QM-137 + QM-140 (server-side observability — no server), QM-138 (smoke test no longer needed without PostHog), QM-139 (privacy disclosure folded into QM-109).

### Epic 6 — Quality & release ops (v1.0)

**Plan:** [`plans/v1-quality-and-release-ops.md`](./plans/v1-quality-and-release-ops.md) — slimmed.

**Preconditions:** test GitHub account `gh-pr-qm-bot` with `E2E_GH_TOKEN` in CI secrets.

| ID | Title | Feature | Est | Deps | Notes |
|----|-------|---------|-----|------|-------|
| QM-141 | Playwright scaffold + extension loader | F6.1 | M | — | [ext] Sequential blocker for Phase 2 |
| QM-142 | Fixture-repo helper (creates temp repo + PRs) | F6.1 | M | QM-141 | [ext] Uses `E2E_GH_TOKEN` |
| QM-143 | Happy-path merge E2E test | F6.1 | M | QM-142 | [ext] Squash/Merge/Rebase × 3 |
| QM-145 | Nightly E2E CI job | F6.1 | S | QM-143 | [ops] Schedule `0 3 * * *` |
| QM-146 | Popup snapshot baseline | F6.2 | S | QM-141 | [ext] `toHaveScreenshot()` |
| QM-147 | Options page snapshot baseline | F6.2 | S | QM-141 | [ext] |
| QM-148 | Modal snapshots (bulk-merge + donation modal) | F6.2 | S | QM-143, QM-162 | [ext] Renamed: tracks donation modal not Pro upsell |
| QM-149 | Snapshot update workflow doc | F6.2 | S | QM-146..148 | [ops] `npm run snapshots:update` |
| QM-150 | Perf timing harness (button injection p95 <50ms) | F6.3 | M | QM-141 | [ext] |
| QM-151 | MutationObserver + heap profiling | F6.3 | M | QM-150 | [ext] Heap <10MB after 5min idle |
| QM-153 | Perf trend tracking — `perf-baseline.json` + CI diff | F6.3 | S | QM-150, QM-151 | [ops] Fail on >20% regression |
| QM-154 | Release runbook + pre-flight checklist | F6.4 | M | QM-104, QM-108 | [ops] `docs/runbook-release.md` |
| QM-155 | Semi-automated release script | F6.4 | M | QM-154 | [ops] `scripts/release.sh <version>` |
| QM-156 | CWS staged rollout SOP | F6.5 | S | QM-154 | [ops] 10% → 50% → 100% |

**Epic 6 totals:** 14 stories (slimmed from 20) · 7×S + 7×M = ~7–10 eng-days. Retired: QM-144 (no Pro gate), QM-152 (no license API), QM-157 (no kill-switch needed — no server), QM-158 (no server endpoint), QM-159, QM-160 (no SLOs to monitor — no server).

### Epic 7 — Donation infrastructure (v1.0)

**Plan:** [`plans/v1-donations.md`](./plans/v1-donations.md) · GitHub Sponsors, 4 tiers (Coffee $5 / Daily $25 / Team $99 / Sponsor $499)

| ID | Title | Feature | Est | Deps | Notes |
|----|-------|---------|-----|------|-------|
| QM-161 | GitHub Sponsors profile setup with 4 tiers | F7.1 | S | — | [ops] HUMAN-IN-LOOP. Sign up, complete profile, define tier copy |
| QM-162 | Replace bulk-merge "Pro" modal with donation modal | F7.2 | S | — | [ext] Edit `content.js` `showProGate`. Same trigger, donation copy |
| QM-163 | Donation link in popup footer + options page | F7.3 | S | — | [ext] Heart icon; `target=_blank rel="noopener"` |
| QM-164 | README + CWS/AMO listing copy includes donation pitch | F7.3 | S | QM-101, QM-106 | One paragraph; auto-shown on GitHub repo from Sponsors profile |
| QM-165 | Optional secondary platform (Buy Me a Coffee) | F7.4 | S | QM-161 | [ops] DEFERRED until Sponsors friction is reported |

**Epic 7 totals:** 5 stories · 5×S = ~1–2 eng-days

---

## §2 In progress

_(empty)_

## §3 In review

_(empty)_

## §4 Blocked

_(empty)_

## §5 Icebox

- Merge-queue integration (real queue, not the v0.4 single-PR scheduler)
- Cross-repo batch ops dashboard
- Slack / Discord notification on bulk merges
- Team admin console (seat management, audit log)
- Analytics dashboard for teams (merge throughput, stuck PRs)
- Safari extension port
- Conventional-commit linter on merge-commit templates
- AI-suggested merge timing (predict CI flakiness)
- JIRA / Linear ticket linkage + auto-transition on merge
- GitHub App + Marketplace listing (per-seat billing)
- Self-hosted PostHog migration (when free-tier exhausted)

## §6 Done

**v0.1 baseline:**
- Manifest v3, content script with row-injected merge buttons, MutationObserver, options page, basic CSS, README

**Wave 1 (v0.2-dev, 2026-04-29):**
- QM-001..QM-009 — icons, OAuth device flow, bulk-merge scaffold, lib/pr-helpers.js, vitest harness

**Wave 1.5 — pure lib modules + tests (2026-04-29):**
- QM-012 — `lib/repo-defaults.js` (15 tests)
- QM-015 — `lib/templates.js` (21 tests)
- QM-017 — `lib/shortcuts.js` (21 tests)

**Wave 2 partial — CI + security (PR #1, merged 2026-04-29):**
- QM-011 — GitHub Actions CI (`npm test` + `web-ext lint`)
- QM-020 — `web-ext lint` job (later flipped to required in PR #9)
- SECURITY F-01, F-02, F-04, F-07, F-08, F-09, F-11, F-12 closed

**Superseded by Epic structure (2026-04-29):**
- QM-010 — absorbed into Epic 1 / QM-046 (fixture-DOM integration tests)
- QM-016 — absorbed into Epic 1 / QM-033 (template editor UI)
- QM-018 — absorbed into Epic 1 / QM-035 (focus-ring + a11y)
- QM-022 — absorbed into Epic 1 / QM-045 (integration glue)
- QM-024 — decomposed into Epic 2 F2.1 (QM-051..053)
- QM-025 — decomposed into Epic 2 F2.2 (QM-054..057)
- QM-026 — decomposed into Epic 2 F2.3 (QM-058..061)
- QM-027 — absorbed into Epic 1 / QM-039 (stale badge inject)
- QM-028 — absorbed into Epic 1 / QM-041 (pinned-repo UI in popup)
- QM-029 — absorbed into Epic 1 / QM-043 (token rotation reminder)
- QM-030 — decomposed into Epic 3 (QM-071..091)

## §7 Shipped

_Merged to main, included in v0.2.0 release._

**v0.2.0 — 2026-04-29:**
- QM-013 — Per-repo default merge method UI · PR [#5](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/5)
- QM-014 — Apply per-repo default to row buttons · PR [#5](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/5)
- QM-019 — Closed remaining SECURITY findings (F-03, F-05, F-06, F-15) · PR [#12](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/12)
- QM-021 — Toolbar popup · PR [#3](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/3)
- QM-023 — `lib/stale-pr.js` pure module · PR [#4](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/4)
