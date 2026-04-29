# CWS promotional tile + marquee — design spec (QM-103)

> Optional but recommended for CWS featuring consideration. Not required by AMO.

## Brand fundamentals

| Token | Value |
|---|---|
| Primary | `#0969da` (GitHub blue — visual coherence with the surface the extension lives on) |
| Background | `#ffffff` (light) and `#0d1117` (dark variant for marquee mock) |
| Accent | `#1f883d` (mergeable-green from GitHub's own merge button) |
| Type | `Inter` 600 for product name; `Inter` 400 for tagline. Fallback: system-ui sans. |

If `Inter` is not available locally, substitute SF Pro (macOS) or Segoe UI (Windows) — both have similar geometry and licensing terms.

## Promotional tile (440 × 280 px)

**Layout:**

```
+-----------------------------------------+
|                                         |
|   [icon@64]  PR Quick Merge             |
|                                         |
|   Merge GitHub PRs from your toolbar.   |
|                                         |
|                                         |
+-----------------------------------------+
```

- 32px outer padding
- Extension icon at 64×64 px, top-left
- Product name in Inter 600, 28px, primary color text on white background
- Tagline in Inter 400, 16px, GitHub neutral-600 (`#57606a`)
- No screenshots, no UI chrome, no logos other than the extension icon
- Rounded corners not needed (CWS crops with its own mask)

**Output file:** `creative/store-copy/cws-tile-440x280.png`

## Marquee banner (1400 × 560 px)

Used in CWS's "Featured" carousel and at the top of the listing page on wide viewports.

**Layout:**

```
+----------------------------------------------------------+
|                                              +---------+ |
|  PR Quick Merge                              |         | |
|                                              | popup   | |
|  Squash, merge, or rebase GitHub             | screenshot|
|  pull requests directly from the list.       |         | |
|                                              +---------+ |
|  github.com/bradygrapentine/gh-pr-quick-merge            |
+----------------------------------------------------------+
```

- 64px outer padding
- Left half: product name (Inter 600, 56px) + tagline (Inter 400, 24px) + URL (Inter 400, 16px, `#57606a`)
- Right half: cropped screenshot of the popup (uses `cws-01-popup-overview.png` cropped to 480×360 with a soft shadow). Screenshot must be a STATIC PNG, not a frame from a video.
- Background: subtle vertical gradient `#ffffff` → `#f6f8fa` (GitHub's own canvas-subtle).
- No people, no faces, no third-party logos.

**Output file:** `creative/store-copy/cws-marquee-1400x560.png`

## Source files

Maintain Figma source so updates don't require restarting from scratch:

```
creative/store-copy/figma-source/
  promotional-tile.fig
  marquee.fig
```

If Figma free tier is unavailable, Canva pro is acceptable — keep both `.fig` (or `.canva` link) AND the exported PNGs in this directory.

## Pre-submission verification

- [ ] `cws-tile-440x280.png` exists, exactly 440×280 px (verify `sips -g pixelWidth -g pixelHeight`)
- [ ] `cws-marquee-1400x560.png` exists, exactly 1400×560 px
- [ ] Both files ≤ 1 MB
- [ ] Text legible when displayed at 50% size (CWS sometimes downsamples)
- [ ] No copyrighted or third-party brand assets used
- [ ] Source `.fig` files committed (or share-link recorded) so future versions can edit, not re-create
