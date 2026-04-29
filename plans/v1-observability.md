# Plan — Epic 5: Observability — MOSTLY DEFERRED

> **Status as of 2026-04-29:** v1.0 ships donation-funded (no license server, no conversion funnel, no paid-tier dashboards). The PostHog telemetry funnel + Cloudflare Worker logs + SLO alerting are all deferred. **The Sentry crash-reporting subset is retained** — QM-126 (SDK + sanitization), QM-127 (error capture), QM-128 (release tagging + source maps in CI). Those three stories remain in `BACKLOG.md` Epic 5; the rest are retired. The full plan below is kept as scaffolding if observability infra ever gets built.

**Milestone:** v1.0 (originally — most stories now deferred)
**Estimate:** L (20 stories across 4 phases)
**Dependencies:** Epic 3 license server live (required for server-side funnel events QM-130, QM-133..137)
**Parallel-safe with:** Epic 4 (UI polish), any non-server work

---

## Goal

Operate on data, not vibes. Ship opt-in telemetry, crash reporting, server-side structured logs, and dashboards so every release decision is backed by actual usage numbers, error rates, and conversion metrics.

---

## Privacy stance

Telemetry is **opt-in only**. No event fires before the user explicitly enables it. A kill-switch purges all locally buffered data on opt-out. The store listing and in-extension disclosure copy must be approved before any SDK boots in production. This is the prerequisite ordering enforced in Phase 1.

---

## Phase 1 — Privacy foundation (sequential, blocks everything else)

All three stories land on `main` before any SDK code ships.

### QM-121 — Telemetry consent model + opt-in gate `[ext]` S

Introduce `telemetry.enabled` (boolean, default `false`) in `chrome.storage.sync`. Gate every outbound SDK call behind `await getTelemetryEnabled()`.

**File ownership:**
- **NEW:** `lib/telemetry-consent.js` — exports `getTelemetryEnabled()`, `setTelemetryEnabled(bool)`, `onConsentChange(cb)`
- **NEW:** `test/telemetry-consent.test.js` — 8+ tests covering default false, set true, change listener fires, storage key collision guard
- **EDIT:** `options.html` + `options.js` — add consent toggle (checkbox + descriptive label, links to disclosure)

**DoD:** default state is opted-out; toggling the checkbox persists to storage; no PostHog/Sentry call occurs without consent.

### QM-122 — Kill-switch + purge-on-opt-out `[ext]` S (dep QM-121)

When `setTelemetryEnabled(false)` is called, flush and purge any locally buffered PostHog events and clear Sentry breadcrumbs. Disable both SDKs in-process without requiring a page reload.

**File ownership:**
- **EDIT:** `lib/telemetry-consent.js` — add `purgeOnOptOut()` called by change listener when transitioning true → false
- **NEW:** `lib/telemetry-purge.js` — orchestrates PostHog `reset()` + Sentry `close()` + breadcrumb clear; exported so SDK bootstrap modules can register their teardown hooks
- **NEW:** `test/telemetry-purge.test.js` — 6+ tests: purge called on transition, no-op if already disabled, teardown hooks invoked in order

**DoD:** opt-out triggers immediate in-process teardown; no events reach PostHog or Sentry after the toggle flip; verified in manual smoke test.

### QM-139 — Privacy disclosure copy + store listing update `[ext]` S (dep QM-121)

Write the privacy disclosure that will appear in the Chrome Web Store listing and in-extension settings. Must be reviewed and approved by a human before Phase 2 merges.

**File ownership:**
- **NEW:** `docs/privacy-disclosure.md` — plain-language description of what is collected (event names, no PII, IP not stored), retention period (90 days PostHog, 30 days Sentry), opt-out mechanics, data processor names
- **EDIT:** `options.html` — link to disclosure from consent toggle

**DoD:** store listing draft updated; disclosure reviewed; sign-off recorded in PR description. No Phase 2 story merges until this PR is approved.

---

## Phase 2 — Telemetry + crash reporting (extension) — parallel after Phase 1

Once Phase 1 is on `main`, the following tracks run in parallel. An ext-team agent owns all of them; dispatch into sub-tasks by dependency group.

### Track A — PostHog SDK (QM-123, then QM-124 + QM-125 in parallel)

**QM-123 — PostHog SDK bootstrap in service worker `[ext]` M (dep QM-121)**

Install `posthog-js` (pinned version). Initialise in the service worker behind the consent gate. Use PostHog's `persistence: "memory"` mode (no cookies, no localStorage — service workers have neither). Distinct ID = `chrome.runtime.id + "_" + installTimestamp`; never user-identifying.

