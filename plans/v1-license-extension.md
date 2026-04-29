# Plan — Extension-side license enforcement (Epic 3, QM-081..090)

**Milestone:** v1.0
**Estimates:** QM-081 M · QM-082 M · QM-083 M · QM-084 S · QM-085 M · QM-086 M · QM-087 S · QM-088 S · QM-089 S · QM-090 S
**Security closes:** SECURITY F-10 (cosmetic Pro flag)
**Hard prereq:** `v1-license-server.md` merged (exposes `/validate`, `/checkout`, webhook for state transitions). Stories QM-081, QM-083, QM-084 are server-independent and can land before the server is live.
**Note on QM-091:** Server-side price-ID routing by variant. This is a server story — it does not belong here. Cross-link to `v1-license-server.md`; implement alongside QM-073 there.

## Goal

Replace the current cosmetic `pro: boolean` flag in storage with a cryptographically verified license state machine. After this plan, a user cannot activate Pro by toggling a value in DevTools. Activation requires a real license key, verified offline via Ed25519 signature and periodically re-validated against the server. Revocation propagates within the grace period.

## Dependencies (from v1-license-server.md)

| Server story | What the extension needs |
|---|---|
| QM-078 `/validate` | Key activation + periodic re-validation (QM-085, QM-086, QM-082) |
| QM-072 webhook → state transitions | Dunning, cancellation, revival events (QM-088) |
| QM-073 `/checkout` | Pricing experiments, variant param (QM-090) |

Phase 1 has zero server dependencies. Phase 2 requires QM-078 live. Phase 3 requires QM-073 live.

## File ownership (exclusive)

| File | Stories | Status |
|---|---|---|
| `lib/license-crypto.js` | QM-081, QM-086 | NEW |
| `lib/license-state.js` | QM-083, QM-082, QM-084, QM-086 | NEW |
| `test/license-crypto.test.js` | QM-081 | NEW |
| `test/license-state.test.js` | QM-083, QM-084 | NEW |
| `test/license-flow.e2e.js` | QM-086, QM-087, QM-088 | NEW |
| `content.js` | QM-084, QM-086, QM-087 | EDIT |
| `options.html` | QM-085, QM-087, QM-088, QM-089 | EDIT |
| `options.js` | QM-085, QM-086, QM-087, QM-088, QM-089, QM-090 | EDIT |
| `options.css` | QM-085, QM-087, QM-088 | EDIT |
| `manifest.json` | QM-082 (alarm permission) | EDIT (one-liner) |

**Conflict hotspot:** `content.js` and `options.*` are touched by five stories in Phase 2. These must run serially or be integrated via a dedicated sub-agent integration story. See Dispatch Decision below.

## Phase 1 — Server-independent (land before server)

Stories: QM-081, QM-083, QM-084. No network calls. Green in isolation.

### QM-081 `lib/license-crypto.js` — Ed25519 verify (M)

Pure module. No DOM, no `chrome.*`.

Exports:
- `verifyLicenseKey(licenseKey, publicKeyB64)` → `Promise<{ valid: boolean, payload: object | null }>` — decodes the key (base64url), splits signature from payload, calls `crypto.subtle.verify` with `{ name: "Ed25519" }` algorithm. Returns `{ valid: false, payload: null }` on any error (never throws).
- `PUBLIC_KEY_B64` — the Ed25519 public key constant (placeholder for now; replaced with real key at ship).
- `decodeLicensePayload(licenseKey)` → `{ email, plan, exp, issued_at }` — splits key, base64url-decodes payload JSON. Throws on malformed input (caller must catch).

Web Crypto `Ed25519` requires Chrome 113+. Extension `manifest_version: 3` targets Chrome 112+; add a comment noting the floor is raised to 113 and update `minimum_chrome_version` in `manifest.json`.

#### TDD spec (target: 10+ tests)

1. Valid key + matching public key → `{ valid: true, payload: {...} }`
2. Valid key + wrong public key → `{ valid: false, payload: null }`
3. Truncated key (missing signature portion) → `{ valid: false, payload: null }` (no throw)
4. Expired key (`exp` in past) — `verifyLicenseKey` does NOT check expiry (state machine owns that); signature still valid
5. `decodeLicensePayload` happy path — returns correct fields
6. `decodeLicensePayload` malformed base64 → throws
7. `decodeLicensePayload` valid base64 but not JSON → throws
8. `verifyLicenseKey` empty string → `{ valid: false, payload: null }`
9. `verifyLicenseKey` null input → `{ valid: false, payload: null }`
10. `PUBLIC_KEY_B64` is a non-empty string (smoke test the constant exists)

