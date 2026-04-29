# Store submission guide — human-in-loop steps (QM-104, QM-108)

> All artifacts (listings, screenshots, source disclosure) live under `creative/store-copy/`. This guide walks the human submitter through the dashboard clicks. Skipped by automation; **do not** auto-submit — both stores require interactive consent flows and reviewer-notes that must be a human's words.

## Pre-flight checklist (before either submission)

- [ ] v1.0 release tagged on `main`
- [ ] `npm test` green on the tagged commit
- [ ] `npm run package` produces `web-ext-artifacts/gh_pr_quick_merge-<VERSION>.zip` AND `.xpi`
- [ ] SHA256 of both artifacts recorded in the GitHub release notes
- [ ] All five screenshots exist at `creative/store-copy/screenshots/cws-*.png` (actual files — specs are in `screenshot-specs.md`; capturing is a manual step)
- [ ] Promotional tile + marquee exist at `creative/store-copy/cws-tile-440x280.png` and `cws-marquee-1400x560.png`
- [ ] Privacy policy URL is publicly reachable: `https://github.com/bradygrapentine/gh-pr-quick-merge/blob/main/docs/privacy-policy.md`
- [ ] Source-disclosure zip built via `BUILD.md` recipe and SHA-verified

## QM-104 — Submit to Chrome Web Store

1. Sign in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). One-time $5 developer-account fee required.
2. Click **New Item** → upload `gh_pr_quick_merge-<VERSION>.zip`. Wait for the upload to validate (~30s).
3. **Store listing tab:**
   - Paste **Name**, **Short description**, and **Detailed description** verbatim from `creative/store-copy/cws-listing.md`.
   - Set **Category** = Developer Tools, **Language** = English.
   - Upload all five screenshots (1280×800).
   - Upload promotional tile (440×280) and marquee (1400×560).
4. **Privacy tab:**
   - Paste the privacy policy URL.
   - Fill in the **Single-purpose** field with the line from `cws-listing.md`.
   - Fill the **Permission justifications** for each requested permission — paste from the corresponding section of `cws-listing.md` into the *reviewer notes*, NOT the public description.
   - Complete the **Data usage disclosure** form exactly as the table in `cws-listing.md` shows.
   - Tick all three certification boxes (don't sell data, don't use for unrelated purposes, don't determine creditworthiness).
5. **Distribution tab:**
   - Visibility: **Public**.
   - Distribution regions: **All regions** (no export-controlled jurisdictions for a dev tool).
   - Pricing: Free.
   - Set **Staged rollout: 10%** for the first release. (If staged-rollout SOP `docs/sop-staged-rollout.md` is in place once group-ops merges, follow that.)
6. Click **Submit for review**. Record the CWS item ID (visible in the dashboard URL).
7. Watch your developer email account daily. Typical outcomes:
   - **"Pending review"** → no action needed. Initial review is 1–7 business days; OAuth + broad-host extensions sometimes take 2–3 weeks.
   - **"Additional information required"** → respond within the response window with whatever the reviewer asked for. Re-read `cws-listing.md` and update if anything's outdated.
   - **"Rejected"** → see QM-105 (CWS resubmit) procedure. Common causes documented in `plans/v1-distribution-and-marketing.md`.
   - **"Published"** → record the listing URL; flip to QM-119 launch posts only AFTER both stores publish.

## QM-108 — Submit to Firefox AMO

1. Sign in to [addons.mozilla.org/developers](https://addons.mozilla.org/en-US/developers/). AMO developer accounts are free.
2. Click **Submit a New Add-on**.
3. **Distribution choice:** Listed (public).
4. Upload `gh_pr_quick_merge-<VERSION>.xpi`. Wait for automated validation; warnings about manifest v3 fields may surface — most are advisory, not blockers.
5. **Source code:** AMO requires source disclosure for any extension that bundles, minifies, or transforms source. PR Quick Merge does not minify, but disclose anyway because (a) `web-ext` zips with a different file order than the source tree, and (b) reviewers prefer explicit submission.
   - Build `source-disclosure.zip` per `creative/store-copy/BUILD.md`.
   - Upload it via the source-code field.
6. **Add-on listing fields:**
   - Paste **Name**, **Summary**, **Description** from `creative/store-copy/amo-listing.md`.
   - Set **Categories** = Developer Tools + Other.
   - Add tags listed in `amo-listing.md`.
   - Set **Support URL** and **Homepage URL**.
   - License: MIT.
7. **Notes for reviewer:** paste the entire "Reviewer notes" block from `amo-listing.md`. This is critical — AMO reviewers rely on this field to understand the OAuth Device Flow choice and host-permission justifications.
8. **Submit.** AMO shows an estimated review-queue time on the confirmation page; record it.
9. Possible outcomes:
   - **Approved (auto)** — uncommon for extensions with broad host permissions; if it happens, listing is live within 5 minutes.
   - **Pending human review** — typical. Several days to several weeks. Check email and `addons.mozilla.org/developers/addons/<id>` daily.
   - **Rejected with revision request** — fix per the reviewer's email; resubmit.
10. Once "Approved" / "Public," record the AMO listing URL and add-on ID.

## After both stores publish

- Update `creative/launch/show-hn-draft.md` and `creative/launch/reddit-draft.md` with the real store URLs.
- Tag `gh-pr-quick-merge` repo with `v1.0.0` if not already done.
- Coordinate Show HN post timing per `show-hn-draft.md` (weekday 9–11am US Eastern).

## What if a store rejects v1.0?

- **CWS rejection:** see `plans/v1-distribution-and-marketing.md` Phase 3 / QM-105 for the rejection-reason → fix table.
- **AMO rejection:** the rejection email cites a specific manifest field or behavior. Most common: a permission whose purpose isn't clear from the source. Update `amo-listing.md` reviewer notes accordingly and resubmit.
- Do NOT delay the AMO Phase 5 launch posts on a CWS rejection (or vice versa) — partial-store launches still produce traction. Just make sure the launch posts link only to the store(s) where the listing is actually live.

## Status tracking

After submitting, update this table at the bottom of the document so the project's status is visible at a glance:

| Store | Submitted | Status | URL | Item ID | Notes |
|---|---|---|---|---|---|
| CWS | | Pending | | | |
| AMO | | Pending | | | |
