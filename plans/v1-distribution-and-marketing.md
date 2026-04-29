# Plan — v1 Distribution & Marketing (Epic 4, QM-101..120)

**Milestone:** v1.0 public launch
**Estimate:** 3–5 weeks (human review timelines dominate)
**Dependencies:** Epic 3 complete (Stripe live, Pro tier billing), domain registered, CWS + AMO developer accounts active, production OAuth client-id from CWS-published extension
**Parallel-safe with:** nothing — this is the terminal epic

## Goal

Get the extension and Pro tier in front of buyers: both browser stores approved and live, a marketing site with a working Stripe checkout CTA, docs covering the full OAuth flow, and a coordinated Show HN + newsletter launch.

## Critical path

Domain confirmed → privacy policy + ToS live → CWS/AMO submissions sent → store approvals (human wait) → marketing site live with pricing CTA → demo assets → launch posts.

The CWS and AMO review periods are the only hard blockers that cannot be parallelised away. Everything else — copy, screenshots, site pages, docs — can run concurrently while waiting for reviewer queues.

---

## Preconditions checklist (verify before Phase 1)

- [ ] Domain registered and DNS propagated
- [ ] CWS developer account active ($5 one-time fee paid)
- [ ] AMO developer account active (free)
- [ ] Stripe account live with Pro product + price IDs (Epic 3 DoD met)
- [ ] Production OAuth client-id obtained from first CWS publish (placeholder OK for Phase 2 creative; required for Phase 3 submission)
- [ ] Extension package (.zip for CWS, .xpi for AMO) built from release tag

---

## Phase 1 — Foundations (QM-109, QM-110, QM-111)

**Goal:** Legal pages live before any store submission. CWS and AMO both require a privacy policy URL; AMO additionally checks that the policy is accurate for listed permissions.

**Stories run in parallel** (three independent documents, same site section).

### QM-109 — Privacy policy (S, [marketing-site])

Write a plain-English privacy policy covering:
- Data collected: GitHub OAuth token stored in `chrome.storage.local` (device only, never transmitted to our servers); PR metadata fetched from GitHub API on user's behalf.
- Data NOT collected: no analytics, no crash reporting, no third-party trackers in extension.
- Pro billing: Stripe collects payment info directly; we receive only a customer-id and subscription status.
- Contact email for privacy inquiries.

**Tooling:** Write in Markdown, publish as a static page on the marketing site (once QM-112 scaffolds it). Until the site exists, host at a GitHub Pages URL (e.g. `https://<org>.github.io/gh-pr-quick-merge/privacy`) so store submissions can proceed.

**Output:** `privacy-policy.md` (or equivalent page source), deployed URL.

**Review gate:** Read aloud for plain-language clarity. Have a non-technical person confirm they understand what data is and isn't collected.

### QM-110 — Terms of service (S, [marketing-site])

Cover: acceptable use, Pro subscription terms (monthly/annual, auto-renewal), refund path pointer to QM-111, warranty disclaimer, limitation of liability, governing law.

Keep it short — 400–600 words. Use a permissive template (e.g. Termly free tier or a plain Creative Commons–compatible template) and adapt rather than writing from scratch.

**Output:** `terms-of-service.md`, deployed URL.

### QM-111 — Refund policy (S, [marketing-site])

Simple: 7-day no-questions refund for Pro subscriptions, initiated via email. Stripe customer portal link for self-serve cancellation. No refunds on partial billing periods beyond the 7-day window.

**Output:** `refund-policy.md`, deployed URL.

**Phase 1 DoD:** All three pages live at stable URLs; privacy policy URL confirmed valid in a browser before Phase 3 submission.

---

## Phase 2 — Store assets (QM-101..103, QM-106..107)

**Goal:** All visual and copy assets ready so Phase 3 submissions can go out the same day Phase 1 finishes.

**Stories run in parallel** (creative work, independent of each other; QM-107 is technical but self-contained).

### QM-101 — CWS store copy (S, [creative])

Write the Chrome Web Store listing text:
- **Name:** "PR Quick Merge" (28 chars — fits CWS limit)
- **Short description** (132 chars max): one punchy sentence, include "GitHub pull requests" for search. Example draft: "Merge GitHub pull requests from your toolbar — no page loads, no tab switching. Pro: bulk merge across pinned repos."
- **Detailed description** (up to 16,000 chars, but aim for 300–500 useful words): feature bullets, Pro vs free comparison table (ASCII or plain text — CWS strips HTML), install instructions, OAuth permission explanation (important for reviewer trust), support email.
- **Category:** Developer Tools
- **Language:** English (add additional locales later if growth warrants)

