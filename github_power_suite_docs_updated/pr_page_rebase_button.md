# PR Page Always-Visible Rebase Button

## Summary

Add a persistent rebase/update-branch button to individual GitHub PR pages so users do not need to open the merge status panel to discover or trigger rebasing.

## Problem

GitHub sometimes presents a PR as ready to merge while the branch still needs to be updated/rebased or while the relevant action is hidden in the merge status panel. This causes confusion, especially when working with reviewers and CI-heavy workflows.

## User Story

As a developer managing PRs with CI, I want to see and trigger rebase/update actions directly on the PR page so I do not mistake a hidden branch-status issue for true merge readiness.

## MVP Behavior

- Detect individual PR pages.
- Detect whether an update/rebase action exists in GitHub's merge status panel.
- Surface a visible warning-style button near the main PR action controls.
- Confirm before executing.
- Show loading/success/failure state.
- Avoid duplicate rendering after GitHub soft navigation.

## UI

```txt
[Approve] [Rebase / Update Branch] [Merge] [Squash & Merge]
```

## Safety Copy

Before action:

```txt
This may update the branch and retrigger CI. Continue?
```

After success:

```txt
Branch update started. CI may rerun.
```

After failure:

```txt
Could not update branch. Open GitHub's merge panel for details.
```

## DOM Strategy

- Use PR page route detection.
- Locate merge/status area.
- Detect native GitHub update/rebase control.
- Prefer calling the underlying GitHub action through the existing button or GitHub API if safe.
- If unable to execute safely, provide a visible shortcut to reveal the merge panel.

## Acceptance Criteria

- A visible rebase/update button appears on PR pages when the action is available.
- The button uses warning-style visual treatment.
- The user receives a confirmation before the action.
- The feature survives GitHub soft navigation.
- The feature does not duplicate buttons.
- The feature does not falsely show rebase as available when unavailable.
