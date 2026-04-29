/* GitHub PR Quick Merge — content script
 * Injects merge buttons into rows on the Pull Requests list page.
 */

const API = "https://api.github.com";
const ROW_SELECTOR = ".js-issue-row, [data-testid='issue-pr-title-link']";
const INJECTED_ATTR = "data-qm-injected";
const { parsePrLink: parsePrHref, classifyMergeState, mergeMethodFromKind } = window.QM_HELPERS;

const state = {
  token: null,
  pro: false,
  // pr key "owner/repo#num" -> { mergeable, mergeable_state, head_sha }
  cache: new Map(),
  // pr key -> { pr, row, container }
  selected: new Map(),
};

async function loadProFlag() {
  const { pro } = await chrome.storage.sync.get("pro");
  state.pro = !!pro;
}

async function getToken() {
  if (state.token !== null) return state.token;
  const { token } = await chrome.storage.sync.get("token");
  state.token = token || "";
  return state.token;
}

function ghHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  };
}

function parsePrLink(anchor) {
  if (!anchor) return null;
  return parsePrHref(anchor.getAttribute("href") || anchor.href);
}

function findPrAnchor(row) {
  return (
    row.querySelector("a[data-hovercard-type='pull_request']") ||
    row.querySelector("a[id^='issue_'][href*='/pull/']") ||
    row.querySelector("a[href*='/pull/']")
  );
}

function makeButton(label, kind) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `qm-btn qm-btn-${kind}`;
  btn.textContent = label;
  btn.disabled = true;
  btn.dataset.qmKind = kind;
  btn.title = "Checking mergeability…";
  return btn;
}

function makeStatus() {
  const el = document.createElement("span");
  el.className = "qm-status";
  return el;
}

function setRowState(container, prState) {
  const buttons = container.querySelectorAll(".qm-btn");
  const status = container.querySelector(".qm-status");
  if (!prState) {
    buttons.forEach((b) => {
      b.disabled = true;
      b.title = "Checking…";
    });
    if (status) status.textContent = "…";
    return;
  }
  const { mergeable_state } = prState;
  const klass = classifyMergeState(prState);
  const ready = klass === "ready";
  const blocked = klass === "blocked";
  buttons.forEach((b) => {
    b.disabled = !ready;
    b.title = ready
      ? `Ready: ${mergeable_state}`
      : blocked
      ? `Blocked: ${mergeable_state}`
      : `State: ${mergeable_state ?? "unknown"}`;
  });
  const checkbox = container.querySelector(".qm-select");
  if (checkbox) {
    checkbox.disabled = !ready;
    checkbox.title = ready
      ? "Select for bulk merge (Pro)"
      : `Not selectable: ${mergeable_state ?? "unknown"}`;
    if (!ready && checkbox.checked) {
      checkbox.checked = false;
      state.selected.delete(container.dataset.qmKey);
      renderBulkBar();
    }
  }
  if (status) {
    status.textContent = ready ? "✓" : blocked ? "✕" : "…";
    status.dataset.kind = ready ? "ok" : blocked ? "blocked" : "pending";
  }
}

async function fetchPrState({ owner, repo, num }, token) {
  const key = `${owner}/${repo}#${num}`;
  if (state.cache.has(key)) return state.cache.get(key);
  try {
    const res = await fetch(`${API}/repos/${owner}/${repo}/pulls/${num}`, {
      headers: ghHeaders(token),
    });
    if (!res.ok) {
      const err = { error: `HTTP ${res.status}` };
      state.cache.set(key, err);
      return err;
    }
    const data = await res.json();
    const out = {
      mergeable: data.mergeable,
      mergeable_state: data.mergeable_state,
      head_sha: data.head?.sha,
    };
    // mergeable can be null while GitHub computes it — don't cache nulls long
    if (data.mergeable === null) {
      setTimeout(() => state.cache.delete(key), 4000);
    }
    state.cache.set(key, out);
    return out;
  } catch (e) {
    return { error: String(e) };
  }
}

