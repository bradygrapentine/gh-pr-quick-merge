# Security policy & audit log

## Reporting a vulnerability

If you find a security issue in PR Quick Merge, **do not** open a public GitHub issue. Email **grapentineb@gmail.com** with:

- A clear description of the issue and its impact.
- Steps to reproduce (or a proof of concept).
- Browser + extension version where you reproduced it.

Expect a first response within 5 business days. Confirmed issues will be fixed in a patch release; reporters are credited in the changelog with their permission.

### Scope

In scope:

- The browser extension's runtime: `content.js`, `background.js`, `popup.*`, `options.*`, all `lib/*`.
- The Sentry sanitization filter (`lib/sentry-sanitize.js`).
- OAuth Device Flow handling (`auth.js`).
- Build / packaging scripts (`scripts/package.sh`, `scripts/release.sh`).

Out of scope:

- Issues in third-party libraries that don't affect PR Quick Merge's behavior; report those upstream.
- Findings that require the user to install a malicious extension or grant credentials to an attacker — those are out-of-band for any browser extension.

## Threat model

PR Quick Merge is intentionally simple to keep the trust surface small:

- **No first-party server.** The browser talks directly to `api.github.com`. There is no PR Quick Merge backend that could be compromised.
- **Token never leaves the device.** GitHub OAuth Device Flow tokens (or PATs) are stored in `chrome.storage.local`. They are read by the extension's content script and sent only as `Authorization: Bearer …` headers to `api.github.com`.
- **OAuth Device Flow is user-supplied.** The Client ID is registered in the user's own GitHub developer settings. There is no developer-owned client secret in the chain.
- **No remote code.** CSP locks scripts to `self`; no `eval`, no remote `<script>` injection, no third-party SDK loaded at runtime in the shipped bundle.

## v1.0 audit (2026-04-29)