Use `globalThis.crypto.subtle` so tests run under Node 20 with `--experimental-global-webcrypto` (or jsdom with WebCrypto polyfill).

---

### QM-083 `lib/license-state.js` — State machine (M)

States: `inactive` → `active` → `grace` → `revoked`. Also `trialing` if a trial token is present.

Exports:
- `LICENSE_STATES` — frozen object `{ INACTIVE, ACTIVE, GRACE, REVOKED, TRIALING }`
- `computeState(stored)` — pure function, `stored` is `{ licenseKey, verifiedAt, gracePeriodEnd, plan, status }`. Returns one of `LICENSE_STATES`. Logic:
  - No `licenseKey` → `INACTIVE`
  - `status === "trialing"` → `TRIALING`
  - `status === "revoked"` → `REVOKED`
  - `gracePeriodEnd` set and `Date.now() < gracePeriodEnd` → `GRACE`
  - `gracePeriodEnd` set and `Date.now() >= gracePeriodEnd` → `REVOKED`
  - Otherwise → `ACTIVE`
- `isProActive(stored)` — returns `true` iff `computeState(stored)` is `ACTIVE` or `TRIALING` or `GRACE`
- `transitionTo(stored, event)` — returns new `stored` object (no mutation). Events: `ACTIVATED`, `VALIDATION_OK`, `VALIDATION_FAIL_GRACE`, `REVOKED`, `RESUBSCRIBED`. Each event maps to a deterministic state + field update.
- `GRACE_PERIOD_MS` — constant, 72 hours in ms.

Dual CJS + `window.QM_LICENSE_STATE` export, matching `lib/pr-helpers.js` pattern.

#### TDD spec (target: 14+ tests)

1. `computeState({})` → `INACTIVE`
2. `computeState({ licenseKey: "x", status: "active" })` → `ACTIVE`
3. `computeState({ licenseKey: "x", status: "trialing" })` → `TRIALING`
4. `computeState({ licenseKey: "x", status: "revoked" })` → `REVOKED`
5. Grace: `gracePeriodEnd` set to future → `GRACE`
6. Grace expired: `gracePeriodEnd` set to past → `REVOKED`
7. `isProActive` returns true for `ACTIVE`
8. `isProActive` returns true for `TRIALING`
9. `isProActive` returns true for `GRACE`
10. `isProActive` returns false for `INACTIVE`
11. `isProActive` returns false for `REVOKED`
12. `transitionTo(stored, "ACTIVATED")` sets `status: "active"`, clears `gracePeriodEnd`
13. `transitionTo(stored, "VALIDATION_FAIL_GRACE")` sets `gracePeriodEnd` to `Date.now() + GRACE_PERIOD_MS`
14. `transitionTo(stored, "REVOKED")` sets `status: "revoked"`
15. `transitionTo` is pure — does not mutate input

---

### QM-084 Replace `pro` boolean with `license-state` module (S, dep QM-083)

Grep for all reads and writes of `chrome.storage.*.pro` and `storage.pro`. Replace every read with `isProActive(stored)` from `lib/license-state.js`. Replace writes with `transitionTo`. Remove the raw `pro` key from any default-storage initialization.

Files touched: `content.js`, `options.js`, and any background script that initializes defaults.

After this story the extension still has no activation UI — the key must be injected manually via DevTools for testing. That is intentional; QM-085 adds the UI.

Verification: `grep -r '"pro"' src/ options.js content.js` returns zero matches.

---

## Phase 2 — Server-coupled (needs `/validate` live)

Stories: QM-082, QM-085, QM-086, QM-087, QM-088, QM-089.

### QM-085 License key entry UI in options + activation flow (M, dep QM-083 + server QM-078)

Add a "License" section to `options.html` between the existing sections. Fields:

- License key `<input type="text" id="licenseKey" placeholder="XXXX-XXXX-XXXX-XXXX">`
- `<button id="activateBtn">Activate</button>`
- `<p id="licenseStatus">` — shows current state label from `LICENSE_STATES`

Activation flow in `options.js`:
1. Read key from input.
2. Call `verifyLicenseKey(key, PUBLIC_KEY_B64)` from `lib/license-crypto.js`.
3. If invalid signature → show "Invalid license key." Stop.
4. POST `/validate` with `{ licenseKey: key }`. Expect `{ status, plan, email }`.
5. On success: call `transitionTo(stored, "ACTIVATED")`, write to `chrome.storage.local.licenseData`, update status label.
6. On network error: if signature was valid, store key optimistically and show "Activated offline — will verify when online."

On options page load: read `licenseData` from storage, call `computeState`, render appropriate status label and show/hide the activate form.

