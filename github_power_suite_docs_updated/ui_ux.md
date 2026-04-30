# UI / UX Design

## Principles

- Native GitHub feel
- Minimal intrusion
- Fast scanning

## Components

### PR Row

[Title] [CI] [Size] [Stale] [Comments] [Actions]

### Filters

[Mine] [Ready] [Stale] [Small]

### Batch Toolbar

Appears when PRs selected

## Color System

- Green: Merge (final action)
- Yellow: Rebase (mutating)
- Blue: Approve (review)
- Purple: Squash (history change)
- Red: Close (destructive)


## PR Page Action Clarity

Individual PR pages should visually distinguish review actions from branch mutation and final merge actions.

### Always-Visible Rebase

The extension should surface a visible rebase/update button whenever GitHub hides that action behind the merge status panel.

```txt
[Approve] [Rebase / Update Branch] [Merge] [Squash & Merge]
```

### Rationale

GitHub can make a PR appear ready while branch update/rebase status is hidden inside the merge panel. A persistent warning-style rebase control reduces accidental workflow mistakes.

### Action Colors / Indicators

- Approve: blue/info
- Rebase / Update Branch: yellow/warning
- Merge: green/success
- Squash & Merge: purple/history-change
- Close: red/danger
