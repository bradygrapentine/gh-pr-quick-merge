# ADR 0001 — Keep the HostAdapter abstraction with a single consumer

**Status:** Accepted
**Date:** 2026-05-01
**Phase:** 4 of `docs/plans/v1.1-blockers-plan.md`

## Context

`lib/hosts/index.js` (108 LOC) defines a `HostAdapter` interface plus a tiny `REGISTRY` of supported hosts. `lib/hosts/github/{api,selectors,pr-state}.js` (507 LOC) implements the GitHub side. As of v1.1.0, **GitHub is the only consumer** — no GitLab adapter exists yet.

The 2026-05-01 status audit flagged this as a *premature abstraction*: a single-consumer interface is, in YAGNI terms, dead weight that future readers must reason about before they can change anything in the host-specific code paths.

## Decision

**Keep the HostAdapter abstraction in place.** Do not inline `lib/hosts/github/*` back into `content.js` for v1.1.

## Rationale

1. **Epic 9 (GitLab port) is fully scoped, not speculative.** `plans/v2-gitlab-port.md` exists with 31 stories (QM-300..330) and a phase-zero scaffold has already shipped. The abstraction was extracted *because* a GitLab port is on the near-term roadmap, not as decorative architecture.
2. **Inlining costs more than it saves.** The interface is 108 LOC and well-tested (`test/hosts.test.js`). Inlining would touch `content.js`, `background.js`, `manifest.json`, three `lib/hosts/github/*` files, and force an Epic 9 phase-zero re-do later. The negative ROI is obvious.
3. **The abstraction is a thin facade, not a framework.** No DI container, no dispatcher, no plugin loader. `HostAdapter` is a TypeScript-style typedef with a runtime `assertHostAdapterShape` validator and a 30-line `REGISTRY` + `detect()` lookup. Cognitive overhead is bounded.
4. **Tests already enforce the contract.** `assertHostAdapterShape` runs in CI on every push; if a refactor inadvertently breaks the seam, the test suite catches it before merge.

## Consequences

- **Positive:** Epic 9 phase 1 (QM-312, GitLab adapter scaffolding) starts from the existing seam without rework.
- **Positive:** Future readers of `content.js` see `parsePrLink(anchor)` and don't need to grep through 200 lines of inline regex variants — the seam has the answer at `lib/hosts/github/selectors.js`.
- **Negative:** Until the GitLab adapter ships, the indirection has zero observable value. A new contributor reading the codebase encounters one extra layer for the same outcome.
- **Mitigation:** This ADR exists. If Epic 9 slips past v2.0 or is dropped entirely, the inlining decision should be revisited under a new ADR.

## Re-evaluate when

- Epic 9 ships (delete this ADR; the abstraction is no longer single-consumer).
- Epic 9 is dropped (open ADR 0002 to inline and remove `lib/hosts/index.js`).
- A second non-GitLab host is proposed (Bitbucket, Forgejo) — the REGISTRY validates the abstraction's shape.

## References

- `lib/hosts/index.js` — interface + REGISTRY + `detect()`
- `lib/hosts/github/{api,selectors,pr-state}.js` — current sole consumer
- `test/hosts.test.js` — interface conformance tests
- `plans/v2-gitlab-port.md` — Epic 9 (the future second consumer)
- `docs/status-2026-05-01.md` — audit that flagged the abstraction as premature
- `docs/plans/v1.1-blockers-plan.md` Phase 4 — this decision's parent task
