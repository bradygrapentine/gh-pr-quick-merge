# GitHub PR Quick Merge — Roadmap

A browser extension that lets devs squash / merge / rebase PRs directly from the GitHub PR list, no PR-page round-trip.

---

## v0.1 — Current (shipped)

**Goal:** Prove the core ergonomic win — one-click merge from the list view — for solo users with a PAT.

**Key features:**
- PAT-based auth, stored in `chrome.storage.sync`
- Per-row Squash / Merge / Rebase buttons injected into PR list rows
- Mergeability check via `GET /repos/:owner/:repo/pulls/:num` (reads `mergeable` + `mergeable_state`)
- `MutationObserver` re-injects buttons on filter / sort / pagination re-renders
- Options page for PAT entry
- Basic CSS to match GitHub list styling
- Works on `github.com/pulls`, `github.com/<owner>/<repo>/pulls`, `github.com/issues`

**Success metric:** ~50 self-installed dev-mode users; positive qualitative feedback from 5+ early testers; zero data-leak incidents.

---

## Shipped in v0.2 (current) — 2026-04-29

Wave 1 of the v0.2 milestone landed:

- OAuth device flow replacing raw PAT entry (PAT remains as fallback) — QM-003 / QM-004
- Real PNG icons (16 / 48 / 128) replacing Chrome's default placeholder — QM-001 / QM-002
- Bulk-merge multi-select scaffold gated behind a "Pro" placeholder upsell (no payment yet — captures intent) — QM-006 / QM-007 / QM-008
- Vitest + jsdom test harness with 17 passing unit tests — QM-009
- Pure helpers extracted to `lib/pr-helpers.js` and consumed by `content.js` — QM-005

## v0.2 — Polish + soft Pro teaser (remaining)

**Goal:** Close out the v0.2 milestone — finish the test/CI story and ship the popup. Wave 2 carries the remaining stories.

**Still pending:**
- Integration tests for row injection against fixture DOM (QM-010)
- GitHub Actions CI: lint + typecheck + test on PR (QM-011)
- web-ext lint integration for Firefox AMO pre-flight (QM-020)
- Toolbar popup with summary of mergeable PRs across pinned repos (QM-021)
- SECURITY.md follow-ups (QM-019 — security agent owns the concrete items)

**Success metric:** 500 WAU; >=10% of WAU click the "Pro" teaser (conversion-intent proxy); test suite green on every PR.

---

## v0.3 — Power-user features

**Goal:** Make the extension sticky for daily users by removing repeated friction.

**Key features:**
- Per-repo default merge method (sync to `chrome.storage.sync`) — QM-012 / QM-013 / QM-014
- Custom merge-commit message templates with variables (`{title}`, `{pr_number}`, `{author}`) — QM-015 / QM-016
- Keyboard shortcuts (`s` squash, `m` merge, `r` rebase on focused row) — QM-017 / QM-018
- Wave 2 integration glue — wire `lib/repo-defaults`, `lib/templates`, `lib/shortcuts` into `content.js` (QM-022)
- Settings UI redesign to host the new options

**Success metric:** 2k WAU; >=30% of active users have customized at least one default; D7 retention >=40%.

---

## v1.0 — Paid Pro tier + public launch

**Goal:** Convert the validated free product into revenue and put it in front of a wide dev audience.

**Key features:**
- License-key Pro tier validated against a Cloudflare Worker backed by Stripe checkout + webhooks (license server)
- Pro unlocks: bulk-merge, templates, keyboard shortcuts, per-repo defaults
- Chrome Web Store listing (paid + free dual-channel)
- Firefox AMO listing
- Marketing push: Show HN, `r/programming`, dev-tools newsletters, short demo video

**Success metric:** 5k WAU within 90 days of launch; 1-3% free→Pro conversion ($3-5/mo); $500-1k MRR by end of quarter.

---

## Post-1.0 — Team + workflow expansion

**Goal:** Move from individual tool to team workflow product; raise the revenue ceiling toward $10k+/mo.

**Key features:**
- GitHub App + Marketplace listing (per-seat billing handled by Marketplace)
- Team / seat billing with admin console
- Merge-queue integration (queue a PR for merge once checks pass, instead of waiting at the row)
- Cross-repo batch ops (act on PRs spanning many repos in one sweep)
- Optional analytics dashboard for teams (merge throughput, stuck PRs)

**Success metric:** 3+ paying teams (10+ seats each); $3-10k MRR; net-revenue retention >=110%.
