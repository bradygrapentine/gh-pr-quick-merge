/* Popup UI for GitHub PR Quick Merge.
 * Loads pinned-repo list from chrome.storage.sync, fetches open PRs per repo,
 * aggregates via lib/popup-data.js, and renders rows.
 */

const API = "https://api.github.com";
// Pull popup-data helpers off the namespace explicitly — destructuring at
// script top-level would clash with the function declarations that
// popup-data.js puts on the global lexical scope.
const QMPopupData = window.QM_POPUP_DATA;

const SLUG_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

const $ = (id) => document.getElementById(id);

const state = {
  manage: false,
  pinned: [],
  rowErrors: new Map(),
  lastSync: null,
  lastEntries: [],
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
  $("emptyHint").textContent = QMPopupData.EMPTY_STATE_HINT;
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
  renderRowsFromState();
}

function _formatSyncAgo(ts) {
  if (!ts) return "";
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 5) return "synced just now";
  if (sec < 60) return `synced ${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `synced ${min}m ago`;
  return `synced ${Math.round(min / 60)}h ago`;
}

function renderSummary(entries) {
  const repoCount = entries.length;
  const mergeable = entries.reduce((n, e) => n + (e.mergeableCount || 0), 0);
  const stat = $("summaryStat");
  // Refine pass 7 — editorial moment: a different headline when the merge
  // queue is empty, with .all-clear flipping the color + ✓ glyph in CSS.
  stat.classList.remove("all-clear");
  if (repoCount === 0) {
    stat.textContent = "No pinned repos";
  } else if (mergeable === 0) {
    stat.textContent = `All clear across ${repoCount} repo${repoCount === 1 ? "" : "s"}`;
    stat.classList.add("all-clear");
  } else {
    stat.textContent = `${mergeable} mergeable across ${repoCount} repo${repoCount === 1 ? "" : "s"}`;
  }
  $("summarySync").textContent = state.lastSync ? `· ${_formatSyncAgo(state.lastSync)}` : "";
}

function renderRowsFromState() {
  renderRows(state.lastEntries || []);
}

function _avatarTile(slug) {
  const tile = document.createElement("span");
  tile.className = "qm-popup-row-tile";
  tile.setAttribute("aria-hidden", "true");
  // Initial letter of the repo name (after "/").
  const name = String(slug).split("/")[1] || "?";
  tile.textContent = name.charAt(0).toUpperCase();
  return tile;
}

function _ownerRepoSplit(slug) {
  const wrap = document.createElement("div");
  wrap.className = "qm-popup-row-name";
  const [owner, repo] = String(slug).split("/");
  const ownerEl = document.createElement("span");
  ownerEl.className = "qm-popup-row-owner";
  ownerEl.textContent = `${owner}/`;
  const repoEl = document.createElement("span");
  repoEl.className = "qm-popup-row-repo";
  repoEl.textContent = repo || "";
  wrap.appendChild(ownerEl);
  wrap.appendChild(repoEl);
  return wrap;
}

function _statsLine(entry) {
  const ready = entry.mergeableCount || 0;
  const open = entry.totalCount || 0;
  const stale = entry.staleCount || 0;
  const wrap = document.createElement("div");
  wrap.className = "qm-popup-row-stats";

  const r = document.createElement("span");
  r.className = `qm-popup-row-stat ${ready > 0 ? "ready" : ""}`;
  r.textContent = `${ready} ready`;
  wrap.appendChild(r);

  const sep1 = document.createElement("span");
  sep1.className = "qm-popup-row-stat-sep";
  sep1.textContent = "·";
  wrap.appendChild(sep1);

  const o = document.createElement("span");
  o.className = "qm-popup-row-stat";
  o.textContent = `${open} open`;
  wrap.appendChild(o);

  if (stale > 0) {
    const sep2 = document.createElement("span");
    sep2.className = "qm-popup-row-stat-sep";
    sep2.textContent = "·";
    wrap.appendChild(sep2);
    const s = document.createElement("span");
    s.className = "qm-popup-row-stat warn";
    s.textContent = `${stale} stale`;
    wrap.appendChild(s);
  }

  return wrap;
}

function renderRows(entries) {
  state.lastEntries = entries;
  renderSummary(entries);
  const list = $("repoList");
  list.innerHTML = "";
  for (const entry of entries) {
    const slug = `${entry.owner}/${entry.repo}`;
    const formatted = QMPopupData.formatPopupRow(entry);
    const li = document.createElement("li");
    li.dataset.slug = slug;

    const link = document.createElement("a");
    link.href = formatted.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "qm-popup-row-link";

    link.appendChild(_avatarTile(slug));

    const body = document.createElement("div");
    body.className = "qm-popup-row-body";
    body.appendChild(_ownerRepoSplit(slug));
    body.appendChild(_statsLine(entry));
    link.appendChild(body);

    if (entry.mergeableCount > 0) {
      const cta = document.createElement("span");
      cta.className = "qm-popup-row-cta qm-button qm-button-primary qm-button-sm";
      cta.textContent = `Merge ${entry.mergeableCount}`;
      link.appendChild(cta);
    }

    li.appendChild(link);

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

  // Render rows for pinned repos that failed entirely (no entry came back),
  // and — in manage mode — also stub rows for pinned repos with no fetch
  // attempt yet so the user can remove them before signing in.
  const haveSlugs = new Set(entries.map((e) => `${e.owner}/${e.repo}`));
  for (const slug of state.pinned) {
    if (haveSlugs.has(slug)) continue;
    const errMsg = state.rowErrors.get(slug);
    if (!errMsg && !state.manage) continue;
    const li = document.createElement("li");
    li.dataset.slug = slug;
    li.className = "qm-popup-row-failed";
    const wrap = document.createElement("div");
    wrap.className = "qm-popup-row-link";
    wrap.appendChild(_avatarTile(slug));
    const body = document.createElement("div");
    body.className = "qm-popup-row-body";
    body.appendChild(_ownerRepoSplit(slug));
    wrap.appendChild(body);
    li.appendChild(wrap);
    if (errMsg) {
      const errPill = document.createElement("span");
      errPill.className = "qm-popup-row-error";
      errPill.textContent = errMsg;
      li.appendChild(errPill);
    }
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
      updated_at: pr.updated_at || null,
    })),
  };
}

async function loadAndRender() {
  hideEmptyState();
  setStatus("Loading…");
  state.rowErrors.clear();
  // Spin the refresh glyph while the fetch is in flight (refine pass 6)
  // and run the brand-band scan line (refine pass 8 / overdrive).
  const refreshBtn = $("refreshBtn");
  if (refreshBtn) refreshBtn.classList.add("qm-spinning");
  document.body.classList.add("qm-popup-syncing");
  try {
    return await _loadAndRenderInner();
  } finally {
    if (refreshBtn) refreshBtn.classList.remove("qm-spinning");
    document.body.classList.remove("qm-popup-syncing");
  }
}

async function _loadAndRenderInner() {
  const [{ pinnedRepos }, { token }, localData] = await Promise.all([
    chrome.storage.sync.get("pinnedRepos"),
    chrome.storage.local.get("token"),
    chrome.storage.local.get("tokenStale"),
  ]);

  const repos = Array.isArray(pinnedRepos) ? pinnedRepos : [];
  state.pinned = repos.map(String);

  $("staleBanner").hidden = !(localData && localData.tokenStale);

  if (repos.length === 0) {
    setStatus("");
    state.lastEntries = [];
    state.lastSync = Date.now();
    renderSummary([]);
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

  const entries = QMPopupData.aggregateMergeable(ok);
  state.lastSync = Date.now();
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

function _injectBrand() {
  const slot = $("brandSlot");
  if (slot && window.QM_BRAND && typeof window.QM_BRAND.makeMark === "function") {
    slot.innerHTML = "";
    slot.appendChild(window.QM_BRAND.makeMark());
  }
}

async function _bootstrapPrefs() {
  if (window.QM_VISUAL_PREFS && chrome.storage && chrome.storage.sync) {
    try {
      await window.QM_VISUAL_PREFS.bootstrap({ root: document.documentElement, store: chrome.storage.sync });
    } catch (_e) { /* best-effort; defaults apply */ }
  }
  if (window.QM_THEME && chrome.storage && chrome.storage.sync) {
    try {
      await window.QM_THEME.bootstrap({ root: document.documentElement, store: chrome.storage.sync });
    } catch (_e) { /* best-effort */ }
  }
}

async function _maybeOnboard() {
  if (!window.QM_ONBOARDING || !chrome.storage) return;
  const mount = $("onboardingSlot");
  await window.QM_ONBOARDING.maybeRender({
    mount,
    localStore: chrome.storage.local,
    syncStore: chrome.storage.sync,
    onConnect: openOptions,
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Attach click handlers FIRST so tests / fast users don't race
  // the async bootstrap calls below.
  $("openOptions").addEventListener("click", openOptions);
  $("goToOptions").addEventListener("click", openOptions);
  $("staleOpenOptions").addEventListener("click", openOptions);
  $("manageBtn").addEventListener("click", () => setManageMode(!state.manage));
  $("footerPin").addEventListener("click", () => setManageMode(true));
  $("refreshBtn").addEventListener("click", () => {
    loadAndRender().catch((e) => setStatus(`Failed: ${e.message || e}`, "err"));
  });
  $("manageAddBtn").addEventListener("click", () => addRepo($("manageRepoInput").value));
  $("manageRepoInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addRepo(e.target.value);
  });

  _injectBrand();
  await _bootstrapPrefs();
  await _maybeOnboard();
  loadAndRender().catch((e) => {
    setStatus(`Failed: ${e.message || e}`, "err");
  });

  // Refresh "synced Ns ago" text once a second so it stays accurate.
  setInterval(() => {
    if (state.lastSync) renderSummary(state.lastEntries || []);
  }, 1000);
});