**File ownership:**
- **NEW:** `lib/posthog-client.js` — lazy-init singleton; exports `capture(event, props)`, `identify(distinctId)`, `reset()`; no-ops if consent is false
- **EDIT:** `service-worker.js` — import and initialise `posthog-client` on startup
- **NEW:** `test/posthog-client.test.js` — 8+ tests: no-op when disabled, capture queues when enabled, reset clears queue, distinct ID format validated

PostHog project key comes from `process.env.POSTHOG_API_KEY` injected at build time (webpack DefinePlugin). Staging and prod use different keys.

**QM-124 — Core feature-usage events `[ext]` S (dep QM-123)**

Emit the following events from existing merge call sites:

| Event | Properties |
|---|---|
| `merge_triggered` | `repo`, `pr_number`, `strategy` (`squash`/`merge`/`rebase`), `is_pro` |
| `merge_succeeded` | `repo`, `pr_number`, `strategy`, `duration_ms` |
| `merge_failed` | `repo`, `pr_number`, `strategy`, `error_code` |
| `options_opened` | — |
| `pinned_repo_added` | `repo` (hashed SHA-256, not raw) |
| `pinned_repo_removed` | `repo` (hashed) |

`repo` is always SHA-256 hashed before capture. `pr_number` is sent as-is (not PII).

**File ownership:**
- **EDIT:** `lib/merge-handler.js` — add `capture()` calls at merge entry, success, failure
- **EDIT:** `options.js` — add `options_opened`, `pinned_repo_added/removed` calls
- **NEW:** `test/merge-handler-telemetry.test.js` — 6+ tests: events fire on success/failure, repo hashed, no-op when disabled

**QM-125 — Retention signal: `session_start` + `days_since_install` `[ext]` S (dep QM-123)**

On service-worker startup, emit `session_start` with `{ days_since_install, version, browser }`. Derive `days_since_install` from `chrome.management.getSelf().installTime` (store in `chrome.storage.local` on first install via `chrome.runtime.onInstalled`).

**File ownership:**
- **EDIT:** `service-worker.js` — emit `session_start` after PostHog init; persist `install_ts` on `onInstalled`
- **NEW:** `test/session-start.test.js` — 4+ tests: event fires once per SW startup, `days_since_install` computed correctly, version matches manifest

### Track B — Sentry crash reporting (QM-126, then QM-127 + QM-128 in parallel)

**QM-126 — Sentry SDK bootstrap + F-15 sanitization `[ext]` M (dep QM-121)**

Install `@sentry/browser` (pinned). Init in service worker behind consent gate. Apply `beforeSend` hook that:
1. Strips any URL containing `github.com/` from breadcrumbs (replaces with `[github-url-redacted]`).
2. Removes `Authorization` and `token` keys from request headers in event payload.
3. Strips stack frames from `chrome-extension://` URLs that reference user data paths.

This is the "F-15 sanitization" required by the privacy disclosure.

**File ownership:**
- **NEW:** `lib/sentry-client.js` — lazy-init singleton; exports `captureException(err, ctx)`, `addBreadcrumb(crumb)`, `close()`
- **NEW:** `lib/sentry-sanitize.js` — pure `beforeSend(event)` function + `sanitizeBreadcrumb(crumb)`, fully unit-tested
- **NEW:** `test/sentry-sanitize.test.js` — 10+ tests: GitHub URL stripped from breadcrumbs, auth header removed, clean frame preserved, dirty frame stripped, null event passthrough
- **EDIT:** `service-worker.js` — import and init `sentry-client`

DSN from `process.env.SENTRY_DSN` injected at build time. Staging DSN routes to a `gh-pr-quick-merge-staging` Sentry project.

**QM-127 — Structured error capture at merge call sites `[ext]` S (dep QM-126)**

Wrap the three merge strategies (`squash`, `merge`, `rebase`) in try/catch that calls `captureException`. Pass structured context: `{ repo: hashedRepo, strategy, pr_number, mergeable_state }`.

**File ownership:**
- **EDIT:** `lib/merge-handler.js` — add `captureException` at each strategy's catch block
- **EDIT:** `test/merge-handler-telemetry.test.js` — extend: Sentry called on throw, context keys present, repo hashed

**QM-128 — Sentry release tagging + source maps in CI `[ext]` S (dep QM-126)**

Set `release: process.env.npm_package_version` in Sentry init. Add a CI step that uploads source maps to Sentry using `sentry-cli` after the webpack build. Tag each release with the git SHA.

