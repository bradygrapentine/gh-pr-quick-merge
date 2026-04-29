# Visual snapshot update SOP (QM-149)

> Playwright stores baseline screenshots in `test/e2e/visual/__snapshots__/`. Updating them is a deliberate human decision, never automatic.

## When to update

- **YES, update:** the UI changed intentionally (new component, deliberate restyle, copy edit).
- **NO, do not update:** a snapshot diff appears and you don't know why. Investigate first — diffs often signal a regression rather than an intentional change.

## Update procedure

1. Reproduce the diff locally:
   ```bash
   npm run test:e2e:visual
   ```
   The runner emits failing snapshots into `test-results/`. Inspect each one against the baseline.

2. Confirm the diff is intentional. Open both images side-by-side. Ask:
   - Did I or anyone else recently change CSS / popup HTML / options HTML?
   - If yes, does the diff match the intended change exactly?
   - If no, the diff is a regression — fix the code, not the snapshot.

3. Regenerate baselines:
   ```bash
   npx playwright test --project=visual --update-snapshots
   ```

4. Inspect the regenerated PNGs in `test/e2e/visual/__snapshots__/` with an image viewer before staging.

5. Commit baselines on the same PR as the UI change. Message convention:
   ```
   ui: <change description>

   Updates visual snapshots: popup-loaded.png, options-with-token.png.
   ```

## PR review rules

- **Reviewer must visually compare** old-vs-new snapshots. The CI snapshot diff is in `test-results/` — link to the PR run for the reviewer.
- **Auto-approval is forbidden.** A bot cannot approve a snapshot-update PR. A human eyeballs every changed image.
- A snapshot PR with a code change unrelated to the UI is a code-review red flag — the snapshot updates should ride with the UI change, not piggyback on an unrelated commit.

## Cross-platform notes

Playwright snapshots are sensitive to:

- OS font rendering (macOS vs Linux differs in subpixel hinting).
- Browser version (Chromium minor versions can shift glyph positioning by 1 px).
- Timezone (date strings on screen).

Mitigations:

- CI uses ubuntu-latest with Playwright's pinned Chromium. Local diffs from a macOS dev environment are EXPECTED — do not commit baselines generated on macOS. Always regenerate inside a Linux container or accept the CI-generated baselines.
- For tests showing dates/times: stub `Date.now` or use a fixed timezone in the test page setup.

## When snapshots are too noisy

If you find yourself regenerating baselines on every PR for diffs you can't visually distinguish, the diff threshold is too tight or the test setup is non-deterministic. Options:

1. Increase `maxDiffPixels` in the spec or globally in `playwright.config.ts`.
2. Mask volatile regions with `page.locator(...).mask()` before the snapshot call.
3. Move from full-page snapshots to component-scoped snapshots (`expect(componentLocator).toHaveScreenshot(...)`).

If none of these resolve the noise, document the failure mode and consider migrating to Percy or Chromatic — Playwright's native snapshot system is fine at < 50 baselines but becomes painful past that.
