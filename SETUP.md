# Setup Guide

Step-by-step setup for **GitHub PR Quick Merge** — for development and personal use.

> **Audience:** the project maintainer (you, Brady) and any future contributor. If you're a casual end-user looking to install the published extension, skip to [README.md](./README.md) once we ship it to the Chrome Web Store.

---

## 1. Prerequisites

Make sure these are installed:

- **Node.js 20+** (`node --version`)
- **npm 10+** (`npm --version`)
- **git** (`git --version`)
- **GitHub CLI** (`gh --version`) — used for authenticated git pushes and repo creation
- **Chrome / Edge / Brave / Arc** OR **Firefox 115+** to load the extension

---

## 2. Clone the repository

```bash
gh repo clone bradygrapentine/gh-pr-quick-merge
cd gh-pr-quick-merge
```

If `gh` isn't authenticated yet:

```bash
gh auth login
# Choose: GitHub.com → HTTPS → Login with a web browser
# Sign in with brady.grapentine@gmail.com
```

---

## 3. Install dev dependencies and run tests

```bash
npm install
npm test
```

You should see **all tests passing** (currently ~32+, growing each wave). If anything is red, stop and report.

For watch mode while developing:

```bash
npm run test:watch
```

---

## 4. Register a GitHub OAuth App (one-time)

The OAuth Device Flow needs a Client ID. You register a personal OAuth app once and reuse it.

1. Open [github.com/settings/applications/new](https://github.com/settings/applications/new) (signed in as **brady.grapentine@gmail.com**).
2. Fill in:
   - **Application name:** `PR Quick Merge — personal`
   - **Homepage URL:** `https://github.com/bradygrapentine/gh-pr-quick-merge`
   - **Authorization callback URL:** anything valid — Device Flow does not use it; e.g. `https://github.com/bradygrapentine`
3. **Tick "Enable Device Flow"** (this is the critical checkbox).
4. Click **Register application**.
5. Copy the **Client ID** — looks like `Iv1.xxxxxxxxxxxxxxxx`. You don't need the client secret; Device Flow doesn't use it.

Keep this Client ID handy — you'll paste it into the extension's options page in step 6.

> The Client ID is **not a secret**. It's safe to commit it into a config file or share with collaborators. If you publish the extension to the Chrome Web Store, you'll bake in your own Client ID rather than asking each user to register one.

---

## 5. Load the extension in Chrome (developer mode)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select the `gh-pr-quick-merge/` folder you cloned.
5. The extension should appear in the list — pin it via the puzzle-piece icon for easy access.

For Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Pick `manifest.json` inside `gh-pr-quick-merge/`.

---

## 6. Sign in

1. Right-click the extension's icon → **Options** (or click the icon and pick the gear).
2. Paste the **Client ID** from step 4 into the OAuth section, click **Save Client ID**.
3. Click **Sign in with GitHub**.
4. A one-time code appears — click **Copy code & open GitHub**.
5. On the page that opens, paste the code, click Continue, then **Authorize**.
6. The options page should flip to "Signed in as bradygrapentine".

> **Fallback:** if Device Flow misbehaves (rare), expand "Use a Personal Access Token instead" and paste a PAT with `repo` scope.

---

## 7. Try it on a real PR list

1. Go to [github.com/pulls](https://github.com/pulls) — your dashboard of all PRs across repos.
2. Each row should now show **Squash / Merge / Rebase** buttons.
3. Tick the checkboxes on a couple of mergeable PRs — the bulk-action bar appears at the bottom.
4. Click **Merge selected** — you'll see the **Pro** modal (bulk-merge is gated). Click **Enable Pro (dev)** to bypass during development.

Test on a repo where you have merge rights — your own forks are ideal for safe experimentation.

---

## 8. Development workflow

```bash
# Make changes
npm test                          # confirm green
git checkout -b feature/QM-XXX
# edit files
npm test
git commit -am "feat(QM-XXX): ..."
git push -u origin feature/QM-XXX
gh pr create --fill
```

Reload the extension after edits via the **↻** button on `chrome://extensions`. The content script reloads automatically on the next page navigation.

### Useful commands

| Task | Command |
|---|---|
| Run tests once | `npm test` |
| Watch tests | `npm run test:watch` |
| Lint manifest (optional) | `npx web-ext lint` |
| Create a zip for upload | `npm run package` (TBD — see `BACKLOG.md`) |

---

## 9. Where things live

```
gh-pr-quick-merge/
├── manifest.json          # extension manifest (MV3)
├── content.js             # injected into github.com/*/pulls etc.
├── auth.js                # OAuth Device Flow
├── options.html / .js     # settings page
├── styles.css             # all extension UI styling
├── lib/                   # pure modules (testable)
│   ├── pr-helpers.js      # URL parsing, mergeability classification
│   ├── repo-defaults.js   # per-repo merge-method defaults
│   ├── templates.js       # merge-commit templates  (added in Wave 2)
│   └── shortcuts.js       # keyboard shortcuts       (added in Wave 2)
├── test/                  # vitest unit tests
├── icons/                 # 16/48/128 PNG icons
├── ROADMAP.md             # high-level milestones
├── BACKLOG.md             # actionable backlog (QM-001…)
├── WAVE-2-PLAN.md         # current wave's execution plan
├── SECURITY.md            # security findings + threat model
└── SETUP.md               # this file
```

---

## 10. Troubleshooting

- **Buttons don't appear on github.com/pulls** → reload the extension at `chrome://extensions`, then refresh the GitHub page. Open DevTools and check the Console for `QM_HELPERS undefined` (means `lib/pr-helpers.js` failed to load — verify it exists).
- **"Bad credentials" on merge** → token expired or revoked. Re-sign-in via the options page.
- **Device Flow times out** → you have ~15 minutes to enter the code. Click **Sign in with GitHub** again to start fresh.
- **Pro modal appears every time** → that's by design until you click "Enable Pro (dev)". Storage is per-browser-profile.
- **Tests fail with "Cannot find module"** → run `npm install`. Vitest 4 uses ESM; if you're on Node < 20, upgrade.

For anything else, open an issue at [github.com/bradygrapentine/gh-pr-quick-merge/issues](https://github.com/bradygrapentine/gh-pr-quick-merge/issues).
