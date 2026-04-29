# Plan — Epic 6: Quality Assurance & Release Operations (QM-141..160)

**Milestone:** v1.0
**Estimates:** 11 M + 9 S stories across 6 features
**Dependencies:** Epic 3 (license server), Epic 4 (store listings), Epic 5 (observability stack — Sentry + PostHog)
**Parallel-safe with:** nothing outside this epic; internally phases 2 and 3 are parallel after the scaffold lands

## Goal

Make releases boring. By the end of this epic every release is gated by automated E2E green, visual regression clean, and a perf budget check; the runbook is a checklist not tribal knowledge; rollback is one env-var flip; and an on-call rotation wakes the right person within 5 minutes of a p95 breach.

## Preconditions

- Test GitHub account `gh-pr-qm-bot` exists with a PAT stored as the `E2E_GH_TOKEN` Actions secret.
- Epic 3 license server staging URL is live and reachable from CI.
- Sentry and PostHog accounts are provisioned (Epic 5 prerequisite for QM-156 telemetry-based rollout decisions).
- Epic 4 Chrome Web Store and Firefox AMO listings are live (runbook needs store admin access to be real).

## File ownership (exclusive)

- **NEW dir:** `test/e2e/` — all Playwright specs, fixtures, helpers (QM-141..148, QM-150, QM-151)
- **NEW:** `.github/workflows/e2e.yml` — nightly E2E CI job (QM-145)
- **NEW:** `scripts/release.sh` — semi-automated release script (QM-155)
- **NEW:** `docs/runbook-release.md` — release runbook + pre-flight checklist (QM-154)
- **NEW:** `docs/sop-staged-rollout.md` — CWS staged rollout SOP (QM-156)
- **NEW:** `docs/runbook-oncall.md` — on-call wiring and alert runbook (QM-160)
- **NEW:** `perf-baseline.json` — tracked perf budget file (QM-153)
- **NEW:** `observability/slo-dashboard.json` — Cloudflare / Grafana SLO dashboard export (QM-159)
- **EDIT:** `worker/index.ts` — add `KILL_SWITCH` env var check (QM-157), add `/metrics/version` endpoint (QM-158)
- **EDIT:** `package.json` — add `test:e2e`, `test:e2e:visual`, `test:perf` scripts; add `playwright` dev dep

No file appears in more than one agent brief.

---

## Phase 1 — Playwright scaffold (sequential blocker)

**Stories:** QM-141

Everything else in the epic depends on the Playwright test harness existing. Implement this first, land it, confirm CI green before dispatching Phase 2.

### QM-141 — Playwright scaffold + extension loader

Install `@playwright/test` and the Chromium browser. Add a `playwright.config.ts` at repo root:

- `testDir: 'test/e2e'`
- Single `chromium` project; `use.channel = 'chromium'`; `headless: true` in CI, `headless: false` locally via `PWDEBUG`.
- `globalSetup: 'test/e2e/setup/global-setup.ts'` — loads the packed extension and captures `extensionId` into `process.env.EXTENSION_ID`.
- Extension loader in `test/e2e/setup/load-extension.ts`: calls `chromium.launchPersistentContext` with `--load-extension=<dist>` and `--disable-extensions-except=<dist>` args; returns context + `extensionId` derived from `chrome-extension://` service worker.
- `test/e2e/fixtures/base.ts` exports a `test` fixture that injects `extensionId` and an authenticated `page` (token injected via `chrome.storage.local`).

**DoD:** `npm run test:e2e` runs, finds zero specs, exits 0. Extension loads without error in CI Chromium.

---

## Phase 2 — Parallel test families (start after QM-141 merges)

Three disjoint families. Dispatch three agents simultaneously; each owns its own subdirectory and touches no shared files beyond `test/e2e/fixtures/base.ts` (read-only after QM-141).

### Agent A — E2E flows (QM-142..145)

**Files owned:** `test/e2e/flows/`, `.github/workflows/e2e.yml`

#### QM-142 — Fixture-repo helper

`test/e2e/helpers/fixture-repo.ts` — exports `createFixtureRepo(octokit, opts)` and `teardownFixtureRepo(octokit, repoName)`.

- Uses `E2E_GH_TOKEN` (from `process.env`) to authenticate an `@octokit/rest` client against `gh-pr-qm-bot`.
- `createFixtureRepo`: creates a private repo under `gh-pr-qm-bot`, pushes a base commit, opens N stub PRs (title `fixture/pr-{n}`, body `<!-- e2e fixture -->`), returns `{ owner, repo, prs: [{number, url}] }`.
- `teardownFixtureRepo`: deletes the repo. Called in `afterAll`.
- Fixture creation must complete in < 30 s; add a timeout assertion.

