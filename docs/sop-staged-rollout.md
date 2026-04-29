# SOP — Chrome Web Store staged rollout (QM-156)

> Chrome Web Store supports staged rollouts; AMO does not. This SOP covers CWS only. AMO releases go straight to 100% — accept that and treat AMO as the canary's canary (smaller install base, faster signal).

## Rollout ladder

| Stage | % of users | Hold time | Required telemetry signal |
|---|---|---|---|
| 1 | 10% | 24 h | Sentry error rate < 0.5% from new version |
| 2 | 50% | 24 h | Sentry error rate < 0.5%; PostHog DAU not declining |
| 3 | 100% | n/a (final) | n/a |

Hold times are minimums. Extend if a metric is borderline, especially over weekends when the developer who shipped is likely off.

## Telemetry inputs

(Note: these depend on Sentry and PostHog being wired — that's the `group-ops` work. Until then, "telemetry" reduces to manually scrolling through the GitHub Issues tab and CWS user-reviews, which is the practical fallback.)

- **Sentry:** `Issues > new in last 24 h, environment=prod, release=v<NEW>` — new issues in the new release vs. the previous release.
- **PostHog:** `Insights > installs by version` and `daily active users` — net positive should hold or climb.
- **CWS reviews:** dashboard shows new 1- and 2-star reviews. Two or more "extension is broken" reviews in the rollout window = stop and investigate.
- **GitHub Issues:** any new issue tagged `regression-vX.Y.Z` is a stop signal.

## Step-by-step

### Stage 1 — 10% rollout

1. Submit new version to CWS Developer Dashboard (see `docs/runbook-release.md` and `docs/store-submission-guide.md`).
2. On the **Pricing & distribution** tab → **Distribution** → **Staged rollout** → **10%**.
3. Click **Submit for review**. CWS may approve and start staged rollout immediately (typical) or queue for manual review (1–7 days for OAuth-using extensions).
4. Once "10% rollout in progress" appears in the dashboard:
   - Note the start timestamp in `docs/runbook-release.md` lessons-learned table.
   - Set a 24 h reminder to check telemetry.
5. At the 24 h mark, check the four telemetry inputs above. If all green, proceed to Stage 2.

### Stage 2 — 50% rollout

1. Dashboard → same staged-rollout slider → **50%**. Save changes; CWS does not require re-review.
2. Wait 24 h. Re-check telemetry — same four inputs.

### Stage 3 — 100% rollout

1. Slider to **100%**.
2. Save. New users on install, and existing users on auto-update, all get the new version within 5 hours.
3. Mark the release "fully rolled out" in `docs/runbook-release.md`.

## Stop conditions

Pause the rollout immediately and do not advance to the next stage if any of:

- **Sentry error rate** from the new version exceeds 1% of sessions, or doubles compared to the previous release at the same install volume.
- **CWS reviews** show 2+ new 1-star reviews in the rollout window with the same reported symptom.
- **GitHub Issues** receive 3+ reports of the same regression in 24 h.
- A reviewer (CWS or AMO) reaches out post-publish citing a problem.

When paused:

1. Lower CWS staged-rollout to 0% if possible (CWS allows reverting the % slider).
2. Tag the issue in GitHub. Confirm reproduction.
3. Open a hotfix branch from the last-known-good tag, fix, run `bash scripts/release.sh <next-patch>`, resubmit.
4. The pre-existing 10/50% users continue running the buggy version until the hotfix lands — communicate via README banner, GitHub Discussions, or release notes.

## AMO mismatch

AMO does not support staged rollouts (as of 2026-04-29; verify on the AMO Developer Hub before each release). The AMO submission goes to 100% as soon as it's approved.

Practical implication: if the CWS rollout reveals a regression while AMO is already at 100%, pull the AMO listing version (the AMO dashboard supports "disable" for individual versions, which forces users back to the previous published version on next browser update). Pulling is destructive — only do it for genuine breakage, not minor inconvenience.

## Logging

Append to the lessons-learned table in `docs/runbook-release.md` after every staged rollout — what went well, what surprised you, what to change in this SOP.
