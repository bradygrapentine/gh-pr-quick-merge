# GitHub PR Quick Merge — Roadmap

A browser extension that lets devs squash / merge / rebase PRs directly from the GitHub PR list, no PR-page round-trip. Free core; paid Pro tier for power-user automation.

**Current release:** [v0.2.0](https://github.com/bradygrapentine/gh-pr-quick-merge/releases/tag/v0.2.0) (2026-04-29) — first public release.

---

## Map

```
v0.1 ── v0.2 ── v0.3 ── v0.4 ── v1.0 ── Post-1.0
shipped shipped Epic 1   Epic 2 Epics 3–6 Teams + GH Marketplace
```

The path from v0.2 to v1.0 is broken into **6 Epics**. Each Epic decomposes into Features, which decompose into individual Stories (`QM-NNN`) tracked in `BACKLOG.md`. Per-Feature implementation plans live in `plans/`.

**Epics**:

| # | Epic | Targets | Domain | Range |
|---|---|---|---|---|
| 1 | Power-user features | v0.3 | extension | QM-031..050 |
| 2 | "Everything you wish the GitHub PR list did" | v0.4 | extension | QM-051..070 |
| ~~3~~ | ~~License & payment infrastructure~~ | _deferred_ | server + extension | ~~QM-071..100~~ |
| 4 | Distribution (slimmed) | v1.0 | store ops | QM-101..120 |
| 5 | Crash reporting (slimmed) | v1.0 | extension | QM-121..140 |
| 6 | Quality & release ops (slimmed) | v1.0 | extension | QM-141..160 |
| 7 | Donation infrastructure | v1.0 | extension + GH Sponsors | QM-161..170 |

**Scope simplification (2026-04-29):** v1.0 ships **donation-funded** via GitHub Sponsors instead of a paid Pro tier. The license-server / Stripe / ed25519 / state-machine path (Epic 3) is deferred — plans remain on disk as scaffolding if a paid tier becomes warranted later. Epics 4/5/6 are slimmed to remove license-server-coupled stories. Epic 7 is new.

---

## v0.1 — Shipped

**Goal:** Prove the core ergonomic win — one-click merge from the list view — for solo users with a PAT.

PAT auth, per-row Squash/Merge/Rebase buttons, mergeability check, MutationObserver re-injection, options page. Initial commit baseline.

---

## v0.2 — Shipped (2026-04-29)

**Goal:** Validate the product loop with real users; harden security; ship a tagged release.

**Highlights** (full list in `CHANGELOG.md`):

- OAuth Device Flow + sign-out flow; PAT retained as fallback
- Real PNG icons (16/48/128); MV3 service worker (`background.js`)
- Bulk-merge multi-select bar gated behind a Pro placeholder modal (intent capture only — no payment yet)
- Toolbar popup with mergeable-PR summary across pinned repos
- Per-repo default merge method — UI in options + button highlight + bulk-bar auto-select
- Pure modules under `lib/` with 149 unit tests across 10 files: `pr-helpers`, `repo-defaults`, `templates`, `shortcuts`, `stale-pr`, `popup-data`, `test-utils`
- GitHub Actions CI: `npm test` + required `web-ext lint`
- 12 of 15 SECURITY findings closed; F-10 deferred to v1.0 license server; F-13 / F-14 informational
- Typed-confirmation modal (`MERGE N`) for bulk merges of 3+ PRs
- `npm run package` → 40K Chrome/Firefox-ready zip

**Outcome:** First public release; baseline for adoption + retention measurement.

---

## v0.3 — Power-user features  (Epic 1)

**Targets:** 2k WAU · ≥30% of active users have customized at least one setting · D7 retention ≥40%

**Theme:** Wire the engines we shipped behind the scenes in v0.2 — templates, shortcuts, stale-PR — into the runtime UI. Polish what's exposed. Free-tier features that make the extension sticky for daily use.

**Features (detail in `BACKLOG.md` and per-Feature plans):**

- **F1.1 Templates UX** — wire `lib/templates` into the merge call; editor in options with live preview + inline validation.
- **F1.2 Shortcuts UX** — `keydown` listener; default `Shift+S/M/R/A/Esc`; rebind UI + a11y focus ring + `aria-live` announcements.
- **F1.3 Per-repo defaults v2** — autocomplete, JSON import/export, override-precedence visible in UI.
- **F1.4 Stale-PR awareness** — row badge + per-repo threshold UI driven by `lib/stale-pr`.
- **F1.5 Popup polish** — pin/unpin from popup, manual refresh, empty/error states.
- **F1.6 Token & auth UX** — rotation reminder badge, multi-account hint.
- **F1.7 Integration glue & tests** — wire all lib modules into `content.js` (closes QM-022); fixture-DOM integration test suite (closes QM-010).

**Closes the v0.2 leftovers:** QM-010, QM-016, QM-018, QM-022, QM-027, QM-028, QM-029.

---

## v0.4 — "Everything you wish the GitHub PR list did"  (Epic 2)

**Targets:** 4k WAU · "wow" momentum that powers Show-HN-readiness · Chrome Web Store featured-pick eligibility

**Theme:** Take the row-injection pattern beyond merge buttons. Every action a user wishes they could trigger from the PR list, instead of opening each PR.

**Features:**

- **F2.1 Per-row "Update branch"** — one-click rebase or merge of base into a PR's head branch (mirrors the green button GitHub buries inside each PR page).
- **F2.2 Merge-when-green** — schedule a deferred merge that fires once required checks pass; queue state badge per row; cancel-watch.
- **F2.3 Bulk close + bulk label** — extend the bulk-action bar with non-merge mass operations.
- **F2.4 Stale-PR row highlighting** — beyond F1.4: idle-author detection, configurable thresholds, tooltip with last-activity author.
- **F2.5 Cheaper list-endpoint mode** — opt-in: use `/pulls` list summary instead of one `/pulls/:n` per row, for very long lists.
- **F2.6 Auto-rebase before merge** — if N commits behind base, silently rebase first then merge.

**Listing tagline candidate:** *"Everything you wish the GitHub PR list did."*

---

## v1.0 — Public launch + donation funding

**Targets:** 5k WAU within 90 days of launch · CWS + AMO listings live · GitHub Sponsors profile receiving traffic

**Theme:** Ship to both stores; ask for support; stay free forever. Ongoing operating cost is ~$1.25/mo (just the domain). Donations cover that floor with the first sponsor and anything above is upside that funds development time.

### Epic 4 — Distribution (slimmed)

**Theme:** Get the extension in front of users via CWS + AMO.

**Features:**

- **F4.1 Chrome Web Store listing** — copy, screenshots, promotional graphics, permissions justifications, submission, review-cycle handling.
- **F4.2 Firefox AMO listing** — same, with AMO's stricter review constraints (source-code disclosure, no remote code).
- **F4.3 Privacy policy** — required by both stores. Hosted as a static page (Cloudflare Pages or GitHub Pages).
- **F4.6 Launch plan** — Show HN, r/programming, dev-tools newsletters, demo video, demo GIF.

_Removed from v1.0:_ marketing site, pricing page, docs site, ToS, refund policy. The README + GitHub Sponsors profile + store listing copy cover the surface area.

### Epic 5 — Crash reporting (slimmed)

**Theme:** Know when the extension breaks. Nothing else.

**Features:**

- **F5.2 Sentry crash reporting** — opt-in, auto-redacts tokens via the F-15 sanitization pattern, source-maps uploaded in CI but not shipped to users.

_Removed from v1.0:_ PostHog telemetry, conversion funnel (no funnel exists without paid conversion), Cloudflare Worker logs (no Worker), license-server SLOs (no server).

### Epic 6 — Quality & release ops (slimmed)

**Theme:** Make releases boring.

**Features:**

- **F6.1 E2E browser tests (Playwright)** — load extension, sign in, run merge against a fixture repo on a test GitHub account; nightly. Free flows only.
- **F6.2 Visual regression** — screenshot diff for popup, options page, donation modal.
- **F6.3 Performance baseline** — extension startup time, MutationObserver impact, memory.
- **F6.4 Release runbook** — pre-flight, ship to CWS dev → public, AMO unlisted → public.
- **F6.5 Rollback** — CWS staged rollouts (10% → 50% → 100%).

_Removed:_ license API perf, kill-switch, old-version metrics endpoint, SLO dashboards, on-call wiring.

### Epic 7 — Donation infrastructure

**Theme:** Make it easy to support development without making it feel mandatory.

**Features:**

- **F7.1 GitHub Sponsors profile** with 4 tiers: Coffee ($5/mo), Daily user ($25/mo), Team ($99/mo), Sponsor ($499/mo with logo placement on the repo).
- **F7.2 Donation modal** — replaces the bulk-merge "Pro" modal. Same trigger; copy changes from "Bulk merge is a Pro feature" to "Like this? Support development." No state, no paywall — just a link.
- **F7.3 Donation link surfaces** — heart icon in popup footer, subtle "Support" link in options page footer, README `## Support` section, store-listing pitch paragraph.
- **F7.4 Optional Buy Me a Coffee** as a secondary platform — only added if Sponsors signup friction is reported in early feedback.

### Operating costs (real)

| Item | Cost |
|---|---|
| Domain (.dev) | $15/year (~$1.25/mo) |
| CWS developer registration | $5 lifetime |
| AMO developer | $0 |
| GitHub Sponsors | 0% platform fee |
| Sentry free tier | $0 (5k events/mo) |
| GitHub Actions (public repo) | $0 |
| **Total** | **~$1.25/mo recurring** |

First sponsor at any tier covers the floor. Everything else is funding development time.

---

## Post-1.0 — Team + workflow expansion

**Goal:** Move from individual tool to team workflow product; raise the revenue ceiling toward $10k+/mo.

**Themes:**

- GitHub App + Marketplace listing (per-seat billing handled by Marketplace)
- Team / seat admin console (assign Pro to N seats; audit log)
- Merge-queue integration (real queue, not the v0.4 single-PR scheduler)
- Cross-repo batch ops dashboard
- Team analytics (throughput, stuck PRs)
- Safari port (revenue per platform / effort tradeoff TBD)

**Targets:** 3+ paying teams (10+ seats each) · $3–10k MRR · NRR ≥110%.

---

## Decision log

- **2026-04-29** — v0.2 cut as the first public release. v0.2.0-rc.1 was an internal milestone consolidated into v0.2.0 final after QM-019 closed.
- **2026-04-29** — v0.3/v0.4 narrative consolidated as **"Everything you wish the GitHub PR list did"**; chosen as the listing tagline candidate.
- **2026-04-29** — v1.0 split into 4 parallel Epics (licensing infra, distribution, observability, quality ops) — keeps cross-domain work from blocking on a single critical path.
- **TBD** — Pro tier pricing (currently placeholder $4/mo); decide post-v0.4 with conversion-funnel data from the Pro modal.

---

## See also

- [`BACKLOG.md`](./BACKLOG.md) — flat list of all Stories with QM-IDs, estimates, dependencies
- [`plans/`](./plans/) — per-Feature implementation plans
- [`CHANGELOG.md`](./CHANGELOG.md) — what shipped per release
- [`SECURITY.md`](./SECURITY.md) — security review + closure status
- [`SETUP.md`](./SETUP.md) — developer setup walkthrough
