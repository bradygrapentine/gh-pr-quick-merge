# Demo video — 60–90 second script (QM-118)

> Target length: 90 seconds at ~130 wpm = ~195 words of voiceover. Recorded with Loom (free tier 5-min cap is plenty); exported MP4 1080p; uploaded to YouTube as **Unlisted** until launch day, then flipped to **Public**.

## Production notes

- **Browser:** Chrome with a clean profile. Window dimensions: 1280×800 (matches store screenshot dims).
- **Test data:** the same `gh-pr-qm-bot` fixture account used for screenshots. Three repos, ~10 PRs total, mix of mergeable and conflict states.
- **Cursor:** show the cursor (Loom default). Click rings on.
- **Audio:** record voice direct in Loom. Quiet room, USB mic preferred. If voiceover quality is poor, fall back to text overlays + background music (no voice).
- **Music (optional):** royalty-free ambient track from YouTube Audio Library at 30% volume below voice.
- **Captions:** auto-generate via YouTube Studio after upload, then proofread.

---

## Storyboard

### 0:00–0:10 — Problem hook

**Visual:** Fast-cut sequence of clicking through ~5 PRs the manual way: pulls list → click PR → scroll to bottom → click "Squash and merge" → wait → back arrow → next PR. Each click takes ~1.5s; the cumulative slowness is the point.

**Voiceover:**
> "If you maintain a couple of repos, you're context-switching to GitHub a dozen times a day just to merge pull requests. Click PR, scroll, merge, back, repeat."

### 0:10–0:35 — Install + first merge

**Visual:**
- Cut to Chrome Web Store page (placeholder until live; until then use a static frame of a CWS listing). One-click "Add to Chrome".
- Cut to extension's options page. Click "Sign in with GitHub". Show the OAuth Device Flow code.
- Cut to github.com/pulls. Show the injected Squash / Merge / Rebase buttons appearing on each row.
- Click Squash on one PR. Confirmation toast appears. Row clears.

**Voiceover:**
> "Install PR Quick Merge from the Chrome Web Store, sign in with GitHub's OAuth Device Flow — your token stays on your machine, never on our server — and the buttons appear on every row of your pulls list. One click. Done. No tab switch."

### 0:35–0:60 — Bulk merge across repos

**Visual:**
- Open the toolbar popup. Show three pinned repos with mergeable counts.
- Click "Bulk merge" mode. Select two repos. Counter at the bottom: "Merging 7 PRs across 2 repos."
- Click "Merge selected." Watch the count tick down to zero.

**Voiceover:**
> "Pin the repos you maintain. The popup shows you what's ready. Need to clear seven dependabot PRs across two repos? Bulk merge takes one click."

### 0:60–0:80 — Privacy + open source

**Visual:**
- Cut to docs/privacy-policy.md displayed in browser.
- Cut to GitHub repo source code.
- Cut to options page showing "Default merge method per repo."

**Voiceover:**
> "No analytics. No third-party trackers. No first-party server. Your browser talks directly to GitHub's API. Open source on GitHub. Configure default merge method per repository if some of your projects squash and others rebase."

### 0:80–0:90 — Call to action

**Visual:** Static end card with extension icon, product name, both store URLs.

**Voiceover:**
> "Free on the Chrome Web Store and Firefox Add-ons. PR Quick Merge — link below."

---

## Deliverables

- [ ] Raw recording (.mov from Loom or QuickTime) saved at `creative/launch/demo-master.mov` (NOT committed — too large; saved to local backup or YouTube unlisted)
- [ ] YouTube unlisted URL recorded in this file once uploaded
- [ ] Final URL substituted into landing page hero (when marketing site lands per Phase 4 of the plan)
- [ ] First 5 seconds verified to "hook" without sound (many viewers preview muted)
- [ ] Captions proofread

## URLs (fill in once recorded)

- YouTube unlisted: `<TBD>`
- YouTube public (post-launch): `<TBD>`
