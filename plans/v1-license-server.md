# Plan — License Server (Epic 3: F3.1 + F3.2, QM-071..080)

**Milestone:** v1.0
**Repo:** `gh-pr-quick-merge-license-server` (new, standalone)
**Estimates:** QM-071 S · QM-072 M · QM-073 M · QM-074 S · QM-075 S · QM-076 M · QM-077 M · QM-078 M · QM-079 S · QM-080 S
**Parallel-safe with:** Extension Epic 3 F3.3 (public key embed) after QM-077 keypair is generated

---

## Goal

A Cloudflare Worker that:
1. Accepts Stripe webhooks to activate/deactivate licenses on purchase and refund/chargeback events.
2. Issues cryptographically signed license tokens (Ed25519) redeemable by the extension.
3. Exposes a minimal REST API (`/checkout`, `/portal`, `/license/issue`, `/license/validate`, `/license/revoke`) consumed by the extension and Stripe redirect flows.
4. Enforces per-IP rate limiting and nonce-based replay protection with no external database — KV only.

---

## Dependencies / Preconditions (not stories)

These must be satisfied before any story ships to production. They are ops/infra tasks, not code stories:

| Precondition | Owner | Blocks |
|---|---|---|
| Stripe account with a product + price object created; webhook secret (`STRIPE_WEBHOOK_SECRET`) noted | Ops | QM-072, QM-073 |
| Cloudflare account on Workers Paid plan; KV namespace `LICENSE_KV` created; namespace ID noted | Ops | QM-071 |
| Ed25519 keypair generated (`openssl genpkey -algorithm ed25519`); private key stored as Worker secret `ED25519_PRIVATE_KEY`; **public key exported for F3.3 extension embed** | Ops/Crypto | QM-077, F3.3 cross-epic |
| Domain registered; subdomain `api.<domain>` pointed at Worker via `wrangler.toml` route | Ops (Epic 4 F4.x) | production routing only — staging uses `*.workers.dev` |

---

## Repo Bootstrap

### Directory structure

```
gh-pr-quick-merge-license-server/
├── src/
│   ├── index.ts              # Worker entry — route dispatch
│   ├── middleware/
│   │   └── rateLimit.ts      # QM-080
│   ├── routes/
│   │   ├── checkout.ts       # QM-073
│   │   ├── portal.ts         # QM-074
│   │   ├── stripe-webhook.ts # QM-072
│   │   └── license/
│   │       ├── issue.ts      # QM-076
│   │       ├── validate.ts   # QM-078
│   │       └── revoke.ts     # QM-079
│   ├── lib/
│   │   ├── kv.ts             # QM-075 — KV schema + CRUD
│   │   └── sign.ts           # QM-077 — Ed25519 sign/verify
│   └── types.ts              # Shared TypeScript types
├── test/
│   ├── kv.test.ts
│   ├── sign.test.ts
│   ├── stripe-webhook.test.ts
│   ├── checkout.test.ts
│   ├── license-issue.test.ts
│   ├── license-validate.test.ts
│   ├── license-revoke.test.ts
│   ├── rateLimit.test.ts
│   └── integration/
│       └── smoke.test.ts     # QM-074 + staging smoke
├── wrangler.toml
├── vitest.config.ts
├── tsconfig.json
├── package.json
└── .github/
    └── workflows/
        └── ci.yml
```

### Language + toolchain

- **TypeScript** — strict mode, `"target": "ES2022"`, `"lib": ["ES2022"]`, `"moduleResolution": "Bundler"`
- **Vitest** with `@cloudflare/vitest-pool-workers` — tests run inside a Miniflare Worker environment; no mocking required for KV or crypto APIs
- **Wrangler v3** — `wrangler dev` for local, `wrangler deploy` for staging/prod
- **CI:** GitHub Actions — `npm ci && npm test && npm run typecheck` on every push; `wrangler deploy --env staging` on merge to `main`

### Core TypeScript types (`src/types.ts`)