async function doMerge({ owner, repo, num }, kind, token, headSha) {
  const method = mergeMethodFromKind(kind);
  const res = await fetch(`${API}/repos/${owner}/${repo}/pulls/${num}/merge`, {
    method: "PUT",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      merge_method: method,
      sha: headSha,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

function toast(message, kind = "info") {
  const el = document.createElement("div");
  el.className = `qm-toast qm-toast-${kind}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("qm-toast-show"), 10);
  setTimeout(() => {
    el.classList.remove("qm-toast-show");
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

async function injectRow(row) {
  if (row.hasAttribute(INJECTED_ATTR)) return;
  const anchor = findPrAnchor(row);
  const pr = parsePrLink(anchor);
  if (!pr) return;
  row.setAttribute(INJECTED_ATTR, "1");

  const container = document.createElement("span");
  container.className = "qm-container";
  container.dataset.qmKey = `${pr.owner}/${pr.repo}#${pr.num}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "qm-select";
  checkbox.title = "Select for bulk merge (Pro)";
  checkbox.disabled = true;
  checkbox.addEventListener("click", (e) => e.stopPropagation());
  checkbox.addEventListener("change", () => {
    const key = container.dataset.qmKey;
    if (checkbox.checked) {
      state.selected.set(key, { pr, row, container });
    } else {
      state.selected.delete(key);
    }
    renderBulkBar();
  });

  const status = makeStatus();
  const squash = makeButton("Squash", "squash");
  const merge = makeButton("Merge", "merge");
  const rebase = makeButton("Rebase", "rebase");

  container.appendChild(checkbox);
  container.appendChild(status);
  container.appendChild(squash);
  container.appendChild(merge);
  container.appendChild(rebase);

  // Place container in a sensible spot inside the row
  const target =
    row.querySelector(".opened-by") ||
    row.querySelector(".col-9") ||
    row;
  target.appendChild(container);

  const token = await getToken();
  if (!token) {
    container.querySelectorAll(".qm-btn").forEach((b) => {
      b.title = "Set a GitHub token in the extension options";
    });
    status.textContent = "🔑";
    status.dataset.kind = "noauth";
    container.addEventListener("click", (e) => {
      if (e.target.classList.contains("qm-btn")) {
        e.preventDefault();
        e.stopPropagation();
        toast("Set a GitHub PAT in the extension options first", "warn");
      }
    });
    return;
  }

  const prState = await fetchPrState(pr, token);
  setRowState(container, prState);

  // If null/pending, retry once after a short delay
  if (prState && prState.mergeable === null) {
    setTimeout(async () => {
      state.cache.delete(`${pr.owner}/${pr.repo}#${pr.num}`);
      const refreshed = await fetchPrState(pr, token);
      setRowState(container, refreshed);
    }, 3000);
  }

  container.addEventListener("click", async (e) => {
    const btn = e.target.closest(".qm-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.disabled) return;

    const kind = btn.dataset.qmKind;
    const current = state.cache.get(`${pr.owner}/${pr.repo}#${pr.num}`);
    if (!current?.head_sha) {
      toast("PR state not ready, try again", "warn");
      return;
    }

    const ok = confirm(`${kind.toUpperCase()} ${pr.owner}/${pr.repo} #${pr.num}?`);
    if (!ok) return;

    container.querySelectorAll(".qm-btn").forEach((b) => (b.disabled = true));
    status.textContent = "⏳";
    try {
      await doMerge(pr, kind, token, current.head_sha);
      status.textContent = "✓";
      status.dataset.kind = "merged";
      toast(`Merged ${pr.owner}/${pr.repo}#${pr.num}`, "ok");
      // Strike row visually
      row.style.opacity = "0.5";
    } catch (err) {
      status.textContent = "✕";
      status.dataset.kind = "error";
      toast(`Failed: ${err.message}`, "error");
      container.querySelectorAll(".qm-btn").forEach((b) => (b.disabled = false));
    }
  });
}

function scan(root = document) {
  const rows = root.querySelectorAll(ROW_SELECTOR);
  rows.forEach((r) => {
    // ROW_SELECTOR may match a link; walk up to its row container
    const row = r.matches(".js-issue-row") ? r : r.closest(".js-issue-row");
    if (row) injectRow(row);
  });
}

const observer = new MutationObserver((muts) => {
  for (const m of muts) {
    m.addedNodes.forEach((n) => {
      if (!(n instanceof Element)) return;
      if (n.matches?.(ROW_SELECTOR) || n.querySelector?.(ROW_SELECTOR)) {
        scan(n);
      }
    });
  }
});

function ensureBulkBar() {
  let bar = document.getElementById("qm-bulk-bar");
  if (bar) return bar;
  bar = document.createElement("div");
  bar.id = "qm-bulk-bar";
  bar.className = "qm-bulk-bar";
  bar.innerHTML = `
    <span class="qm-bulk-count">0 selected</span>
    <span class="qm-bulk-pro" title="Pro feature">PRO</span>
    <select class="qm-bulk-method" aria-label="Merge method">
      <option value="squash">Squash &amp; merge</option>
      <option value="merge">Merge commit</option>
      <option value="rebase">Rebase &amp; merge</option>
    </select>
    <button class="qm-btn qm-bulk-go">Merge selected</button>
    <button class="qm-btn qm-bulk-clear">Clear</button>
  `;
  document.body.appendChild(bar);
  bar.querySelector(".qm-bulk-clear").addEventListener("click", () => {
    state.selected.forEach(({ container }) => {
      const cb = container.querySelector(".qm-select");
      if (cb) cb.checked = false;
    });
    state.selected.clear();
    renderBulkBar();
  });
  bar.querySelector(".qm-bulk-go").addEventListener("click", onBulkMerge);
  return bar;
}

function renderBulkBar() {
  const bar = ensureBulkBar();
  const n = state.selected.size;
  bar.querySelector(".qm-bulk-count").textContent = `${n} selected`;
  bar.classList.toggle("qm-bulk-bar-shown", n > 0);
}

async function onBulkMerge() {
  if (!state.pro) {
    showProGate();
    return;
  }
  const items = Array.from(state.selected.values());
  if (!items.length) return;
  const method = document.querySelector(".qm-bulk-method").value;
  const ok = confirm(`${method.toUpperCase()} ${items.length} PR${items.length > 1 ? "s" : ""}?`);
  if (!ok) return;
  const token = await getToken();
  if (!token) {
    toast("Set a GitHub token first", "warn");
    return;
  }
  const goBtn = document.querySelector(".qm-bulk-go");
  goBtn.disabled = true;
  let success = 0;
  let failed = 0;
  for (const { pr, row, container } of items) {
    const cached = state.cache.get(`${pr.owner}/${pr.repo}#${pr.num}`);
    if (!cached?.head_sha) {
      failed++;
      continue;
    }
    try {
      await doMerge(pr, method, token, cached.head_sha);
      success++;
      row.style.opacity = "0.5";
      const status = container.querySelector(".qm-status");
      if (status) {
        status.textContent = "✓";
        status.dataset.kind = "merged";
      }
    } catch (e) {
      failed++;
      toast(`Failed ${pr.owner}/${pr.repo}#${pr.num}: ${e.message}`, "error");
    }
  }
  state.selected.clear();
  document.querySelectorAll(".qm-select:checked").forEach((cb) => (cb.checked = false));
  renderBulkBar();
  goBtn.disabled = false;
  toast(`Bulk merge: ${success} ok, ${failed} failed`, failed ? "warn" : "ok");
}

function showProGate() {
  const existing = document.getElementById("qm-pro-modal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "qm-pro-modal";
  modal.className = "qm-pro-modal";
  modal.innerHTML = `
    <div class="qm-pro-card">
      <h2>Bulk merge is a Pro feature</h2>
      <p>Merge multiple PRs in one click — plus per-repo defaults, custom commit templates, and keyboard shortcuts.</p>
      <ul>
        <li>Bulk-merge multiple PRs at once</li>
        <li>Custom merge-commit templates</li>
        <li>Per-repo default merge method</li>
        <li>Keyboard shortcuts</li>
      </ul>
      <p class="qm-pro-price"><strong>$4/mo</strong> — coming soon.</p>
      <div class="qm-pro-actions">
        <button class="qm-btn qm-pro-close">Maybe later</button>
        <button class="qm-btn qm-pro-dev">Enable Pro (dev)</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("qm-pro-close")) modal.remove();
  });
  modal.querySelector(".qm-pro-dev").addEventListener("click", async () => {
    await chrome.storage.sync.set({ pro: true });
    state.pro = true;
    modal.remove();
    toast("Pro mode enabled (dev). Re-click Merge selected.", "ok");
  });
}

function start() {
  loadProFlag();
  scan();
  observer.observe(document.body, { childList: true, subtree: true });
  renderBulkBar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

// Re-scan on GitHub's pjax-style navigation
document.addEventListener("turbo:render", () => scan());
document.addEventListener("pjax:end", () => scan());

chrome.storage.onChanged.addListener((changes) => {
  if (changes.token) {
    state.token = changes.token.newValue || "";
    state.cache.clear();
    state.selected.clear();
    renderBulkBar();
    document.querySelectorAll(`[${INJECTED_ATTR}]`).forEach((r) => {
      r.removeAttribute(INJECTED_ATTR);
      r.querySelectorAll(".qm-container").forEach((c) => c.remove());
    });
    scan();
  }
  if (changes.pro) {
    state.pro = !!changes.pro.newValue;
  }
});
