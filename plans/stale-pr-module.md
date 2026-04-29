# Plan — Stale-PR detection module (QM-023, new)

**Milestone:** v0.3 / v0.4 (part of "Everything you wish the GitHub PR list did" cluster — see ROADMAP)
**Estimate:** S
**Dependencies:** none
**Parallel-safe with:** Plan A (popup), Plan B (per-repo defaults integration)

## Goal

Pure module that classifies a PR as stale based on configurable thresholds. **Library only — no integration into `content.js` in this plan.** Integration is a follow-up; this plan ships the testable engine.

## File ownership (exclusive)

- **NEW:** `lib/stale-pr.js`
- **NEW:** `test/stale-pr.test.js`

Touches nothing else. Fully parallel-safe with everything.

## TDD spec for `lib/stale-pr.js`

Exports:
- `classifyStaleness({ updatedAt, draft, hasReviewerRequested }, options, now)` — returns `"fresh" | "warming" | "stale" | "abandoned"`.
- `DEFAULT_THRESHOLDS` — `{ warmingDays: 7, staleDays: 14, abandonedDays: 30 }`.
- `formatStaleLabel(classification)` — returns `{ label: string, kind: string }` for UI rendering. E.g. `"stale"` → `{ label: "Stale (14d+)", kind: "warn" }`.
- `getStaleBucket(updatedAt, now, thresholds)` — pure date-bucket helper, returns one of the four classifications based on day-deltas.

### Behavior rules

- `now` is injected (default `new Date()`) so tests are deterministic.
- Day delta = `floor((now - updatedAt) / 86_400_000)`.
- If `draft === true` → classification capped at `"warming"` (drafts shouldn't be flagged abandoned).
- If `hasReviewerRequested === false` AND days >= staleDays → bump one bucket toward `abandoned` (no reviewer + old = worse).
- Thresholds are inclusive lower bounds: `days >= abandonedDays` → `abandoned`; otherwise `>= staleDays` → `stale`; otherwise `>= warmingDays` → `warming`; else `fresh`.

Dual CJS + `window.QM_STALE_PR` export, matching `lib/pr-helpers.js`.

### Tests (target: 14+)

1. Brand-new PR (0 days) → `"fresh"`.
2. 6 days old → `"fresh"` (under default warmingDays=7).
3. 7 days old → `"warming"` (inclusive lower bound).
4. 13 days → `"warming"`.
5. 14 days → `"stale"`.
6. 29 days → `"stale"`.
7. 30 days → `"abandoned"`.
8. 100 days → `"abandoned"`.
9. Draft PR at 30 days → `"warming"` (cap applies).
10. Draft PR at 5 days → `"fresh"` (cap doesn't downgrade fresh).
11. No reviewer + 14 days → bumped to `"abandoned"`.
12. No reviewer + 7 days → stays `"warming"` (no bump below stale threshold).
13. Custom thresholds — `staleDays: 3` → 3-day-old PR classified `"stale"`.
14. `formatStaleLabel("fresh")` → `kind: "info"` or similar (define convention; just be consistent).
15. `formatStaleLabel` returns the same shape for all four classifications.
16. `now` injection — same `updatedAt` with two different `now` values produces different classifications.

## Verify

```bash
npm test                          # full suite green; ~14 new tests
```

No manual UX testing (this plan ships no UI).

## Follow-up (not in this plan)

A future plan integrates the module into `content.js`:
- Fetch `pr.updated_at` + `draft` flag in `fetchPrState`.
- On each row, call `classifyStaleness` and inject a small badge (`<span class="qm-stale-badge qm-stale-stale">Stale (14d)</span>`) next to the title.
- User-configurable thresholds via options page.

That follow-up will conflict with anything else editing `content.js` — schedule it serially.

## Risks

- Date math edge cases (DST, timezones). The day-delta approach using ms is timezone-safe but DST-affected if a day "shrinks" by an hour — accept this drift; the buckets are coarse enough that it doesn't matter.
- `pr.updated_at` includes label/comment activity, not just commits. That's the intended definition (any activity = not stale).
