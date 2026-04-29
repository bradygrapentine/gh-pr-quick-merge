# Firefox Add-ons (AMO) listing — PR Quick Merge

> Source of truth for the AMO Developer Hub fields. Reworded vs. the CWS listing — AMO reviewers compare submissions and lazy duplicate-paste signals low-effort.

## Name

```
PR Quick Merge
```

## Summary (AMO limit: 250 chars)

```
Adds Squash, Merge, and Rebase buttons to every row of the GitHub Pull Requests list. One click closes the PR — no tab switching, no page reloads. OAuth Device Flow keeps your token on your machine; no first-party server, no telemetry.
```
(232 chars)

## Description (no hard limit; aim 300–500 words)

```
PR Quick Merge is a small browser add-on for software developers who maintain or review GitHub repositories.

The add-on injects three buttons — Squash, Merge, Rebase — into each row of the github.com/pulls page and per-repository pull-request lists. When you click a button, the add-on calls GitHub's REST API to merge the PR using your chosen method, then waits for the row to clear. No tab switch. No page reload. No "Merge pull request" → "Confirm" → "back to list" → "next PR" → repeat.

How it works under the hood

The content script runs only on github.com pages. For each visible PR row it asks the GitHub REST API whether the PR is mergeable; the buttons enable when the answer is yes. A MutationObserver watches GitHub's client-side router so the buttons stay attached when you filter, sort, or paginate the list.

Authentication

PR Quick Merge ships with two sign-in paths:

1. OAuth Device Flow (recommended). You register your own OAuth app in GitHub's developer settings (free, takes thirty seconds), paste the Client ID into the add-on's options page, and click Sign in. The Client ID is not a secret — Device Flow is designed for public clients. The resulting access token is written to the browser's local extension storage on your machine and is read only by the add-on's content script.

2. Personal Access Token. If you'd rather skip OAuth, paste a fine-grained PAT with Pull Requests: Read & Write and Contents: Read & Write scopes for the repos you want to merge.

What's NOT collected

- No analytics. No usage telemetry. No third-party trackers.
- No first-party server. Your browser talks directly to api.github.com.
- The add-on is open source. The source-disclosure zip submitted to AMO reproduces the .xpi byte-for-byte from the public GitHub repository.

Open source

PR Quick Merge is licensed under MIT. Source: github.com/bradygrapentine/gh-pr-quick-merge

Support

Bug reports and feature requests: github.com/bradygrapentine/gh-pr-quick-merge/issues
Privacy policy: github.com/bradygrapentine/gh-pr-quick-merge/blob/main/docs/privacy-policy.md
```

## Categories

- Primary: `Developer Tools`
- Secondary: `Other` (AMO requires two)

## Tags

`github`, `pull-requests`, `merge`, `code-review`, `developer-tools`

## Support URL

```
https://github.com/bradygrapentine/gh-pr-quick-merge/issues
```

## Homepage URL

```
https://github.com/bradygrapentine/gh-pr-quick-merge
```
(Swap to the marketing site URL once Phase 4 of `v1-distribution-and-marketing.md` ships.)

## License

`MIT License` (matches `LICENSE` file in repo)

---

## Reviewer notes (AMO Developer Hub: "Notes for Reviewer")

```
Source disclosure

This add-on is bundled with web-ext build. The source-disclosure zip attached to this submission contains:
- All extension source files (unminified — the build does not minify)
- creative/store-copy/BUILD.md with exact commands to reproduce the production .xpi

To reproduce:
  nvm use 20
  npm ci
  npm run build
  npm run package
The output XPI in web-ext-artifacts/ matches the file uploaded to AMO byte-for-byte (verify with sha256sum).

Permissions justification

- "storage" — required to persist the user's GitHub OAuth access token and per-repo merge-method preferences across browser sessions.
- "*://*.github.com/*" host permission — required to read the DOM of github.com Pull Request list pages and inject merge buttons. The content script does not run on any other domain.
- "https://api.github.com/*" host permission — required to call the GitHub REST API: GET /repos/:owner/:repo/pulls/:num (read mergeable state) and PUT /repos/:owner/:repo/pulls/:num/merge (perform merge). Calls go directly from the user's browser to GitHub; no proxy server.

The add-on does not load remote code (no eval, no remote script injection). It does not collect analytics, does not transmit any data to a server operated by the developer, and does not contain any third-party trackers or SDKs.

OAuth Device Flow notes

The OAuth path uses GitHub's Device Flow (RFC 8628). The Client ID is supplied by the user — they register their own OAuth app in their GitHub settings. The add-on never embeds a developer-owned client secret or client ID. This means each user's data flow goes:
  user's browser ↔ github.com (Device Flow endpoints)
  user's browser ↔ api.github.com (REST API)
There is no third-party leg in the authentication chain.

Test account
For reviewer convenience: a Firefox profile with the add-on pre-installed and a sandbox GitHub account credentialled can be provisioned on request.
```

---

## Submission checklist (handover to QM-108)

- [ ] Final .xpi built from the same tagged release as the CWS .zip (`npm run package`)
- [ ] sha256sum of .xpi recorded so reviewer can verify reproducibility
- [ ] `source-disclosure.zip` produced (excludes `.git/`, `node_modules/`, `web-ext-artifacts/`, `dist/`)
- [ ] `creative/store-copy/BUILD.md` included in the source-disclosure zip
- [ ] Privacy policy URL reachable
- [ ] Listing copy + reviewer notes pasted into AMO Developer Hub
- [ ] Submit; record AMO add-on ID + estimated review queue time