#### QM-143 — Happy-path merge E2E

`test/e2e/flows/happy-path.spec.ts`

1. `createFixtureRepo` → 1 PR, auto-mergeable (no branch protection).
2. Navigate to `github.com/{owner}/{repo}/pulls`.
3. Assert "Quick Merge" button injected within 2 s.
4. Click button → confirm dialog → accept.
5. Wait for PR state to become `closed` via Octokit poll (timeout 15 s).
6. Assert success toast visible.

#### QM-144 — Bulk-merge E2E with Pro gate

`test/e2e/flows/bulk-merge-pro.spec.ts`

Two sub-suites under `describe`:

- **Free user:** fixture-repo with 3 PRs. Click "Bulk Merge" → Pro upsell modal appears. Assert `data-testid="pro-upsell-modal"` visible. No PRs merged.
- **Pro user:** inject a valid test license key into `chrome.storage.local.licenseKey` before navigation. Click "Bulk Merge" → all 3 PRs merged. Assert each PR `closed` via Octokit poll.

Depends on Epic 3 QM-085 (license validation endpoint must be live in staging).

#### QM-145 — Nightly E2E CI job

`.github/workflows/e2e.yml`:

```yaml
on:
  schedule:
    - cron: '0 4 * * *'   # 04:00 UTC nightly
  workflow_dispatch:

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:e2e
        env:
          E2E_GH_TOKEN: ${{ secrets.E2E_GH_TOKEN }}
          LICENSE_STAGING_URL: ${{ secrets.LICENSE_STAGING_URL }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**DoD (Agent A):** QM-143 spec green locally + in CI dry-run. QM-144 both sub-suites green. Nightly workflow valid YAML (`act --list` passes).

---

### Agent B — Visual regression (QM-146..149)

**Files owned:** `test/e2e/visual/`, `docs/snapshot-update.md`

Uses Playwright's built-in snapshot feature (`toHaveScreenshot`). No third-party Percy/Chromatic for v1 — keep the dependency count low and re-evaluate post-launch if diff noise becomes painful.

#### QM-146 — Popup snapshot baseline

`test/e2e/visual/popup.spec.ts`

- Open `chrome-extension://{extensionId}/popup.html` directly.
- Two states: empty (no pinned repos) and loaded (inject stub storage with one repo + 2 mergeable PRs).
- `expect(page).toHaveScreenshot('popup-empty.png', { maxDiffPixels: 5 })`.
- `expect(page).toHaveScreenshot('popup-loaded.png', { maxDiffPixels: 5 })`.
- Snapshots committed at `test/e2e/visual/__snapshots__/`.

#### QM-147 — Options page snapshot baseline

`test/e2e/visual/options.spec.ts`

- Open `chrome-extension://{extensionId}/options.html`.
- Three states: default (no token), token entered, with a pinned repo in the list.
- One screenshot per state.

#### QM-148 — Modal snapshots

`test/e2e/visual/modals.spec.ts`

- Trigger Pro upsell modal (free user + bulk-merge click) → screenshot `modal-upsell.png`.
- Trigger bulk-merge confirmation modal (Pro user) → screenshot `modal-bulk-confirm.png`.
- Depends on QM-143 + QM-144 fixture patterns.

#### QM-149 — Snapshot update workflow doc

`docs/snapshot-update.md` — short SOP:

1. When to update (intentional UI change vs. regression).
2. Command: `npx playwright test --update-snapshots`.
3. Review diff in PR. Reviewer must confirm visual change is intentional.
4. Never auto-approve snapshot PRs; always human sign-off.

**DoD (Agent B):** All three snapshot specs produce committed baselines. `npm run test:e2e:visual` green on the machine that generated the snapshots.

---

### Agent C — Perf harness (QM-150..151)

**Files owned:** `test/e2e/perf/`

#### QM-150 — Perf timing harness

`test/e2e/perf/injection-timing.spec.ts`

- Navigate to a fixture repo PR list (uses `createFixtureRepo` with 5 PRs).
- Before navigation, inject a `PerformanceObserver` via `page.addInitScript` that records a `mark('qm:button-injected')` when the first "Quick Merge" button appears in the DOM.
- After navigation, `waitForFunction` until the mark exists.
- Read `performance.measure('qm:injection', 'navigationStart', 'qm:button-injected').duration`.
- Run 10 iterations (loop inside `test`); compute p95.
- Assert p95 < 50 ms. Fail the test if exceeded.

