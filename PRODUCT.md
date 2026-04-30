# Product

## Register

product

## Users

Engineers who manage open pull requests across multiple repositories every day, primarily inside the github.com PR list. They live in the merge queue: a typical user pins 5–30 repos, sweeps through ready-to-merge PRs in batches, and wants the friction-per-merge to be as close to zero as the underlying GitHub API allows. Many work at small teams where they're both the author and the reviewer of their own merges; others are tech leads triaging contributor PRs across an org.

The extension lives inside two contexts: (1) injected into github.com PR list rows, where it competes for attention with GitHub's own chrome; (2) the toolbar popup + options page, where it's a focused config and pinned-repo overview surface. Users open the popup multiple times a day. They open the options page once during setup and rarely after.

## Product Purpose

PR Quick Merge collapses the standard merge gesture from "click PR → wait for page → find merge button → pick method → confirm" into a single in-line action on the PR list page. It also adds bulk operations (merge / close / label many at once), an opinionated row widget that surfaces mergeability state, a pinned-repo summary in the popup, and Sentry-gated crash reporting (opt-in). It does not host data, does not run a server, does not require an account beyond a GitHub OAuth or PAT token. Success looks like: a regular user merges 10+ PRs in under a minute without ever leaving the PR list.

## Brand Personality

Confident, opinionated, distinctive. Voice is terse-technical — no "let's", no "awesome", no apology language. Visual language has a clear signature accent (currently a saturated blue, configurable via the Tweaks pane) carried across the brand mark, primary CTAs, the row widget's active state, and the EXT/SETTINGS tag chips. The tool wants users to recognize at a glance which UI is extension-added vs native GitHub. Lineage: closer to Vercel CLI dashboards or Stripe's docs than to Linear's reserved minimalism — willing to take a stance, willing to occupy real estate when a primary action deserves it.

## Anti-references

- **Brutalist / loud dev-tool aesthetic.** No raw monospace everywhere, no neon-on-black, no exposed-grid maximalism. The tool is used many times per day; legibility and calm rhythm matter more than visual maximalism.
- **Generic Chrome-extension default.** No flat tab-row settings page, no system-default form controls, no '90s preferences-pane vibe. Must feel intentionally designed.
- **Generic SaaS dashboard template.** No hero-metric tiles, no purple-gradient cards, no "features grid" on the popup, no stock illustrations.
- **Verbatim re-skin of GitHub's own UI.** The extension's affordances must be visually distinct from GitHub's native buttons so users always know which surface is doing what.

## Design Principles

1. **Earned attention.** Visual weight is reserved for the primary action on each surface. The Merge CTA in the row widget gets accent color; the rest of the row stays neutral. The popup's summary stat is the loudest element above the fold.
2. **Committed accent.** The brand color (--qm-accent) carries 30–60% of any given surface — primary CTAs, brand mark, status pills, active rows. Not "≤10% sprinkled accent." The extension announces itself.
3. **Inhabit GitHub, but distinct from it.** Visual signature (rounded pill widgets, tinted neutrals via OKLCH, the wordmark + EXT chip) must be obvious next to GitHub's native chrome. Users should never confuse extension-added affordances for GitHub's.
4. **Density is intentional.** Compact mode is a real choice (data-qm-density="compact" already wired). Default is comfortable; users who manage 50+ PRs at once flip to compact. Spacing varies for rhythm — same padding everywhere is monotony.
5. **Keyboard-first when active, hover-first when ambient.** The row widget's "▶ S to squash" hint only appears on hover and only when shortcut mode is active. Don't flood the surface with keyboard glyphs.

## Accessibility & Inclusion

- WCAG AA at minimum on all light + dark theme combinations. AAA contrast on primary CTAs and status pills (READY / BEHIND / BLOCKED / DRAFT) since they communicate semantic state.
- Respect `prefers-reduced-motion` — the bulk-bar shimmer and row-widget spinner have non-animated fallbacks.
- Respect `prefers-color-scheme` — auto theme follows OS unless overridden in Tweaks.
- Keyboard reachability for every interactive surface in the popup and options. Focus rings use the brand accent at 4px outline-offset for 3:1 contrast against GitHub's surface.
- Sentry crash reporting is **opt-in only** (qm_sentry_consent toggle in options Privacy section). Default off.
