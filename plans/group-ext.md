# Group plan — `group-ext` (external assets + test/release infra)

**Sub-plans (parallel):**
- [`v1-distribution-and-marketing.md`](./v1-distribution-and-marketing.md) — slimmed Epic 4
- [`v1-quality-and-release-ops.md`](./v1-quality-and-release-ops.md) — slimmed Epic 6

**Mode:** §3b parallel dispatch (per wave skill).
**Estimated wall time:** 5–8 days end-to-end (some of it human review wait — CWS/AMO).
**Dependencies:** none. Designed to run early; doesn't touch `content.js`/`popup`/`options.html`/`options.js`.

## Why these two pair

- P4 (distribution) owns: `README.md` (one section), creative assets (Figma/Loom), store dashboards (CWS + AMO — human-in-loop), privacy-policy hosting (separate static page).
- P6 (quality) owns: `test/e2e/*` (NEW), `.github/workflows/e2e.yml` (NEW), `scripts/release.sh` (NEW), `docs/runbook-release.md` (NEW), `package.json` (Playwright dep).

Zero shared files. P4 has zero code changes in the extension; P6 has zero docs changes outside `docs/runbook-release.md`.

## Pre-dispatch verification (mandatory)

1. `git fetch origin && git rev-parse origin/main` — base SHA must match local `main`. Print it.
2. Confirm both sub-plans haven't been merged already (`git log` search for QM-101..QM-120 and QM-141..QM-160 — if shipped, skip).
3. Confirm no open PR for either plan.

## Subagent briefs

### Subagent A — distribution & marketing
- **Branch:** `wave-group-ext-distrib`
- **Files OWNED:** `README.md` (Support section + listing-pitch paragraph only), and any new assets it produces (creative outputs to `creative/` dir if it makes sense).
- **Files FORBIDDEN:** every code file (`content.js`, `popup.*`, `options.*`, `lib/*`, `background.js`, `manifest.json`, `styles.css`, `test/*`, `scripts/*`, `.github/*`, `package.json`).
- **Heartbeat:** `.claude/agent-status/group-ext-distrib.log`
- **Brief excerpt:** Execute the slimmed `v1-distribution-and-marketing.md`. Stories QM-101, QM-102, QM-103, QM-106, QM-107, QM-109, QM-118, QM-119, QM-120 (12 stories). The store-submission stories (QM-104, QM-108) are HUMAN-IN-LOOP — agent prepares zip + metadata doc; user must click "Submit" in the CWS / AMO dashboards.
- **Open PR:** title "Group EXT: distribution & marketing", body lists every story status (drafted/blocked-on-human/done).

### Subagent B — quality & release ops
- **Branch:** `wave-group-ext-quality`
- **Files OWNED:** `test/e2e/*` (NEW), `.github/workflows/e2e.yml` (NEW), `scripts/release.sh` (NEW), `docs/runbook-release.md` (NEW), `package.json` (Playwright dep + new scripts).
- **Files FORBIDDEN:** every other source/test file. Specifically: `test/` root level (existing vitest tests live there — agent must add E2E under `test/e2e/`), `scripts/package.sh` (existing), `.github/workflows/test.yml` (existing).
- **Heartbeat:** `.claude/agent-status/group-ext-quality.log`
- **Brief excerpt:** Execute the slimmed `v1-quality-and-release-ops.md`. Retained stories: QM-141, QM-142, QM-143, QM-145, QM-146, QM-147, QM-148, QM-149, QM-150, QM-151, QM-153, QM-154, QM-155, QM-156 (14 stories). QM-141 is the sequential blocker (Playwright scaffold). QM-142 (fixture-repo helper) needs `E2E_GH_TOKEN` in CI secrets — note as a precondition; agent can scaffold the harness with a stub token if real one isn't set yet.
- **Open PR:** title "Group EXT: quality & release ops", same body convention.

## Subagent dispatch contract (both)

- Branch from **the same base SHA** = current `origin/main`. Print it before dispatch.
- Each subagent commits + pushes to its own branch — DO NOT push to `wave-group-ext` shared branch (avoids the wave-lock-guard cross-session issue from v0.3 Phase 1).
- Each subagent opens its own PR.
- Each subagent arms auto-merge after CI green (per repo memory: auto-merge pre-authorized).
- Heartbeat clause from `subagent-heartbeat` skill: append timestamp every ~5 min to `.claude/agent-status/<branch-slug>.log`. Orchestrator polls every 10 min; >30 min idle = stalled.
- Iteration cap: 5 rounds to green per story. Escalate with diagnostic if stuck.

## Verify (after both PRs merge)

- [ ] `npm test` — full suite green (existing 167+ tests untouched)
- [ ] `npm run package` — still produces a valid zip
- [ ] CI green on `main`
- [ ] `test/e2e/*` runs locally via `npx playwright test` (or matches the script the quality subagent wires)
- [ ] CWS + AMO listings drafted (story status reflected in PR body) — submission step is left for the user

## Definition of done

- Both sub-plan PRs squash-merged
- README has a Support section + Sponsor profile link (depends on `group-ops` having already created `lib/donation-link.js` const? — actually no, README link can be hardcoded to `https://github.com/sponsors/bradygrapentine` regardless)
- E2E + perf baselines run in CI nightly (QM-145)
- `docs/runbook-release.md` exists and covers CWS dev → public + AMO unlisted → public

## Hand-off

After `group-ext` lands, run `group-ops` next (Sentry + donations). Then iterate through the v0.3 / v0.4 single-plan groups.
