# Newsletter outreach — pitch template (QM-119)

> Goal: organic mention in 1–3 developer-focused newsletters. Editorial mentions only — paid placements ($500–2,000/issue) are out of scope for the donation-funded v1.0. Send pitches at least 2 weeks before target launch date; most editors have 2–4 week lead times.

## Targets (in priority order)

| Newsletter | Editor | Audience size | Sub URL | Lead time |
|---|---|---|---|---|
| TLDR Dev | Dan Ni | 700k+ | `tldr.tech/dev` | 2 weeks |
| Bytes (JavaScript Weekly) | Cooper Press | 600k+ | `bytes.dev` | 3 weeks |
| Console DevTools | Jack Bridger | 25k | `console.dev` | 2 weeks |
| Refactoring | Luca Rossi | 30k | `refactoring.fm` | 2 weeks |
| Pointer | Suraj Patil | 15k | `pointer.io` | 2 weeks |

(Editor names + sub URLs current as of 2026-04-29 — verify before sending; newsletters change hands.)

## Pitch template (150 words; one paragraph; one link)

> Subject line: PR Quick Merge — open-source GitHub extension for merging from the PR list

```
Hi <EDITOR_NAME>,

I'm a longtime <NEWSLETTER_NAME> reader. I'm launching PR Quick Merge — a
free, open-source Chrome/Firefox extension that adds merge buttons to every
row of GitHub's pull-request list. It saves the open-PR / click-merge /
back-to-list loop for maintainers landing dependabot PRs in bulk.

Two angles your readers might find interesting:
1. It uses GitHub's OAuth Device Flow with a user-supplied Client ID, so
   there's no developer-owned secret and no first-party server in the
   data path — a deployment shape I'd love to see more extensions adopt.
2. The implementation is vanilla JS with no build step, which made the
   Firefox AMO source-disclosure review trivial and shrunk the XPI.

Live on Chrome Web Store and Firefox Add-ons:
<MARKETING-URL>

If it's a fit for an upcoming issue, I'd be happy to provide a 60-second
demo, additional screenshots, or answer questions on the build.

Thanks,
Brady
```

## Customization notes

- **Personalization > template:** before sending, skim the last 3–4 issues of the target newsletter and include a one-line reference to a recent post they ran (genuine, not flattery). Generic pitches get ignored; specific ones get replies.
- **Subject line A/B:** TLDR-style newsletters prefer concrete subject lines. "PR Quick Merge — open-source GitHub extension for merging from the PR list" beats "Check out my new project!" by a wide margin.
- **One link only:** newsletter editors get hundreds of pitches. A pitch with five links signals low effort. One link to a single canonical URL (the marketing site, or the GitHub repo if the marketing site isn't ready).
- **No attachments.** Editors filter inbound mail with attachments. Inline screenshots are also a deliverability risk. Link to a YouTube unlisted demo instead if visual proof is needed.

## Sending log (fill in as pitches go out)

| Newsletter | Sent date | Reply received | Mentioned in issue | Notes |
|---|---|---|---|---|
| TLDR Dev | | | | |
| Bytes | | | | |
| Console DevTools | | | | |
| Refactoring | | | | |
| Pointer | | | | |

## What success looks like

- 1 organic mention in any of the top 3 newsletters → ~500–2000 referral installs over the following week.
- 0 mentions → no harm done. Newsletter outreach is a low-cost long shot, not a critical path.

## Ethics rails

- Don't mass-send the same template to 50 newsletters; pick 5 you genuinely read, and write each one a personalized note.
- Don't pretend to be an unrelated reader recommending the project. Editors detect this and blacklist senders.
- If a paid sponsorship slot is offered, take it on its merits — but disclose the relationship in the pitch and avoid mixing earned/paid coverage.