Reviewed: diff `v0.2.0..main` (PRs #18–#25). All v0.1 findings F-01 through F-09 and F-15 are closed (see history below). Remaining items from the v0.1 review:

- **F-10** — deferred indefinitely. Pro paywall replaced with a donation prompt (PR #20); no license enforcement is needed now or for v1.0.
- **F-13, F-14** — informational, still apply (innerHTML uses only static literals; no runtime npm deps shipped to the user).

### v1.0 hardening checklist

| Control | Status |
|---|---|
| Manifest CSP: `script-src 'self'; object-src 'self'; base-uri 'none'` | ✅ |
| `host_permissions` minimal: `api.github.com`, `github.com/login/device/code`, `github.com/login/oauth/access_token` | ✅ |
| Runtime permissions minimal: `storage`, `management`, `alarms` | ✅ |
| No `eval()` / `new Function()` in shipped source | ✅ verified by grep |
| Sentry payloads redacted before transmit (`lib/sentry-sanitize.js`) | ✅ 18 unit tests |
| Token never logged or transmitted to non-GitHub hosts | ✅ |
| `innerHTML` interpolations only over constants (no user-controlled strings) | ✅ audited |
| GitHub repo: secret scanning + push protection | ✅ enabled |
| GitHub repo: Dependabot security updates | ⚠ disabled — see launch checklist |
| Branch protection on `main`: required CI green | ⚠ not configured — see launch checklist |

The two ⚠ items are GitHub repo-settings (not code) and are tracked as v1.0 launch-checklist stories in `BACKLOG.md` (QM-167, QM-168).

### New code surface reviewed in this audit

- `lib/api.js` — centralised GitHub REST helpers. `apiPost`/`apiPut` send `Authorization: Bearer …` only when `token` is supplied; no token leaks to other hosts because `path` is always concatenated with `https://api.github.com` (or absolute `https://...github.com` URLs the caller already approved). ✅
- `lib/update-branch.js`, `lib/merge-queue.js`, `lib/auto-rebase.js` — pure orchestration over `lib/api.js`. No new network destinations. Queue size capped at `MAX_ENTRIES=10` to bound API rate-limit impact. ✅
- `lib/bulk-ops.js`, `lib/list-mode.js` — same pattern; per-PR error capture prevents one bad request from leaking via stack traces. ✅
- `background.js` — merge-queue poller fires once per minute and only on entries the user explicitly enqueued. Reads token from `chrome.storage.local`; never logs it. Per-entry `try/catch` so one bad PR can't take the tick down. ✅
- `content.js` `injectRowActions` — only renders buttons; no DOM injection of user-controlled strings. The donation modal's only template-string interpolation is `${SPONSORS_URL}`, a const. ✅
- `lib/sentry-init.js` — boots the SDK only when a vendored bundle is present **and** a DSN is configured. Default state is no-op so a half-configured build cannot silently transmit telemetry. ✅
- `creative/store-copy/BUILD.md` — AMO source-disclosure recipe is byte-reproducible. ✅

### Findings (v1.0)

**0 critical, 0 high, 0 medium.** Two repo-setting warnings (above) tracked as launch-checklist items.

---

## Audit log

| Date | Reviewer | Scope | Findings |
|---|---|---|---|
| 2026-04-29 | self (v1.0 polish) | diff `v0.2.0..main` (PRs #18–#25) | 0 critical, 0 high, 0 medium; 2 repo-settings warnings → BACKLOG.md QM-167/168 |
| 2026-04-29 | self | QM-019 closure | F-03, F-05, F-06, F-15 closed |
| 2026-04-29 | self (v0.1.0) | initial | 8 of 15 findings closed in PR #1; see "History" below |

---

## History — original v0.1.0 review (kept for context)

**Closed in PR #1 (Wave 2 partial):** F-01, F-02, F-04, F-07, F-08, F-09, F-11, F-12 (8 of 15).
**Closed in PR for QM-019:** F-03, F-05, F-06, F-15 (4 more).
**Remaining:** F-10 (deferred; donation-funded v1.0 means no paywall to enforce); F-13 + F-14 (informational, no action needed).


## Summary

Overall posture is reasonable for a small MV3 extension: no `eval`, no remote code, no `web_accessible_resources`, no runtime npm dependencies, all `innerHTML` usage is over static literals, and the OAuth Device Flow is implemented largely per RFC 8628. The most significant risks are (1) a GitHub token with `repo` scope stored in `chrome.storage.sync` — which syncs across the user's signed-in browsers and is readable by any code in any extension execution context — combined with (2) a developer "Enable Pro (dev)" backdoor button shipped in production that any page user (or arguably any clickjack overlay) can trigger, and (3) over-broad `host_permissions` granting access to all of `https://github.com/*` when the script only runs on `/pulls` and `/issues` URLs. There are no XSS vectors found from the audited surface (all rendered HTML is static; user-controlled strings flow only through `textContent`/`title`), and no token leakage to non-GitHub origins. The Pro gate is, as the brief expects, purely cosmetic.

## Findings

| ID | Severity | Title | Location | Description | Recommendation |
|----|----------|-------|----------|-------------|----------------|
| F-01 | High | Token stored in `chrome.storage.sync` with `repo` scope | `auth.js:144`, `options.js:20`, `options.html:120-125` | OAuth/PAT access tokens are written to `chrome.storage.sync`, which roams across every Chrome profile signed into the same Google account and is encrypted only at rest by Chrome. A `repo`-scoped token grants full read/write to all the user's private repos. Any other extension running with `storage` permission on the same profile, or a compromise of any signed-in browser, exposes the token. | Move token (and `clientId` is fine to keep in sync) to `chrome.storage.local`, or — better — `chrome.storage.session` for the cached copy plus an explicit "remember me" toggle. Document the trade-off. Recommend fine-grained PATs scoped to `pull_requests:write` + `contents:write` over classic `repo`. |
| F-02 | High | "Enable Pro (dev)" button ships in production | `content.js:399`, `content.js:407-412` | The pro-gate modal includes an `Enable Pro (dev)` button that calls `chrome.storage.sync.set({ pro: true })`. This is a developer affordance left in the shipped content script. Beyond bypassing the (admittedly cosmetic) paywall, the modal is appended to `document.body` on a github.com page — a malicious GitHub README/Issue cannot script the extension directly, but the button is reachable by any user who hits "Merge selected" without auth, so it is effectively a self-serve unlock. | Remove the dev button entirely from production builds, or gate it on a build flag (`if (process.env.NODE_ENV !== "production")` via a bundler) or `chrome.management.getSelf().installType === "development"`. |
| F-03 | Medium | `host_permissions` broader than needed | `manifest.json:8-11` | `host_permissions` grants `https://github.com/*` and `https://api.github.com/*`. The content script only runs on `/pulls`, `/*/pulls*`, and `/issues*` (per `content_scripts.matches`), and the only fetch destinations are `api.github.com` and `github.com/login/device/code` + `github.com/login/oauth/access_token`. The blanket `github.com/*` host permission gives the extension fetch/cookie access to every github.com page. | Tighten `host_permissions` to `https://api.github.com/*` plus the specific `/login/device/code` and `/login/oauth/access_token` endpoints if possible. The `content_scripts.matches` already declares the page surface; `host_permissions` should match. |
| F-04 | Medium | OAuth token request omits `Origin` controls; client_id-only flow accepts user-supplied IDs | `auth.js:35-46`, `options.js:55-122` | The user pastes their own `clientId` into the options UI. Anyone tricked into pasting an attacker-controlled OAuth App's client ID will authorize the **attacker's** app against their own GitHub account, then save the resulting attacker-issued token into the extension's storage — where the extension will use it as if legitimate. There is no UX warning that a wrong/malicious client ID equals account compromise. | Either (a) hardcode the publisher's official client ID for distribution, or (b) display a strong warning in `options.html` explaining that the client ID identifies the OAuth app that will receive permissions, and link to the user's own OAuth app settings page so they can verify. |
| F-05 | Medium | `slow_down` interval handling deviates from RFC 8628 §3.5 | `auth.js:119-122` | RFC 8628 says on `slow_down` the polling interval MUST be increased by **at least 5 seconds**, and the new interval applies to **subsequent** polls. The code adds 5s to `pollInterval` then continues — but the loop body sleeps **before** the next poll (`await sleep(pollInterval * 1000)` at line 91), so this is correct. However, `slow_down` errors do not consume the deadline guard at line 92, and repeated `slow_down` from a hostile/misbehaving server could grow `pollInterval` unbounded. Also, the spec recommends the new interval be returned by the server in the error response — we ignore `tokenData.interval` if present. | Cap `pollInterval` at e.g. 60s. Honor a server-supplied `interval` field from the `slow_down` response if present. |
| F-06 | Medium | `confirm()` dialog is the only safety guard for bulk merge | `content.js:256`, `content.js:342` | A native `confirm()` is the sole confirmation before pushing PRs to merge — including bulk merges of N PRs. `confirm()` is dismissible by Enter and is trivially clickjacked or socially engineered. Combined with the over-broad `host_permissions` (F-03), any github.com sub-page that can render content (Issue body, Wiki page, Gist embed) cannot directly trigger a merge — but a compromised github.com cookie/session could. | Add an in-extension confirmation modal showing the exact PRs and head SHAs being merged, with a typed-confirmation step for bulk (e.g. type "MERGE 5"). Consider rate-limiting bulk operations. |
| F-07 | Low | Token mirrored into a visible DOM input on success | `options.js:114` | After successful OAuth, the access token is written to `$("token").value`. The input is `type="password"` (`options.html:120`), but the value is still readable by any extension code with options-page access and is exposed via DOM inspection. Mirroring also leaks the token through clipboard if the user accidentally copies the field. | Don't mirror the token into the input. Show a "Signed in as @login" badge instead, with a "Sign out" button that calls `chrome.storage.sync.remove("token")`. |
| F-08 | Low | Token never explicitly cleared on sign-out / no sign-out UI | `options.js`, `options.html` | There is no UI affordance to revoke or clear a saved token. Users cannot recover from a compromised token from inside the extension; they must visit github.com/settings/tokens manually. | Add a "Sign out / clear token" button that calls `chrome.storage.sync.remove(["token"])` and (best-effort) `DELETE /applications/{client_id}/token` to revoke server-side. |
| F-09 | Low | `parsePrLink` uses default base `https://github.com` for relative hrefs | `lib/pr-helpers.js:12-19` | The parser anchors relative paths against `https://github.com`. If a malicious GitHub-rendered page injected an anchor with a crafted href like `//evil.com/owner/repo/pull/1`, `URL` resolution would set host to `evil.com` and the regex on `pathname` would still match. The parsed `{owner, repo, num}` would then be used to construct `https://api.github.com/repos/<owner>/<repo>/pulls/<num>` — `owner` of `owner` is benign here, but the assumption that the anchor host is github.com is implicit. The anchors in question come from `findPrAnchor(row)` which queries within `.js-issue-row` rendered by GitHub itself, so practical exploitability is low. | Validate `url.host === "github.com"` (and protocol `https:`) inside `parsePrLink` before matching pathname, returning null otherwise. |
| F-10 | Low | Pro flag is client-side only; no server-side license check | `content.js:19-22`, `content.js:335-338`, `content.js:407-412` | As the brief notes: `chrome.storage.sync.set({ pro: true })` from devtools or the dev button trivially unlocks "Pro" features. This is **not** a real paywall — only an in-product gate. For a real paid offering at v1.0, a license-key + signed-receipt verification step is required. | Document explicitly in README/marketing that v0.1 has no license enforcement. For paid v1.0, integrate a license server (e.g. ed25519-signed license keys verified offline, plus periodic online check). |
| F-11 | Low | No `content_security_policy` declared in manifest | `manifest.json` (entire file) | MV3 applies a default extension CSP (`script-src 'self'; object-src 'self'`), which is correct and restrictive. No remote scripts are imported. This is informational — the absence is fine, but adding an explicit `content_security_policy.extension_pages` strengthens it against future drift. | Optionally declare `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'self'; base-uri 'none'" }` to lock options-page CSP. |
| F-12 | Low | `options.html` opens external links via `target="_blank"` without `rel="noopener"` | `options.html:93`, `options.html:106`, `options.html:124` | Anchors with `target="_blank"` lack `rel="noopener noreferrer"`. Modern browsers default to `noopener` for `target=_blank`, but explicit attribution prevents reverse-tabnabbing on older browsers and clarifies intent. | Add `rel="noopener noreferrer"` to all `target="_blank"` anchors. |
| F-13 | Info | All `innerHTML` sites use static template literals | `content.js:303-313`, `content.js:386-402` | Reviewed: `qm-bulk-bar` and `qm-pro-modal` both build markup from string literals with no interpolation of user-controlled data. PR identifiers and error messages are rendered with `textContent` (`content.js:159`, `c.js:265`, `c.js:271`, `c.js:330`). No XSS sink found. | None — note for future devs: keep these literal. If you add interpolation, switch to DOM construction. |
| F-14 | Info | No runtime npm dependencies | `package.json` | Only `vitest` as a devDep; no runtime dependencies are bundled into the shipped extension. Supply-chain surface is minimal. | None. Keep it that way. |
| F-15 | Low | Token logged through `String(e)` on fetch error | `content.js:135` | `fetchPrState` catches errors and stores `{ error: String(e) }` in the in-memory cache. Network errors typically don't include the request URL/headers, but `TypeError: Failed to fetch` from some Chromium builds may include the URL with bearer-token-bearing requests. The cache is in-memory only and not exfiltrated, so impact is bounded. | Sanitize: store `{ error: e.name + ": " + e.message.slice(0, 200) }` and never include the request URL. Don't `console.log` errors with the request object attached if logging is added later. |

## Threat model

**In scope**

- A malicious or compromised GitHub.com page (rendered Markdown, gists, repo content) attempting to trick the content script into a merge or to exfiltrate the token.
- A malicious/typosquatted OAuth client ID supplied to the user via social engineering.
- Token theft via Chrome sync replication to an attacker-controlled signed-in browser.
- A coexisting malicious extension reading `chrome.storage.sync` (extensions cannot read each other's storage directly — but a compromised extension with broader permissions, or an OS-level attacker reading the unencrypted Chromium leveldb, can).
- Cosmetic-paywall bypass.
- DOM-injection / XSS via injected modal/bar UI.
- Device-flow protocol correctness (RFC 8628 conformance).

**Out of scope**

- GitHub.com itself being compromised (token theft is then unrecoverable regardless of extension behavior).
- Local malware running with user privileges (can read any browser storage).
- Browser zero-days breaking MV3 isolation.
- Phishing of the user's GitHub credentials — that is GitHub's authentication problem.
- Network-layer attacks against TLS to api.github.com.

## Open questions

1. Is the OAuth client ID intended to be **publisher-owned and hardcoded** in the shipped extension, or is end-user-supplied client ID the permanent UX? The current self-registration UX is unusual and creates F-04. README/ROADMAP would clarify intent — recommend reading those before locking the design.
2. What is the planned v1.0 license enforcement architecture (signed keys / hosted license server / Stripe customer-portal callback)? Affects how F-10 should be addressed.
3. Does the extension target Firefox AMO submission? `browser_specific_settings.gecko` is present — AMO has stricter CSP and remote-code rules; F-11 becomes a hard requirement there.
4. Is `chrome.storage.sync` necessary for cross-device convenience, or was it the default? Moving the token to `local` (F-01) is straightforward if sync is not a product requirement.
5. Are there end-to-end tests / Puppeteer tests verifying the dev-only "Enable Pro" button is stripped from release builds (F-02)? No build pipeline was found in `package.json`.