### QM-086 Wire license-crypto offline verification into `isProActive()` (M, dep QM-081 + QM-083)

Every gate in `content.js` that calls `isProActive` must now also verify the stored key's signature before returning true. The signature check is synchronous-after-import (key import is cached at module load). Steps:

1. At module load, call `crypto.subtle.importKey` with `PUBLIC_KEY_B64` and cache the result.
2. Wrap `isProActive` in an async guard: reads `licenseData` from storage, calls `verifyLicenseKey` with the cached public key, then calls `computeState`. Returns false if signature invalid regardless of stored state.
3. All call sites in `content.js` must `await` the guard.

This closes SECURITY F-10: even if a user sets `licenseData.status = "active"` in DevTools, the Ed25519 signature check will fail and Pro features will be gated.

### QM-082 Periodic re-validation alarm + grace-period logic (M, dep QM-081 + QM-084)

Add `"alarms"` to `permissions` in `manifest.json`.

In the background service worker (or create `background.js` if absent):
- Register a `chrome.alarms.create("licenseRevalidate", { periodInMinutes: 1440 })` on install and startup.
- On alarm: read `licenseData`, POST `/validate` with the stored key.
  - `200 { status: "active" }` → `transitionTo("VALIDATION_OK")`, clear grace.
  - `402` or `{ status: "canceled" }` → `transitionTo("VALIDATION_FAIL_GRACE")`.
  - Network error → no transition (grace period already handles offline).
  - `{ status: "revoked" }` → `transitionTo("REVOKED")` immediately.
- Write updated `licenseData` back to `chrome.storage.local`.

Grace period is 72 hours (`GRACE_PERIOD_MS` from QM-083). During grace, `isProActive` returns true; after expiry it returns false.

### QM-087 Grace-period warning UI (S, dep QM-083 + QM-082)

In `options.js`: on load, if `computeState` returns `GRACE`, show a yellow warning banner:

> "Your license could not be verified. Pro features remain active until [date]. Check your subscription or re-enter your key."

In `content.js`: if state is `GRACE`, inject a lightweight banner into the page DOM (one-time per session, dismissable) with the same message. Use a `chrome.storage.session` flag to suppress repeat injection.

Add styles for the warning banner to `options.css`.

### QM-088 Dunning + cancellation copy + resubscribe CTA (S, dep QM-087 + server QM-072)

In `options.js`, handle `REVOKED` state:

