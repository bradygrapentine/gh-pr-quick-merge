# Show HN — PR Quick Merge launch post (QM-119)

> Posted only after BOTH store listings return "Published". HN readers click through immediately; broken store links = wasted post. Target: weekday 9–11am US Eastern.

## Title (HN limit: 80 chars; aim < 60 for full visibility on listings)

```
Show HN: PR Quick Merge – merge GitHub PRs from your toolbar
```
(58 chars)

## Body

```
Hi HN,

PR Quick Merge is a small Chrome / Firefox extension I've been using for the
past several months to clear my GitHub PR backlog without context-switching.
It adds Squash, Merge, and Rebase buttons to every row of github.com/pulls
and per-repo PR lists, so you can land a PR with one click instead of:
open the PR → scroll → click Merge → confirm → back to list → next PR.

It's open source (MIT), no first-party server, no telemetry. The browser
talks directly to api.github.com using your own OAuth Device Flow Client
ID — there's no developer-owned client secret in the chain. Your access
token lives in chrome.storage.local on your machine and never crosses a
server I operate.

Other things in there:
- Pinned-repo toolbar popup that surfaces what's mergeable across repos
- Bulk-merge across multiple pinned repos in one click (great for cleaning
  up dependabot)
- Per-repo default merge method (some of my repos squash, others rebase —
  this remembers)
- A MutationObserver keeps the buttons attached when GitHub re-renders the
  list (filter, sort, pagination)

Stack: vanilla JS extension (no build step beyond web-ext bundling), 167
unit tests, web-ext lint clean, GitHub Actions CI.

Tradeoffs I made and might be wrong about:
1. No backend on purpose. It costs nothing to operate, can't leak user
   data, and means I'll never email you. The downside is no usage analytics
   to inform what to build next.
2. OAuth Device Flow with user-supplied Client ID adds 30 seconds to
   first-run setup. The alternative — embed my own Client ID — would mean
   every install touches my GitHub Apps quota and gives me visibility I
   didn't want.
3. I picked vanilla JS over a framework. Smaller XPI, easier AMO source
   review, but the popup UI is plainer than a React-based equivalent
   would be.

Free on Chrome Web Store: <CWS-LISTING-URL>
Free on Firefox Add-ons: <AMO-LISTING-URL>
Source + privacy policy: https://github.com/bradygrapentine/gh-pr-quick-merge

Happy to answer questions about the build, the OAuth flow, the AMO source-
disclosure process, or trade-offs above.
```

## Pre-post checklist

- [ ] Both `<CWS-LISTING-URL>` and `<AMO-LISTING-URL>` substituted with real published URLs (not "Pending review" URLs)
- [ ] Click each store URL from a logged-out browser to confirm "Add to Chrome / Firefox" works
- [ ] Verify the GitHub repo URL renders publicly (no 404, README embeds the demo GIF)
- [ ] Confirm I (the OP) am available to respond to comments for at least the first 4 hours after posting
- [ ] Posted from an HN account with > 50 karma (avoids new-account ranking penalty)
- [ ] No vote manipulation / asking friends to upvote — HN detects rings and shadowbans

## Response strategy

When someone asks "how is this different from [X]":
- Don't shit-talk the alternative.
- Lead with the tradeoff PR Quick Merge made differently (e.g. "X requires a Client ID I host; PR Quick Merge uses your own — that's a tradeoff in setup friction vs operational independence").
- Be specific. "X charges $5/mo, PR Quick Merge is donation-funded" is fine; "X is bloated" is not.

When someone reports a bug in the comments:
- Acknowledge, ask for a repro repo + browser version, and link to the GitHub Issues page. Do NOT debug live in the HN thread.

When someone asks about Pro / paid features:
- Be honest: v1 ships donation-funded via GitHub Sponsors; Pro tier (paid) was deferred.

## Timing tactics

- HN's algorithm rewards posts that pick up votes + comments quickly without looking gamed.
- A post submitted at 9:00 ET on Tuesday/Wednesday/Thursday has the longest natural climb window before the New Day cutoff.
- Avoid Mondays (back-to-work noise) and Fridays (front page falls fast over weekend).
- If the post stalls below 5 points after 30 min, do NOT delete and resubmit — HN flags resubmits.
