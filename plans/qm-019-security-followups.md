# Plan — QM-019: SECURITY follow-ups (close v0.2 release gate)

**Milestone:** v0.2 (closes the last gate before tagging `v0.2.0`)
**Estimate:** S
**Dependencies:** none
**Mode:** direct, single PR (scope is 4 small defensive hardenings; not parallelizable)

## Goal

Close the remaining open SECURITY findings so v0.2.0 can be tagged. From `SECURITY.md`:

| ID | Severity | Title | Action |
|---|---|---|---|
| F-03 | Medium | `host_permissions` broader than needed | **Fix:** narrow to `https://api.github.com/*` + the two `/login/*` Device Flow endpoints |
| F-05 | Medium | `slow_down` interval handling can grow unbounded | **Fix:** cap `pollInterval` at 60s; honor server-supplied `interval` if returned |
| F-06 | Medium | `confirm()` is the only safety guard for bulk merge | **Fix:** typed-confirmation modal for bulk merges of N≥3 PRs |
| F-15 | Low | Token may leak through `String(e)` on fetch error | **Fix:** sanitize to `e.name + ": " + e.message.slice(0, 200)` |
| F-10 | Low | Pro flag is client-side only; no server-side license check | **Defer to v1.0** (needs license server — QM-030) |
| F-13 / F-14 | Info | innerHTML over static literals; no runtime npm deps | **No action** (already correct; informational) |

**Net:** 4 fixes, 1 explicit defer, 2 informational acknowledgements.

## File ownership

- `manifest.json` — F-03 narrow `host_permissions`
- `auth.js` — F-05 polling cap + interval honor
- `content.js` — F-06 typed-confirmation modal + F-15 error sanitization in `fetchPrState`
- `styles.css` — F-06 modal styling
- `SECURITY.md` — flip closed findings to "✅ closed in QM-019" with PR ref
- `BACKLOG.md` — promote QM-019 to §7 Shipped + bump `/backlog-sync` timestamp

## Detail

### F-03 — narrow `host_permissions`

Current: `["https://github.com/*", "https://api.github.com/*"]`
Target: `["https://api.github.com/*", "https://github.com/login/device/code", "https://github.com/login/oauth/access_token"]`

The content script's `matches` already restricts where it injects (no host permission needed for that). Fetches go to `api.github.com` and the two Device Flow endpoints. `https://github.com/*` blanket grant is unnecessary.

**Risk:** if anywhere in the codebase silently relies on cookie-context fetches to other github.com URLs, this would break. Verified by grep — no such fetches exist.

### F-05 — `slow_down` cap + honor server interval

In `auth.js`, the `slow_down` branch currently does `pollInterval += 5;` unbounded. Cap at 60s. Also: if the response includes `interval`, prefer it over the +5 increment.

```js
if (tokenData.error === "slow_down") {
  const serverInterval = Number(tokenData.interval) || pollInterval + 5;
  pollInterval = Math.min(60, serverInterval);
  status(`GitHub asked us to slow down. Polling every ${pollInterval}s.`);
  continue;
}
```

### F-06 — typed-confirmation for bulk merge

Currently `onBulkMerge` calls `confirm("...")`. Replace with a custom modal for `items.length >= 3`:

- Lists the PRs (owner/repo#num + title) being merged
- Shows the merge method
- Requires the user to type the literal string `MERGE N` (where N is the count) into a text input
- Disables the confirm button until input matches
- Cancel button or backdrop click cancels

For `items.length === 1` or `2`, keep the cheap `confirm()` — typing-friction-vs-safety tradeoff favors keeping speed for single/double merges.

### F-15 — sanitize error strings

In `fetchPrState`, the catch block currently stores `{ error: String(e) }`. Replace with `{ error: \`${e.name}: ${(e.message || "").slice(0, 200)}\` }`.

## Test plan

- [ ] `npm test` — 147/147 still green (defensive hardenings; no test breakage expected)
- [ ] Add a small test in `test/auth-poll.test.js` for the F-05 cap (pollInterval should never exceed 60 even after many `slow_down` responses)
- [ ] Manual: load unpacked, perform a 3-PR bulk merge, verify the typed-confirmation modal appears and blocks the merge until "MERGE 3" is typed
- [ ] Manual: trigger a fetch error (e.g. revoke token mid-session) and verify no token-bearing context leaks into the cached error string
- [ ] CI green
- [ ] Verify no fetch in the codebase relies on `https://github.com/*` cookie-context after F-03

## Out of scope

- F-10 — license server scaffolding (QM-030, v1.0)
- Migrating from `confirm()` for non-bulk merges (preserves UX speed)
- Replacing `innerHTML` calls (F-13 confirms current usage is safe — static literals only)

## Definition of done

- [ ] F-03, F-05, F-06, F-15 all closed
- [ ] SECURITY.md updated: 4 more findings flipped to ✅
- [ ] BACKLOG.md: QM-019 promoted to §7 with PR ref
- [ ] All tests + CI green
- [ ] Hand-off line: "v0.2.0 release gate cleared; ready for `release-orchestrator`"
