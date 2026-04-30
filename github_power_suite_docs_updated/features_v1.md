# V1 Features

## Core
- PR buttons on /pulls page (merge, squash, rebase)
- Enhanced PR buttons (loading, disabled states, confirmations)

## Metadata
- CI status badge
- PR size badge
- Stale indicator
- Comments indicator + jump

## Interaction
- Quick filter bar (mine, ready, stale, small)
- Ready-to-merge highlight
- Noise toggles (dependabot, drafts)

## Batch Operations
- Multi-select PRs
- Batch merge/squash/rebase

## PR Page Enhancements
- Distinct action indicators (approve, rebase, merge)
- Safety confirmations


## PR Page: Always-Visible Rebase Button

Add a visible **Rebase / Update Branch** button directly on individual PR pages instead of requiring users to open GitHub's merge status panel.

### Problem

GitHub can show a PR as "ready to merge" while still requiring or recommending a branch update/rebase behind the merge status panel. This creates a red herring where the user thinks the PR is merge-ready, but CI/review workflow still needs an update.

### Value

- Eliminates hidden workflow state
- Reduces accidental merge/review confusion
- Makes "rebase needed" obvious
- Saves clicks for CI-heavy workflows
- Fits V1 philosophy: surface control from higher-level or more visible pages

### Behavior

- Detect when GitHub exposes an update/rebase action in the merge status panel
- Render a persistent button near the PR action area
- Button label options:
  - `Rebase`
  - `Update Branch`
  - `Rebase / Rerun CI`
- Use warning-style indicator because this may retrigger CI
- Show confirmation:
  `This may update the branch and retrigger CI. Continue?`

### Visual Treatment

- Rebase button: yellow/warning style
- Merge button: green/success style
- Approve button: blue/info style
- Squash button: purple/history-change style