**Review hint:** CWS reviewers flag misleading descriptions. Be precise: do not claim "instant" if the GitHub API has latency. Do not mention competitor extensions by name.

**Output:** `store-copy/cws-listing.md` in the repo (source of truth for edits).

### QM-102 — CWS screenshots (M, [creative])

CWS requires at least 1 screenshot; 5 is the recommended maximum. Size: 1280×800 or 640×400.

**Shots to produce (5):**
1. Popup open showing 3 repos, merge-ready count badges.
2. Single-click merge in action (before/after or animated — but CWS screenshots must be static PNGs).
3. Bulk-merge flow with repo selector.
4. Options page showing pinned repos list.
5. Pro upgrade prompt (tasteful, not alarming).

**Tooling:** Use a real browser session on a staging repo with seeded test PRs. Take screenshots via Chrome's DevTools device toolbar at 1280×800. Annotate in Figma (free tier is sufficient): add callout labels, a thin 2px brand-color border, drop shadow. Export as PNG.

**Output:** `store-copy/screenshots/cws-*.png` (5 files).

**Review gate:** Load in Chrome Web Store Developer Dashboard preview; confirm text is legible at thumbnail size (176×112).

### QM-103 — CWS promotional tile + marquee banner (S, [creative])

CWS optional but recommended for featuring consideration:
- **Small promotional tile:** 440×280px. Brand mark (extension icon at 64px), product name in Inter or similar, one-line tagline, brand background color. No screenshots — this is brand.
- **Marquee banner:** 1400×560px. Same brand elements scaled up, optionally a cropped screenshot of the popup as a device frame accent.

**Tooling:** Figma (free tier). Export both as PNG. If no Figma access, Canva free tier works. Save Figma source file in `store-copy/figma-source/` (or share link in the doc) so assets can be updated without recreating from scratch.

**Output:** `store-copy/cws-tile-440x280.png`, `store-copy/cws-marquee-1400x560.png`.

### QM-106 — AMO listing copy (S, [creative])

Firefox Add-ons listing is structurally similar to CWS but has different character limits and a different audience.

