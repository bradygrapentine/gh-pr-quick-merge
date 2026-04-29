# Animated demo GIF spec (QM-120)

> 8–12 second loop, no audio. Used in: README hero, landing-page hero, GitHub social-card preview.

## Content

A single uninterrupted action: open popup → see PR list → click Squash on top PR → row disappears → return to neutral state ready to loop.

```
0.0s   start: github.com/pulls visible, toolbar idle
0.5s   click extension icon, popup opens
1.5s   popup shows 3 repos, top one expanded with 2 PRs
3.0s   cursor moves to "Squash" button on first PR
4.0s   click — toast appears: "Merged PR #42"
5.5s   PR row fades out
7.0s   popup updates: count drops from 2 to 1
8.5s   loop seam: back to popup-just-opened state
```

The seam from frame 8.5s back to frame 0.0s should be visually continuous (popup remains open in both, list state matches modulo the merged PR). Test the loop in a browser; if the cut is jarring, trim 0.5s off either end.

## Tooling

```
1. Record with QuickTime (macOS) or ShareX (Windows) at 1280×800, 30 fps. Capture only the relevant browser region (~960×600) to keep file size down.

2. Trim in iMovie or QuickTime to exactly the loop length.

3. Convert to GIF via ezgif.com:
   - FPS: 15 (halves file size vs 30; eyes don't notice for UI demo)
   - Resize: 800px wide (down from 1280; keeps text legible)
   - Optimize: lossy compression at quality 80
   - Loop: infinite

4. Verify file < 2MB. If larger, drop FPS to 12 or width to 720.

5. Save as creative/launch/demo.gif and (when marketing site exists) copy to that repo's public/demo.gif.
```

## Brand consistency

- Same fixture account (`gh-pr-qm-bot`), same repo names, same PR titles as the screenshot set.
- Same browser chrome (Chrome on macOS Sonoma — neutral, recognizable).
- Cursor visible throughout; click rings on (so the user can see "click happened" without audio cues).

## Where the GIF gets used

| Surface | Path / URL |
|---|---|
| README hero | embedded via `![demo](creative/launch/demo.gif)` near top |
| Landing page hero | swapped in for the static placeholder when the marketing site goes live |
| GitHub social card (Open Graph) | static first frame, NOT the GIF (OG previews don't animate) |
| Show HN post | NOT included in the post body (HN strips images); link to the README which embeds it |

## Pre-publish verification

- [ ] File ≤ 2 MB
- [ ] Exact dimensions: 800px wide
- [ ] Loop is seamless (visually verify by watching 3 cycles)
- [ ] Text in popup is legible at full GIF size and at 50% zoom
- [ ] No personal data visible (real PR titles, avatars, etc. — fixture account only)
- [ ] First frame works as a static thumbnail (it'll show for users with reduced-motion preferences)
