# GitHub PR Quick Merge

**Status:** v0.4.0 — v1.0 launch candidate. All v0.3 polish (templates, shortcuts, stale badge, popup manage) and v0.4 row-actions (Update branch / Merge-when-Green / Auto-Rebase / bulk close / bulk label / per-repo stale threshold / fast list mode) shipped. 284 unit tests at 95% line coverage; Playwright E2E suite scaffolded (20 specs); GitHub Sponsors live; Sentry crash-reporting sanitiser ready (SDK vendoring is the last pre-launch follow-up). See [ROADMAP.md](./ROADMAP.md), [CHANGELOG.md](./CHANGELOG.md), [docs/v1-launch-checklist.md](./docs/v1-launch-checklist.md), [SECURITY.md](./SECURITY.md).

Squash, merge, or rebase pull requests directly from the GitHub Pull Requests list — no need to open each PR.

> Browser extension that adds **Squash / Merge / Rebase** buttons to every row of `github.com/pulls`. Click once and the PR closes — no tab switch, no page load. Works across all your repos. OAuth Device Flow keeps your token on-device only; nothing transits our servers.

## Install (developer mode)

### Chrome / Edge / Brave / Arc
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → pick this folder
4. Click the extension's icon → **Options** (or right-click → Options) and paste a GitHub PAT

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** → pick `manifest.json`
3. Open the extension's preferences and paste a PAT

## OAuth setup (recommended over PAT)

The extension supports the GitHub OAuth Device Flow so you don't have to manage a long-lived PAT.

