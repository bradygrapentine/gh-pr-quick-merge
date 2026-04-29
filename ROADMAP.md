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
| 3 | License & payment infrastructure | v1.0 | server + extension | QM-071..100 |
| 4 | Distribution & marketing | v1.0 | store ops + web | QM-101..120 |
| 5 | Observability | v1.0 | server + extension | QM-121..140 |
| 6 | Quality & release ops | v1.0 | extension + ops | QM-141..160 |

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

## v1.0 — Paid Pro tier + public launch

Four parallel Epics carry v1.0. v0.3 and v0.4 must ship first to give Pro something to gate against.

**Targets:** 5k WAU within 90 days of launch · 1–3% free→Pro conversion ($3–5/mo) · $500–1k MRR by end of quarter

### Epic 3 — License & payment infrastructure

**Theme:** Turn the cosmetic Pro modal into a real paywall.

**Features:**

- **F3.1 Stripe integration** — checkout, customer portal, webhook handlers (subscription.created/updated/deleted).
- **F3.2 Cloudflare Worker license API** — generate, validate, revoke license keys; idempotency; rate limiting; replay protection.
- **F3.3 Ed25519 signing** — license keys are signed receipts the extension verifies offline; periodic online re-validation; offline grace period (7 days).
- **F3.4 License entry & state in extension** — replace `chrome.storage.local.pro` boolean with a real license-state machine (none / trial / active / grace / revoked).
- **F3.5 Subscription lifecycle UX** — restore-purchase flow, expiry warnings, dunning copy, cancellation feedback.
- **F3.6 Pricing experiments** — feature-flag the Pro tier price; run a small A/B at launch.

### Epic 4 — Distribution & marketing

**Theme:** Get the extension and the Pro tier in front of buyers.

**Features:**

- **F4.1 Chrome Web Store listing** — copy, screenshots, promotional graphics, permissions justifications, submission, review-cycle handling.
- **F4.2 Firefox AMO listing** — same, with AMO's stricter review constraints (source-code disclosure, no remote code).
- **F4.3 Privacy policy & legal** — privacy policy, terms of service, refund policy, cookie disclosure.
- **F4.4 Marketing site** — landing page (feature tour, demo GIF), pricing page, install CTAs to both stores.
- **F4.5 Documentation site** — getting-started, OAuth setup walkthrough, Pro-only feature docs, troubleshooting.
- **F4.6 Launch plan** — Show HN draft, r/programming launch post, dev-tools newsletter outreach, demo video.

### Epic 5 — Observability

**Theme:** Operate on data, not vibes.

**Features:**

- **F5.1 Telemetry SDK (extension)** — opt-in PostHog (or self-hosted equivalent) capturing feature usage, conversion funnel, retention.
- **F5.2 Crash reporting (extension)** — Sentry; auto-redact tokens.
- **F5.3 License-server logs & dashboards** — request volume, signing-key rotation health, webhook lag, refund rate.
- **F5.4 Conversion funnel** — Pro modal → checkout → license-key entry → first Pro action; drop-off attribution.
- **F5.5 Privacy-respecting analytics** — explicit opt-in, transparent disclosure, easy off-switch in options.

### Epic 6 — Quality & release ops

**Theme:** Make releases boring.

**Features:**

- **F6.1 E2E browser tests (Playwright)** — load extension, sign in, run merge against a fixture repo on a test GitHub account; runs nightly.
- **F6.2 Visual regression** — screenshot diff for the popup, options page, modals.
- **F6.3 Performance baseline** — startup time, MutationObserver impact, memory profile; track in CI.
- **F6.4 Release runbook** — pre-flight, ship, post-ship monitoring; per-channel publish (CWS dev → CWS public, AMO unlisted → public).
- **F6.5 Rollback procedures** — staged rollouts via CWS percentages; "panic" license-server kill-switch; users-on-old-version metrics.
- **F6.6 SLA / on-call** — license-server SLOs (99.9% available, p95 < 200ms), PagerDuty wiring (or solo equivalent).

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