#### QM-151 — MutationObserver + heap profiling

`test/e2e/perf/mutation-observer.spec.ts`

- Instrument MutationObserver call count: inject a counter script that wraps `MutationObserver` and tallies callbacks after the extension's observer fires.
- Navigate through 3 pages (PR list → PR detail → PR list) and assert observer fires ≤ 200 times total (rough sanity, catches accidental recursive observe loops).
- Heap snapshot: `page.evaluate(() => window.gc?.())` then `cdpSession.send('HeapProfiler.takeHeapSnapshot')`. Record total heap size. Assert < 15 MB delta vs. cold page (no extension) baseline captured earlier in the test.

**DoD (Agent C):** Both specs green. p95 < 50 ms assertion passing on CI hardware (allow 80 ms ceiling in CI env via `PERF_BUDGET_SCALE=1.6` env multiplier).

---

## Phase 3 — Server perf + trend tracking (parallel with Phase 2)

No agent needed; implement directly (only 2 stories, one of which is a doc + JSON file).

### QM-152 — License API perf smoke (k6)

`test/perf/license-api.k6.js`

```js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: { 'http_req_duration{status:200}': ['p(95)<200'] },
};

export default function () {
  const res = http.post(`${__ENV.LICENSE_STAGING_URL}/v1/validate`, JSON.stringify({
    licenseKey: __ENV.E2E_LICENSE_KEY,
  }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

Run locally: `k6 run --env LICENSE_STAGING_URL=... --env E2E_LICENSE_KEY=... test/perf/license-api.k6.js`

Add `test:perf:server` npm script. Do not add k6 to the nightly CI job yet (needs a k6 Cloud token or self-hosted runner); document the manual trigger in the runbook.

### QM-153 — Perf trend tracking

`perf-baseline.json` — committed file, machine-generated, human-reviewed on PRs:

```json
{
  "updated": "ISO-8601 date",
  "button_injection_p95_ms": 0,
  "heap_delta_mb": 0,
  "license_api_p95_ms": 0
}
```

CI diff: add a step to the nightly E2E job that runs `scripts/update-perf-baseline.js` (reads Playwright JSON reporter output), compares to committed `perf-baseline.json`, and comments on any nightly run summary if a metric regresses > 20%. Does not block; alerts only. Human decides whether to open a perf bug.

---

## Phase 4 — Release ops (sequential; start after Epic 4 stores are live)

### QM-154 — Release runbook + pre-flight checklist

`docs/runbook-release.md` — written document, not a script. Sections:

1. **Trigger criteria** — what warrants a release (milestone closed, hotfix, etc.)
2. **Pre-flight checklist** (checkbox list): local tests green, E2E green on main, perf baseline not regressed, changelog updated, version bumped in `manifest.json`, icons and store assets match new screenshots.
3. **Build steps** — `npm run build:prod`, `npm run zip`, verify zip contents.
4. **Chrome Web Store submission** — upload zip in CWS developer dashboard, submit for review, set staged rollout to 10%.
5. **Firefox AMO submission** — upload XPI, submit, set staged rollout if AMO supports it.
6. **Post-release checks** — confirm version live in both stores, check Sentry for new error spike, check PostHog install count ticking up.
7. **Abort criteria** — if Sentry error rate > 1% within 2 h of rollout start, pause rollout immediately.

### QM-155 — Semi-automated release script

`scripts/release.sh` — bash script, not fully automated (store submission still manual), but reduces mechanical steps:

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION=${1:?usage: release.sh <version>}

# 1. Confirm tests green
npm test && npm run test:e2e || { echo "Tests failed — aborting"; exit 1; }

# 2. Bump version
node -e "
  const m = JSON.parse(require('fs').readFileSync('manifest.json','utf8'));
  m.version = '$VERSION';
  require('fs').writeFileSync('manifest.json', JSON.stringify(m, null, 2) + '\n');
"
npm pkg set version="$VERSION"

# 3. Build + zip
npm run build:prod
mkdir -p dist-zips
zip -r "dist-zips/gh-pr-quick-merge-$VERSION.zip" dist/ -x "*.map"

# 4. Print next steps
echo ""
echo "=== Release $VERSION built ==="
echo "Zip: dist-zips/gh-pr-quick-merge-$VERSION.zip"
echo "Next: follow docs/runbook-release.md sections 4–6"
```

**DoD (Phase 4):** Runbook reviewed by a second pair of eyes (PR with two approvals). Script exits 0 on a clean repo, exits 1 if tests fail.

---

## Phase 5 — Rollback + SLO (parallel after QM-154 merges)

