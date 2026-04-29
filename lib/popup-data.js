/* Pure popup-data aggregator. No DOM. Used by popup.js + tests.
 * Mirrors the dual CJS+window export pattern of lib/pr-helpers.js.
 */

const READY_STATES = new Set(["clean", "has_hooks", "unstable"]);

const EMPTY_STATE_HINT =
  "No pinned repos yet. Open the extension's Options page to add some.";

function isReady(mergeable_state) {
  return READY_STATES.has(mergeable_state);
}

function aggregateMergeable(repoFetchResults) {
  if (!Array.isArray(repoFetchResults)) return [];
  const out = repoFetchResults.map(({ owner, repo, prs }) => {
    const safePrs = Array.isArray(prs) ? prs : [];
    const mergeableCount = safePrs.reduce(
      (n, pr) => n + (isReady(pr && pr.mergeable_state) ? 1 : 0),
      0,
    );
    return {
      owner,
      repo,
      mergeableCount,
      totalCount: safePrs.length,
      prs: safePrs.slice(),
    };
  });
  out.sort((a, b) => {
    if (b.mergeableCount !== a.mergeableCount) {
      return b.mergeableCount - a.mergeableCount;
    }
    const aKey = `${a.owner}/${a.repo}`;
    const bKey = `${b.owner}/${b.repo}`;
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;
    return 0;
  });
  return out;
}

function formatPopupRow(entry) {
  const label = `${entry.owner}/${entry.repo}`;
  const subtitle =
    entry.totalCount === 0
      ? "no open PRs"
      : `${entry.mergeableCount} of ${entry.totalCount} ready to merge`;
  const url = `https://github.com/${entry.owner}/${entry.repo}/pulls`;
  return { label, subtitle, url };
}

const helpers = {
  aggregateMergeable,
  formatPopupRow,
  EMPTY_STATE_HINT,
  READY_STATES,
};

if (typeof module !== "undefined") module.exports = helpers;
if (typeof window !== "undefined") window.QM_POPUP_DATA = helpers;
