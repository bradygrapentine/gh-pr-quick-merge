# Mozilla Add-ons (AMO) listing — v1.1.0

For copy-paste into the addons.mozilla.org developer hub. Some fields differ from CWS — notes inline.

---

## Add-on name

```
PR Quick Merge — Merge from List
```

## Summary (250 char max)

```
Merge, squash, or rebase pull requests directly from GitHub's PR list. Auto-merge when CI is green, bulk actions, smart filters. Open source, donation-funded.
```
*(157 chars)*

## Description (markdown supported)

```markdown
**PR Quick Merge** adds merge / squash / rebase buttons to GitHub's pull request list page so you can ship work without clicking into each PR. Open source, free, donation-funded.

### What it does

- One-click **merge / squash / rebase** from the PR list — skip the "open PR → scroll → click → confirm" cycle.
- **Auto-Merge:** queue a PR to merge automatically the moment CI turns green. Click again to stop watching.
- **Auto-Rebase before merge:** per-PR opt-in. If a PR is N commits behind base, the extension silently rebases first, then merges.
- **Update Branch:** one-click rebase or merge of base into a PR's head branch.
- **Resolve Conflicts:** when a PR is conflicting, a one-click pill opens GitHub's web conflict editor.
- **Bulk actions:** select multiple PRs and merge / close / label all at once. Typed-confirm dialog for safety.
- **Quick filters:** Mine / Ready / Hide bots / Stale / Small.
- **Row metadata badges:** PR size (XS/S/M/L/XL), CI status, stale-PR highlight, behind-base count.
- **Per-repo defaults** for merge method + commit-message templates.
- **Custom keyboard shortcuts.**
- **Dark + light themes** following GitHub's setting.

### Privacy

Nothing leaves your browser. The extension uses your GitHub access token (stored only in your browser's local storage) to call api.github.com directly. PR data, repo names, and merge actions never touch our servers — because we don't run any.

Crash reports are **opt-in** and disabled by default.

[Full privacy policy](https://bradygrapentine.github.io/gh-pr-quick-merge/privacy-policy.html)

### Donation-funded

PR Quick Merge is free and open source under the MIT license. If it saves you time, [GitHub Sponsors](https://github.com/sponsors/bradygrapentine) keeps it maintained.

### Source code & bug reports

- [GitHub repo](https://github.com/bradygrapentine/gh-pr-quick-merge)
- [Issues](https://github.com/bradygrapentine/gh-pr-quick-merge/issues)
```

---

## Categories

- Primary: **Web Development**
- Secondary: **Other**

## Tags

`github`, `pull-request`, `merge`, `developer-tools`, `productivity`, `code-review`

## Default locale

`en-US`

---

## Privacy policy URL

```
https://bradygrapentine.github.io/gh-pr-quick-merge/privacy-policy.html
```

## Support email

```
grapentineb@gmail.com
```

## Support site

```
https://github.com/bradygrapentine/gh-pr-quick-merge/issues
```

## Homepage

```
https://github.com/bradygrapentine/gh-pr-quick-merge
```

---

## License

MIT

## Source code disclosure (AMO requirement for vendored / minified code)

AMO requires that any minified or vendored code shipped in the extension be either built from source or pointed at the upstream source. This applies to `lib/vendor/sentry.min.js` (the `@sentry/browser` 8.55.2 CDN bundle).

```
The vendored Sentry browser SDK at lib/vendor/sentry.min.js is fetched from the official Sentry CDN at:

  https://browser.sentry-cdn.com/8.55.2/bundle.min.js

The vendor script (scripts/vendor-sentry.sh) pins both the version (8.55.2) and the SHA-256 of the bundle (d8e888c3e22a0790e84734d688e3f59347d555efc1f4a4c2ebac39738087e9b6) so any supply-chain change is loud, not silent.

Upstream source: https://github.com/getsentry/sentry-javascript at tag 8.55.2
Upstream license: MIT
```

## Manifest dual-build note

AMO's web-ext linter rejects `background.service_worker` (Chrome MV3 only) and requires `background.scripts` (Firefox MV3). The CWS submission uses `service_worker`; the AMO submission needs a manifest variant with `background.scripts: ["background.js"]` instead.

**Build step needed before AMO upload:** edit the manifest in the build artifact:

```json
"background": {
  "scripts": ["background.js"]
}
```

instead of the Chrome version's:

```json
"background": {
  "service_worker": "background.js"
}
```

Both reference the same `background.js`, so no source change is needed — only the manifest entry.

---

## Submission checklist

- [ ] CWS submission complete (signal that the source is shipped + reviewed)
- [ ] Build artifact: `npm run package` produces `dist/gh-pr-quick-merge-1.1.0.zip`
- [ ] Manifest patched for Firefox: `background.service_worker` → `background.scripts: ["background.js"]`
- [ ] manifest.json `version` matches `1.1.0`
- [ ] Source-code archive uploaded (AMO requires source for vendored Sentry SDK)
- [ ] License confirmed: MIT
- [ ] Privacy policy URL resolves
- [ ] Tags + categories set
- [ ] Listing copy reviewed