- Show a red status block: "Your subscription has ended. Pro features are disabled."
- Show a "Resubscribe" button that opens the checkout URL (from `/checkout`, built in QM-085's activation flow).
- If the server sends a `dunning_stage` field on the `/validate` response, render stage-specific copy:
  - `dunning_1`: "Payment failed — please update your card."
  - `dunning_2`: "Second payment attempt failed."
  - `dunning_final`: "Subscription canceled after failed payment."

Remove any Pro-feature UI elements from `options.html` when state is `REVOKED`.

### QM-089 Restore-purchase flow on new device (S, dep QM-085)

Add a "Restore purchase" link below the activation form in `options.html`. On click:

1. Prompt for email via a small inline form.
2. POST `/validate` with `{ email }` (server looks up the license key by email and returns it if active).
3. On success: treat identically to a normal activation (QM-085 step 4 onward).
4. On `404`: "No active license found for that email."

This requires `/validate` to accept an email lookup mode — flag as a server-contract dependency. Coordinate with the QM-078 implementer.

---

## Phase 3 — Pricing experiments (parallel with Phase 2 once `/checkout` exists)

Stories: QM-090. (QM-091 is server-side — see `v1-license-server.md`.)

### QM-090 A/B variant assignment + checkout param (S, dep server QM-073 + QM-083)

On first install (or when `licenseData` is absent), assign the user to variant A or B:

```js
const variant = Math.random() < 0.5 ? "A" : "B";
chrome.storage.local.set({ pricingVariant: variant });
```

When opening the checkout URL (from options or the activation flow), append `?variant=A` or `?variant=B`. The server (QM-073/QM-091) reads the param and routes to the correct Stripe price ID.

Read `pricingVariant` in `options.js` and pass it as a query param to every `/checkout` call.

No UI change is needed — the variant is invisible to the user.

---

## Conflict matrix and dispatch decision

| File | Phase 1 stories | Phase 2 stories | Risk |
|---|---|---|---|
| `content.js` | QM-084 | QM-086, QM-087 | High — 3 stories, sequential edits |
| `options.js` | QM-084 | QM-085, QM-087, QM-088, QM-089, QM-090 | High — 5 stories |
| `options.html` | — | QM-085, QM-087, QM-088, QM-089 | Medium |
| `lib/license-crypto.js` | QM-081 | QM-086 | Low — additive |
| `lib/license-state.js` | QM-083 | QM-082, QM-084, QM-086 | Low — additive |

**Dispatch decision:**

Phase 1 (QM-081, QM-083, QM-084): three disjoint pure-lib stories, then one integration story. QM-081 and QM-083 are fully disjoint and can run in parallel as separate subagents. QM-084 must land after both. Total: one parallel dispatch pair, then serial integration.

Phase 2: `content.js` and `options.*` contention across five stories makes parallel dispatch expensive to integrate. Recommend serial implementation in dependency order: QM-085 → QM-086 → QM-082 → QM-087 → QM-088 → QM-089. If time pressure is real, split into two tracks: (options-only: QM-085, QM-088, QM-089) vs. (content+alarm: QM-086, QM-082, QM-087), with a dedicated integration commit at the end. Track split requires strict file boundaries — options track does not touch `content.js`.

Phase 3 (QM-090): single story, no contention, can run in parallel with any Phase 2 story except QM-085 (they both write to the checkout URL logic in `options.js`). Safest: land after QM-085.

---

## Verify and definition of done

### SECURITY F-10 closure mapping

| F-10 requirement | Story that closes it |
|---|---|
| Pro flag cannot be set by toggling storage | QM-083 + QM-084 (state machine replaces boolean) |
| Activation requires valid Ed25519 signature | QM-081 |
| `isProActive()` verifies signature at runtime | QM-086 |
| Revocation propagates within 72h | QM-082 + QM-083 |
| User sees revocation state in UI | QM-087 + QM-088 |

F-10 is closed when QM-081, QM-083, QM-084, QM-082, and QM-086 are all merged and green.

### Per-story DoD

```bash
npm test                          # all tests green
node --check lib/license-crypto.js lib/license-state.js
grep -r '"pro"' content.js options.js  # must return 0 matches after QM-084
```

### E2E test (required before v1.0 ship)

File: `test/license-flow.e2e.js`

Sequence:
1. Load extension with empty storage (state = `INACTIVE`). Assert Pro features gated.
2. Enter a valid license key in options. Assert `computeState` returns `ACTIVE`. Assert Pro features accessible.
3. Force-set `gracePeriodEnd` to `Date.now() + 1` (simulate validation failure). Assert state transitions to `GRACE`. Assert Pro features still accessible. Assert grace warning banner visible in options.
4. Advance clock past `gracePeriodEnd`. Assert state transitions to `REVOKED`. Assert Pro features gated. Assert resubscribe CTA visible.
5. Simulate webhook `RESUBSCRIBED` event (via `transitionTo`). Assert state returns to `ACTIVE`.

E2E harness: Playwright with `chrome` channel, loading the extension via `--load-extension`. Use `page.evaluate` to stub `chrome.storage` where needed.

### Manual smoke (pre-release)

1. Load unpacked extension in Chrome 113+.
2. Open options → "License" section visible, status shows "Inactive".
3. Paste a valid test license key → activate → status shows "Active".
4. Open DevTools → Application → Local Storage → manually set `licenseData.status = "active"` without a valid key → reload → Pro features remain gated (F-10 closed).
5. Trigger alarm manually via `chrome.alarms.create` override → confirm re-validation fires and logs.

---

## Open questions

1. **Public key distribution.** Where is `PUBLIC_KEY_B64` baked in? Options: hardcoded constant in `lib/license-crypto.js` (simplest, requires extension update to rotate), fetched from server on activation (requires key-pinning to avoid MITM). Recommendation: hardcode for v1, add key-rotation story to v1.1 backlog.

2. **Email-lookup mode for `/validate` (QM-089).** The restore-purchase flow sends `{ email }` instead of `{ licenseKey }`. Needs explicit server-contract agreement with QM-078 implementer before QM-089 starts.

3. **Trial flow.** `LICENSE_STATES.TRIALING` is defined in QM-083 but no story sets it. Is there a trial-activation endpoint? If yes, add a story. If no, remove `TRIALING` from the state machine to avoid dead code.

4. **Alarm timing.** 1440-minute (24h) revalidation interval means maximum revocation lag of 24h + 72h grace = 96h. Is that acceptable? If not, reduce the alarm period (minimum is 1 minute per Chrome API).

5. **QM-091 server story.** Confirm it lands in `v1-license-server.md` before anyone starts QM-090 — the checkout URL variant param is a no-op until QM-091 routes it.

6. **`minimum_chrome_version` bump.** Raising to 113 for Ed25519 Web Crypto may block users on older Chrome. Check analytics before shipping QM-081.
