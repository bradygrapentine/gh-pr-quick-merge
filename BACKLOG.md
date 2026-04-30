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

_Last sync: 2026-04-29 (v1.0 polish)_

- Ready: 12 (v1.0 launch follow-ups + 8 v1.1 candidates — see §1)
- Epic 8 (v1.1 Design Refresh): 21 stories (QM-200..220) — handoff received 2026-04-29; reference at `~/projects/handoff_pr_quick_merge_design/`
- Epic 9 (v2.0 GitLab port): 31 stories (QM-300..330) — scoped 2026-04-29; plan at `plans/v2-gitlab-port.md`. Requires v1.0 launched + v1.1 design merged before Phase 0 begins.
- Blocked-on-human: 2 (QM-104 CWS submit; QM-108 AMO submit)
- Deferred: 22 (Epic 3 license server + QM-165 BMaC)
- In progress: 0
- In review: 0
- Shipped (v0.2.0): 5
- Shipped (v0.3 + v0.4 + v1.0 backlog): 60+ (PRs #16, #18–#25)
- Done (pre-Epic): 14

**v1.0 effort remaining:** ~2 eng-days (Sentry SDK vendoring + repo settings + store submissions). All code-level v1.0 work is on `main`.

**Operating cost:** ~$1.25/mo (domain only — when registered). Donation-funded; first sponsor at any tier covers the floor.

---

## §1 Ready

### v1.0 launch follow-ups (NEW — surface during v1-polish review, 2026-04-29)

| ID | Title | Feature | Est | Deps | Notes |
|----|-------|---------|-----|------|-------|
| QM-167 | Enable Dependabot security updates on the repo | F4.5 | XS | — | Settings → Code security → enable. Audited 2026-04-29: currently **disabled**. |
| QM-168 | Configure branch protection on `main` | F6.6 | S | — | Required: PR review ≥ 1, status checks (`test`, `manifest-lint`, `e2e`) green, no force pushes. Currently unconfigured. |
| QM-169 | Vendor `@sentry/browser` SDK + DSN injection | F5.2 | M | — | Follow-up from PR #21. Add `npm run vendor:sentry` script; `scripts/package.sh` calls it before `web-ext build`; `SENTRY_DSN` injected via `sed`. See [`docs/runbook-external-services.md`](./docs/runbook-external-services.md) §5. |
| QM-170 | Privacy-policy stable HTTPS URL | F4.3 | S | — | Currently lives at `docs/privacy-policy.md` in the repo. CWS + AMO submissions need a stable URL — either GitHub Pages on this repo or a custom domain. Recommend GitHub Pages for v1.0 (zero cost). |

### v1.1 candidates (gaps surfaced 2026-04-29 — not v1.0 blocking)

| ID | Title | Notes |
|----|-------|-------|
| QM-171 | Custom modal for bulk close + label confirmation | Replace native `confirm()` / `prompt()`. The typed-confirmation modal already exists for bulk merge (`confirmBulkMergeTyped`); reuse. |
| QM-172 | Real label-picker dropdown (fetches repo labels) | Currently `prompt()` for comma-separated text. The plan included `lib/label-picker.js` as a stub; v1.1 fills it. |
| QM-173 | Sentry crash-reporting consent toggle in options | The sanitiser is in place; the SDK boots only when DSN configured at build time. v1.1: surface a user-facing on/off toggle so users can opt in even on builds where DSN is shipped. |
| QM-174 | Onboarding tour for first-time installs | Pinned-repo + token setup is friction-laden for new users. A 3-step popover walkthrough on first install. |
| QM-175 | Per-repo merge-template assignment UI | Templates exist; per-repo binding is hard-coded to `*` (global) or `owner/repo`. Options-page picker would let users assign saved templates per repo. |
| QM-176 | Update-branch poll-instead-of-fixed-3-s wait | Per `plans/v0.4-row-actions.md` §Risks. After clicking Update, poll `/pulls/:n` until `behind_by === 0` instead of a fixed 3-s refresh. |
| QM-177 | Anonymous opt-in install/usage telemetry (PostHog) | Was deferred from v1.0 per Epic 5 slim; revisit if growth signal is needed for prioritisation. |
| QM-178 | Safari port assessment | Effort vs. revenue tradeoff. Reserved per Post-1.0 roadmap. |

### Epic 8 — v1.1 Design Refresh (NEW — handoff received 2026-04-29)

**Source:** `~/projects/handoff_pr_quick_merge_design/` — high-fidelity design from a Claude Design session. README, `styles.css`, and `components/*.jsx` document tokens, primitives, and target surfaces.

**Theme:** Replace inline-styled, ad-hoc surfaces with a coherent token-driven design system. Light + dark themes. Refresh every visible surface (row widget, popup, options, bulk bar) and add three net-new surfaces (onboarding, toast stack, Pro/Sponsor upsell). Keep all v0.2-v1.0 functionality; this is a pure visual / interaction-pattern refresh, not a re-architecture.

**Constraint:** the current extension is plain JS + DOM (no React, no bundler). Recreate the designs against that stack — DOM construction in `content.js` / `popup.js` / `options.js`, CSS in `styles.css` / `popup.css` / a new `theme.css`. Inline SVG icons (no external assets).

**Estimate:** L overall (~10–14 eng-days). Foundation (F8.1) blocks everything else; surfaces (F8.3 / F8.4 / F8.5) parallelise after foundation lands.

#### F8.1 — Design system foundation

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-200 | Adopt design tokens — `theme.css` (or extend `styles.css`) with the full `--qm-*` variable set | M | — | Tokens enumerated in handoff `styles.css` lines 1–69. Both light + dark blocks. |
| QM-201 | Brand mark + wordmark components | S | QM-200 | Inline-SVG glyph, `qm-mark` + `qm-wordmark` CSS classes, "EXT" / "SETTINGS" / "WELCOME" tag variants. |
| QM-202 | Button primitives (`qm-button` + `-primary` / `-accent` / `-ghost` / `-sm` / `-lg`) | S | QM-200 | Replace inline `<button style="…">` usage across `popup.html`, `options.html`, content.js template strings, donation modal, bulk bar. |
| QM-203 | Input + card + kbd + badge + dot primitives | S | QM-200 | `qm-input`, `qm-card`, `qm-kbd`, `qm-badge` (`-success` / `-warn` / `-danger` / `-pro`), `qm-dot`. CSS only; usage migration tracked per surface. |
| QM-204 | Theme system — light / dark switch | M | QM-200 | `[data-theme="dark"]` token swap. Auto-detect: read `prefers-color-scheme` AND GitHub's own theme on `github.com`; user override in options. Persist `theme` to `chrome.storage.sync`. |
| QM-205 | Vendor Inter Tight + JetBrains Mono | S | QM-200 | Bundled `.woff2` files under `fonts/`; `@font-face` declarations; CSP-friendly (no remote loads). Fall back to `system-ui` / `ui-monospace`. **Verify against MV3 CSP and AMO source disclosure.** |

#### F8.2 — Injected row widget

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-206 | Compact pill widget replaces the 3-button stack | M | QM-202 | Reference: `gh-pr-list.jsx` `QMRowWidget`. Status pill (READY/BEHIND/BLOCKED/DRAFT in font-mono 9.5px), divider, main "Merge" button + caret. |
| QM-207 | Caret menu for merge method (squash/merge/rebase) | S | QM-206 | Click caret → dropdown with the three methods + per-repo default highlighted. Replaces the always-visible 3-button row. |
| QM-208 | Per-repo default indicator dot on widget button | S | QM-206, QM-207 | Existing `applyRepoDefaultClass` becomes a small dot badge instead of a button-border highlight. |
| QM-209 | Hover-only keyboard shortcut hint ("▶ press S to squash") | S | QM-206 | Gated on `chrome.storage.sync.qm_shortcut_mode === "active"`. Per design, only renders on the focused row. |
| QM-210 | Optimistic UI for single-PR merge | S | QM-206, QM-217 | Inline spinner → "Merged ✓" swap on success; revert + error toast on failure. Replaces the current emoji-status-text pattern. |

#### F8.3 — Popup surface

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-211 | Rebuild popup to design spec | M | QM-200..205 | Sticky header (mark + wordmark + EXT tag + Settings ghost button), summary strip (`N mergeable across M repos · synced 2s ago`), repo rows (avatar tile, owner/repo split typography, `N ready · M open · K stale`), inline `Merge N` primary button, footer (Pin a repo + Sponsor link). 360×540 dims. |

#### F8.4 — Options page

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-212 | Side-nav + pane layout | M | QM-200..205 | Reference: `options.jsx` `OptionsSurface`. 720×720; nav: Sign in / Repo defaults / Shortcuts / Templates / Pinned repos / About. Each pane re-uses existing options.js logic, just re-laid-out. |
| QM-213 | About pane | S | QM-212 | Version, license, privacy-policy link, Sponsor CTA, security disclosure link. |
| QM-218 | Tweaks panel — accent color picker, density, font-family | M | QM-204, QM-205 | New "Appearance" section in options. Persist to `chrome.storage.sync.qm_visual_prefs`. Live-preview applies via the same `--qm-*` variables. |
| QM-219 | Persist visual prefs across surfaces | S | QM-218 | All surfaces (popup, content row widget, options) read `qm_visual_prefs` and apply on load + on `chrome.storage.onChanged`. |

#### F8.5 — Bulk merge bar

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-214 | Dark-pill bulk bar + per-row in-flight progress | M | QM-202, QM-217 | Reference: `extras.jsx` `BulkMergeBar`. Idle: count badge + repo list + method select + Merge N button. Mid-flight: per-row queued/running/ok status with Pause. Replaces current `ensureBulkBar` HTML. |

#### F8.6 — Onboarding (NEW surface)

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-215 | First-run onboarding card | M | QM-200..205, QM-211 | Reference: `extras.jsx` `OnboardingCard`. Trigger: open popup with no `clientId` AND no `token` AND `chrome.storage.local.onboardingDismissed !== true`. 3-step explainer (Squash / Merge / Rebase glyphs) + "Continue — connect GitHub" CTA that opens options to the Sign-in pane. Dismiss writes `onboardingDismissed: true`. **Closes QM-174.** |

#### F8.7 — Pro / Sponsor upsell

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-216 | Replace donation modal with the design's accent-gradient card | S | QM-202, QM-203 | Reference: `extras.jsx` `ProUpsell`. The current `showProGate` modal becomes this card (donation-funded variant: subtle treatment that links to GitHub Sponsors). The "$4 / mo" line is conditional on a future paid tier — for v1.1 ship the subtle Sponsor variant. |

#### F8.8 — Toast system

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-217 | Custom toast system — dark fg-color toasts with colored side bar | S | QM-200, QM-203 | Reference: `extras.jsx` `Toast` / `ToastStack`. Variants: ok / warn / err / info. Auto-dismiss 4 s; max 3 stacked. Replaces the existing `toast()` in `content.js`. Used by QM-210 + QM-214 + bulk-ops feedback. |

#### F8.9 — Visual regression baselines

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-220 | Re-snapshot all Playwright visual specs after F8.1–F8.7 land | S | F8.1–F8.7 | `test/e2e/visual/popup.spec.ts`, `options.spec.ts`, `modals.spec.ts` all need fresh baselines. Per `docs/snapshot-update.md`: human reviewer signs off on each diff. |

#### Epic 8 handoff reference

The design files at `~/projects/handoff_pr_quick_merge_design/` are **React + Babel-standalone design references**, not production code. They render in a browser via `PR Quick Merge.html` for live iteration. When implementing a story, mirror the visuals + interaction states; rebuild the markup against this repo's vanilla-JS / DOM stack rather than introducing React.

| Surface | File to consult |
|---|---|
| Tokens, primitives | `styles.css` |
| Brand mark, icons, status dots | `components/primitives.jsx` |
| Row widget | `components/gh-pr-list.jsx` |
| Popup | `components/popup.jsx` |
| Options | `components/options.jsx` |
| Bulk bar, onboarding, Pro upsell, toast | `components/extras.jsx` |
| Tweaks / theme controls | `tweaks-panel.jsx` |
| All-up canvas | `design-canvas.jsx` + `PR Quick Merge.html` |

### Epic 9 — v2.0 GitLab port (NEW — scoped 2026-04-29)

**Plan:** [`plans/v2-gitlab-port.md`](./plans/v2-gitlab-port.md)
**Source of intent:** ship the same one-click merge ergonomic on GitLab (gitlab.com + self-hosted) without forking the codebase. Single extension, host-adapter pattern.
**Estimate:** XL — ~20 eng-days, parallelisable to ~12 calendar days.
**Dependencies:** v1.0 launched on both stores; v1.1 design refresh complete.

#### F9.0 — Refactor for multi-host (Phase 0)

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-300 | Introduce `lib/hosts/index.js` + `HostAdapter` interface (JSDoc types) | M | — | Defines the contract both GitHub and GitLab adapters must satisfy. Pure types + dispatch; no behavior change. |
| QM-301 | Move `lib/api.js` → `lib/hosts/github/api.js` (with thin re-export at the old path) | S | QM-300 | Backwards-compat shim during migration; removed in QM-303. |
| QM-302 | Write `lib/hosts/github/adapter.js` implementing `HostAdapter`; route `content.js` through adapter methods | M | QM-301 | The biggest single PR in Phase 0. After this, `content.js` is host-agnostic. |
| QM-303 | Token storage migration — `chrome.storage.local.token` → `tokens["github.com"]` | S | QM-302 | One-shot migration on first run after upgrade. Remove the temporary re-export from QM-301 in this PR. |
| QM-304 | Extract DOM selectors from `content.js` into `lib/hosts/github/selectors.js` | S | QM-302 | Mechanical move; tests pin the contract. |
| QM-305 | Phase 0 regression sweep — full Playwright + unit suites green; manual smoke on real github.com | S | QM-300..304 | Gate before Phase 1 starts. |

#### F9.1 — GitLab adapter (Phase 1)

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-306 | `lib/hosts/gitlab/api.js` — apiGet/apiPost/apiPut against `gitlab.com/api/v4` | M | QM-300 | `PRIVATE-TOKEN` header; project-id encoding (numeric or url-encoded namespace path). 12+ unit tests. |
| QM-307 | `lib/hosts/gitlab/selectors.js` — `parseRowAnchor` for `.merge-request` rows | S | QM-306 | DOM selectors against gitlab.com merge-request list pages. |
| QM-308 | `fetchMrState` — normalise GitLab `merge_status`/`detailed_merge_status` into the shared shape | M | QM-306 | Output the same `{ ready, behind, blocked, draft, head_sha, behind_by }` shape as `fetchPrState`. |
| QM-309 | `doMerge` — squash via `squash=true`; respect project-level `merge_method` setting | M | QM-306, QM-308 | Greys out methods the project disabled; surfaces a friendly error if user tries one anyway. |
| QM-310 | `updateBranch` — `PUT /merge_requests/:iid/rebase`, poll `rebase_in_progress` | S | QM-306 | GitLab returns 202; mirrors GitHub's queued behaviour. |
| QM-311 | Bulk close + label — `PUT /merge_requests/:iid` with `state_event: close` and `add_labels` | S | QM-306 | Single-endpoint merge of two GitHub-side calls. |
| QM-312 | `lib/hosts/gitlab/adapter.js` — implements `HostAdapter`; passes the same contract test suite as the GitHub adapter | M | QM-306..311 | The contract suite (from QM-300) runs against both adapters; parity enforced. |

#### F9.2 — Host detection + UI surfacing (Phase 2)

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-313 | `manifest.json` — add `gitlab.com/*` to content_scripts.matches | S | QM-312 | Self-hosted handled at runtime via QM-318. |
| QM-314 | Host-aware injection in `content.js` | S | QM-312, QM-313 | `lib/hosts/index.js#detect()` picks adapter; `injectRowActions` API stays unchanged. |
| QM-315 | Per-host status-pill copy mapping | S | QM-314 | READY / BEHIND / BLOCKED / DRAFT generalise to GitLab; "BEHIND" copy stays neutral ("needs rebase" remains a tooltip detail). |
| QM-316 | Popup — host icons on pinned-list rows; mixed-host counts | S | QM-314 | "10 mergeable across 4 repos" wording adapts when only GitLab projects are pinned. |
| QM-317 | Options — new "Hosts" pane (GitHub / GitLab.com / Add self-hosted…) | M | QM-314 | New section; replaces the Sign-in pane that v1.1 ships with. |

#### F9.3 — Self-hosted GitLab (Phase 3)

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-318 | `chrome.permissions.request` flow when user adds a self-hosted host | M | QM-317 | Pre-flight disclosure modal that the token will be sent only to that domain. |
| QM-319 | Per-host token storage shape | S | QM-303, QM-318 | Sign-in / sign-out flows operate on the right slot in `tokens` map. |
| QM-320 | `lib/import-export.js` gains the multi-host shape | S | QM-319 | Exports `hosts` array; tokens still excluded. |
| QM-321 | `docs/runbook-external-services.md` + `SECURITY.md` updates | S | QM-318..320 | Per-instance disclosure, GitLab PAT instructions, threat-model update for multi-host. |

#### F9.4 — Distribution + launch (Phase 4)

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-322 | Product rename decision + manifest update | S | QM-321 | Recommendation: "Quick Merge" (drop the GitHub-flavoured "PR"). Subtitle "PR Quick Merge" preserved on listings for 6 months for SEO continuity. Decide before this story starts. |
| QM-323 | Store-listing copy refresh — new screenshots, descriptions, taglines | M | QM-322 | "One-click merge for GitHub and GitLab pull requests" tagline candidate. |
| QM-324 | Launch posts — Show HN + r/programming + Reddit-GitLab + newsletter pitch | S | QM-323 | Frame around "GitLab parity reached on this dev-tool surface". |
| QM-325 | Privacy-policy update — explicit per-host destination list | S | QM-321 | Already covered by `docs/privacy-policy.md`; v2.0 update reflects each host the extension talks to. |

#### F9.5 — Quality + ops (Phase 5)

| ID | Title | Est | Deps | Notes |
|----|-------|-----|------|-------|
| QM-326 | Playwright e2e suite for GitLab — fixture project + lifecycle tests | M | QM-312 | Mirrors the existing GitHub e2e set: happy-path merge, update-branch, bulk-close, merge-queue lifecycle. New bot account (or reuse `gh-pr-qm-bot` if it has GitLab credentials). |
| QM-327 | SECURITY.md threat-model update for multi-host | S | QM-321 | Adds "user adds a malicious self-hosted host" to the threat model with the consent flow as the mitigation. |
| QM-328 | Contract tests — both adapters exercised against the same `HostAdapter` suite | M | QM-300, QM-312 | Enforces interface parity. New file `test/host-adapter-contract.test.js`. |
| QM-329 | Shared MR/PR fixture data so visual snapshots cover both hosts | S | QM-326 | Updates `test/fixtures/` with a GitLab MR-list snapshot. |
| QM-330 | Release runbook update — staged rollout SOP + GitLab smoke checklist | S | QM-321 | `docs/runbook-release.md` adds GitLab steps; SOP unchanged. |

### Historical — Epics 1, 2, 4, 5, 6, 7 (mostly shipped — see §7)

> The rows below this line were the v0.3 → v1.0 build-out. Most are shipped (PRs #16–#25). Kept inline for cross-reference; canonical shipped status is in §7 and `git log`. New work should land in the launch-follow-ups or v1.1-candidates tables above.

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

**v0.3 — Epic 1 (PRs #16, #22):**
- QM-031, 032 — Templates wired into merge action + storage helpers
- QM-033 — Template editor UI in options
- QM-034, 035 — Shortcut listener + a11y
- QM-036 — Shortcut customization UI
- QM-037 — Repo-name autocomplete in defaults UI
- QM-038 — Import/export for repo defaults + templates (`lib/import-export.js`)
- QM-039 — Stale-PR badge injection
- QM-040 — Stale-threshold config UI
- QM-041, 042 — Popup manage mode + refresh + error states
- QM-043 — Token-rotation reminder
- QM-044 — Multi-account hint
- QM-045 — Row-actions extension point + `lib/api.js` + `behind_by` (PR [#23](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/23))
- QM-046 — Fixture-DOM integration tests + `test/fixtures/*.html`

**v0.4 — Epic 2 (PRs #24, #25):**
- QM-051..057 — Update branch + Merge-when-Green + Auto-Rebase row actions (`lib/update-branch.js`, `lib/merge-queue.js`, `lib/auto-rebase.js`, background poller, options strategy + threshold)
- QM-058..061 — Bulk close + bulk label (`lib/bulk-ops.js`, per-row flash feedback)
- QM-062..064 — Stale-PR row highlighting with per-repo thresholds + tooltip
- QM-065..067 — Fast-mode list endpoint (`lib/list-mode.js`, options toggle)
- QM-068..070 — Auto-rebase orchestration + UI

**v1.0 backlog — Epics 4/5/6/7 (slimmed) (PRs #18–#21):**
- QM-101, 102, 103, 106, 107, 109, 118, 119, 120 — Distribution: store-listing copy, screenshot specs, AMO source-disclosure recipe, privacy policy, demo-video script, launch posts (PR [#18](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/18))
- QM-104, 108 — **Blocked-on-human** (CWS / AMO submission dashboards); artifacts ready
- QM-126, 127, 128 — Sentry sanitiser + boot scaffold (PR [#21](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/21))
- QM-141..143, 145..151, 153..156 — Quality: Playwright scaffold, e2e workflow, release script + runbook, staged-rollout SOP, perf baseline (PR [#19](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/19))
- QM-161..164 — Donations: GitHub Sponsors live, donation modal, README support section, popup heart, options Support link (PR [#20](https://github.com/bradygrapentine/gh-pr-quick-merge/pull/20))
- QM-165 — Buy Me a Coffee secondary platform: **deferred** per plan

**v1-polish — quality + housekeeping (PR pending):**
- 95% line coverage gate (`@vitest/coverage-v8`)
- 6 new E2E specs (`donation-modal`, `options-roundtrip`, `popup-manage`, `merge-queue-lifecycle`, `bulk-close`, `update-branch`)
- v1.0 security review (0 critical/high/medium; 2 repo-settings warnings → QM-167/168)
- `docs/runbook-external-services.md` + `docs/v1-launch-checklist.md`
- README + ROADMAP + BACKLOG status sync
- Stale-branch cleanup; auto-delete-branch enabled on the repo