1. Go to [github.com/settings/applications/new](https://github.com/settings/applications/new) and register a new OAuth App.
   - **Application name**: anything (e.g. "PR Quick Merge — personal")
   - **Homepage URL**: anything (e.g. your GitHub profile URL)
   - **Authorization callback URL**: anything — Device Flow doesn't use it, but GitHub requires the field
   - Tick **"Enable Device Flow"**
2. Click **Register application**, then copy the **Client ID** (looks like `Iv1.xxxxxxxxxxxxxxxx`).
3. Open the extension's Options page, paste the Client ID, click **Save Client ID**, then click **Sign in with GitHub**.
4. The page shows a one-time code. Click **Copy code & open GitHub**, paste the code on the page that opens, and authorize the app.
5. Once authorized, the extension stores the resulting access token via `chrome.storage.local.token`. The content script picks it up automatically.

The Client ID is not a secret; Device Flow is designed for public clients (no client secret involved). To clear the saved token, click **Sign out / clear token** in the options page.

## PAT fallback

If you'd rather skip OAuth, expand **"Use a Personal Access Token instead"** in the options page and paste a token.

### Token scopes
- **Classic PAT**: `repo`
- **Fine-grained PAT**: `Contents: Read & Write` + `Pull requests: Read & Write` on the repos you want to merge

Token is stored via `chrome.storage.local` (per-browser-profile only — does NOT roam across other browsers signed into the same Google account; see SECURITY F-01).

## How it works
- Content script runs on `github.com/pulls`, `github.com/<owner>/<repo>/pulls`, and `github.com/issues`
- For each PR row, calls `GET /repos/:owner/:repo/pulls/:num` to read `mergeable` + `mergeable_state`
- Buttons enable when the PR is mergeable; clicking calls `PUT /repos/:owner/:repo/pulls/:num/merge` with the requested method
- A `MutationObserver` re-injects buttons when GitHub re-renders the list (filter, sort, pagination)

## Limitations
- Bulk-merge UI is gated behind a "Pro" placeholder modal — payment / license server not wired yet (planned for v1.0). The "Enable Pro (dev)" bypass button only appears in unpacked dev installs.
- Rate limiting: at ~5000/hr authed, the per-row mergeability check is fine for normal use; very long lists may want a future opt-in to use the cheaper list endpoint.
- Popup uses a coarse mergeability proxy from the `/pulls` list endpoint (which doesn't return `mergeable_state`); full mergeability still computed in the content script on the PR-list page.
- No merge-commit templates or keyboard shortcuts yet — engines exist (`lib/templates.js`, `lib/shortcuts.js`) and pass tests, but UI integration is queued for v0.3 (QM-016, QM-018).
- 7 of 15 SECURITY findings remain open (tracked under QM-019); none are Critical or High.

## Roadmap (v0.2)
- [x] Real icons (16/48/128)
- [x] OAuth device flow to replace PAT
- [x] Multi-select + batch merge UI (gated behind Pro modal)
- [x] GitHub Actions CI (`npm test` on every PR)
- [x] Toolbar popup with summary of mergeable PRs across pinned repos
- [x] Per-repo default merge method
- [ ] Merge-commit templates UI (QM-016)
- [ ] Keyboard shortcuts UI (QM-018)
- [ ] Remaining 7 SECURITY findings (QM-019)
- [ ] Tag `v0.2.0` (gated on QM-019)
- [ ] Paid Pro tier with license server (v1.0)

## Development

- Setup walkthrough: [SETUP.md](./SETUP.md)
- Milestones: [ROADMAP.md](./ROADMAP.md)
- Backlog (QM-xxx): [BACKLOG.md](./BACKLOG.md)
- Wave plan: [WAVE-2-PLAN.md](./WAVE-2-PLAN.md)
- Per-feature plans: [`plans/`](./plans/)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Security review: [SECURITY.md](./SECURITY.md)
- Run tests: `npm test` (Vitest; pure helpers live in `lib/`)
- Build a zip for upload: `npm run package` (output lands in `web-ext-artifacts/`)

## Monetization

Realistic monetization options for a GitHub PR merge extension, ranked by likely return vs effort:

**Most viable:**
- **Freemium with team features** — free for solo use; paid tier ($3-5/mo) for: bulk-merge multiple PRs at once, custom merge-commit templates, per-repo default merge method, keyboard shortcuts, merge queue integration. Devs will pay for time savings; individual buyers expense it.
- **GitHub Marketplace listing** — if you wrap the core as a GitHub App later, Marketplace handles billing and gives discovery. Per-seat pricing ($2-4/user/mo) is the norm.
- **Pro one-time license ($9-19)** — Chrome Web Store supports paid extensions in some regions but it's flaky; better to gate Pro features behind a license key checked against your own server (Stripe + a tiny Cloudflare Worker).

**Lower-effort, lower-ceiling:**
- **Donations** — "Buy me a coffee" / GitHub Sponsors link in the options page. Expect <1% conversion.
- **Sponsor logo in the options page** — only works at scale (10k+ active users).

**Avoid:**
- **Ads in a dev tool** — instant uninstall, reputation damage.
- **Selling/analyzing usage data** — GitHub's content + dev audience = trust suicide; also ToS risk.
- **Affiliate links** — no natural fit.

**Strategy that usually works for dev extensions:**
1. Ship free, get to ~5k weekly active users (takes 3-12 months with good SEO + a Show HN / r/programming post).
2. Add a clearly-better Pro tier; existing users convert at 1-3%.
3. Pitch to teams once you have proof of individual value — team plans are where the actual revenue is (Refined GitHub stays free; Octotree, CodeStream, GitLens all monetized via team/enterprise).

Realistic ceiling for a niche extension like this: **$500-3k/mo MRR within year 1** if you push it; **$10k+/mo** only if you expand scope (merge queue, review automation, etc.) into a broader workflow tool.

## Support the project

PR Quick Merge is free and open source — no payment gate, no license server, no Pro tier. If the extension saves you time, sponsor the project on GitHub:

**[github.com/sponsors/bradygrapentine](https://github.com/sponsors/bradygrapentine)**

| Tier | Amount | For |
|---|---|---|
| ☕ Coffee | $5/mo | Individual users — keeps the lights on |
| 🛠 Daily user | $25/mo | Power users merging PRs all day |
| 🏢 Team | $99/mo | Small teams — cheaper than half a Linear seat |
| 🚀 Sponsor | $499/mo | Logo on the repo + first-dibs roadmap input |

Bug reports & feature requests: [github.com/bradygrapentine/gh-pr-quick-merge/issues](https://github.com/bradygrapentine/gh-pr-quick-merge/issues)

No analytics, no telemetry, no remote code — see [`docs/privacy-policy.md`](./docs/privacy-policy.md).