```typescript
/** Stored in KV under key `license:<licenseKey>` */
export interface LicenseRecord {
  licenseKey: string;          // UUID v4
  customerId: string;          // Stripe customer ID
  subscriptionId: string;      // Stripe subscription ID
  email: string;
  status: "active" | "revoked" | "expired";
  issuedAt: number;            // Unix epoch seconds
  expiresAt: number | null;    // null = lifetime; future use for subscriptions
  revokedAt: number | null;
}

/** Signed payload embedded in the JWT-like token issued to the extension */
export interface LicenseTokenPayload {
  sub: string;                 // licenseKey
  email: string;
  status: "active";
  iat: number;                 // issued-at (seconds)
  exp: number;                 // expiry (seconds) — short-lived; extension re-validates periodically
  nonce: string;               // random 16-byte hex; stored in KV to prevent replay
}

/** Wire format returned by POST /license/issue and POST /license/validate */
export interface LicenseTokenResponse {
  token: string;               // base64url(payload) + "." + base64url(signature)
  expiresAt: number;           // echo of exp for convenience
}

/** KV key for nonce replay store: `nonce:<nonce>` → "1", TTL = token exp window */
export type NonceKey = `nonce:${string}`;

/** Bindings shape passed to every handler */
export interface Env {
  LICENSE_KV: KVNamespace;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_SECRET_KEY: string;
  ED25519_PRIVATE_KEY: string; // hex-encoded raw 64-byte private key
  RATE_LIMIT_KV: KVNamespace;  // can reuse LICENSE_KV; separate namespace preferred
}
```

---

## Phase 1 — Repo + Scaffolding (sequential)

Stories must land in order; each is a dependency for Phase 2.

### QM-071 — Scaffold repo (S)

Create the repo. Wire everything together so `npm test` runs green on an empty test suite and `wrangler dev` starts without error.

