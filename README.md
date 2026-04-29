# GitHub PR Quick Merge

**Status:** v0.2-dev — Wave 1 shipped (OAuth device flow, real icons, bulk-merge UI behind Pro modal, vitest suite). See [ROADMAP.md](./ROADMAP.md).

Squash, merge, or rebase pull requests directly from the GitHub Pull Requests list — no need to open each PR.

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
5. Once authorized, the extension stores the resulting access token via `chrome.storage.sync.token` — same key the PAT flow uses, so the content script just works.

The Client ID is not a secret; Device Flow is designed for public clients (no client secret involved).

## PAT fallback

If you'd rather skip OAuth, expand **"Use a Personal Access Token instead"** in the options page and paste a token.

### Token scopes
- **Classic PAT**: `repo`
- **Fine-grained PAT**: `Contents: Read & Write` + `Pull requests: Read & Write` on the repos you want to merge

Token is stored via `chrome.storage.sync` (synced across your browser profile, not sent anywhere else).

## How it works
- Content script runs on `github.com/pulls`, `github.com/<owner>/<repo>/pulls`, and `github.com/issues`
- For each PR row, calls `GET /repos/:owner/:repo/pulls/:num` to read `mergeable` + `mergeable_state`
- Buttons enable when the PR is mergeable; clicking calls `PUT /repos/:owner/:repo/pulls/:num/merge` with the requested method
- A `MutationObserver` re-injects buttons when GitHub re-renders the list (filter, sort, pagination)

## Limitations
- Bulk-merge UI ships in v0.2 but is gated behind a "Pro" placeholder modal — payment / license server not wired yet (planned for v1.0)
- Rate limiting: at ~5000/hr authed, the per-row mergeability check is fine for normal use; very long lists may want a future opt-in to use the cheaper list endpoint
- No toolbar popup yet — mergeable-PR summary across pinned repos is on the v0.2 backlog (QM-021)
- No per-repo default merge method, merge-commit templates, or keyboard shortcuts yet — landing in v0.3

## Roadmap
- [x] Real icons (16/48/128)
- [x] OAuth device flow to replace PAT
- [x] Multi-select + batch merge UI (gated behind Pro modal)
- [ ] CI (lint + typecheck + test on PR)
- [ ] Toolbar popup with summary of mergeable PRs across pinned repos
- [ ] Per-repo default merge method
- [ ] Merge-commit templates and keyboard shortcuts (v0.3)
- [ ] Paid Pro tier with license server (v1.0)

## Development

- Plan and milestones: [ROADMAP.md](./ROADMAP.md)
- Story-level work and IDs (QM-xxx): [BACKLOG.md](./BACKLOG.md)
- Run the test suite: `npm test` (Vitest + jsdom; pure helpers live in `lib/pr-helpers.js`)

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
