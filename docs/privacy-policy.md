# PR Quick Merge — Privacy Policy

**Effective date:** 2026-04-29
**Contact:** grapentineb@gmail.com

PR Quick Merge is a browser extension that adds merge buttons to GitHub's pull-request list pages. This policy explains what data the extension touches and what it does *not* collect.

## What is collected

**Nothing leaves your browser.**

- **GitHub OAuth access token (or PAT):** stored in `chrome.storage.local` on your device. The token is never transmitted to any server operated by us. It is read by the extension's content script in order to call the GitHub REST API on your behalf.
- **PR metadata:** when you open a GitHub Pull Requests list page, the extension fetches each visible PR's `mergeable` / `mergeable_state` from `api.github.com` directly. Responses live in memory for the lifetime of the page and are not persisted, logged, or sent anywhere else.

## What is NOT collected

- No analytics. No page-view tracking. No event telemetry.
- No crash reporting from the extension itself.
- No third-party trackers. No advertising IDs.
- No metadata about your repositories, branches, or commits is stored remotely.
- No payment data. (PR Quick Merge does not currently process payments. If donations resume via GitHub Sponsors, billing is handled entirely by GitHub.)

## Where the extension talks to the network

The extension makes outbound requests to:

- `https://api.github.com` — to read PR state and submit merges, on your explicit interaction.
- `https://github.com/login/device/code` and `https://github.com/login/oauth/access_token` — only during OAuth Device Flow sign-in.

That's it. There is no first-party server, no backend, and no analytics endpoint.

## Permissions explained

| Permission | Why we need it |
|---|---|
| `storage` | Persist your access token + per-repo merge-method preferences across sessions. |
| `*://*.github.com/*` host permission | Read DOM and inject merge buttons on `github.com/pulls` and per-repo PR lists. |
| `https://api.github.com/*` host permission | Call the GitHub REST API to read PR state and submit merges. |
| `identity` (Chrome only, optional) | Used by the OAuth Device Flow path to open the verification URL in a new tab. |

## Data deletion

To remove all data the extension stores:

1. Open the extension's Options page.
2. Click **"Sign out / clear token"**.
3. Right-click the extension icon → **Remove from Chrome / Firefox**.

Once uninstalled, the extension's `chrome.storage.local` entry is wiped by the browser.

## Children

PR Quick Merge is intended for software developers and is not directed at children under 13.

## Changes to this policy

If the extension's data handling changes, this document will be updated and the new effective date will be set. Material changes will also be noted in the extension's release notes (`CHANGELOG.md`).

## Contact

Privacy questions: grapentineb@gmail.com
Bug reports: [github.com/bradygrapentine/gh-pr-quick-merge/issues](https://github.com/bradygrapentine/gh-pr-quick-merge/issues)
