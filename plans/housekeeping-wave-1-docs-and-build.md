# Plan — Housekeeping Wave 1: Doc/state drift + Build/release prep

**Sequence:** Wave 1 must complete (PR merged) before Wave 2 starts.
**Estimate:** S overall · 5 internal tracks · expected wall time 30-45 min with parallel dispatch
**Dependencies:** none
**Output:** v0.2.0-rc.1 metadata + accurate docs reflecting all merged work

## Goal

Bring all stationary artifacts (READMEs, plan docs, version stamps, changelog) into sync with what's actually on `main`. Lay the groundwork for a v0.2 release without actually tagging it (security follow-ups in QM-019 still gate the tag).

## Internal tracks (parallel-safe)

All 5 tracks share **zero file ownership overlap**. Dispatch in parallel. Single PR squash-merges the lot.

### Track T1 — README + SETUP audit
**Files (exclusive):** `README.md`, `SETUP.md`
**Deliverable:**
- Walk every feature claim in README and SETUP, confirm it matches current code (popup exists, per-repo defaults UI exists, sign-out button exists, OAuth device flow shipped, etc.)
- Update "Limitations" — bulk-merge gated, popup shipped (was: "popup planned"), per-repo defaults shipped, etc.
- Add a "What's new in v0.2-dev" callout pointing to CHANGELOG.md (created by T5).
- Verify all command examples (`npm test`, `gh repo clone`, etc.) still work as written.
- Verify all internal links (e.g. links to `BACKLOG.md`, `ROADMAP.md`, `plans/`) resolve.

### Track T2 — WAVE-2-PLAN.md sync
**Files (exclusive):** `WAVE-2-PLAN.md`
**Deliverable:**
- Mark Parts E (CI), F (security partial), A (per-repo defaults integration), and the popup feature (originally Part D) as ✅ shipped, with PR references (`#1`, `#3`, `#5`).
- Add a "Wave 1.5" sub-section recap (the lib-only TDD trio merged on 2026-04-29 before Wave 2 properly started).
- Update Part F's status: **8 of 15 SECURITY findings closed in PR #1**; remaining 7 deferred to QM-019.
- Recompute the merge graph at the bottom: only Parts B (templates integration), C (shortcuts integration), and G (tag v0.2.0) remain.
- Update Definition of Done: tick off CI green, test count target hit, etc.

### Track T3 — ROADMAP.md sync
**Files (exclusive):** `ROADMAP.md`
**Deliverable:**
- Move popup, per-repo-defaults integration, and stale-PR detection module from "v0.2 — remaining" or "v0.3 — pending" lists into the existing "Shipped in v0.2 (current) — 2026-04-29" block.
- Update WAU / D7 retention success metrics with stub note "TBD post v0.2 release".
- Cross-check QM ID references against current BACKLOG.md (some IDs got re-numbered in earlier syncs); fix any drift.
- Leave the v0.3/v0.4 narrative cluster section unchanged — that's still aspirational.

### Track T4 — Build + version metadata
**Files (exclusive):** `package.json`, `manifest.json`, `scripts/package.sh` (NEW)
**Deliverable:**
- Add `npm run package` script wrapping `npx web-ext build --source-dir . --artifacts-dir dist/ --overwrite-dest` (via `scripts/package.sh` for portability + comments).
- Add `dist/` and `*.zip` patterns to `.gitignore` (also exclusive — touches that one extra file).
- Bump `manifest.json` version: `0.1.0` → `0.2.0-rc.1`.
- Bump `package.json` version: `0.0.0` (or current) → `0.2.0-rc.1`.
- Bump `manifest.json` `version_name` to a friendly label: `"0.2.0-rc.1 (dev)"`.
- DO NOT create a git tag. v0.2.0 final is QM-019-gated.
- Verify `npm run package` actually produces a working `dist/*.zip` (run locally; gitignore the artifact).

### Track T5 — CHANGELOG.md
**Files (exclusive):** `CHANGELOG.md` (NEW)
**Deliverable:**
- Create `CHANGELOG.md` in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
- Sections: `[Unreleased]`, `[0.2.0-rc.1] — 2026-04-29`, `[0.1.0] — initial commit baseline`.
- For 0.2.0-rc.1, enumerate all PRs (#1–#6) under correct buckets: **Added** (popup, OAuth, bulk-merge UI, per-repo defaults, stale-PR module, CI workflow, sign-out button), **Changed** (token storage moved to `chrome.storage.local`), **Security** (8 findings closed; 7 still open).
- Add a footer link section linking to GitHub release pages (placeholder `https://github.com/bradygrapentine/gh-pr-quick-merge/releases/tag/v0.2.0-rc.1`).

## Dispatch decision

**5 truly disjoint tracks** → meets the CLAUDE.md "4+ independent tracks" bar. Dispatch in parallel.

Each subagent owns one track exclusively. Heartbeats per `subagent-heartbeat` skill. Base SHA = current `origin/main`. All five branch from that single SHA, merge into one final feature branch via fast-forward (or, simpler, work in a single shared branch with one agent at a time per file — but the file ownership is so cleanly split that parallel branches integrate trivially).

**Recommended branching:** one `housekeeping/wave-1` feature branch, agents push to it sequentially via separate commits (each commit only touches its owned files). Avoids 5-PR overhead for 5 small docs changes.

## Merge order

Within Wave 1, doesn't matter — fully disjoint. Single PR.

## Verify

```bash
npm test                              # 124/124 still green
node --check ...                      # all JS files parse
node -e "JSON.parse(...)"             # manifest valid
npm run package && ls dist/*.zip      # builds + zip exists
```

Plus: human eyeballs the rendered README on github.com to make sure it looks right.

## Definition of done

- [ ] README + SETUP describe v0.2-dev correctly (no stale claims)
- [ ] WAVE-2-PLAN.md, ROADMAP.md, BACKLOG.md mutually consistent (every shipped ID in one place, not two)
- [ ] CHANGELOG.md present and accurate
- [ ] `npm run package` works locally and produces a loadable zip
- [ ] manifest + package.json version stamped 0.2.0-rc.1
- [ ] All Wave 1 work landed in a single squash-merged PR
- [ ] CI green on PR

## Hand-off to Wave 2

After Wave 1 merges, immediately start Wave 2 (`plans/housekeeping-wave-2-code-hygiene.md`).
