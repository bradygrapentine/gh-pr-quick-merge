# Chrome Web Store listing — PR Quick Merge

> Source of truth for the CWS Developer Dashboard fields. Keep this in sync with the AMO listing — same product, different audience.

## Name (CWS limit: 45 chars)

```
PR Quick Merge
```
(14 chars)

## Short description (CWS limit: 132 chars)

```
Squash, merge, or rebase GitHub pull requests directly from the PR list — one click, no tab switching, no page reloads.
```
(123 chars)

## Category

`Developer Tools`

## Language

`English`

---

## Detailed description

```
PR Quick Merge adds Squash / Merge / Rebase buttons to every row of GitHub's Pull Requests list. Click once and the PR closes — no tab switch, no page load.

WHAT IT DOES
- Adds merge buttons to github.com/pulls and per-repo PR list pages
- Reads each PR's mergeable state from the GitHub API and enables the right buttons
- Re-injects buttons when GitHub re-renders the list (filtering, sorting, pagination)
- Remembers your preferred merge method per repository

WHO IT'S FOR
- Solo maintainers landing dependabot PRs in bulk
- Reviewers who batch-approve and merge five repos at a time
- Anyone tired of opening every PR just to click "Merge"

OAUTH BY DEFAULT
PR Quick Merge uses GitHub's OAuth Device Flow. Your access token lives in your browser's local storage only — it never transits a server we operate. (See the privacy policy linked below for full details.) If you'd rather use a Personal Access Token, that path is supported too.

PRIVACY
- No analytics, no telemetry, no third-party trackers
- No backend server: your browser talks directly to api.github.com
- Open source on GitHub — read the code yourself

PERMISSIONS REQUESTED
- "storage" — to keep your token and per-repo preferences across sessions
- Access to github.com — to read the PR list and inject merge buttons
- Access to api.github.com — to call the GitHub REST API on your explicit click

SUPPORT
Bug reports and feature requests: github.com/bradygrapentine/gh-pr-quick-merge/issues
Privacy policy: github.com/bradygrapentine/gh-pr-quick-merge/blob/main/docs/privacy-policy.md
```

(~290 words; CWS allows up to ~16,000 chars but reviewers prefer concise listings.)

## Privacy policy URL

`https://github.com/bradygrapentine/gh-pr-quick-merge/blob/main/docs/privacy-policy.md`

(Until a custom marketing site exists, the in-repo Markdown URL is acceptable to CWS.)

## Single-purpose declaration

> The single purpose of this extension is to allow GitHub users to merge their own pull requests from the GitHub Pull Requests list page without opening each PR individually.

## Permission justifications (Developer Dashboard reviewer notes)

- **`storage`**: required to persist the user's GitHub OAuth access token and per-repository default merge-method preferences (squash / merge / rebase) across sessions.
- **`https://*.github.com/*` host permission**: required to inject merge buttons into the GitHub Pull Requests list DOM. Without this permission the extension cannot render its UI.
- **`https://api.github.com/*` host permission**: required to call the GitHub REST API endpoints `GET /repos/:owner/:repo/pulls/:num` (read mergeable state) and `PUT /repos/:owner/:repo/pulls/:num/merge` (perform the merge). Calls are made directly from the user's browser; no proxy server is involved.
- **`identity`** (Chrome only): used to open the GitHub OAuth Device Flow verification URL in a new tab during sign-in. Optional; the PAT path does not require this.

## Remote code

The extension does **not** load remote code. There are no `eval()` calls, no `Function()` constructors, no remote `<script>` injections. All JavaScript is bundled in the .crx and reviewable in the source disclosure.

## Data usage disclosure (CWS Privacy form)

| Question | Answer |
|---|---|
| Does this extension collect personally identifiable information? | No |
| Does this extension collect health information? | No |
| Does this extension collect financial / payment information? | No |
| Does this extension collect authentication information? | Yes — GitHub access token, stored only in `chrome.storage.local`, never transmitted to a server operated by the developer. |
| Does this extension collect personal communications? | No |
| Does this extension collect location data? | No |
| Does this extension collect web history? | No |
| Does this extension collect user activity? | No |
| Does this extension collect website content? | Yes — PR titles + state, fetched from api.github.com on user interaction. Not persisted, not transmitted off-device. |

Tick the certifications:
- [x] I do not sell or transfer user data to third parties.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## Submission checklist (handover to QM-104)

- [ ] Final .zip built from a tagged release (`scripts/package.sh` or `npm run package`)
- [ ] Five screenshots ready (`creative/store-copy/screenshot-specs.md`)
- [ ] Promotional tile + marquee ready (`creative/store-copy/promotional-tile-spec.md`)
- [ ] Privacy policy URL is publicly reachable
- [ ] Listing copy above pasted into Developer Dashboard verbatim
- [ ] Permission justifications copied into the reviewer-notes field (NOT the public description)
- [ ] Data-usage disclosure form completed exactly as shown above
- [ ] Submit for review and record the CWS item ID