**Tasks:**
- `npm init` + install `wrangler`, `typescript`, `vitest`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`
- `wrangler.toml` with `kv_namespaces` bindings for `LICENSE_KV` and `RATE_LIMIT_KV`; `[env.staging]` block with staging namespace IDs
- `tsconfig.json` strict mode; `vitest.config.ts` using `@cloudflare/vitest-pool-workers`
- Stub `src/index.ts` — 404 fallback only
- GH Actions `ci.yml`: `npm ci`, `npm test`, `npm run typecheck`
- Add `.dev.vars.example` documenting required secrets

**Verify:** `wrangler dev` serves 404; `npm test` exits 0; `npm run typecheck` exits 0.

---

### QM-075 — KV schema + CRUD helpers (S, dep QM-071)

All KV access goes through `src/lib/kv.ts`. No route handler touches `env.LICENSE_KV` directly.

**Exports:**
- `getLicense(kv, licenseKey): Promise<LicenseRecord | null>`
- `setLicense(kv, record: LicenseRecord, ttlSeconds?: number): Promise<void>` — TTL only for expired records cleanup
- `getByCustomerId(kv, customerId): Promise<LicenseRecord | null>` — secondary index key `customer:<customerId>` → licenseKey
- `setByCustomerId(kv, customerId, licenseKey): Promise<void>`
- `consumeNonce(kv, nonce, ttlSeconds): Promise<boolean>` — atomic check-and-set using KV `putIfAbsent` pattern; returns false if nonce already exists (replay detected)

**Tests (target: 10+):**
1. `getLicense` returns null for missing key
2. `setLicense` round-trips a full `LicenseRecord`
3. `getByCustomerId` resolves via secondary index
4. `setByCustomerId` writes the index key
5. `getLicense` after `setLicense` with TTL still returns record within window
6. `consumeNonce` returns true first call
7. `consumeNonce` returns false on second call with same nonce (replay blocked)
8. `consumeNonce` TTL respected (simulated via Miniflare time travel)
9. `getLicense` returns null for revoked record only if caller logic checks status (CRUD is status-agnostic)
10. `setLicense` overwrites existing record cleanly

---

### QM-077 — Ed25519 signing utility (M, dep QM-071)

`src/lib/sign.ts` wraps the Web Crypto API (`SubtleCrypto`) available in the Workers runtime.

**Exports:**
- `importPrivateKey(hexKey: string): Promise<CryptoKey>` — imports raw 64-byte private key
- `signPayload(privateKey: CryptoKey, payload: LicenseTokenPayload): Promise<string>` — serialises payload as canonical JSON (keys sorted), signs with Ed25519, returns `base64url(json) + "." + base64url(sig)`
- `verifyToken(publicKeyHex: string, token: string): Promise<LicenseTokenPayload | null>` — used in validate route; returns null on bad sig or parse error
- `buildPayload(record: LicenseRecord, nonce: string, ttlSeconds: number): LicenseTokenPayload` — pure helper; testable without crypto

**Tests (target: 8+):**
1. `buildPayload` sets `exp = iat + ttlSeconds`
2. `buildPayload` includes nonce field
3. `signPayload` returns a two-part dot-delimited string
4. `verifyToken` round-trips a signed payload
5. `verifyToken` returns null on tampered payload
6. `verifyToken` returns null on tampered signature
7. `verifyToken` returns null on malformed token string
8. `importPrivateKey` throws on wrong-length hex input

---

## Phase 2 — Endpoints (parallelizable after Phase 1 merges)

Once QM-071 + QM-075 + QM-077 are merged to `main`, **dispatch 5 parallel TDD agents** (see Dispatch Decision below). Each owns one or two route files with no overlap.

---

### QM-072 — Stripe webhook handler (M, dep QM-071)

`src/routes/stripe-webhook.ts` — `POST /webhook`

Handle `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed` (optional for v1 — log only).

Stripe signature verification via `stripe.webhooks.constructEventAsync` (use the official `stripe` npm package compiled for Workers).

On `checkout.session.completed`: create `LicenseRecord` via `kv.ts`; set status `"active"`.
On `customer.subscription.deleted`: update status to `"revoked"`, set `revokedAt`.

Idempotency: key on Stripe event ID — store `event:<eventId>` → "processed" in KV before processing; skip if already present.

**Tests (target: 8+):**
1. Valid `checkout.session.completed` → creates license record + sets active
2. Duplicate event ID → 200 no-op (idempotent)
3. Invalid Stripe signature → 400
4. Missing `STRIPE_WEBHOOK_SECRET` binding → 500 with no leak
5. `customer.subscription.deleted` → record status becomes `"revoked"`
6. Unknown event type → 200 (logged, not errored)
7. Malformed JSON body → 400
8. `getByCustomerId` secondary index written on checkout completion

---

### QM-073 — POST /checkout (M, dep QM-071)

`src/routes/checkout.ts`

Creates a Stripe Checkout session and returns the session URL for redirect.

Request body: `{ email: string }`. Returns `{ url: string }`.

Uses `stripe.checkout.sessions.create` with `mode: "payment"` (lifetime) or `mode: "subscription"` — make this a `STRIPE_MODE` env var for flexibility. Set `metadata.email` so the webhook can correlate.

**Tests (target: 6+):**
1. Valid email → returns Stripe session URL (mock Stripe client)
2. Missing email → 400
3. Invalid email format → 400
4. Stripe API error → 502 with generic message (no Stripe internals leaked)
5. Response sets `Access-Control-Allow-Origin` for extension origin
6. OPTIONS preflight → 204 with CORS headers

---

### QM-076 — POST /license/issue (M, dep QM-072 + QM-075)

`src/routes/license/issue.ts`

Called by the extension after purchase. Authenticates by `licenseKey` in request body (shared secret from webhook response — see open questions). Looks up record, checks `status === "active"`, mints a short-lived token (TTL 24h default, `LICENSE_TOKEN_TTL_SECONDS` env override).

Request: `{ licenseKey: string }`. Response: `LicenseTokenResponse`.

**Tests (target: 7+):**
1. Valid active license → returns signed token
2. Revoked license → 403
3. Unknown license key → 404
4. Token exp set to `iat + ttlSeconds`
5. Nonce stored in KV (consumeNonce called)
6. Response includes `expiresAt`
7. Missing `licenseKey` in body → 400

---

### QM-078 — POST /license/validate + nonce replay protection (M, dep QM-075 + QM-077)

`src/routes/license/validate.ts`

Extension calls this to verify a cached token is still valid (e.g. on browser start).

Request: `{ token: string }`. Parses token, calls `verifyToken`, checks `exp > now`, checks `consumeNonce` returns false (nonce must already be stored — if missing, token was never issued by us → 401). Looks up `LicenseRecord` to confirm `status === "active"` (handles server-side revocation propagation).

Response on success: `{ valid: true, email: string, expiresAt: number }`.

**Tests (target: 8+):**
1. Valid token with known nonce → `{ valid: true }`
2. Expired token → 401 `token_expired`
3. Bad signature → 401 `invalid_token`
4. Nonce not in KV (never issued) → 401 `invalid_token`
5. License revoked server-side → 403 `license_revoked`
6. Malformed token string → 400
7. Missing `token` field → 400
8. Valid token for unknown license key → 404

---

### QM-079 — POST /license/revoke (S, dep QM-075)

`src/routes/license/revoke.ts`

Admin endpoint — bearer token auth (`ADMIN_SECRET` env var). Sets record status to `"revoked"`.

Request: `{ licenseKey: string }`. Response: `{ revoked: true }`.

**Tests (target: 5+):**
1. Valid admin secret + active license → revoked
2. Missing admin secret → 401
3. Wrong admin secret → 401
4. Unknown license key → 404
5. Already-revoked license → 200 idempotent (no error)

---

### QM-080 — Rate limiting middleware (S, dep QM-071)

`src/middleware/rateLimit.ts`

Sliding window rate limit keyed on `CF-Connecting-IP`. Uses `RATE_LIMIT_KV` — key `rl:<ip>:<window>` with `expirationTtl`. Default: 60 requests per 60 seconds.

Applied in `src/index.ts` before route dispatch. Returns `429` with `Retry-After` header if exceeded.

**Tests (target: 6+):**
1. Under limit → request passes through
2. At limit → 429 returned
3. `Retry-After` header present on 429
4. Window resets after TTL
5. Different IPs get independent counters
6. Missing `CF-Connecting-IP` (local dev) → bypass rate limit (configurable)

---

## Phase 3 — Customer Portal + Integration Testing

### QM-074 — GET /portal (S, dep QM-072 + QM-073)

`src/routes/portal.ts`

Creates a Stripe Customer Portal session for an existing customer. Requires an authenticated request — pass `licenseKey` as a query param; look up `customerId` via `getByCustomerId`, create Stripe portal session, redirect to `session.url`.

**Tests (target: 5+):**
1. Valid licenseKey → 302 redirect to Stripe portal URL
2. Unknown licenseKey → 404
3. Revoked license → 403 (disallow portal access for revoked)
4. Stripe API error → 502
5. Missing `licenseKey` param → 400

### Smoke tests against staging Worker (`test/integration/smoke.test.ts`)

Run with `WORKER_URL=https://<slug>.workers.dev npm run test:smoke`. Not part of unit CI — separate GH Actions job gated on `deploy-staging` success.

