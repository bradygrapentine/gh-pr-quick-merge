# Chrome Web Store listing — v1.1.0

For copy-paste into the CWS Developer Dashboard. All fields below match the dashboard's labels.

---

## Item name (45 char max)

```
PR Quick Merge — Merge from List
```
*(31 chars)*

## Summary (132 char max)

```
Merge, squash, or rebase pull requests directly from GitHub's PR list. Auto-merge when CI is green. Bulk actions, smart filters.
```
*(131 chars — counted)*

## Category

`Developer Tools`

## Language

`English (United States)`

---

## Detailed description (16,384 char max)

```
PR Quick Merge adds merge/squash/rebase buttons to GitHub's pull request list page so you can ship work without clicking into each PR. It's open source, free, and donation-funded.

WHAT IT DOES

• One-click merge / squash / rebase from the PR list — no more "open the PR, scroll to the bottom, click the green button, choose method, confirm" cycle for each one.
• Auto-Merge: queue a PR to merge automatically the moment CI turns green. Click again to stop watching.
• Auto-Rebase before merge: per-PR opt-in. If a PR is N commits behind base, the extension silently rebases first, then merges.
• Update Branch: one-click rebase or merge of base into a PR's head branch.
• Resolve Conflicts: when a PR is conflicting, a one-click pill opens GitHub's web conflict editor.
• Bulk actions: select multiple PRs and merge / close / label all at once. Typed-confirm dialog for safety.
• Quick filters: Mine / Ready / Hide bots / Stale / Small. Saved per-browser.
• Row metadata badges: PR size (XS/S/M/L/XL), CI status, stale-PR highlight, behind-base count.
• Per-repo defaults: pick squash for repo A, merge commit for repo B; remembered.
• Per-repo merge templates: customize commit messages.
• Custom keyboard shortcuts.
• Dark + light themes. Respects your GitHub theme.

PRIVACY

Nothing leaves your browser. The extension uses YOUR GitHub access token (stored only in your browser's local storage) to call api.github.com directly. PR data, repo names, and merge actions never touch our servers — because we don't run any.

Crash reports are OPT-IN and disabled by default. If you turn them on (Options → Crash reports), redacted stack traces are sent to Sentry to help fix bugs. You can turn them off any time.

Full privacy policy: https://bradygrapentine.github.io/gh-pr-quick-merge/privacy-policy.html

PERMISSIONS

• "storage" — to remember your settings and per-repo defaults.
• "alarms" — to wake the background poller for Auto-Merge.
• "management" — to read your installed extension list (used to detect a known compatibility issue with a popular GitHub theming extension).
• Host permissions for github.com — to inject the merge buttons and call the GitHub API.

The extension does NOT request access to other sites, your browsing history, or your tabs.

DONATION-FUNDED

PR Quick Merge is free and open source under the MIT license. If it saves you time, GitHub Sponsors keeps it maintained:
https://github.com/sponsors/bradygrapentine

REPORTING BUGS

GitHub Issues: https://github.com/bradygrapentine/gh-pr-quick-merge/issues
Source code: https://github.com/bradygrapentine/gh-pr-quick-merge
```

---

## Promotional images

| Slot | Size | Status | Notes |
|---|---|---|---|
| Small promo tile | 440×280 | TODO | Use brand mark + "Merge from list" tagline |
| Marquee | 1400×560 | OPTIONAL | Skip for v1.1; not required |
| Screenshots ×5 | 1280×800 | TODO | See screenshot list below |

### Screenshots to capture

1. **PR list with merge buttons** — three PRs in different states (clean, behind base, blocked), action cluster on the right. Caption: *"Merge / squash / rebase any PR without opening it."*
2. **Auto-Merge in action** — yellow "🟡 watching" pill on a PR with pending CI. Caption: *"Click Auto-Merge — it'll fire the moment CI turns green."*
3. **Filter bar + row badges** — filter chips active (Mine, Ready), badges visible. Caption: *"Filter to your queue. Size + CI badges at a glance."*
4. **Bulk actions** — multi-select bar visible with 3 PRs selected. Caption: *"Select many; merge them all in one go."*
5. **Options page** — per-repo defaults + crash-report opt-in toggle. Caption: *"Remembers per-repo defaults. Opt-in telemetry only."*

---

## Single-purpose justification

> What is the single purpose of your extension?

```
PR Quick Merge has a single purpose: streamline GitHub pull request workflows by adding merge / squash / rebase / auto-merge controls directly to the PR list page, so users don't have to open each PR individually to ship it.
```

## Permission justifications

### `storage`
```
Stores user settings (per-repo merge defaults, custom commit-message templates, keyboard shortcuts, Auto-Merge watch list, opt-in crash-report consent flag) in chrome.storage.local and chrome.storage.sync. Required for the extension to remember preferences across sessions.
```

### `alarms`
```
Schedules a 30-second background poller that checks Auto-Merge-watched PRs for green CI and fires the merge when ready. Without `alarms`, Auto-Merge cannot function — the service worker would not wake to poll.
```

### `management`
```
Used solely to detect whether a small set of known-incompatible GitHub theming extensions are installed; if so, the extension shows a compatibility tip in the popup. The list of detected IDs is hard-coded; the extension does not enumerate, modify, or interact with any other installed extensions.
```

### Host permission `https://github.com/*`
```
Required to inject the merge button row into github.com/*/pulls list pages and to call the GitHub REST API on the user's behalf using their personal access token.
```

---

## Privacy practices

| Question | Answer |
|---|---|
| Is your data usage compliant with the developer program policies? | **Yes** |
| Do you collect or use the user's personal or sensitive data? | **No** (the GitHub token is stored locally in the user's browser; we never receive or proxy it) |
| Do you sell, transfer, or share user data with third parties? | **No** |
| Are you using user data only for the disclosed purpose? | **Yes** |
| Is the extension's privacy policy accessible? | **Yes** — `https://bradygrapentine.github.io/gh-pr-quick-merge/privacy-policy.html` |

### Disclosed data uses

- **Authentication info:** GitHub OAuth token / PAT — stored locally on the user's device only; never transmitted off-device.
- **Anonymous diagnostic / crash reports:** opt-in only; sent to Sentry; PII is sanitized before upload (token redacted, repo names hashed).

---

## Submission checklist

- [ ] Build artifact: `npm run package` with `SENTRY_DSN` exported produces `dist/gh-pr-quick-merge-1.1.0.zip`.
- [ ] manifest.json `version` matches `1.1.0`.
- [ ] Icons present at 16/32/48/128.
- [ ] Privacy policy URL resolves (200 OK).
- [ ] Listing copy reviewed for typos.
- [ ] Screenshots captured at 1280×800.
- [ ] Promo tile rendered at 440×280.
- [ ] Single-purpose statement matches the actual functionality.
- [ ] Each requested permission has a justification.
