# Runbook — external service configuration

> One-time setup steps for every external service PR Quick Merge interacts with. **Most of these are zero-cost.** Where money matters it's flagged.
>
> Owner: project maintainer (one-person operation today). When this becomes a team, split this doc into per-service runbooks and assign owners.

## Inventory

| Service | Tier | Cost | Required for |
|---|---|---|---|
| GitHub OAuth App (Device Flow) | personal app | free | Sign-in path. Each end-user registers their own; the project maintainer needs one for testing only. |
| GitHub Sponsors | profile + Stripe Connect | free (GitHub takes 0% from individual sponsors) | Donation funding (v1.0). |
| Chrome Web Store developer account | one-time $5 | $5 once | Publishing the Chrome / Edge / Brave / Arc extension. |
| Firefox AMO developer account | free | $0 | Publishing the Firefox add-on. |
| Sentry | free hobby plan | free for ≤ 50 k events / month | Crash reporting. Optional — extension no-ops if DSN absent. |
| GitHub bot account `gh-pr-qm-bot` | free | $0 | E2E test suite fixtures (creates / deletes ephemeral repos). |

## 1. GitHub OAuth App (Device Flow) — for testing

End-users register their own (per `README.md`). For maintainer's testing builds:

1. Go to <https://github.com/settings/applications/new>.
2. Application name: `PR Quick Merge — local dev`.
3. Homepage URL: `https://github.com/bradygrapentine/gh-pr-quick-merge`.
4. Authorization callback URL: any value (Device Flow ignores it; field is required by GitHub).
5. **Tick "Enable Device Flow"**.
6. Click **Register application**, copy the Client ID (looks like `Iv1.…`).
7. Paste into the extension's Options page during local testing.

The Client ID is **not** a secret. Don't commit it; just paste at runtime. (If you accidentally commit it, rotate it via the OAuth app settings page — it's not catastrophic, but it makes a clean record.)

## 2. GitHub Sponsors — donation funding

1. Go to <https://github.com/sponsors>. If not eligible yet, GitHub walks through tax / payee verification (US needs SSN/EIN + bank account; non-US analogous).
2. Set up the four tiers as shown in `plans/v1-donations.md`:
   - ☕ Coffee — $5/month
   - 🛠 Daily user — $25/month
   - 🏢 Team — $99/month
   - 🚀 Sponsor — $499/month
3. Customize the profile description: pull text from `README.md` "Support the project" section.
4. Verify the sponsor button shows on the repo's main page.

Sponsorship payouts hit the linked bank account ~30 days after sponsor month closes (GitHub holds for fraud window).

**Live URL (verify):** <https://github.com/sponsors/bradygrapentine>

## 3. Chrome Web Store

Setup:

1. Go to <https://chrome.google.com/webstore/devconsole>.
2. Sign in with the Google account that will own the listing. **Use a Google account dedicated to the project** if possible — switching ownership later is painful.
3. Pay the one-time $5 developer fee (credit card; Google holds account in pending state until paid).
4. Wait ~24 hours for the account to fully activate.
5. Verify your contact email (Google sends a verification code).

First submission walks through the **store-submission-guide.md** checklist. Subsequent submissions reuse the listing fields.

## 4. Firefox AMO

Setup:

1. Go to <https://addons.mozilla.org/developers/>.
2. Sign in with a Firefox Account. Free; no fee.
3. Verify email.
4. (One-time per add-on) Add a `browser_specific_settings.gecko.id` to `manifest.json` — already present (`gh-pr-quick-merge@grapentineb.dev`).
5. Submit per `docs/store-submission-guide.md` (QM-108 section). Source disclosure zip is built per `creative/store-copy/BUILD.md`.

## 5. Sentry crash reporting

PR Quick Merge ships **Sentry-ready** but the SDK isn't bundled until you complete the vendoring follow-up (PR #21 documents this). To enable crash reporting in production:

1. Sign up at <https://sentry.io>. Free hobby tier covers ≤ 50 k events / month — far more than this project will use.
2. Create a project named `gh-pr-quick-merge`. Platform: **Browser → JavaScript**.
3. Copy the DSN (looks like `https://abc@o0.ingest.sentry.io/123456`).
4. Create a separate project `gh-pr-quick-merge-staging` for development builds. Different DSN.
5. Generate a **Sentry auth token** with `releases:write` + `org:read` scopes for source-map uploads.
6. **Vendor the SDK** (follow-up after PR #21): add to `package.json` as a devDependency, copy `node_modules/@sentry/browser/build/bundles/bundle.tracing.min.js` to `lib/vendor/sentry.min.js` during `scripts/package.sh`.
7. Inject the DSN into the build:

   ```bash
   # scripts/package.sh — add before the web-ext build step
   sed -i.bak "s|QM_SENTRY_DSN_PLACEHOLDER|$SENTRY_DSN|g" lib/sentry-init.js
   trap 'mv lib/sentry-init.js.bak lib/sentry-init.js' EXIT
   ```

8. Add the GitHub Actions secret `SENTRY_AUTH_TOKEN` and `SENTRY_DSN` (Settings → Secrets and variables → Actions).
9. Add the source-map upload step to `.github/workflows/release.yml` (see PR #21 follow-up notes).

Until the vendoring is done, the extension's Sentry init runs in no-op mode — verified by `lib/sentry-sanitize.test.js` (the redaction filter is exercised with or without the SDK present).

**Verifying it's wired:**

After deploying to staging:

1. Open the extension in a development browser.
2. In the SW devtools, run: `throw new Error("sentry test " + Date.now())`.
3. Wait ~1 minute, refresh Sentry's issue feed.
4. Confirm: (a) the issue appears, (b) any GitHub URLs in the breadcrumbs are `[github-url-redacted]`, (c) the `Authorization` header is `[redacted]`.

## 6. `gh-pr-qm-bot` GitHub account (for E2E)

The Playwright suite expects a dedicated bot account so test repos can be created and torn down without endangering the maintainer's real repos.

Setup (one-time):

1. <https://github.com/join> — register a new account named `gh-pr-qm-bot` (or pick another name — update `test/e2e/helpers/fixture-repo.ts` accordingly).
2. Sign in as `gh-pr-qm-bot`. Settings → Developer settings → Personal access tokens → Fine-grained.
3. Create a token with the following scopes:
   - **Repository access:** All repositories owned by `gh-pr-qm-bot` (NOT "All repositories" — keep blast radius bounded).
   - **Repository permissions:** Contents: Read & Write; Metadata: Read; Pull requests: Read & Write; Administration: Read & Write (needed to create/delete repos).
   - **Expiration:** 90 days. Set a calendar reminder to rotate.
4. Copy the token (`github_pat_…`).
5. Add it as repo Actions secret `E2E_GH_TOKEN`:

   ```bash
   gh secret set E2E_GH_TOKEN --repo bradygrapentine/gh-pr-quick-merge --body "<token>"
   ```

6. Trigger the E2E workflow manually to confirm:

   ```bash
   gh workflow run e2e.yml --repo bradygrapentine/gh-pr-quick-merge
   ```

**Why a dedicated bot:** the fixture helper deletes repos after each suite. A bug or runaway loop could delete real production repos if the token belongs to your personal account.

## 7. CI Actions secrets — full list

| Secret | Required for | Where it's set |
|---|---|---|
| `E2E_GH_TOKEN` | Nightly E2E + Playwright tests against fixture PRs | repo Actions secrets |
| `SENTRY_AUTH_TOKEN` | Source-map upload step (after Sentry vendoring) | repo Actions secrets |
| `SENTRY_DSN` | Production DSN injection at build time (after Sentry vendoring) | repo Actions secrets |
| `LICENSE_STAGING_URL` | Reserved — Pro license server (deferred indefinitely) | not set |

Without these set, the relevant CI workflows skip cleanly (E2E tests guard with `test.skip(!process.env.E2E_GH_TOKEN, …)`).

## Rotation cadence

| Credential | Rotate every |
|---|---|
| `E2E_GH_TOKEN` | 90 days (set at token creation) |
| `SENTRY_AUTH_TOKEN` | Annually, or whenever a maintainer leaves the project |
| Maintainer's own PAT (used for `gh` CLI) | 90 days |
| OAuth Client IDs | Never proactively — only if compromised |

Calendar reminder: set a recurring 90-day event titled "PR Quick Merge — rotate `E2E_GH_TOKEN`".
