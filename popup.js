/* Popup UI for GitHub PR Quick Merge.
 * Loads pinned-repo list from chrome.storage.sync, fetches open PRs per repo,
 * aggregates via lib/popup-data.js, and renders rows.
 */

const API = "https://api.github.com";
const { aggregateMergeable, formatPopupRow, EMPTY_STATE_HINT } = window.QM_POPUP_DATA;

const SLUG_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

const $ = (id) => document.getElementById(id);

const state = {
  manage: false,
  pinned: [],
  rowErrors: new Map(), // slug -> error message
};

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg || "";
  el.className = `qm-popup-status ${kind}`;
}

function setManageStatus(msg, kind = "") {
  const el = $("manageStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.className = `qm-popup-manage-status ${kind}`;
}

function showEmptyState() {
  $("repoList").innerHTML = "";
  $("emptyHint").textContent = EMPTY_STATE_HINT;
  $("emptyState").hidden = false;
}

function hideEmptyState() {
  $("emptyState").hidden = true;
}

function setManageMode(on) {
  state.manage = !!on;
  const btn = $("manageBtn");
  btn.setAttribute("aria-pressed", state.manage ? "true" : "false");
  btn.textContent = state.manage ? "Done" : "Manage";
  $("manageBox").hidden = !state.manage;
  // Re-render rows so remove buttons appear/disappear.
  renderRowsFromState();
}

function renderRowsFromState() {
  const entries = state.lastEntries || [];
  renderRows(entries);
}

function renderRows(entries) {
  state.lastEntries = entries;
  const list = $("repoList");
  list.innerHTML = "";
  for (const entry of entries) {
    const formatted = formatPopupRow(entry);
    const li = document.createElement("li");
    li.dataset.slug = `${entry.owner}/${entry.repo}`;

    const a = document.createElement("a");
    a.href = formatted.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const label = document.createElement("div");
    label.className = "qm-popup-row-label";
    label.textContent = formatted.label;

    const subtitle = document.createElement("div");
    const ready = entry.mergeableCount > 0;
    subtitle.className = `qm-popup-row-subtitle ${ready ? "ready" : ""}`;
    subtitle.textContent = formatted.subtitle;

    a.appendChild(label);
    a.appendChild(subtitle);
    li.appendChild(a);

    const slug = `${entry.owner}/${entry.repo}`;
    const errMsg = state.rowErrors.get(slug);
    if (errMsg) {
      const errPill = document.createElement("span");
      errPill.className = "qm-popup-row-error";
      errPill.textContent = errMsg;
      errPill.title = errMsg;
      li.appendChild(errPill);
    }

    if (state.manage) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "qm-popup-row-remove";
      removeBtn.textContent = "Remove";
      removeBtn.setAttribute("aria-label", `Remove ${slug}`);
      removeBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await removeRepo(slug);
      });
      li.appendChild(removeBtn);
    }

    list.appendChild(li);
  }

  // Render rows for pinned repos that failed entirely (no entry came back).
  const haveSlugs = new Set(entries.map((e) => `${e.owner}/${e.repo}`));
  for (const slug of state.pinned) {
    if (haveSlugs.has(slug)) continue;
    const errMsg = state.rowErrors.get(slug);
    if (!errMsg) continue;
    const li = document.createElement("li");
    li.dataset.slug = slug;
    li.className = "qm-popup-row-failed";
    const label = document.createElement("div");
    label.className = "qm-popup-row-label";
    label.textContent = slug;
    li.appendChild(label);
    const errPill = document.createElement("span");
    errPill.className = "qm-popup-row-error";
    errPill.textContent = errMsg;
    li.appendChild(errPill);
    if (state.manage) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "qm-popup-row-remove";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeRepo(slug));
      li.appendChild(removeBtn);
    }
    list.appendChild(li);
  }
}

async function fetchRepoPrs(owner, repo, token) {
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/pulls?state=open&per_page=30`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!res.ok) {
    if (res.status === 401) throw new Error("401 unauthorized");
    if (res.status === 404) throw new Error("not found");
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  return {
    owner,
    repo,
    prs: data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      mergeable_state: pr.draft ? "blocked" : null,
    })),
  };
}

async function loadAndRender() {
  hideEmptyState();
  setStatus("Loading…");
  state.rowErrors.clear();

  const [{ pinnedRepos }, { token }, localData] = await Promise.all([
    chrome.storage.sync.get("pinnedRepos"),
    chrome.storage.local.get("token"),
    chrome.storage.local.get("tokenStale"),
  ]);

  const repos = Array.isArray(pinnedRepos) ? pinnedRepos : [];
  state.pinned = repos.map(String);

  // Token-stale banner (QM-044 popup side).
  $("staleBanner").hidden = !(localData && localData.tokenStale);

  if (repos.length === 0) {
    setStatus("");
    state.lastEntries = [];
    if (state.manage) {
      $("repoList").innerHTML = "";
    } else {
      showEmptyState();
    }
    return;
  }
  if (!token) {
    setStatus("Sign in via the Options page to fetch PRs.", "err");
    return;
  }

  const results = await Promise.allSettled(
    repos.map((slug) => {
      const [owner, repo] = String(slug).split("/");
      if (!owner || !repo) return Promise.reject(new Error("invalid slug"));
      return fetchRepoPrs(owner, repo, token);
    }),
  );

  const ok = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ok.push(r.value);
    } else {
      state.rowErrors.set(state.pinned[i], r.reason && r.reason.message ? r.reason.message : "fetch failed");
    }
  });
  const failed = state.rowErrors.size;

  const entries = aggregateMergeable(ok);
  renderRows(entries);

  if (failed > 0) {
    setStatus(`${failed} repo${failed > 1 ? "s" : ""} failed.`, "err");
  } else {
    setStatus("");
  }
}

async function removeRepo(slug) {
  const { pinnedRepos } = await chrome.storage.sync.get("pinnedRepos");
  const next = (Array.isArray(pinnedRepos) ? pinnedRepos : []).filter((r) => r !== slug);
  await chrome.storage.sync.set({ pinnedRepos: next });
  setManageStatus(`Removed ${slug}.`, "ok");
  await loadAndRender();
}

async function addRepo(slug) {
  const trimmed = String(slug || "").trim();
  if (!SLUG_RE.test(trimmed)) {
    setManageStatus("Use the format owner/repo.", "err");
    return false;
  }
  const { pinnedRepos } = await chrome.storage.sync.get("pinnedRepos");
  const arr = Array.isArray(pinnedRepos) ? pinnedRepos.slice() : [];
  if (arr.includes(trimmed)) {
    setManageStatus(`${trimmed} is already pinned.`, "err");
    return false;
  }
  arr.push(trimmed);
  await chrome.storage.sync.set({ pinnedRepos: arr });
  setManageStatus(`Added ${trimmed}.`, "ok");
  $("manageRepoInput").value = "";
  await loadAndRender();
  return true;
}

function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("openOptions").addEventListener("click", openOptions);
  $("goToOptions").addEventListener("click", openOptions);
  $("staleOpenOptions").addEventListener("click", openOptions);
  $("manageBtn").addEventListener("click", () => setManageMode(!state.manage));
  $("refreshBtn").addEventListener("click", () => {
    loadAndRender().catch((e) => setStatus(`Failed: ${e.message || e}`, "err"));
  });
  $("manageAddBtn").addEventListener("click", () => addRepo($("manageRepoInput").value));
  $("manageRepoInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addRepo(e.target.value);
  });

  loadAndRender().catch((e) => {
    setStatus(`Failed: ${e.message || e}`, "err");
  });
});
