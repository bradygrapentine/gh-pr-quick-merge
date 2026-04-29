// web-ext configuration.
//
// Note: plan listed `.web-ext-config.cjs` but web-ext 8 fails to load .cjs
// configs via Node's CJS-as-ESM bridge (the dynamic import surfaces a literal
// `module.exports` key that the option-validator then rejects as "unknown
// option"). Using `.mjs` with `export default` is the supported form for
// web-ext 8 and produces an identical config tree.
//
// `ignoreFiles` excludes repo files that are NOT part of the shipped
// extension package: build/dev tooling (scripts/), planning docs (plans/),
// tests (test/, lib/test-utils.js), CI/harness dirs (.github/, .claude/),
// lockfiles, and Markdown docs. They live in the repo but are not part of the
// runtime extension. Excluding them silences false-positive lints (e.g.
// FLAGGED_FILE_EXTENSION on scripts/package.sh, JS_SYNTAX_ERROR on the test
// helper lib/test-utils.js which is module-only and never shipped) and keeps
// lint focused on the actual extension surface. This is a correctness
// exclusion, not a "we don't want to fix it" suppression.
export default {
  ignoreFiles: [
    "scripts/**",
    "plans/**",
    "test/**",
    "node_modules/**",
    "dist/**",
    ".github/**",
    ".claude/**",
    "lib/test-utils.js",
    "package.json",
    "package-lock.json",
    "BACKLOG.md",
    "CHANGELOG.md",
    "README.md",
    "ROADMAP.md",
    "SECURITY.md",
    "SETUP.md",
    "WAVE-2-PLAN.md",
    ".web-ext-config.mjs",
    ".gitignore",
    "web-ext-artifacts/**",
  ],
};
