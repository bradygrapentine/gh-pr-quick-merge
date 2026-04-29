/* Popup UI for GitHub PR Quick Merge.
 * Loads pinned-repo list from chrome.storage.sync, fetches open PRs per repo,
 * aggregates via lib/popup-data.js, and renders rows.
 */

const API = "https://api.github.com";
const { aggregateMergeable, formatPopupRow, EMPTY_STATE_HINT } = window.QM_POPUP_DATA;

const $ = (id) => document.getElementById(id);

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg || "";
  el.className = `qm-popup-status ${kind}`;
}

function showEmptyState() {
  $("repoList").innerHTML = "";
  $("emptyHint").textContent = EMPTY_STATE_HINT;
  $("emptyState").hidden = false;
}

function hideEmptyState() {
  $("emptyState").hidden = true;
}

function renderRows(entries) {
  const list = $("repoList");
  list.innerHTML = "";
  for (const entry of entries) {
    const formatted = formatPopupRow(entry);
    const li = document.createElement("li");
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
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  // /pulls list endpoint does not return `mergeable_state`. Approximate:
  // draft PRs are never ready; everything else stays "pending" until the
  // content script computes full mergeability on the PR-list page.
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

  const [{ pinnedRepos }, { token }] = await Promise.all([
    chrome.storage.sync.get("pinnedRepos"),
    chrome.storage.local.get("token"),
  ]);

  const repos = Array.isArray(pinnedRepos) ? pinnedRepos : [];
  if (repos.length === 0) {
    setStatus("");
    showEmptyState();
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

  const ok = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  const failed = results.filter((r) => r.status === "rejected").length;

  const entries = aggregateMergeable(ok);
  renderRows(entries);

  if (failed > 0) {
    setStatus(`${failed} repo${failed > 1 ? "s" : ""} failed to load.`, "err");
  } else {
    setStatus("");
  }
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
  loadAndRender().catch((e) => {
    setStatus(`Failed: ${e.message || e}`, "err");
  });
});
