# DOM & Injection Strategy

## Page Detection

- /pulls page
- /pull/{number} page

## PR Row Detection

- Locate anchor tags with /pull/{number}
- Traverse to parent row container

## Injection Points

- Badges: next to PR title
- Buttons: right side of PR row
- Filters: above PR list

## Idempotency

Use data attributes:
- data-gps-actions
- data-gps-badges
- data-gps-filterbar

## Dynamic DOM Handling

Use MutationObserver to re-run injection when GitHub updates DOM


## PR Page Rebase Button Injection

### Page Detection

```ts
function isPullRequestPage() {
  return /^\/[^/]+\/[^/]+\/pull\/\d+/.test(location.pathname)
}
```

### Strategy

1. Detect the individual PR page.
2. Locate the primary PR action area near the merge/status box.
3. Check whether GitHub exposes an update/rebase action inside the merge status panel.
4. If found, clone/bridge that action into a persistent visible button.
5. Add warning styling and confirmation.
6. Mark injected element with `data-gps-visible-rebase="true"`.

### Preferred Mount Location

Near the main PR status/merge controls:

```txt
[Approve] [Rebase / Update Branch] [Merge] [Squash & Merge]
```

### Fallback Behavior

If the native GitHub rebase/update action cannot be safely called:

- Render a disabled indicator:
  `Rebase available in merge panel`
- Add a helper button:
  `Open merge panel`
- Do not attempt unsupported DOM clicks blindly.

### Idempotency

```ts
if (document.querySelector('[data-gps-visible-rebase="true"]')) return
```

### Safety

The button should warn the user that rebasing/updating can retrigger CI and affect reviewer expectations.