1. `POST /checkout` with test email → returns URL matching `checkout.stripe.com`
2. Stripe test-mode webhook delivery → KV record created (poll KV via `wrangler kv:key get`)
3. `POST /license/issue` with seeded test licenseKey → signed token returned
4. `POST /license/validate` with that token → `{ valid: true }`
5. `POST /license/revoke` (admin auth) → subsequent `/validate` returns 403
6. Rate limit: 61 rapid requests to `/license/validate` → last batch returns 429

---

## File Ownership Table

| File | Story | Phase |
|---|---|---|
| `src/index.ts` | QM-071 (stub) + QM-080 (middleware wiring) | 1 / 2 |
| `src/middleware/rateLimit.ts` | QM-080 | 2 |
| `src/routes/stripe-webhook.ts` | QM-072 | 2 |
| `src/routes/checkout.ts` | QM-073 | 2 |
| `src/routes/portal.ts` | QM-074 | 3 |
| `src/routes/license/issue.ts` | QM-076 | 2 |
| `src/routes/license/validate.ts` | QM-078 | 2 |
| `src/routes/license/revoke.ts` | QM-079 | 2 |
| `src/lib/kv.ts` | QM-075 | 1 |
| `src/lib/sign.ts` | QM-077 | 1 |
| `src/types.ts` | QM-071 (initial shape) | 1 |
| `wrangler.toml` | QM-071 | 1 |
| `vitest.config.ts` | QM-071 | 1 |
| `test/integration/smoke.test.ts` | QM-074 | 3 |

