/* GitHub PR Quick Merge — content script
 * Injects merge buttons into rows on the Pull Requests list page.
 */

const API = "https://api.github.com";
const ROW_SELECTOR = ".js-issue-row, [data-testid='issue-pr-title-link']";
const INJECTED_ATTR = "data-qm-injected";
const SPONSORS_URL = "https://github.com/sponsors/bradygrapentine";
const { parsePrLink: parsePrHref, classifyMergeState, mergeMethodFromKind } = window.QM_HELPERS;
const TEMPLATES = window.QM_TEMPLATES || {};
const SHORTCUTS = window.QM_SHORTCUTS || {};
const STALE = window.QM_STALE_PR || {};
const API_HELPERS = window.QM_API || {};

const state = {
  token: "",
  pro: false,
  cache: new Map(),
  selected: new Map(),
  repoDefaults: {},
  // owner/repo -> template body string; "*" = global default
  templates: {},
  // array of { id, shortcut, description } overrides
  shortcuts: [],
  staleDays: 14,
};

const prKey = (pr) => `${pr.owner}/${pr.repo}#${pr.num}`;

function setButtonsDisabled(container, disabled, title) {
  container.querySelectorAll(".qm-btn").forEach((b) => {
    b.disabled = disabled;
    if (title !== undefined) b.title = title;
  });
}

async function loadInitialState() {
  const [localStore, syncStore] = await Promise.all([
    chrome.storage.local.get(["token", "pro"]).catch(() => ({})),
    chrome.storage.sync
      .get(["repoDefaults", "qm_templates", "qm_shortcuts", "qm_stale_days"])
      .catch(() => ({})),
  ]);
  state.token = localStore.token || "";
  state.pro = !!localStore.pro;
  const map = syncStore.repoDefaults;
  state.repoDefaults = map && typeof map === "object" ? map : {};
  const tpl = syncStore.qm_templates;
  state.templates = tpl && typeof tpl === "object" ? tpl : {};
  const cs = syncStore.qm_shortcuts;
  state.shortcuts = Array.isArray(cs) ? cs : (SHORTCUTS.DEFAULT_BINDINGS || []);
  const sd = Number(syncStore.qm_stale_days);
  state.staleDays = Number.isFinite(sd) && sd > 0 ? sd : 14;
}

function pickDefaultForBulkLocal(prs, map) {
  if (!Array.isArray(prs) || prs.length === 0) return null;
  if (!map || typeof map !== "object") return null;
  let chosen = null;
  for (const pr of prs) {
    if (!pr || !pr.owner || !pr.repo) return null;
    const v = map[`${pr.owner}/${pr.repo}`];
    if (v == null) return null;
    if (chosen === null) chosen = v;
    else if (chosen !== v) return null;
  }
  return chosen;
}

function applyStaleBadge(container, prState) {
  if (!container) return;
  // Remove any prior badge so re-renders stay accurate.
  const existing = container.querySelector(".qm-stale-badge");
  if (existing) existing.remove();
  if (!prState || !prState.updated_at || !STALE.classifyStaleness) return;
  const updatedAt = new Date(prState.updated_at);
  if (Number.isNaN(updatedAt.getTime())) return;
  const klass = STALE.classifyStaleness(
    {
      updatedAt,
      draft: prState.draft,
      hasReviewerRequested: prState.has_reviewer_requested,
    },
    { warmingDays: 7, staleDays: state.staleDays, abandonedDays: state.staleDays * 2 },
    new Date(),
  );
  if (klass !== "stale" && klass !== "abandoned") return;
  const label = STALE.formatStaleLabel ? STALE.formatStaleLabel(klass) : { label: klass };
  const badge = document.createElement("span");
  badge.className = `qm-stale-badge qm-stale-${klass}`;
  badge.textContent = (label && label.label) || klass;
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-label", `Pull request is ${klass}`);
  // Place badge after the merge buttons.
  container.appendChild(badge);
}

