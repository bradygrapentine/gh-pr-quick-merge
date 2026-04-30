# `/refine` sweep — all components

**Status:** ready
**Base SHA:** `0fffa5c`
**Goal:** apply the impeccable 8-pass refine pipeline (layout, typeset, colorize, bolder, quieter, animate, delight, overdrive) to every UI component in the extension. One PR per component.

## Scope reality

`/refine` is heavy. Each component runs through 8 sub-passes; each sub-pass touches CSS, sometimes markup, sometimes JS. On the design-handoff surfaces (popup, options, row widget) a single full refine pass is roughly a 1500-line PR, not a 50-line tweak. Doing all 8 components in one session is **not realistic** — the right framing is one PR per component spread across multiple sessions.

This plan defines the order; the executing session picks one component and runs `/refine` on it end-to-end.

## Components, prioritized by user-facing surface area

| # | Component | Source | Why this order |
|---|-----------|--------|----|
| 1 | Popup | `popup.html`/`.js`/`.css` | Most-visited surface; first impression |
| 2 | Row widget | `lib/qm-row-widget.js` + theme.css §row | Highest interaction count per user per day |
| 3 | Bulk merge bar | `content.js` ensureBulkBar + styles.css §bulk | High-stakes; runs the big-batch merges |
| 4 | Options shell | `options.html` + `options-shell.js` + theme.css §options | Long-tail config; lots of dense form UI |
| 5 | Onboarding card | `lib/qm-onboarding.js` + popup.css §onboarding | First-run, can't afford to feel rough |
| 6 | Toast stack | `lib/qm-toast.js` + theme.css §toast | Persistent feedback channel |
| 7 | Label picker modal | `lib/label-picker.js` + styles.css §label-picker | New surface (QM-172); never refined |
| 8 | Sponsor / Pro card | `content.js` showProGate + styles.css §sponsor | Shipped in stage 1 design pass, due for refresh |

## Per-component workflow

For each component:

1. New branch `refine/<component-slug>` off latest main.
2. Invoke the `impeccable:impeccable` skill against the component (refine cycle = layout → typeset → colorize → bolder → quieter → animate → delight → overdrive). Skill drives the eight passes.
3. After each pass: `npm test` green, syntax check.
4. After all passes: regenerate Linux visual baselines via Docker if popup or options markup changed (see `feedback_playwright_visual_baselines_per_platform.md`).
5. Commit per pass (8 commits) so reviewers can step through individual changes.
6. Open PR titled `refine: <component> — full impeccable pass`. Auto-merge once green.

## Verification per PR

- 381+ unit tests still pass
- All e2e flows green
- Visual baselines refreshed if any rendered surface changed
- Manual smoke for the targeted component (popup actually opens, row widget renders, bulk bar shows, options panes navigate, etc.)

## Out of scope

- New features. Refine only restyles / re-arranges; it doesn't change behavior.
- Surfaces marked deferred elsewhere (QM-205 Inter Tight font vendoring stays out — it's a separate AMO/CSP review).
- The empty-state and stale-banner micro-surfaces — they get pulled along when their parent component refines.

## Order of execution

This session will run **#1 Popup** AND **#2 Row widget** end-to-end as a deliberate comparison set:
- Popup is the largest surface (header, summary, list, manage box, footer, onboarding slot).
- Row widget is the smallest interactive primitive (status pill, primary button, caret, menu).

Running both lets us compare how the impeccable refine cycle scales between a sprawling page and a focused component. Each ships as its own PR. Subsequent components (#3–#8) wait for separate sessions.