### QM-156 — CWS staged rollout SOP

`docs/sop-staged-rollout.md`

Defines the rollout ladder: 10% → 50% → 100%, with hold times (24 h at each stage) and the telemetry thresholds that allow progression. Uses Sentry error rate < 0.5% and PostHog adoption curve as go/no-go signals. References `docs/runbook-release.md` abort criteria.

### QM-157 — License-server kill-switch

In `worker/index.ts`, add at the top of the request handler:

```typescript
if (env.KILL_SWITCH === 'true') {
  return new Response(JSON.stringify({ error: 'service_unavailable', retry_after: 300 }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '300' },
  });
}
```

`KILL_SWITCH` is a Cloudflare Workers env var set via `wrangler secret put KILL_SWITCH`. Default absent (treated as false). Document the flip procedure in `docs/runbook-release.md` under a new "Emergency rollback" section.

### QM-158 — Old-version metrics endpoint

Add `GET /metrics/version` to `worker/index.ts`:

- Reads a `KV` namespace `VERSION_COUNTS` (key: extension version string, value: JSON `{ count: N, last_seen: ISO }`).
- Every `/v1/validate` request upserts the caller's `X-Extension-Version` header into `VERSION_COUNTS`.
- `/metrics/version` returns the full KV namespace as JSON sorted by version descending. Auth: `Authorization: Bearer <METRICS_TOKEN>` checked against a Worker secret.
- Purpose: know what fraction of installs are on old versions after a partial rollout.

### QM-159 — SLO dashboards + alerting

`observability/slo-dashboard.json` — Cloudflare Analytics Engine or Grafana dashboard export (whichever the Epic 5 observability stack chose). Defines three SLOs:

| SLO | Target | Alert threshold |
|-----|--------|-----------------|
| License API availability | 99.9% / 30 d | < 99.5% in any 1 h window |
| License API p95 latency | < 200 ms | > 300 ms p95 in any 15 min window |
| E2E nightly pass rate | 100% / 7 d | any failure |

Alert channels: Cloudflare Notifications → webhook → routing in QM-160.

### QM-160 — On-call wiring + runbook

Cloudflare alert webhook → either Slack (if team has a workspace) or `ntfy.sh` topic (simpler, no OAuth). Decision: default to `ntfy.sh`; add Slack as optional env var. Implement a small Cloudflare Worker route (`/alerts/ingest`) that receives the Cloudflare notification payload and forwards to `ntfy.sh` with a formatted message including the SLO name, current value, and a deep-link to the dashboard.

`docs/runbook-oncall.md`:

- Alert taxonomy (which SLO fired, severity mapping).
- First-response steps per alert type.
- Escalation path.
- Link to kill-switch flip procedure.

**DoD (Phase 5):** `KILL_SWITCH=true` returns 503. `/metrics/version` returns 200 with correct data in a local `wrangler dev` session. SLO dashboard JSON validates against the target platform's schema. Ntfy.sh test alert fires end-to-end.

---

## Verify

```bash
# Full local gate before any PR goes ready
npm test
npm run test:e2e           # requires EXTENSION_ID auto-discovered, E2E_GH_TOKEN set
npm run test:e2e:visual    # snapshot comparison
npm run test:perf          # Playwright perf specs

# Server smoke (manual; needs staging URL)
k6 run --env LICENSE_STAGING_URL=$STAGING --env E2E_LICENSE_KEY=$KEY test/perf/license-api.k6.js

# Release script dry-run
bash scripts/release.sh 1.0.0-rc1
```

Nightly CI (`e2e.yml`) must be green for 3 consecutive nights before v1.0 tag is cut.

## Open questions

1. **Snapshot hosting:** Playwright native snapshots are committed to the repo. At scale (> 50 snapshots) this inflates clone size. Re-evaluate Percy or Chromatic after v1 launch; migration path is low friction (swap `toHaveScreenshot` for `percySnapshot`).
2. **PagerDuty vs ntfy.sh:** ntfy.sh is zero-cost and zero-config for a solo operator. If the team grows beyond 2 people, PagerDuty's on-call rotation and escalation policies are worth the $19/user/month. Defer decision to post-v1.
3. **k6 in CI:** k6 Cloud has a free tier (50 VU-hours/month). Evaluate after QM-152 manual runs establish a stable baseline; adding it to nightly before the baseline is stable would produce noisy alerts.
4. **Firefox staged rollout:** AMO does not support staged rollout for extensions without an AMO reviewer exception. QM-156 SOP covers CWS only; AMO rollout is all-or-nothing. Document this difference in the SOP.