function applyRepoDefaultClass(container, pr) {
  if (!container || !pr) return;
  const method = state.repoDefaults[`${pr.owner}/${pr.repo}`];
  container.querySelectorAll(".qm-btn").forEach((b) => {
    b.classList.remove("qm-btn-default");
  });
  if (!method) return;
  const target = container.querySelector(`.qm-btn[data-qm-kind="${method}"]`);
  if (target) target.classList.add("qm-btn-default");
}

function restyleAllRows() {
  document.querySelectorAll(".qm-container").forEach((container) => {
    const key = container.dataset.qmKey;
    if (!key) return;
    const m = key.match(/^([^/]+)\/([^#]+)#/);
    if (!m) return;
    applyRepoDefaultClass(container, { owner: m[1], repo: m[2] });
  });
  syncBulkBarFromDefaults();
}

async function isDevInstall() {
  try {
    const reply = await chrome.runtime.sendMessage({ type: "qm:get-install-type" });
    return reply && reply.installType === "development";
  } catch {
    return false;
  }
}

const getToken = () => state.token;

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

async function fetchPrState(pr, token) {
  const { owner, repo, num } = pr;
  const key = prKey(pr);
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
      title: data.title || "",
      body: data.body || "",
      author: data.user?.login || "",
      branch: data.head?.ref || "",
      base: data.base?.ref || "",
      updated_at: data.updated_at || null,
      draft: !!data.draft,
      has_reviewer_requested: Array.isArray(data.requested_reviewers)
        ? data.requested_reviewers.length > 0
        : false,
      behind_by: typeof data.behind_by === "number" ? data.behind_by : 0,
    };
    // mergeable can be null while GitHub computes it — don't cache nulls long
    if (data.mergeable === null) {
      setTimeout(() => state.cache.delete(key), 4000);
    }
    state.cache.set(key, out);
    return out;
  } catch (e) {
    return { error: `${e.name || "Error"}: ${(e.message || "").slice(0, 200)}` };
  }
}

function buildMergeBody(method, pr, prData) {
  const body = { merge_method: method, sha: prData.head_sha };
  // Templates only meaningful for squash + merge; rebase ignores them.
  if (method === "rebase") return body;
  const repoKey = `${pr.owner}/${pr.repo}`;
  const tpl =
    state.templates[repoKey] ||
    state.templates["*"] ||
    (method === "squash" ? TEMPLATES.DEFAULT_SQUASH_TEMPLATE : TEMPLATES.DEFAULT_MERGE_TEMPLATE);
  if (!tpl || !TEMPLATES.applyTemplate) return body;
  try {
    const result = TEMPLATES.applyTemplate(tpl, {
      title: prData.title,
      number: pr.num,
      author: prData.author,
      body: prData.body,
      branch: prData.branch,
      base: prData.base,
      repo: repoKey,
    });
    const text = (result && result.text) || "";
    if (text) {
      const newlineIdx = text.indexOf("\n");
      body.commit_title = newlineIdx >= 0 ? text.slice(0, newlineIdx) : text;
      body.commit_message = newlineIdx >= 0 ? text.slice(newlineIdx + 1) : "";
    }
  } catch {
    // Fall back to GitHub's default commit message on template failure.
  }
  return body;
}

async function doMerge({ pr, kind, token, headSha }) {
  const method = mergeMethodFromKind(kind);
  const cached = state.cache.get(prKey(pr)) || { head_sha: headSha };
  const res = await fetch(`${API}/repos/${pr.owner}/${pr.repo}/pulls/${pr.num}/merge`, {
    method: "PUT",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(buildMergeBody(method, pr, { ...cached, head_sha: headSha })),
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
  container.dataset.qmKey = prKey(pr);

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

  applyRepoDefaultClass(container, pr);

  // Place container in a sensible spot inside the row
  const target =
    row.querySelector(".opened-by") ||
    row.querySelector(".col-9") ||
    row;
  target.appendChild(container);

  const token = getToken();
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
  applyStaleBadge(container, prState);

  // If null/pending, retry once after a short delay
  if (prState && prState.mergeable === null) {
    setTimeout(async () => {
      state.cache.delete(prKey(pr));
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
    const current = state.cache.get(prKey(pr));
    if (!current?.head_sha) {
      toast("PR state not ready, try again", "warn");
      return;
    }

    const ok = confirm(`${kind.toUpperCase()} ${pr.owner}/${pr.repo} #${pr.num}?`);
    if (!ok) return;

    setButtonsDisabled(container, true);
    status.textContent = "⏳";
    try {
      await doMerge({ pr, kind, token, headSha: current.head_sha });
      status.textContent = "✓";
      status.dataset.kind = "merged";
      toast(`Merged ${prKey(pr)}`, "ok");
      row.style.opacity = "0.5";
    } catch (err) {
      status.textContent = "✕";
      status.dataset.kind = "error";
      toast(`Failed: ${err.message}`, "error");
      setButtonsDisabled(container, false);
    }
  });

  injectRowActions({ row, container, pr, prData: prState, token, status });
}

/* QM-045 / v0.4 extension point. Called once per row after the standard merge
 * buttons + click handler are wired. Subsequent waves (v0.4 row-actions) add
 * Update / Cancel-watch / queue-status / rebasing-spinner UI here.
 *
 * Contract: container is mounted in the row, prData reflects the just-fetched
 * PR state (may be null on auth-less or errored rows — guard accordingly).
 * The function MUST be idempotent at the row level (re-entry is unlikely
 * because `INJECTED_ATTR` already gates injectRow, but the implementation
 * should not assume single-call exclusivity).
 */
function injectRowActions(ctx) {
  // Intentional no-op. v0.4 row-action stories (QM-052/056/057/070) populate
  // this body. Keep this function present on main even when empty so those
  // stories don't have to introduce the extension point alongside their work.
  void ctx;
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
  syncBulkBarFromDefaults();
}

function syncBulkBarFromDefaults() {
  const select = document.querySelector(".qm-bulk-method");
  if (!select) return;
  const prs = Array.from(state.selected.values()).map((s) => s.pr);
  const shared = pickDefaultForBulkLocal(prs, state.repoDefaults);
  if (shared && select.value !== shared) {
    select.value = shared;
  }
}

function confirmBulkMergeTyped(items, method) {
  return new Promise((resolve) => {
    const expected = `MERGE ${items.length}`;
    const modal = document.createElement("div");
    modal.className = "qm-typed-modal";

    const card = document.createElement("div");
    card.className = "qm-typed-card";

    const heading = document.createElement("h2");
    heading.textContent = `Confirm bulk ${method}`;

    const lede = document.createElement("p");
    lede.textContent = `You are about to ${method} ${items.length} pull requests:`;

    const list = document.createElement("ul");
    list.className = "qm-typed-list";
    for (const { pr } of items) {
      const li = document.createElement("li");
      li.textContent = prKey(pr);
      list.appendChild(li);
    }

    const prompt = document.createElement("p");
    prompt.innerHTML = `Type <code>${expected}</code> to confirm:`;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "qm-typed-input";
    input.autocomplete = "off";
    input.spellcheck = false;

    const actions = document.createElement("div");
    actions.className = "qm-typed-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "qm-btn";
    cancelBtn.textContent = "Cancel";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "qm-btn qm-typed-go";
    confirmBtn.textContent = `${method.toUpperCase()} ${items.length}`;
    confirmBtn.disabled = true;

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    card.appendChild(heading);
    card.appendChild(lede);
    card.appendChild(list);
    card.appendChild(prompt);
    card.appendChild(input);
    card.appendChild(actions);
    modal.appendChild(card);
    document.body.appendChild(modal);

    const close = (result) => {
      modal.remove();
      resolve(result);
    };

    input.addEventListener("input", () => {
      confirmBtn.disabled = input.value !== expected;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !confirmBtn.disabled) close(true);
      if (e.key === "Escape") close(false);
    });
    cancelBtn.addEventListener("click", () => close(false));
    confirmBtn.addEventListener("click", () => close(true));
    modal.addEventListener("click", (e) => { if (e.target === modal) close(false); });

    setTimeout(() => input.focus(), 0);
  });
}

async function onBulkMerge() {
  if (!state.pro) {
    showProGate();
    return;
  }
  const items = Array.from(state.selected.values());
  if (!items.length) return;
  const method = document.querySelector(".qm-bulk-method").value;
  const ok = items.length >= 3
    ? await confirmBulkMergeTyped(items, method)
    : confirm(`${method.toUpperCase()} ${items.length} PR${items.length > 1 ? "s" : ""}?`);
  if (!ok) return;
  const token = getToken();
  if (!token) {
    toast("Set a GitHub token first", "warn");
    return;
  }
  const goBtn = document.querySelector(".qm-bulk-go");
  goBtn.disabled = true;
  let success = 0;
  let failed = 0;
  for (const { pr, row, container } of items) {
    const cached = state.cache.get(prKey(pr));
    if (!cached?.head_sha) {
      failed++;
      continue;
    }
    try {
      await doMerge({ pr, kind: method, token, headSha: cached.head_sha });
      success++;
      row.style.opacity = "0.5";
      const status = container.querySelector(".qm-status");
      if (status) {
        status.textContent = "✓";
        status.dataset.kind = "merged";
      }
    } catch (e) {
      failed++;
      toast(`Failed ${prKey(pr)}: ${e.message}`, "error");
    }
  }
  state.selected.clear();
  document.querySelectorAll(".qm-select:checked").forEach((cb) => (cb.checked = false));
  renderBulkBar();
  goBtn.disabled = false;
  toast(`Bulk merge: ${success} ok, ${failed} failed`, failed ? "warn" : "ok");
}

async function showProGate() {
  const existing = document.getElementById("qm-pro-modal");
  if (existing) existing.remove();
  const isDev = await isDevInstall();
  const modal = document.createElement("div");
  modal.id = "qm-pro-modal";
  modal.className = "qm-pro-modal";
  const devButtonHtml = isDev
    ? '<button class="qm-btn qm-pro-dev">Enable Pro (dev)</button>'
    : "";
  modal.innerHTML = `
    <div class="qm-pro-card">
      <h2>Like this? Support development.</h2>
      <p>PR Quick Merge is free and open source. If it saves you time, a small monthly sponsorship keeps it maintained.</p>
      <ul>
        <li>☕ $5/mo — keeps the lights on</li>
        <li>🛠 $25/mo — for daily users</li>
        <li>🏢 $99/mo — small teams</li>
        <li>🚀 $499/mo — logo on the repo + roadmap input</li>
      </ul>
      <div class="qm-pro-actions">
        <button class="qm-btn qm-pro-close">Maybe later</button>
        <a class="qm-btn qm-pro-sponsor" href="${SPONSORS_URL}" target="_blank" rel="noopener noreferrer">Sponsor on GitHub</a>
        ${devButtonHtml}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("qm-pro-close")) modal.remove();
    if (e.target.classList && e.target.classList.contains("qm-pro-sponsor")) modal.remove();
  });
  const devBtn = modal.querySelector(".qm-pro-dev");
  if (devBtn) {
    devBtn.addEventListener("click", async () => {
      await chrome.storage.local.set({ pro: true });
      state.pro = true;
      modal.remove();
      toast("Pro mode enabled (dev). Re-click Merge selected.", "ok");
    });
  }
}

function ensureLiveRegion() {
  let live = document.getElementById("qm-live-region");
  if (live) return live;
  live = document.createElement("div");
  live.id = "qm-live-region";
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");
  live.style.cssText =
    "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;";
  document.body.appendChild(live);
  return live;
}

function announce(msg) {
  const live = ensureLiveRegion();
  live.textContent = "";
  // Force reflow so screen readers re-read the same message.
  void live.offsetHeight;
  live.textContent = msg;
}

function flashShortcutActive(buttons) {
  if (!buttons || buttons.length === 0) return;
  buttons.forEach((b) => {
    b.classList.add("qm-shortcut-active");
    b.setAttribute("aria-pressed", "true");
  });
  setTimeout(() => {
    buttons.forEach((b) => {
      b.classList.remove("qm-shortcut-active");
      b.removeAttribute("aria-pressed");
    });
  }, 200);
}

function shortcutHandlers() {
  return {
    selectAll: () => {
      const cbs = document.querySelectorAll(".qm-select:not(:disabled)");
      cbs.forEach((cb) => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      announce(`Selected ${cbs.length} pull requests.`);
    },
    clearSelection: () => {
      document.querySelectorAll(".qm-select:checked").forEach((cb) => {
        cb.checked = false;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      });
      announce("Selection cleared.");
    },
    mergeSelected: () => {
      const goBtn = document.querySelector(".qm-bulk-go");
      if (goBtn && !goBtn.disabled) {
        const select = document.querySelector(".qm-bulk-method");
        if (select) select.value = "merge";
        flashShortcutActive([goBtn]);
        goBtn.click();
        announce("Bulk merge triggered.");
      }
    },
    squashSelected: () => {
      const goBtn = document.querySelector(".qm-bulk-go");
      if (goBtn && !goBtn.disabled) {
        const select = document.querySelector(".qm-bulk-method");
        if (select) select.value = "squash";
        flashShortcutActive([goBtn]);
        goBtn.click();
        announce("Bulk squash triggered.");
      }
    },
    rebaseSelected: () => {
      const goBtn = document.querySelector(".qm-bulk-go");
      if (goBtn && !goBtn.disabled) {
        const select = document.querySelector(".qm-bulk-method");
        if (select) select.value = "rebase";
        flashShortcutActive([goBtn]);
        goBtn.click();
        announce("Bulk rebase triggered.");
      }
    },
  };
}

function isTextInputFocused(event) {
  const t = event.target;
  if (!t) return false;
  const tag = (t.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

function onShortcutKeydown(event) {
  if (isTextInputFocused(event)) return;
  if (!SHORTCUTS.findBinding) return;
  const binding = SHORTCUTS.findBinding(event, state.shortcuts);
  if (!binding) return;
  const handlers = shortcutHandlers();
  const handler = handlers[binding];
  if (!handler) return;
  event.preventDefault();
  handler();
}

async function start() {
  await loadInitialState();
  ensureLiveRegion();
  document.addEventListener("keydown", onShortcutKeydown);
  scan();
  observer.observe(document.body, { childList: true, subtree: true });
  renderBulkBar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

document.addEventListener("turbo:render", () => scan());
document.addEventListener("pjax:end", () => scan());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync") {
    if (changes.repoDefaults) {
      const next = changes.repoDefaults.newValue;
      state.repoDefaults = next && typeof next === "object" ? next : {};
      restyleAllRows();
    }
    if (changes.qm_templates) {
      const next = changes.qm_templates.newValue;
      state.templates = next && typeof next === "object" ? next : {};
    }
    if (changes.qm_shortcuts) {
      const next = changes.qm_shortcuts.newValue;
      state.shortcuts = Array.isArray(next) ? next : (SHORTCUTS.DEFAULT_BINDINGS || []);
    }
    if (changes.qm_stale_days) {
      const next = Number(changes.qm_stale_days.newValue);
      state.staleDays = Number.isFinite(next) && next > 0 ? next : 14;
    }
    return;
  }
  // token + pro live in chrome.storage.local; ignore other sync-area noise.
  if (areaName !== "local") return;
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