- **Name:** "PR Quick Merge"
- **Summary** (250 chars max): AMO surfaces this in search results.
- **Description** (no hard limit, but 300–500 words recommended): same feature story as CWS but reword — AMO reviewers may compare listings, and duplicate copy from CWS is fine but lazy rewording signals low-effort submissions.
- **Support URL:** GitHub Issues page.
- **Homepage URL:** marketing site (can be added post-Phase-4 if site isn't live yet — AMO allows updating post-submission).
- Note: AMO requires Firefox-specific permissions justification in the review notes field, not in public copy.

**Output:** `store-copy/amo-listing.md`.

### QM-107 — Source-code disclosure package (M, [ext])

AMO requires source code submission for any minified or bundled extension. This is a technical task, not creative.

Produce a source disclosure zip containing:
- All extension source files (unminified).
- `BUILD.md` with exact commands to reproduce the production .xpi from source: Node version, `npm ci`, `npm run build`, output path.
- Confirm the built artifact matches the submitted .xpi (same file sizes, same manifest version).

**Tooling:** `zip -r source-disclosure.zip . --exclude='.git/*' --exclude='node_modules/*'`. Run the build commands in a clean environment (e.g. Docker or a fresh `nvm use`) to verify reproducibility before zipping.

**Output:** `source-disclosure.zip` (not committed to repo — attach directly in AMO submission form). `store-copy/BUILD.md` committed to repo.

**Phase 2 DoD:** All five CWS assets ready (`cws-listing.md`, 5 screenshots, tile, banner); AMO copy ready; source disclosure zip verified reproducible.

---

## Phase 3 — Store submissions (QM-104, QM-105, QM-108)

**Goal:** Both extensions submitted and under review. This phase is sequential: CWS first (harder review, longer queue), AMO second.

**HUMAN-IN-LOOP required for all tasks in this phase.**

### QM-104 — Submit to CWS review + monitor + respond (M, [store-ops])

**Steps (human performs):**
1. Log into [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Create new item → upload .zip.
3. Fill in all listing fields from `store-copy/cws-listing.md` and upload all five screenshots, tile, and banner.
4. Set privacy policy URL (from Phase 1).
5. Fill in "Single purpose" justification and permissions rationale (pull directly from the detailed description doc).
6. Submit for review.
7. Monitor the developer dashboard and the registered developer email daily.

**Review timeline:** CWS initial review typically 1–7 business days. Extensions with OAuth or broad host permissions (`*://*.github.com/*`) are sometimes routed to manual review, which can extend to 2–3 weeks.

**What to watch for:**
- Email subject "Your item is pending review" → no action needed.
- Email subject "Your item has been rejected" or "Additional information required" → escalate to QM-105.
- Email subject "Your item has been published" → Phase 3 CWS complete.

**Output:** CWS item ID (visible in dashboard URL after upload), store listing URL once published.

### QM-105 — Handle CWS review rejection / resubmit (S, [store-ops])

Common rejection reasons for developer-tool extensions and mitigations:

| Rejection reason | Fix |
|---|---|
| "Remote code execution" | Confirm no `eval()`, no remote script loads. Add note to reviewer. |
| "Misleading description" | Soften any absolute claims in QM-101 copy. |
| "Insufficient permission justification" | Expand the permissions rationale in the submission notes (not the public description). |
| "Privacy policy insufficient" | Add explicit paragraph about GitHub API token scope to QM-109 doc, redeploy. |

**Process:** Read the rejection email carefully. If the reason is ambiguous, use the CWS developer support form to request clarification (response in 2–5 business days). Fix, resubmit. Each resubmit restarts the review queue.

**This story is conditional** — skip if QM-104 is approved on first submission.

### QM-108 — Submit to AMO (M, [store-ops])

**Steps (human performs):**
1. Log into [addons.mozilla.org/developers](https://addons.mozilla.org/en-US/developers/).
2. Submit new add-on → upload .xpi.
3. Select "Listed" distribution.
4. Attach `source-disclosure.zip` in the source code field.
5. Add reviewer notes: explain the OAuth flow, why `*://*.github.com/*` host permission is needed, and that the source zip reproduces exactly.
6. Fill in listing fields from `store-copy/amo-listing.md`.
7. Submit.

**Review timeline:** AMO initial automated review is near-instant for non-flagged extensions. Human review (required for extensions with broad permissions) typically takes several days to several weeks. AMO publishes an estimated queue time on the submission confirmation page — use that as the planning baseline.

**Output:** AMO add-on ID, listing URL once approved.

**Phase 3 DoD:** Both submissions confirmed received by respective stores (dashboard shows "Pending review" status). Estimated approval dates recorded so Phase 5 launch timing can be anchored.

---

## Phase 4 — Marketing site + docs (QM-112..117)

**Goal:** Marketing site live at the registered domain with working Stripe pricing CTA; docs site covering install, OAuth flow, and Pro features.

**QM-112 must finish before QM-113/114/115/116/117.** After scaffold, remaining pages run in parallel.

### QM-112 — Scaffold marketing site (M, [marketing-site] NEW REPO)

**Stack:** Astro + Tailwind CSS, deployed on Vercel (free hobby tier sufficient).

```bash
npm create astro@latest gh-pr-quick-merge-site -- --template minimal
cd gh-pr-quick-merge-site
npx astro add tailwind
```

**Repo:** Create `gh-pr-quick-merge-site` as a sibling repo under the same GitHub org. Do not add it to the extension monorepo — separate deployment lifecycle.

**Vercel setup:** Connect Vercel to the new repo. Set custom domain in Vercel dashboard → add CNAME record at registrar. Confirm `https://<domain>` resolves before QM-113 starts.

**Shared layout:** Create `src/layouts/Base.astro` with: nav (logo + "Pricing" + "Docs" + "Install" CTA button), footer (Privacy | Terms | Refund links pointing to Phase 1 pages), and Open Graph meta tags.

**Output:** Repo created, Vercel project connected, domain resolving, base layout committed.

### QM-113 — Landing page (L, [marketing-site], dep QM-120 GIF)

`src/pages/index.astro`

Sections:
1. **Hero:** Headline + subheadline + "Add to Chrome" + "Add to Firefox" buttons (link to store listings once live; placeholder anchor tags until Phase 3 completes). Embed the animated demo GIF (QM-120) in a browser chrome frame mockup.
2. **Features:** 3-column grid — Toolbar popup, One-click merge, Bulk merge. Icons from Heroicons (free, MIT).
3. **Social proof:** Placeholder for star count / testimonials (add real content post-launch).
4. **Pro callout:** 2-column card comparing Free vs Pro tier, CTA to `/pricing`.
5. **FAQ:** 5–7 questions covering OAuth trust, data privacy, refund policy.

**Note on GIF dependency:** The hero GIF (QM-120) can be a static screenshot placeholder until the GIF is produced; swap it in without a page rewrite. Do not block the landing page on the GIF.

### QM-114 — Pricing page (M, [marketing-site], dep server checkout)

`src/pages/pricing.astro`

- Two plan cards: Free (list features) and Pro (list additional features, show price, monthly/annual toggle).
- "Subscribe" button calls the Stripe Checkout session endpoint from Epic 3. The endpoint URL and publishable key go in Vercel environment variables (`STRIPE_PUBLISHABLE_KEY`, `CHECKOUT_API_URL`).
- FAQ section: "Do I need a credit card for the free tier? No.", "Can I cancel anytime? Yes, immediately in the customer portal.", "Is there a free trial? 7-day refund guarantee."
- Add a small "Powered by Stripe" badge for trust.

### QM-115 — Getting-started + OAuth walkthrough (M, [docs])

Docs can live as a `/docs` directory in the marketing site repo (`src/pages/docs/`) or a separate Docusaurus/Astro Starlight instance. Use Astro Starlight (integrated into the same repo) to keep deployment simple.

```bash
npx astro add starlight
```

Pages to write:
- `docs/getting-started.md`: Install from CWS/AMO → pin repos → see popup → merge a PR. Step-by-step with screenshots (reuse Phase 2 assets).
- `docs/oauth-walkthrough.md`: Why OAuth is needed, what scopes are requested (`repo` for private repos, `public_repo` for public-only), how to revoke, where the token is stored (device only).

### QM-116 — Pro-only feature docs (S, [docs])

- `docs/pro-features.md`: Bulk merge, repo selector, future roadmap items. Include a callout box: "Pro features require an active subscription — see Pricing."
- `docs/subscription-management.md`: How to upgrade, how to access the Stripe customer portal, how to cancel, refund policy summary with link.

### QM-117 — Troubleshooting guide (S, [docs])

- `docs/troubleshooting.md`: Table of common errors with causes and fixes.

Common errors to cover:

| Symptom | Likely cause | Fix |
|---|---|---|
| "Sign in" button loops | OAuth client-id mismatch (dev vs prod) | Reinstall from store; clear extension storage |
| Popup shows 0 PRs | Token lacks `repo` scope | Re-authenticate; grant correct scopes |
| Merge button grayed out | PR has failing checks or required reviews | Resolve upstream; or enable "merge anyway" in options |
| Pro features locked after payment | Subscription webhook not received | Check Stripe dashboard; contact support |

**Phase 4 DoD:** `https://<domain>` loads landing page with GIF or placeholder; `/pricing` shows Pro card with working Stripe CTA (test mode checkout completes); `/docs/getting-started` renders; all three legal pages linked from footer.

---

## Phase 5 — Launch (QM-118, QM-120, QM-119)

**Goal:** Coordinated asset production and outreach. Run QM-118 and QM-120 in parallel; QM-119 drafts in parallel but posts only after both stores are live.

### QM-118 — Demo video 60–90s (M, [creative])

**Script outline (90s at ~130 wpm = ~195 words):**
1. 0–10s: Problem hook. "You're context-switching to GitHub 20 times a day just to merge PRs."
2. 10–35s: Install + first merge. Show CWS install, pin to toolbar, click popup, see PR list, click merge.
3. 35–60s: Bulk merge flow. Pin two repos, select all ready PRs, merge in one click.
4. 60–80s: Pro pitch. "Upgrade for unlimited repos and bulk merge — link below."
5. 80–90s: Call to action + URL.

**Tooling:** Record with [Loom](https://www.loom.com) (free tier, 5-min limit — sufficient for 90s). Use Chrome's built-in screen recorder as fallback. Edit in Loom's trim tool or iMovie. Export as MP4 1080p. Upload to YouTube (unlisted initially, switch to public on launch day).

**Output:** YouTube URL, MP4 file.

### QM-120 — Animated demo GIF (S, [creative])

**Content:** 8–12s loop showing popup open → PR list → click merge → PR disappears. No audio.

**Tooling:**
1. Record the interaction as a short screen capture using QuickTime (Mac) or ShareX (Windows).
2. Convert to GIF using [ezgif.com](https://ezgif.com/video-to-gif): set FPS to 15, resize to 800px wide, optimize with lossy compression (quality 80) to keep file under 2MB.
3. Preview the loop — ensure the end frame cuts cleanly back to the start (trim if needed).

**Output:** `store-copy/demo.gif`, also placed in `gh-pr-quick-merge-site/public/demo.gif` for the landing page hero.

### QM-119 — Show HN + r/programming + newsletter outreach (M, [creative])

**Prepare drafts in parallel with QM-118/120; post only after both store listings are live.**

**Show HN post:**
- Title: `Show HN: PR Quick Merge – merge GitHub PRs from your browser toolbar`
- Body (3–4 short paragraphs): what it does, why it's different (no page load, works across multiple repos), tech stack highlight (Chrome extension + Firefox, OAuth only, no server for free tier), link to both stores and marketing site.
- Post on a weekday between 9–11am US Eastern for peak HN front-page window.
- **Do not** post until both store listings return "Published" status — HN readers will click immediately.

**r/programming post:**
- Different angle from Show HN: lead with the bulk-merge workflow story, not the product pitch.
- Follow r/programming rules: no vote manipulation, respond to every comment in the first 2 hours.

**Newsletter outreach:**
- Target 3–5 developer-focused newsletters: TLDR Dev, Cooper Press (JavaScript Weekly, Node Weekly), Bytes.dev.
- Prepare a 150-word sponsor/mention pitch: who it's for, what problem it solves, a link, a discount code if possible.
- Email editors at least 2 weeks before target launch date — most have 2–4 week lead times.

**Output:** `launch/show-hn-draft.md`, `launch/reddit-draft.md`, `launch/newsletter-pitch.md` in repo.

**Phase 5 DoD:** Video published on YouTube; GIF in repo and on landing page; Show HN post submitted; at least one newsletter pitch sent.

---

## Dispatch decision

Most Phase 1–2 work is copy and creative. **Run serially with Opus** for quality (Sonnet is fine for boilerplate pages but Opus produces better marketing copy). Phase 4 pages can be parallelised across two Sonnet agents (marketing site pages vs docs pages) once QM-112 scaffold is committed — that's the one case with clear file-touch boundaries and no shared state.

Human is the only executor for Phase 3 (store submissions) and Phase 5 posting.

---

## Open questions

1. **Domain choice:** Confirm the domain before Phase 1 starts — the privacy policy URL must not change after store submission. Preferred pattern: `prquickmerge.com` or `gh-pr-quick-merge.dev`. Record decision here: `___`.
2. **Marketing site repo location:** Separate repo (recommended — independent Vercel deployment, separate release cadence) vs subdirectory in extension monorepo. If monorepo: set up Vercel's root directory config to point at the site subfolder.
3. **Docs hosting:** Astro Starlight in the same site repo (simple) vs separate Docusaurus repo (more powerful search, heavier). Recommendation: Starlight for v1, migrate if docs volume grows past 20 pages.
4. **Newsletter budget:** Paid placements in TLDR/Cooper Press newsletters run $500–2,000 per issue. Decide whether to budget for a paid slot or rely on organic editorial pitches only.

---

## Verify

- CWS listing URL loads in Chrome and "Add to Chrome" button is active.
- AMO listing URL loads in Firefox and "Add to Firefox" button is active.
- `https://<domain>` loads without certificate warning.
- Clicking "Subscribe" on `/pricing` completes a Stripe test-mode checkout and returns to a success page.
- `/docs/getting-started` renders all screenshots without broken image links.
- All three legal pages (privacy, ToS, refund) are linked from footer and return HTTP 200.
- Show HN post URL is accessible (not flagged as spam).

## Definition of Done

- [ ] Both store listings in "Published" / "Approved" state.
- [ ] Marketing site live at `https://<domain>` with working Stripe CTA.
- [ ] Docs site live at `https://<domain>/docs`.
- [ ] Show HN post submitted; at least one newsletter pitch sent.
- [ ] Demo video published on YouTube.
- [ ] Demo GIF embedded on landing page hero.
