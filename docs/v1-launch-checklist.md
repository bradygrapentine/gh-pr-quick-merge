# v1.0 launch checklist

> One-shot checklist for the v1.0 cut. Each item references the runbook or backlog story that owns it. Tick them in order — earlier items are pre-conditions for later ones.

## Phase 0 — pre-flight

- [ ] **Maintainer's GitHub PAT rotated** — used for the `gh` CLI commands below.
- [ ] **`docs/runbook-external-services.md` walked end-to-end.** Every external account exists.
- [ ] **`gh-pr-qm-bot` account created** + `E2E_GH_TOKEN` secret set in repo Actions.
- [ ] **Trigger nightly E2E** workflow manually (`gh workflow run e2e.yml`) and confirm it goes green. Fix any spec breakage before proceeding.

## Phase 1 — code & tests

- [ ] **All open PRs merged.** `gh pr list --state open --limit 5` shows nothing.
- [ ] **`main` is green.** `npm test`, `npm run test:coverage`, `npm run package` all pass locally on a clean clone.
- [ ] **Coverage gate clears.** `npm run test:coverage` passes the 95% lines threshold.
- [ ] **Sentry SDK vendored** (follow-up from PR #21):
   - `npm run vendor:sentry` script copies `node_modules/@sentry/browser/build/bundles/bundle.tracing.min.js` → `lib/vendor/sentry.min.js`.
   - `scripts/package.sh` runs `vendor:sentry` before `web-ext build`.
   - `SENTRY_DSN` injected at build time.
   - **Smoke test:** trigger a synthetic exception, confirm it arrives in Sentry with redacted breadcrumbs.

## Phase 2 — repo settings (manual)

- [ ] **Branch protection on `main`** — Settings → Rules → require pull-request review ≥ 1, require status checks (`test`, `manifest-lint`, `e2e`), block force pushes.
- [ ] **Auto-delete-branch** — already enabled (verified 2026-04-29).
- [ ] **Dependabot security updates** — Settings → Code security → enable.
- [ ] **CODEOWNERS** — add `* @bradygrapentine` so future PRs auto-request review.

## Phase 3 — release artifacts

- [ ] **`bash scripts/release.sh 1.0.0`** runs cleanly. Produces `dist/gh_pr_quick_merge-1.0.0.zip` and `.xpi`.
- [ ] **SHA256s recorded** in the upcoming GitHub release notes.
- [ ] **CHANGELOG.md** updated for v1.0.0. Use commit log + plan-level summary.
- [ ] **Manifest version 1.0.0** — `scripts/release.sh` does this; verify `manifest.json` and `package.json` agree.

## Phase 4 — store submissions (human-in-loop)

Walk through `docs/store-submission-guide.md` for each store:

- [ ] **Chrome Web Store (QM-104):** upload, listing copy from `creative/store-copy/cws-listing.md`, 5 screenshots, tile, marquee, privacy policy URL, permissions justification, **set staged rollout to 10%**, submit.
- [ ] **Firefox AMO (QM-108):** upload .xpi, source-disclosure.zip, listing copy from `creative/store-copy/amo-listing.md`, reviewer notes, submit.

Wait. CWS review: 1–7 business days for the most common case, 2–3 weeks for OAuth+broad-host extensions on first submission. AMO: variable.

## Phase 5 — launch

After **both** stores publish:

- [ ] **Staged rollout monitoring** per `docs/sop-staged-rollout.md`. 24 h hold at 10%, then 50%, then 100%.
- [ ] **README.md** updated with the live store URLs (currently placeholders).
- [ ] **Show HN post** (`creative/launch/show-hn-draft.md`) — substitute real store URLs, post weekday 9–11am ET.
- [ ] **r/programming + r/webdev** posts (`creative/launch/reddit-draft.md`).
- [ ] **Newsletter pitches sent** (`creative/launch/newsletter-pitch.md`).

## Phase 6 — first 72 hours

- [ ] **Sentry monitored.** No new high-volume issue clusters from the new release.
- [ ] **GitHub issues triaged daily.** Respond to bug reports within 24 h.
- [ ] **Sponsors profile traffic checked.** Compare to baseline.
- [ ] **CWS reviews + AMO reviews scanned.** Two or more 1-star reviews with the same symptom = pause rollout per SOP.

## Rollback decision tree

If anything in Phase 6 trips a stop condition (per `docs/sop-staged-rollout.md`):

1. **Pause CWS rollout** in dashboard (lower % to 0).
2. **Tag the issue** in GitHub.
3. **Open a hotfix branch** from the last-known-good tag.
4. `bash scripts/release.sh 1.0.1` and resubmit through CWS / AMO.
5. **Update README banner** noting the issue and ETA.

## Sign-off

- [ ] All Phase 4 items shipped to "Published" / "Approved".
- [ ] No critical issues in 72-hour Phase 6 window.
- [ ] **v1.0 marked done** in `BACKLOG.md` §0 status board and `ROADMAP.md`.

Date completed: `___`
