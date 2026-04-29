# CWS / AMO screenshot specifications (QM-102)

> Five screenshots, 1280×800 PNG, captured against a real browser session with seeded test PRs. CWS minimum: 1, recommended: 5. AMO accepts the same set.

## Tooling

1. Use a clean Chrome / Firefox profile with no other extensions enabled.
2. Use a fixture GitHub account (`gh-pr-qm-bot`) with three sandbox repositories. Each repo seeded with 3–5 stub PRs (titles match the patterns in `test/e2e/helpers/fixture-repo.ts` once that helper lands in the quality branch).
3. Capture at logical 1280×800 viewport. In Chrome DevTools: **Toggle device toolbar → Responsive → 1280×800 → 100%**. In macOS native: command-shift-4 + window selector at the right zoom level.
4. Annotate in Figma free tier or Canva: 2px brand-color border (use `#0969da`, GitHub's primary blue, for visual coherence with GitHub itself), drop shadow optional, callout labels in a sans-serif (Inter or system-default).
5. Export as PNG, ≤ 5 MB per file.

## Naming convention

```
creative/store-copy/screenshots/cws-01-popup-overview.png
creative/store-copy/screenshots/cws-02-merge-action.png
creative/store-copy/screenshots/cws-03-bulk-flow.png
creative/store-copy/screenshots/cws-04-options.png
creative/store-copy/screenshots/cws-05-oauth-signin.png
```

(Same files re-used for AMO; rename `cws-` → `amo-` only if a screenshot needs Firefox-specific chrome.)

## Shots

### 1. `cws-01-popup-overview.png` — Toolbar popup, 3 repos pinned

**Subject:** Extension popup open. Three pinned repos visible. Each row shows a count badge (e.g. "2 ready", "5 ready", "0 ready"). Active "Merge all" button on the row that has the most PRs ready.

**Annotation callouts:**
- Top-right: "Pinned repos with mergeable count"
- Bottom: "Click any row to expand the PR list"

**State setup:**
- Pin: `gh-pr-qm-bot/sandbox-frontend` (2 ready)
- Pin: `gh-pr-qm-bot/sandbox-api` (5 ready, 1 conflict)
- Pin: `gh-pr-qm-bot/sandbox-infra` (0 ready)

### 2. `cws-02-merge-action.png` — Single-click merge in flight

**Subject:** github.com/pulls list view. One PR row highlighted with a Squash button glowing or a confirmation toast at the top-right ("Merged PR #42 in sandbox-frontend"). MUST be a static frame — animated GIFs are rejected.

**Annotation callouts:**
- Pointing at the injected button: "PR Quick Merge button — squash, merge, or rebase from here"
- Pointing at the toast: "Confirmation appears when the merge completes (~1s on average)"

### 3. `cws-03-bulk-flow.png` — Bulk-merge selector

**Subject:** Popup expanded into bulk-merge mode. Two repos selected via checkboxes. Counter at the bottom: "Merging 7 PRs across 2 repos". Big "Merge selected" button.

**Annotation callouts:**
- Top: "Bulk merge across multiple pinned repos in one click"
- Bottom: "Confirms total + estimated time before submitting"

### 4. `cws-04-options.png` — Options page

**Subject:** Options page. Three sections visible: Auth (OAuth Device Flow with Client ID field), Pinned repos (list with add/remove), Default merge method per repo (radio buttons or dropdown).

**Annotation callouts:**
- "OAuth Device Flow — your token never transits a server"
- "Per-repo default merge method (Squash / Merge / Rebase)"

### 5. `cws-05-oauth-signin.png` — Device Flow code

**Subject:** Options page after clicking "Sign in with GitHub". One-time device code displayed. "Copy code & open GitHub" button highlighted.

**Annotation callouts:**
- "GitHub OAuth Device Flow — no client secret, no server-side token storage"
- "Your access token is stored only in chrome.storage.local on your device"

---

## Thumbnail legibility check

CWS shows screenshots at 176×112 thumbnails on the listing page. Before submitting, view each PNG at that size:

```bash
# macOS quick-check
sips -Z 176 cws-01-popup-overview.png --out /tmp/thumb.png && open /tmp/thumb.png
```

If text is unreadable at 176×112, reshoot with: larger UI scale (browser zoom 110%), or fewer simultaneous callouts, or higher-contrast annotations.

## Pre-submission verification

- [ ] All 5 PNGs exist at the paths above
- [ ] Each ≤ 5 MB
- [ ] Each at 1280×800 (verify with `sips -g pixelWidth -g pixelHeight <file>` or `identify` from ImageMagick)
- [ ] No dev-mode artifacts visible (no `chrome://extensions` "Load unpacked" badge, no DevTools panels)
- [ ] No personal data visible (real PR titles, author avatars from your own account, etc.) — use the fixture account only
- [ ] Thumbnails legible at 176×112
