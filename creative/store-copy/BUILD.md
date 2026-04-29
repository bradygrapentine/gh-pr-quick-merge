# Build reproducibility — for AMO source disclosure (QM-107)

> AMO requires the source disclosure submission to reproduce the uploaded .xpi byte-for-byte. This document is included verbatim inside `source-disclosure.zip`.

## Toolchain

| Tool | Version | Notes |
|---|---|---|
| Node.js | `20.x` (latest LTS at v0.2.0 release) | Use `nvm use 20` or `asdf install nodejs 20.x`. The `package-lock.json` is generated under Node 20. |
| npm | `10.x` (ships with Node 20) | |
| `web-ext` | `8.x` (pinned in `package.json` devDependencies) | The Mozilla CLI used to bundle the .xpi |
| OS | Any POSIX (macOS / Linux). The build does not rely on platform-specific binaries. | Tested under macOS 14 + Ubuntu 22.04. |

## Steps to reproduce the .xpi

```bash
# 1. Clean checkout
git clone https://github.com/bradygrapentine/gh-pr-quick-merge.git
cd gh-pr-quick-merge
git checkout v<VERSION>     # use the tag matching the AMO submission

# 2. Use Node 20 LTS
nvm use 20                  # or: asdf install nodejs 20 && asdf local nodejs 20

# 3. Install dependencies from lockfile (no version drift)
npm ci

# 4. Lint (optional, but the same lint runs in CI)
npm run lint

# 5. Build the package
npm run package
# Output: web-ext-artifacts/gh_pr_quick_merge-<VERSION>.zip
#         web-ext-artifacts/gh_pr_quick_merge-<VERSION>.xpi (renamed copy)
```

## Verify byte-for-byte match

```bash
# Compare against the .xpi uploaded to AMO
sha256sum web-ext-artifacts/gh_pr_quick_merge-<VERSION>.xpi
# Expected: <SHA256_FROM_RELEASE_NOTES>
```

The expected SHA256 is published in the GitHub release notes for each tagged version. If the local build's SHA does not match, do NOT submit — investigate the toolchain mismatch first (most common cause: a different Node version producing different timestamps in the zip's metadata).

## What's in the .xpi

The bundle contains the same files visible in the GitHub repo at the tagged version:

- `manifest.json`
- `background.js`
- `content.js`
- `popup.html`, `popup.js`, `popup.css`
- `options.html`, `options.js`, `options.css`
- `lib/*.js` (all extension modules)
- `icons/*.png`
- `styles.css`

Excluded by `.web-extignore` and `web-ext.config.js`:

- `.git/`, `.github/`, `node_modules/`
- `test/`, `web-ext-artifacts/`
- `docs/`, `creative/`, `plans/`
- `*.md` (except a top-level `README.md` if requested)
- `package.json`, `package-lock.json`, `web-ext.config.js`

The build does NOT minify or transform JavaScript. Files in the .xpi are byte-identical to files in the source tree (modulo line-ending normalization on Windows).

## What's NOT in the .xpi

- No third-party tracking SDKs
- No analytics libraries
- No bundled remote URLs other than `api.github.com` and `github.com`
- No `eval()`, no `new Function()`, no remote `<script>` injection
- No native binaries
- No telemetry endpoints

## How AMO reviewers can verify

1. Download `source-disclosure.zip` from the AMO submission page.
2. Unzip into a clean directory.
3. Follow the steps above (`npm ci && npm run package`).
4. `diff` the resulting .xpi structure against the AMO-uploaded .xpi:
   ```bash
   unzip -l web-ext-artifacts/gh_pr_quick_merge-<VERSION>.xpi > local.txt
   unzip -l <amo-downloaded>.xpi > amo.txt
   diff local.txt amo.txt   # should be empty
   ```
5. SHA256-compare each file inside the two zips for full byte-equality.

## Contact

Reviewer questions: grapentineb@gmail.com
Public source: https://github.com/bradygrapentine/gh-pr-quick-merge