**File ownership:**
- **EDIT:** `.github/workflows/release.yml` — add `sentry-cli sourcemaps upload` step after `npm run build`
- **EDIT:** `webpack.config.js` — emit source maps only in production builds (`devtool: 'hidden-source-map'`); exclude source maps from the extension zip

### Track C — Conversion funnel (QM-129..131, parallel; QM-132 after events exist)

**QM-129 — Pro modal impression + dismiss events `[ext]` S (dep QM-123)**

| Event | Properties |
|---|---|
| `pro_modal_shown` | `trigger` (`merge_limit`/`manual`) |
| `pro_modal_dismissed` | `trigger`, `time_open_ms` |

**File ownership:**
- **EDIT:** `lib/pro-modal.js` — add `capture()` calls at show and dismiss
- **NEW:** `test/pro-modal-telemetry.test.js` — 4+ tests

**QM-130 — Checkout-initiated + license-entry events `[ext + server]` S (dep QM-123 + Epic 3)**

| Event | Properties |
|---|---|
| `checkout_initiated` | `plan` (`monthly`/`annual`) |
| `license_entry_attempted` | `method` (`paste`/`type`) |
| `license_entry_succeeded` | `method`, `time_to_activate_ms` |
| `license_entry_failed` | `method`, `error_code` |

Extension side captures these. Server side (license Worker) logs `checkout_initiated` via Logpush (see QM-133) — do not double-count.

**File ownership:**
- **EDIT:** `lib/checkout-handler.js` — add `capture()` at checkout click
- **EDIT:** `lib/license-validator.js` — add `capture()` at entry attempt, success, failure
- **NEW:** `test/checkout-telemetry.test.js` — 4+ tests

**QM-131 — First Pro action event `[ext]` S (dep QM-123 + Epic 3)**

Emit `first_pro_action` once per install (gate on `chrome.storage.local.firstProActionSent`). Properties: `{ action: "merge", days_since_install, days_since_upgrade }`.

**File ownership:**
- **EDIT:** `lib/merge-handler.js` — add first-action guard
- **EDIT:** `test/merge-handler-telemetry.test.js` — extend: fires once, not twice

**QM-132 — PostHog funnel dashboard config-as-code `[ext]` S**

Commit a PostHog dashboard JSON export (or Terraform/API config) that defines the conversion funnel: `pro_modal_shown → checkout_initiated → license_entry_succeeded → first_pro_action`. Alert threshold: if `pro_modal_shown → checkout_initiated` drops below 5% over 7 days, fire a Slack webhook.

**File ownership:**
- **NEW:** `infra/posthog/funnel-dashboard.json` — PostHog dashboard export
- **NEW:** `infra/posthog/README.md` — import instructions

**DoD for Phase 2:** all events verified in PostHog live-tail on staging; Sentry test exception visible in staging project; source maps resolve correctly; no raw repo names or auth tokens appear in any captured event.

---

## Phase 3 — License-server observability (parallel with Phase 2)

Independent of extension work. A server-team agent owns QM-133..137 + QM-140. Can start immediately after Phase 1 since it requires only Epic 3 (license Worker) to be live, not the extension telemetry.

### QM-133 — Structured request logging in Worker → R2 via Logpush `[server]` M

Add a `structuredLog(req, res, ctx)` helper that emits a newline-delimited JSON log line per request. Fields: `ts` (ISO-8601), `method`, `path`, `status`, `duration_ms`, `license_key_prefix` (first 8 chars only), `cf_ray`, `country`. Configure Cloudflare Logpush to deliver Worker logs to an R2 bucket (`qm-worker-logs`) with daily partitioning (`YYYY/MM/DD/`).

**File ownership:**
- **NEW:** `server/lib/structured-log.js` — `logRequest(req, res, durationMs, ctx)` pure function
- **EDIT:** `server/src/worker.js` — wrap each route handler with timing + log call
- **NEW:** `server/test/structured-log.test.js` — 6+ tests: fields present, key truncated, no full key leaks
- **NEW:** `infra/cloudflare/logpush-config.json` — Logpush job definition (applied via `wrangler` or Terraform)

### QM-134 — Signing-key rotation health metric + alert `[server]` S

Expose a `GET /metrics/key-age` endpoint on the Worker (internal, protected by a shared secret header `X-Metrics-Token`). Returns JSON: `{ active_key_id, days_since_rotation, next_rotation_due }`. Wire a Cloudflare Worker Cron Trigger that runs daily and posts to a Slack webhook if `days_since_rotation > 80` (rotation is expected every 90 days).

