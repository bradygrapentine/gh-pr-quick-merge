# Group plan — `group-ops` (Sentry crash reporting + donations)

**Sub-plans (parallel):**
- [`v1-observability.md`](./v1-observability.md) — slimmed Epic 5 (Sentry only — QM-126, QM-127, QM-128)
- [`v1-donations.md`](./v1-donations.md) — Epic 7 (QM-161..QM-165)

**Mode:** §3b parallel dispatch.
**Estimated wall time:** 2–3 days.
**Dependencies:** GitHub Sponsors profile **must be live** (QM-161 precondition — confirmed `https://github.com/sponsors/bradygrapentine` is live as of 2026-04-29).

## Why these two pair

- P5 (Sentry) owns: `background.js` (Sentry init in service worker), `scripts/package.sh` (strip source maps from prod zip + upload to Sentry in CI), `package.json` (Sentry dep), possibly `.github/workflows/test.yml` (release tagging step).
- P7 (donations) owns: `content.js` (donation modal swap of `showProGate`), `popup.html`/`popup.css` (heart icon footer), `options.html` (Support link), `README.md` (Support section).

Zero shared files. P5 doesn't touch UI; P7 doesn't touch background or build infra.

**Caveat:** `README.md` is also touched by `group-ext` (P4 distribution). Don't run `group-ops` and `group-ext` concurrently — sequence them. The recommended order is `group-ext` → `group-ops`.

## Pre-dispatch verification (mandatory)

1. `git fetch origin && git rev-parse origin/main` — base SHA must match local `main`. Print it.
2. Confirm Sponsors profile is live at `https://github.com/sponsors/bradygrapentine`.
3. Confirm `group-ext` (if running) is fully merged — `gh pr list --state open` should not include `wave-group-ext-*` branches.
4. Confirm no open PR for either sub-plan.

## Subagent briefs

### Subagent A — Sentry crash reporting
- **Branch:** `wave-group-ops-sentry`
- **Files OWNED:** `background.js`, `scripts/package.sh`, `package.json` (Sentry dep + scripts), `.github/workflows/test.yml` (release upload step ONLY — don't change other steps), `lib/sentry-init.js` (NEW, optional — only if separating init from background.js helps testability), `test/sentry.test.js` (NEW).
- **Files FORBIDDEN:** every UI file (`content.js`, `popup.*`, `options.*`, `manifest.json`, `styles.css`, `README.md`).
- **Heartbeat:** `.claude/agent-status/group-ops-sentry.log`
- **Brief excerpt:** Execute QM-126, QM-127, QM-128 from `v1-observability.md`.
  - QM-126: install `@sentry/browser`, init in `background.js` service worker. `beforeSend` strips Bearer tokens, `ghp_`/`gho_` patterns, removes `request.headers` and `request.url`, scrubs `extra/contexts` keys named `token`/`auth`/`key`/`secret`. Default off; optional crash-reporting toggle in options page (deferred to a UI follow-up — don't add UI here).
  - QM-127: extends F-15 closure pattern at merge call sites. Replaces lingering `String(e)` patterns with `e.name + ": " + e.message.slice(0, 200)`.
  - QM-128: `npm run package` strips `*.map` from the zip; CI step `sentry-cli releases files` uploads source maps to Sentry. Add `SENTRY_AUTH_TOKEN` and `SENTRY_DSN` as required env vars; document in `docs/runbook-release.md` if `group-ext` already created it, otherwise leave a TODO note.
- **Open PR:** title "Group OPS: Sentry crash reporting (QM-126/127/128)".

### Subagent B — Donations
- **Branch:** `wave-group-ops-donations`
- **Files OWNED:** `content.js` (replace `showProGate`), `popup.html` + `popup.css` (heart icon footer), `options.html` (Support link in footer), `README.md` (Support section), `manifest.json` ONLY for adding the Sponsors URL as a const if needed (preferred: hardcode in `content.js` directly).
- **Files FORBIDDEN:** `background.js`, `scripts/*`, `package.json`, `.github/*`, `lib/*`, `test/*` (don't add tests for this UI swap; integration tested manually).
- **Heartbeat:** `.claude/agent-status/group-ops-donations.log`
- **Brief excerpt:** Execute QM-161..QM-165 from `v1-donations.md`.
  - QM-161: HUMAN-IN-LOOP, already done by user (confirmed Sponsors profile live). Mark as closed.
  - QM-162: replace `showProGate` body in `content.js`. Constant `SPONSORS_URL = "https://github.com/sponsors/bradygrapentine"` at top of file. Modal copy: "Like this? Support development." Buttons: "Maybe later" / "Sponsor on GitHub" (opens SPONSORS_URL in new tab, `target=_blank rel="noopener noreferrer"`). Keep dev-only "Enable Pro (dev)" gating per `installType` (existing behavior).
  - QM-163: heart icon (`♥`) in `popup.html` footer + corresponding CSS in `popup.css`. Subtle "Support" link in `options.html` footer.
  - QM-164: README `## Support` section with Sponsor profile link + tier table copied from `plans/v1-donations.md`. Mirror in CWS/AMO listing copy if `group-ext` has already drafted those (cross-link).
  - QM-165: DEFERRED per plan — note as such.
- **Open PR:** title "Group OPS: donation infra (QM-161/162/163/164)".

## Subagent dispatch contract (both)

- Branch from same base SHA = current `origin/main`.
- Each subagent owns its own branch; don't push to a shared `wave-group-ops` branch.
- Each opens its own PR; arms auto-merge.
- Heartbeat per `subagent-heartbeat` convention.
- Iteration cap: 5 rounds to green.

## Verify (after both PRs merge)

- [ ] `npm test` — green (Sentry tests +N; donations adds none)
- [ ] `npm run package` — produces a zip with no `.map` files
- [ ] Manual: load unpacked extension; trigger bulk merge → donation modal appears with "Sponsor on GitHub" button; clicking opens Sponsors profile in new tab
- [ ] Manual: throw an error in `content.js` (devtools) → Sentry receives event with token-redacted payload
- [ ] CI green on `main`

## Definition of done

- Both sub-plan PRs squash-merged
- Donation modal live in extension; popup heart icon + options Support link present
- Sentry capturing crashes (verify with one synthetic event)
- README has Support section with all 4 tier amounts and link to `https://github.com/sponsors/bradygrapentine`

## Hand-off

After `group-ops` lands, the v0.3/v0.4 waves can begin in series:
1. `group-v0.3-ui` (UI editors for templates, shortcuts, defaults v2, popup polish, multi-account hint)
2. `group-v0.4-a` (row actions: Update branch, merge-when-green, auto-rebase)
3. `group-v0.4-b` (bulk close/label, stale row, list-mode)
