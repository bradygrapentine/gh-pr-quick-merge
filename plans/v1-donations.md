# Plan — Epic 7: Donation infrastructure (v1.0)

**Milestone:** v1.0
**Estimate:** S overall · 5 stories · ~1–2 eng-days end-to-end
**Dependencies:** none (can run in parallel with anything else)
**Reservation:** QM-161..QM-170

## Goal

Replace the cosmetic Pro paywall with a donation prompt. Set up GitHub Sponsors with tiered amounts that make sense for individuals, power users, small teams, and corporate sponsors. Surface the donation link in two extension touch-points (popup footer + options page) and the store listings. **No payment gate, no license server, no state machine** — donations are voluntary; the extension is fully free forever.

## Why this exists (vs Epic 3)

The license-server / Pro-paywall path (`plans/v1-license-server.md`, `plans/v1-license-extension.md`) is **deferred** as scope-creep relative to a small browser extension. Those plans remain on disk as scaffolding if a paid tier becomes warranted later (pre-existing demand signal, not speculation).

Donation tiers:

| Tier | Amount | Audience | Pitch |
|---|---|---|---|
| ☕ Coffee | $5/mo | individual | "You use this. Buy a coffee a month." |
| 🛠 Daily user | $25/mo | power user | "You merge a lot of PRs." |
| 🏢 Team | $99/mo | small company | "Your team uses this. Cheaper than half a Linear seat." |
| 🚀 Sponsor | $499/mo | enterprise | "Logo on the GitHub repo + first-dibs on roadmap input." |

## Stories

| ID | Title | Estimate | Notes |
|----|-------|----------|-------|
| **QM-161** | GitHub Sponsors profile setup with 4 tiers | S | [ops] HUMAN-IN-LOOP. Sign up at github.com/sponsors, complete profile (bio, goals), define the 4 tier breakpoints above with copy. Stripe Connect handshake (US-only payee identity verification — analogous to Stripe's; ~10–30 min, no separate Stripe account needed). |
| **QM-162** | Replace bulk-merge "Pro" modal with donation modal | S | [ext] Edit `content.js` `showProGate()`. Same trigger (clicking bulk-merge with no Pro flag), same 3-button shape, but copy changes from "Bulk merge is a Pro feature" to "Like this? Support development." Buttons: "Maybe later" / "Open Sponsors" / dev-only "Enable Pro (dev)" stays for testing. Remove all `chrome.storage.local.pro` writes — no state, link only. |
| **QM-163** | Donation link in popup footer + options page | S | [ext] Heart icon in popup footer linking to GitHub Sponsors. Subtle "Support" link in options page footer. `target="_blank" rel="noopener noreferrer"`. No DOM injection on github.com pages. |
| **QM-164** | README + CWS/AMO listing copy includes donation pitch | S | [docs] One paragraph in README under a `## Support` section. Mirror that paragraph in CWS long description (QM-101) and AMO listing copy (QM-106). One-line link in `manifest.json` description? No — keeps the description clean. The Sponsors profile shows on the GitHub repo automatically. |
| **QM-165** | Optional secondary platform (Buy Me a Coffee) | S | [ops] DEFERRED — only do this if Sponsors signup feedback indicates friction. BMaC catches users who won't sign into GitHub. Setup is 15 min. Linked from the donation modal as a secondary CTA. |

**Total:** 5 stories, all S. ~1–2 days serial; Phase 1 is QM-161 (account setup, async wait possible), Phase 2 (QM-162, QM-163, QM-164) parallelizable.

## File ownership

| Story | Files |
|---|---|
| QM-161 | none (external — GitHub Sponsors dashboard) |
| QM-162 | `content.js` (the `showProGate` function), `styles.css` (modal copy tweaks) |
| QM-163 | `popup.html`, `popup.css`, `options.html` |
| QM-164 | `README.md` |
| QM-165 | none (external — BMaC dashboard) + `content.js` (secondary CTA in donation modal) |

Zero file overlap with Epics 1, 2, 4, 5, 6 (other than `content.js` for QM-162 — which conflicts with Epic 1 stories that touch the same file). Sequence after Epic 1's `content.js` work merges, OR fold QM-162 into the QM-045 integration glue commit.

## Verify

- [ ] Sponsors profile is live at `github.com/sponsors/bradygrapentine` with 4 tier amounts visible
- [ ] Clicking bulk-merge → donation modal opens (not Pro paywall)
- [ ] "Open Sponsors" button opens Sponsors page in a new tab
- [ ] Heart icon in popup → same destination
- [ ] No `chrome.storage.local.pro` writes anywhere in the codebase (grep confirms)
- [ ] README has a `## Support` section
- [ ] CWS + AMO listings include the donation pitch paragraph

## Definition of done

- All 5 stories merged
- Sponsors profile receiving traffic from the extension
- README + store listings reflect the donation pitch
- F-10 SECURITY finding closure path now reads "deferred — no paywall enforcement needed; product is free forever"

## Open questions

1. **Sponsors profile owner:** personal (`bradygrapentine`) or org? Personal is simplest. Org has tax / brand-separation upside if revenue grows past hobby scale.
2. **Button copy:** "Open Sponsors" vs "❤️ Support" vs "Donate" — A/B-irrelevant at this scale, just pick one. My pick: "Sponsor on GitHub" — clearest about what happens.
3. **Show Sponsors button on every page load**, or only when bulk-merge attempted? Only on bulk-merge keeps it non-annoying. Power users (the willing-to-pay cohort) hit bulk-merge naturally.

## Out of scope (explicitly)

- Pro feature gating (no longer a thing)
- License server (`v1-license-server.md` is deferred)
- License crypto, state machine, validation (`v1-license-extension.md` is deferred)
- Marketing site, pricing page (Sponsors profile + repo README replace these)
- Refund policy (donations don't refund — Sponsors handles disputes)
- Conversion-funnel telemetry (no funnel; one binary action: clicked support or didn't)