**File ownership:**
- **EDIT:** `server/src/worker.js` — add `/metrics/key-age` route
- **NEW:** `server/src/cron-key-health.js` — cron handler
- **EDIT:** `wrangler.toml` — add `[triggers] crons = ["0 9 * * *"]`
- **NEW:** `server/test/key-health.test.js` — 4+ tests: alert fires at day 81, not at day 79

### QM-135 — Webhook processing lag metric + alert `[server]` S

Record `webhook_received_ts` (from Stripe `created` field) and `webhook_processed_ts` (Worker wall clock). Log lag as `webhook_lag_ms`. If lag exceeds 30 000 ms (30 s) for any event, emit a structured log line at `level: "warn"` with `alert: "webhook_lag"`. A Cloudflare Log Drains filter forwards `alert` field lines to a Slack webhook.

**File ownership:**
- **EDIT:** `server/src/webhook-handler.js` — compute and log `webhook_lag_ms`
- **NEW:** `server/test/webhook-lag.test.js` — 4+ tests: lag computed correctly, warn emitted at 30 001 ms, not at 29 999 ms

### QM-136 — Refund rate + churn dashboard `[server]` M

Query R2 log data (via Cloudflare Analytics Engine or an R2 Select query in a scheduled Worker) to compute weekly: total activations, refunds, net new licenses, churn rate. Publish as a static JSON to `qm-worker-logs/dashboards/weekly.json`. Add a GitHub Actions job that fetches this JSON and posts a summary to Slack every Monday at 09:00 UTC.

**File ownership:**
- **NEW:** `server/src/cron-churn-report.js` — scheduled Worker; queries R2, writes `weekly.json`
- **NEW:** `.github/workflows/weekly-report.yml` — GH Actions cron that posts Slack summary
- **EDIT:** `wrangler.toml` — add second cron `"0 9 * * 1"` for weekly report

### QM-137 — SLO burn-rate alert (error rate, p95 latency) `[server]` S

Define two SLOs:
- **Error rate SLO:** < 1% 5xx responses over any 1-hour window.
- **Latency SLO:** p95 `duration_ms` < 500 ms over any 1-hour window.

Implement as a Cloudflare Analytics Engine query in a cron Worker. If either SLO burns > 5× in a 1-hour window (fast-burn alert), post to Slack with `level: "critical"`. If > 2× over 6 hours (slow-burn), post with `level: "warning"`.

**File ownership:**
- **NEW:** `server/src/cron-slo-alert.js` — fast-burn + slow-burn logic
- **EDIT:** `wrangler.toml` — add cron `"0 * * * *"` for hourly SLO check
- **NEW:** `server/test/slo-alert.test.js` — 6+ tests: fast-burn fires at 5×, not 4×; slow-burn fires at 2×; Slack payload format correct

### QM-140 — Observability runbook + on-call setup `[server]` S

Write the runbook covering: how to query R2 logs, how to ack a Slack alert, how to silence a flapping alert, key rotation procedure, Sentry triage steps. Set up PagerDuty (or equivalent) with a single on-call rotation; Slack alerts route to PagerDuty for `level: "critical"` events only.

**File ownership:**
- **NEW:** `docs/runbook-observability.md`
- **NEW:** `infra/pagerduty/routing-rules.json` (or equivalent)

**DoD for Phase 3:** Logpush delivering to R2 on staging; `/metrics/key-age` responding; SLO alert fires in staging when a synthetic 5xx flood is injected; runbook reviewed by one other engineer.

---

## Phase 4 — Funnel dashboard + smoke test (depends on Phase 2 + Phase 3)

### QM-132 — PostHog funnel dashboard config-as-code

(Listed under Phase 2 Track C above. Merges last in Phase 2 once events are emitting.)

### QM-138 — End-to-end telemetry smoke test `[ext]` S (dep QM-123 + QM-126)

Add a `test:smoke-telemetry` npm script that:
1. Loads the built extension in a headless Chromium via Puppeteer.
2. Enables telemetry via `chrome.storage.sync`.
3. Triggers a mock merge (intercepts the GitHub API call).
4. Asserts that PostHog received a `merge_triggered` event (intercept via `nock` or a local PostHog stub).
5. Asserts that no raw repo name appears in the captured payload (only hash).

**File ownership:**
- **NEW:** `test/smoke/telemetry.smoke.test.js`
- **EDIT:** `package.json` — add `"test:smoke": "jest test/smoke/"` script

**DoD for Phase 4:** smoke test green in CI; PostHog funnel dashboard importable to a fresh PostHog project; no raw PII visible in any event payload in the smoke run.

---

## Dispatch decision

After Phase 1 merges, split into two parallel agents:

