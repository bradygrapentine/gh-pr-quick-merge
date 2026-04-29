/* Per-repo default merge method storage.
 * Backed by a chrome.storage.sync-shaped `store` (get/set/remove).
 * Storage shape: { repoDefaults: { "owner/repo": "squash"|"merge"|"rebase" } }
 */

const KEY = "repoDefaults";
const VALID_METHODS = ["squash", "merge", "rebase"];

function repoKey(owner, repo) {
  return `${owner}/${repo}`;
}

async function readMap(store) {
  const got = await store.get(KEY);
  const map = got && got[KEY];
  return map && typeof map === "object" ? map : null;
}

async function getDefault(owner, repo, store) {
  const map = await readMap(store);
  if (!map) return null;
  const v = map[repoKey(owner, repo)];
  return v == null ? null : v;
}

async function setDefault(owner, repo, method, store) {
  if (!VALID_METHODS.includes(method)) {
    throw new Error(
      `Invalid merge method: ${method}. Expected one of ${VALID_METHODS.join(", ")}.`
    );
  }
  const existing = (await readMap(store)) || {};
  const next = { ...existing, [repoKey(owner, repo)]: method };
  await store.set({ [KEY]: next });
}

async function clearDefault(owner, repo, store) {
  const existing = await readMap(store);
  if (!existing) return;
  const k = repoKey(owner, repo);
  if (!(k in existing)) return;
  const next = { ...existing };
  delete next[k];
  if (Object.keys(next).length === 0) {
    await store.remove(KEY);
  } else {
    await store.set({ [KEY]: next });
  }
}

async function listDefaults(store) {
  const map = await readMap(store);
  return map ? { ...map } : {};
}

/**
 * Given a list of selected PRs ({owner, repo}) and an in-memory defaults map,
 * return the shared default merge method if every selected PR maps to the same
 * method. Otherwise return null. Empty selections, missing entries, or any
 * divergence all yield null.
 */
function pickDefaultForBulk(selectedPrs, defaultsMap) {
  if (!Array.isArray(selectedPrs) || selectedPrs.length === 0) return null;
  if (!defaultsMap || typeof defaultsMap !== "object") return null;
  let chosen = null;
  for (const pr of selectedPrs) {
    if (!pr || !pr.owner || !pr.repo) return null;
    const v = defaultsMap[`${pr.owner}/${pr.repo}`];
    if (v == null) return null;
    if (chosen === null) {
      chosen = v;
    } else if (chosen !== v) {
      return null;
    }
  }
  return chosen;
}

const mod = {
  getDefault,
  setDefault,
  clearDefault,
  listDefaults,
  pickDefaultForBulk,
  KEY,
};

if (typeof module !== "undefined") module.exports = mod;
if (typeof window !== "undefined") window.QM_REPO_DEFAULTS = mod;
