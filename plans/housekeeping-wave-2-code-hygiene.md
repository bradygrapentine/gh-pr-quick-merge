# Plan — Housekeeping Wave 2: Code hygiene

**Sequence:** Run **after** Wave 1 (`plans/housekeeping-wave-1-docs-and-build.md`) merges. Wave 2 starts with the version-stamped, doc-synced state Wave 1 produces.
**Estimate:** M overall · 3 internal tracks · expected wall time 60-90 min
**Dependencies:** Wave 1 merged

## Goal

Improve the runtime code's quality without changing behavior: clean up `web-ext` lint warnings, simplify code that's grown awkward, and fill obvious test gaps. Each track ships behind its own PR (3 PRs total) so a regression in one is rollback-isolated from the others.

## Internal tracks (parallel-safe with explicit ownership)

Three tracks, each on its own feature branch + PR. **Track T2 is the riskiest** (simplify can cross files); we keep it constrained to a fixed file list so it can't trample T1 or T3.

### Track T1 — `web-ext` lint cleanup
**Files (exclusive):** `manifest.json`, `.web-ext-config.cjs` (NEW)
**Branch:** `housekeeping-wave-2/lint`
**Deliverable:**
- Run `npx web-ext lint --self-hosted` locally; capture full warnings list.
- Fix anything that is a real issue, not cosmetic noise:
  - Missing manifest fields AMO requires (e.g. `author`, `homepage_url`, sensible `description` length)
  - Permission warnings (some, like `management`, may need explicit AMO justification — note in PR body)
  - Missing icon sizes if AMO wants 32px or 96px in addition to 16/48/128
  - Inappropriate `permissions` (we already added `management` for the dev-pro gate; lint may flag it)
- Suppress (with config + justification) only what is genuinely wrong-positive — never blanket-disable.
- After fixes, flip the CI `web-ext lint` job from `continue-on-error: true` to `false`. (That single line is the only CI-workflow edit; everything else is manifest/config.)
- **Wait** — `.github/workflows/test.yml` is owned by T1 here even though it's nominally CI infra. Lock that file to T1 only.

**Files T1 also owns:** `.github/workflows/test.yml` (one-line change to drop `continue-on-error`).

### Track T2 — `simplify` pass on the largest files
**Files (exclusive):** `content.js`, `auth.js`, `popup.js`, `options.js`
**Branch:** `housekeeping-wave-2/simplify`
**Deliverable:**
- Run the `simplify` skill against the diff between v0.1.0-equivalent baseline (commit `e38d837`, the initial commit) and current `main`.
- Apply ONLY non-behavioral simplifications:
  - Dedupe extracted helpers
  - Collapse three-line conditionals into ternaries when readability improves
  - Replace `var` → `const`/`let` where any remain
  - Consolidate `chrome.storage.local.get`/`set` patterns into a tiny module if it reduces 6+ duplicate lines
  - Remove dead branches identified by lint
- Constraints:
  - Test count must not drop. All 124 existing tests must continue to pass.
  - Behavior must not change. The simplify skill's own contract enforces this; reviewer (Phase 8) double-checks.
  - Do NOT touch `lib/*.js` files in this pass — they're already small + tested and were extracted recently.
  - Do NOT touch `background.js` — too small to simplify, easy to break.
- If simplify finds nothing meaningful → skip the PR; record in the wave report.

### Track T3 — Test gaps fill-in
**Files (exclusive):** `test/integration/` (NEW dir), `test/popup-data-coercion.test.js` (NEW), `test/auth-poll.test.js` (NEW), `lib/test-utils.js` (NEW — small mock helpers)
**Branch:** `housekeeping-wave-2/test-gaps`
**Deliverable:**
- Run `test-gaps` skill, capture report (read-only — produces a list, not code).
- Pick the top 3-5 gaps by risk weight from the report. Likely candidates (confirm via the skill output):
  1. `auth.js` polling loop edge cases (`slow_down`, `expired_token`, `access_denied`) — currently zero tests on this critical path.
  2. `popup-data` coercion of malformed API responses (PRs with missing `mergeable_state`, non-array `prs` field) — current tests assume well-formed input.
  3. `repo-defaults-integration` — `pickDefaultForBulk` is tested but the storage-change handler that triggers re-styling isn't.
  4. `pr-helpers.parsePrLink` — F-09 host validation has 3 tests; consider edge cases like userinfo-in-URL (`https://attacker@github.com/...`).
- Write tests ONLY. Do NOT modify production code. If a test reveals a real bug, file it as a new BACKLOG item (`QM-031+`) and skip it; bugfix is a separate wave.
- New `lib/test-utils.js` is permissible only if it provides shared mocks (e.g. `makeMockStore()`, `makeMockFetch()`) used by 2+ test files. If only one file needs it, inline.
- Target: +20 tests minimum, +40 stretch.

## Conflict matrix

|     | T1 (lint) | T2 (simplify) | T3 (tests) |
|---|---|---|---|
| `manifest.json` | ✅ owns | — | — |
| `.web-ext-config.cjs` | ✅ owns | — | — |
| `.github/workflows/test.yml` | ✅ owns | — | — |
| `content.js`, `auth.js`, `popup.js`, `options.js` | — | ✅ owns | — |
| `test/**` | — | — | ✅ owns |
| `lib/test-utils.js` | — | — | ✅ owns (new) |

No row has two ✅ → zero overlap. Safe to dispatch parallel.

## Dispatch decision

3 disjoint tracks, each with non-trivial complexity. Below the CLAUDE.md "4+ tracks" parallel-dispatch bar. **But:** the user explicitly authorized parallel dispatch within the wave, the file ownership is enforceable, and each track produces its own PR (so integration is just `git pull` between tracks, no cherry-pick).

**Recommended:** dispatch all three as parallel subagents. Each opens its own PR. Merge order on completion:

1. T3 (tests) merges first — it's the safest (only adds files).
2. T1 (lint) merges second — config + manifest only.
3. T2 (simplify) merges last — touches behavior-adjacent code, deserves the most scrutiny including the `simplify` skill's own self-review.

Each PR auto-merges as approved per repo policy. Codex adversarial gate runs on T2 (security/auth/data surface touched). T1 and T3 skip the adversarial gate per its skip-conditions (config-only / test-only diffs).

## Verify (per track + final)

Per-track:
```bash
npm test                              # green; T3 raises the count
node --check ...                      # parses
npx web-ext lint --self-hosted        # T1 only — must be clean now
```

After all three merge:
```bash
git checkout main && git pull
npm test                              # all green together
npm run package                       # zip still builds
```

## Phase 9 (security review) — applies only to T2

Run `/security-review` on T2's diff before merge. Skip for T1 (config) and T3 (tests-only).

## Phase 10 (adversarial gate) — applies only to T2

Run `codex-adversarial-gate` against T2's diff. Skip T1 + T3.

## Definition of done

- [ ] T1 PR merged: `web-ext lint` CI gate is green and required (not `continue-on-error`)
- [ ] T2 PR merged OR explicitly closed with "no simplify findings" note
- [ ] T3 PR merged: test count up by ≥20
- [ ] All three PRs squash-merged within 24h of each other (avoid stale rebase pain)
- [ ] `main` post-Wave-2 still passes `npm test` + `npm run package`
- [ ] `BACKLOG.md` updated via `/backlog-sync` after Wave 2 closes; any test-revealed bugs filed as QM-0?? items

## Hand-off

Wave 2 closes the v0.2 release-prep arc. Next wave should be **QM-019 (security follow-ups)** — that's the last gate on tagging v0.2.0 (per Wave 1's version-stamp note).