No two Phase 2 agents touch the same file. `src/index.ts` is touched by QM-080 only in Phase 2 (route wiring); all Phase 2 agents import from `src/index.ts` but do not edit it.

---

## Dispatch Decision

**After QM-071 + QM-075 + QM-077 are merged and CI is green on `main`:**

Dispatch **5 parallel TDD agents**:

| Agent | Stories | Owns |
|---|---|---|
| A | QM-072 | `stripe-webhook.ts`, `test/stripe-webhook.test.ts` |
| B | QM-073 | `checkout.ts`, `test/checkout.test.ts` |
| C | QM-076 | `license/issue.ts`, `test/license-issue.test.ts` |
| D | QM-078 + QM-079 | `license/validate.ts`, `license/revoke.ts`, corresponding tests |
| E | QM-080 | `middleware/rateLimit.ts`, `src/index.ts` (route wiring), `test/rateLimit.test.ts` |

**Merge order:** A and B are independent — merge in any order. C depends on A (needs active license from webhook) conceptually but the code only depends on `kv.ts` — merge C freely. D depends on `sign.ts` (already merged in Phase 1). E is independent. QM-074 (Phase 3) merges last after A + B + C are in.

Each agent's brief must include the exact base SHA from `git rev-parse origin/main` at dispatch time.

---

## Verify Steps

```bash
# Unit tests (all phases)
npm test

# Typecheck
npm run typecheck

# Local dev with Miniflare (Wrangler v3 uses Miniflare internally)
wrangler dev --local

# Deploy to staging
wrangler deploy --env staging

# Smoke tests against staging (set WORKER_URL first)
WORKER_URL=https://<slug>.workers.dev npm run test:smoke

# Check rate limit header
curl -i -X POST https://<slug>.workers.dev/license/validate \
  -H "Content-Type: application/json" \
  -d '{"token":"bad"}' | grep -E "HTTP|Retry-After|x-ratelimit"
```

---

## Definition of Done

- [ ] `npm test` green — all unit tests pass inside Miniflare environment
- [ ] `npm run typecheck` exits 0 — no `any` escapes in route handlers or lib
- [ ] Signed token from `POST /license/issue` decodes and verifies under the exported Ed25519 public key using `verifyToken`
- [ ] Webhook idempotency proven: same Stripe event ID delivered twice → second delivery returns 200 with no duplicate KV write
- [ ] Rate limit: 61 sequential requests to any endpoint from the same IP → request 61 returns 429 with `Retry-After` header
- [ ] `POST /license/validate` returns 401 on replay: using the same token twice within its TTL window (nonce consumed on first call)
- [ ] Smoke test suite green against staging Worker
- [ ] No Stripe secret keys or private key material appear in any log line (verified via `wrangler tail` during smoke run)

---

## Open Questions

1. **KV vs D1 for license records.** KV is simpler and has no SQL dependency, but secondary indexes (customer → license) are manual and eventually consistent. D1 would give proper relational queries and atomic updates. Recommendation: ship v1 with KV; migrate to D1 in v1.1 if customer lookup consistency becomes an issue.

2. **License key delivery after purchase.** The webhook fires server-side; the extension needs to know the license key. Options: (a) Stripe `success_url` encodes the license key in the redirect (generated pre-session, stored in KV keyed on session ID, claimed on `checkout.session.completed`); (b) customer emails the key from a receipt email. Option (a) is cleaner for UX — decide before QM-073 ships.

3. **Workers Paid cost.** KV reads are $0.50/million; writes $5/million. A validate call costs 2 KV reads (license record + nonce check). At 10k DAU validating once per session: ~600k reads/month — well within free tier. Rate limit adds 1 KV write per request. Acceptable for v1.

4. **Token TTL.** 24h default means the extension re-calls `/license/issue` daily. Shorter TTL (1h) increases server load; longer (7d) widens the revocation propagation window. 24h is the recommended default; expose `LICENSE_TOKEN_TTL_SECONDS` as a Worker env var to tune without code changes.

5. **CORS origin allowlist.** Extension origin is `chrome-extension://<extension-id>`. The extension ID differs between dev and prod builds. Store allowed origins as a `CORS_ORIGINS` env var (comma-separated) rather than hardcoding.
