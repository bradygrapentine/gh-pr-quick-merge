# Release runbook — PR Quick Merge

> Make releases boring. This is the canonical step-by-step. If something here is wrong, fix the runbook in the same PR that fixes the underlying problem.

## Trigger criteria

Cut a release when any of:

- A milestone in `BACKLOG.md` (or the issue tracker) is closed.
- A security fix needs to ship to users.
- A stuck-bug hotfix is required.
- A scheduled cadence (~once every 4–6 weeks) elapses with shipped changes on `main`.

Do **not** cut a release when:

- CI on main is red.
- A `KILL_SWITCH`-type emergency is active. Resolve the emergency first.
- E2E nightly has been red 2+ nights in a row without an explanation tied to known infra flake.

## Pre-flight checklist

Run sequentially. Do not skip.

- [ ] On `main`, working tree clean: `git status` is empty
- [ ] `main` matches `origin/main`: `git fetch origin && git diff main origin/main` is empty
- [ ] Unit tests green: `npm test` reports 0 failures
- [ ] Lint clean: `npx web-ext lint --source-dir=. --self-hosted` reports 0 errors
- [ ] `CHANGELOG.md` updated for the new version (manually edit before this runbook)
- [ ] Version in `manifest.json` and `package.json` will be bumped by `scripts/release.sh` — do not bump manually
- [ ] Icons + screenshots match the new version's UI (re-shoot if there were UI changes since last release; specs in `creative/store-copy/screenshot-specs.md`)
- [ ] Privacy policy `docs/privacy-policy.md` accurately reflects current data handling

## Build steps

```bash
# 1. Run the release helper
bash scripts/release.sh 1.0.0

# 2. Verify artifacts
ls -lh web-ext-artifacts/
shasum -a 256 web-ext-artifacts/*.zip
shasum -a 256 web-ext-artifacts/*.xpi 2>/dev/null || true

# 3. Inspect the zip contents — make sure no secrets, no .git, no node_modules
unzip -l web-ext-artifacts/gh_pr_quick_merge-1.0.0.zip | head -40
```

If `web-ext` is configured for both Chromium and Firefox, both `.zip` and `.xpi` should appear. If only `.zip` appears, run `npx web-ext build --source-dir=. --artifacts-dir=web-ext-artifacts/ --filename={name}-{version}.xpi` to produce the Firefox-targeted bundle.

## Tag + push

```bash
git add manifest.json package.json package-lock.json CHANGELOG.md
git commit -m "release: v1.0.0"
git tag -a "v1.0.0" -m "v1.0.0"
git push origin main --tags
```

## GitHub release

```bash
gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes-file <(awk '/^## v1.0.0/,/^## v[0-9]+\.[0-9]+\.[0-9]+$/' CHANGELOG.md) \
  web-ext-artifacts/gh_pr_quick_merge-1.0.0.zip \
  web-ext-artifacts/gh_pr_quick_merge-1.0.0.xpi
```

Record the SHA256 of each uploaded artifact in the release-notes body. This is what AMO reviewers will compare against the source-disclosure rebuild.

## Chrome Web Store submission

See `docs/store-submission-guide.md` (QM-104 section) — a human submitter walks through this each time. Set staged-rollout to 10% (see `docs/sop-staged-rollout.md`).

## Firefox AMO submission

See `docs/store-submission-guide.md` (QM-108 section). Attach `source-disclosure.zip` produced via `creative/store-copy/BUILD.md` recipe.

## Post-release checks

Within 24 h of stores publishing:

- [ ] CWS dashboard shows new version live (under partial rollout if 10% staged)
- [ ] AMO listing shows new version live (no staged rollout — AMO is all-or-nothing)
- [ ] No spike in Sentry issues attributed to new version (skip if Sentry isn't wired up yet — `group-ops` adds it)
- [ ] PostHog / install counters tick up (skip if not wired)
- [ ] Smoke-test the live extension manually: install from CWS in a clean Chrome profile, sign in via OAuth Device Flow, merge one fixture PR

## Abort criteria

Halt rollout immediately if any of:

- Sentry error rate from the new version > 1% within 2h of publish (gives ~1k+ events on a typical install base)
- A user reports inability to authenticate with reproducible steps
- AMO reviewer reaches out flagging a regression they missed in pre-publish review

Use the staged-rollout SOP (`docs/sop-staged-rollout.md`) to roll back: pause CWS rollout, optionally flip emergency `KILL_SWITCH` env (added in `group-ops`), publish a hotfix point release.

## Emergency rollback

(Reserved for the moment `group-ops` adds the license-server kill-switch. Until then, the extension has no remote killswitch — the only rollback path is publishing a downgraded build.)

To roll back via store:

1. Bump version higher than current published (CWS does not allow re-publishing the same version).
2. Build from the last-known-good commit (`scripts/release.sh <next-patch>` on `<good-commit>` checked out).
3. Submit through CWS staged rollout to 100% as fast as the dashboard will let you.

## Lessons-learned

After every release, append one paragraph here covering:
- What went wrong (or what surprised you).
- What change to the runbook would have prevented it.
- Whether you applied that change in this PR.

---

| Date | Version | Notes |
|---|---|---|
| `<add row per release>` | | |
