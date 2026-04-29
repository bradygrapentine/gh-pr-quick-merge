# Reddit launch posts — r/programming + r/webdev (QM-119)

> r/programming bans pure self-promotion (rule 1: "no advertising"). The post must lead with technical substance — the "I built a thing" framing kills threads here. Lead with the bulk-merge workflow story, not the product pitch.

## r/programming version

**Title:**
```
Cleaning up dependabot PR backlogs across multiple repos with one click — what I learned building a GitHub merge extension
```

**Body:**
```
The problem I had: every Monday, ~15 dependabot PRs across four maintained
repos. The merge-PR-by-PR loop is mechanically tedious and breaks flow
every time you have to swap repos. The merging itself is one API call;
the rest is browser ceremony.

I built a Chrome / Firefox extension that injects Squash / Merge / Rebase
buttons directly into github.com/pulls list rows, plus a toolbar popup
that aggregates mergeable counts across pinned repos so I can clear a
dependabot batch in 30 seconds instead of 5 minutes.

Some implementation notes that turned out interesting:

1. GitHub re-renders the PR list as a SPA (filter, sort, pagination, infinite
   scroll). A naive contentScript that queries the DOM once misses everything
   after the first render. A MutationObserver scoped to the listing container
   re-injects buttons on each rerender. Filtering observer callbacks down to
   only the mutations that affect rows (vs avatar swaps, label changes, etc.)
   matters for keeping the work bounded.

2. OAuth Device Flow is undersold for browser extensions. It's designed for
   public clients (no client secret), which means I can ship the extension
   without operating any backend OR embedding a developer-owned Client ID.
   Each user registers their own OAuth app in GitHub settings (30 second job),
   pastes the Client ID, and signs in. Every user's data path is browser ↔
   GitHub directly; I'm not in the chain at all. The cost: ~30s of first-run
   friction. The benefit: zero backend to operate, zero data I could leak,
   zero analytics I could be tempted to add later.

3. The mergeable state surface from GitHub's API is messier than the docs
   suggest. `mergeable: null` means GitHub hasn't computed it yet (it's
   doing a background merge-base check), which on busy repos can take 1–3
   seconds. My first version just showed "loading…" buttons and looked
   broken. The fix: poll for up to 3s with backoff, then show "checking
   upstream" and an explicit retry button instead of a hard error.

4. Firefox AMO requires source disclosure for any extension that bundles
   or minifies. Going the path of "no build step at all" (vanilla JS,
   web-ext zips the source as-is) made the source review trivial and
   produced a smaller XPI than a webpack-bundled equivalent.

It's MIT, no telemetry, no backend. github.com/bradygrapentine/gh-pr-quick-merge

I'm interested in feedback on (a) anyone who's wrestled with the
mergeable: null polling pattern more elegantly than the backoff above,
and (b) anyone who's published a Firefox extension recently — AMO's
source-review queue times have been wildly variable lately.
```

## r/webdev version (lighter touch)

**Title:**
```
[Showoff Saturday] PR Quick Merge — Chrome/Firefox extension to merge GitHub PRs from the list page (no tab switch)
```

**Body:**
```
Built this because I got tired of opening every PR just to click Merge.

It adds Squash / Merge / Rebase buttons to github.com/pulls rows, plus a
toolbar popup that aggregates mergeable counts across multiple pinned repos.
One click bulk-merges across them. Useful for clearing dependabot backlogs.

Vanilla JS extension. Open source. No backend, no telemetry. OAuth Device
Flow so no client secret in the chain — your token stays in chrome.storage
.local on your machine.

Source + privacy policy: github.com/bradygrapentine/gh-pr-quick-merge
Chrome: <CWS-LISTING-URL>
Firefox: <AMO-LISTING-URL>

Happy to answer questions about the OAuth Device Flow choice, the
MutationObserver re-injection strategy, or AMO's source disclosure process.
```

## Subreddit rules cheatsheet

| Sub | Self-promo rule | What works there |
|---|---|---|
| r/programming | No "I made X" posts. Must lead with substance. | Lessons-learned post format above. Don't link to stores in the title. |
| r/webdev | "Showoff Saturday" thread is the only OK day for project shares. | Saturday-only timing. Title bracket tag required. |
| r/github | Smaller (50k subs). Less hostile to project posts. | Direct product post is fine here. |
| r/chrome_extensions | Niche but on-topic. | Direct product post welcome. |

## Pre-post checklist

- [ ] CWS + AMO URLs substituted (both must be Published, not Pending)
- [ ] r/programming post submitted on a weekday 9am–noon US Eastern (the sub's natural peak)
- [ ] r/webdev post saved as a draft and submitted on the next Saturday (Showoff Saturday rule)
- [ ] Author available to respond to comments for at least 2 hours after each post
- [ ] No cross-posting between subs within 24 hours (Reddit detects + deranks)
- [ ] Don't ask anyone to upvote (vote manipulation = sitewide ban)
