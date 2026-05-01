# Architecture Decision Records

Numbered records of architectural choices with the *why* preserved so future readers don't have to reverse-engineer it.

| # | Title | Status | Date |
|---|---|---|---|
| [0001](./0001-hostadapter.md) | Keep the HostAdapter abstraction with a single consumer | Accepted | 2026-05-01 |

## Adding an ADR

Use the `/write-adr` skill. Filename pattern: `NNNN-short-slug.md`. Update the table above.

## When to write one

- A non-trivial architectural choice (DB engine, framework, auth model, schema shape, abstraction boundary).
- A decision that future maintainers will likely revisit ("why did we do it this way?").
- A reversal of a prior ADR — open a new one rather than editing the old; mark the old one Superseded.

Don't write an ADR for routine implementation choices — those belong in commit messages and code comments.