- **ext-agent** — owns Phase 2 (all `[ext]` stories). Works in `worktrees/ext-observability`. File boundary: `lib/`, `test/`, `options.*`, `service-worker.js`, `webpack.config.js`, `.github/workflows/release.yml`, `infra/posthog/`.
- **server-agent** — owns Phase 3 (all `[server]` stories). Works in `worktrees/server-observability`. File boundary: `server/`, `wrangler.toml`, `infra/cloudflare/`, `infra/pagerduty/`, `docs/runbook-observability.md`.

Both agents base off the Phase 1 merge SHA. Print base SHA before dispatch. Phase 4 (QM-138, QM-132 final merge) waits for both agents to finish and rebases last.

---

## File ownership table

| File | Story | Agent |
|---|---|---|
| `lib/telemetry-consent.js` | QM-121, QM-122 | ext |
| `lib/telemetry-purge.js` | QM-122 | ext |
| `lib/posthog-client.js` | QM-123 | ext |
| `lib/sentry-client.js` | QM-126 | ext |
| `lib/sentry-sanitize.js` | QM-126 | ext |
| `lib/merge-handler.js` | QM-124, QM-127, QM-131 | ext |
| `lib/pro-modal.js` | QM-129 | ext |
| `lib/checkout-handler.js` | QM-130 | ext |
| `lib/license-validator.js` | QM-130 | ext |
| `service-worker.js` | QM-123, QM-125, QM-126 | ext |
| `options.html`, `options.js` | QM-121, QM-139 | ext |
| `webpack.config.js` | QM-128 | ext |
| `.github/workflows/release.yml` | QM-128 | ext |
| `infra/posthog/` | QM-132 | ext |
| `test/smoke/telemetry.smoke.test.js` | QM-138 | ext |
| `server/lib/structured-log.js` | QM-133 | server |
| `server/src/worker.js` | QM-133, QM-134 | server |
| `server/src/webhook-handler.js` | QM-135 | server |
| `server/src/cron-key-health.js` | QM-134 | server |
| `server/src/cron-churn-report.js` | QM-136 | server |
| `server/src/cron-slo-alert.js` | QM-137 | server |
| `wrangler.toml` | QM-134, QM-136, QM-137 | server |
| `infra/cloudflare/logpush-config.json` | QM-133 | server |
| `docs/privacy-disclosure.md` | QM-139 | ext |
| `docs/runbook-observability.md` | QM-140 | server |

No file appears in more than one agent's boundary.

---

## Verify + DoD (epic-level)

```bash
# Extension tests
npm test                        # all existing + new tests green
npm run test:smoke              # end-to-end telemetry smoke green

# Typecheck
npm run typecheck               # zero errors

# Lint
npm run lint                    # zero warnings

# Manual consent gate
# 1. Load unpacked extension
# 2. Open options — telemetry toggle is OFF by default
# 3. Open DevTools network tab — confirm zero PostHog/Sentry requests
# 4. Enable toggle — confirm session_start appears in PostHog live-tail
# 5. Disable toggle — confirm PostHog reset() called, no further events

# Server
wrangler dev                    # Worker starts
curl http://localhost:8787/metrics/key-age -H "X-Metrics-Token: test"
# → { active_key_id, days_since_rotation, next_rotation_due }
```

Epic is shippable when:
1. Privacy disclosure approved and linked from options page.
2. Opt-in funnel wired: default off → user enables → events flow.
3. Sentry sanitization verified: no GitHub URLs, no auth headers in any captured event.
4. Logpush delivering to R2 on staging Worker.
5. SLO alert fires in staging on injected 5xx flood.
6. Runbook reviewed.

---

## Open questions

1. **PostHog managed vs self-hosted.** Managed (posthog.com) is fastest to ship; self-hosted on a Cloudflare Worker + R2 backend avoids sending data to a third party. Decision needed before QM-123 merges. Recommendation: start managed, migrate if GDPR pressure increases.

2. **Sentry opt-in vs legitimate-interest basis.** Crash data could be argued as legitimate interest (security / stability) under GDPR, which would allow it without explicit opt-in. Legal review needed. Until resolved, gate Sentry behind the same consent toggle as PostHog (conservative path).

3. **Cloudflare Analytics Engine vs external TSDB.** Analytics Engine is the natural fit for Worker metrics (zero egress cost, SQL-queryable). It is in open beta; retention is 31 days. If longer retention is needed for churn analysis, pipe to an external store (e.g. Tinybird, ClickHouse Cloud). QM-136 assumes Analytics Engine; revisit if retention proves insufficient.
