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
const BULK_OPS = window.QM_BULK_OPS || {};
const LIST_MODE = window.QM_LIST_MODE || {};

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
  // owner/repo -> override stale-day threshold (QM-063)
  repoStaleThresholds: {},
  // QM-067 — when true, skip per-PR detail fetch; use list endpoint data only
  listMode: false,
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
      .get([
        "repoDefaults",
        "qm_templates",
        "qm_shortcuts",
        "qm_stale_days",
        "qm_repo_stale_thresholds",
        "listModeEnabled",
      ])
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
  const rst = syncStore.qm_repo_stale_thresholds;
  state.repoStaleThresholds = rst && typeof rst === "object" ? rst : {};
  state.listMode = !!syncStore.listModeEnabled;
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

function _staleThresholdFor(pr) {
  if (pr && pr.owner && pr.repo) {
    const override = state.repoStaleThresholds[`${pr.owner}/${pr.repo}`];
    const n = Number(override);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return state.staleDays;
}

function applyStaleBadge(container, prState, pr) {
  if (!container) return;
  // Remove any prior badge so re-renders stay accurate.
  const existing = container.querySelector(".qm-stale-badge");
  if (existing) existing.remove();
  if (!prState || !prState.updated_at || !STALE.classifyStaleness) return;
  const updatedAt = new Date(prState.updated_at);
  if (Number.isNaN(updatedAt.getTime())) return;
  const threshold = _staleThresholdFor(pr);
  const klass = STALE.classifyStaleness(
    {
      updatedAt,
      draft: prState.draft,
      hasReviewerRequested: prState.has_reviewer_requested,
    },
    { warmingDays: 7, staleDays: threshold, abandonedDays: threshold * 2 },
    new Date(),
  );
  if (klass !== "stale" && klass !== "abandoned") return;
  const label = STALE.formatStaleLabel ? STALE.formatStaleLabel(klass) : { label: klass };
  const badge = document.createElement("span");
  badge.className = `qm-stale-badge qm-stale-${klass}`;
  badge.textContent = (label && label.label) || klass;
  badge.setAttribute("role", "status");
  const days = Math.max(0, Math.round((Date.now() - updatedAt.getTime()) / 86400000));
  const sourceTag = (pr && state.repoStaleThresholds[`${pr.owner}/${pr.repo}`]) ? "per-repo" : "global";
  const tip = `Last update ${days} day${days === 1 ? "" : "s"} ago — ${klass} threshold ${threshold}d (${sourceTag}).`;
  badge.title = tip;
  badge.setAttribute("aria-label", tip);
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
  // In list mode the GitHub list endpoint doesn't return mergeable_state,
  // so merge buttons stay disabled but selection should still work for
  // close / label bulk ops.
  const allowSelect = ready || prState.listMode;
  buttons.forEach((b) => {
    b.disabled = !ready;
    b.title = ready
      ? `Ready: ${mergeable_state}`
      : blocked
      ? `Blocked: ${mergeable_state}`
      : prState.listMode
      ? "Fast mode: merge readiness not fetched. Disable fast mode in options to enable merging."
      : `State: ${mergeable_state ?? "unknown"}`;
  });
  const checkbox = container.querySelector(".qm-select");
  if (checkbox) {
    checkbox.disabled = !allowSelect;
    checkbox.title = ready
      ? "Select for bulk merge (Pro)"
      : prState.listMode
      ? "Select for bulk close / label"
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

// Compat shim — legacy toast(message, kind) delegates to the new
// QM_TOAST stack manager (lib/qm-toast.js). Kind remap: "error" → "err".
const _TOAST_KIND_MAP = { info: "info", ok: "ok", warn: "warn", error: "err", err: "err" };
function toast(message, kind = "info") {
  const t = window.QM_TOAST;
  if (t && t.show) {
    try {
      t.show({ kind: _TOAST_KIND_MAP[kind] || "info", title: String(message) });
      return;
    } catch (_) { /* fall through to legacy fallback below */ }
  }
  // Fallback for environments where qm-toast isn't loaded — preserves the
  // pre-v1.1 behaviour so a misconfigured build doesn't lose feedback.
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
  container.appendChild(checkbox);
  container.appendChild(status);

  // QM-206..210 — single compact pill widget replaces the 3-button stack.
  // The widget owns its own status pill + button enabling + optimistic
  // spinner; the legacy `status` span still exists for paths that pre-date
  // the widget (auth toast, stale badge etc.) — `setRowState` becomes a
  // no-op on the widget's `.qm-button` elements.
  const widgetApi = window.QM_ROW_WIDGET;
  let rowWidget = null;
  if (widgetApi && widgetApi.makeRowWidget) {
    rowWidget = widgetApi.makeRowWidget({
      pr,
      prState: null,
      getDefaultMethod: () => state.repoDefaults[`${pr.owner}/${pr.repo}`] || "squash",
      getShortcutHint: () => null, // QM-209 toggled in a follow-up; read state.shortcutMode
      onMethodChange: () => { /* no-op; cached for the next click */ },
      onMerge: async (method) => {
        const current = state.cache.get(prKey(pr));
        if (!current?.head_sha) {
          toast("PR state not ready, try again", "warn");
          throw new Error("not ready");
        }
        const ok = confirm(`${method.toUpperCase()} ${pr.owner}/${pr.repo} #${pr.num}?`);
        if (!ok) throw new Error("cancelled");

        let rebaseSpinner = null;
        const onRebaseStart = () => {
          rebaseSpinner = document.createElement("span");
          rebaseSpinner.className = "qm-rebasing";
          rebaseSpinner.textContent = "Rebasing…";
          container.insertBefore(rebaseSpinner, status.nextSibling);
        };
        const onRebaseEnd = () => {
          if (rebaseSpinner && rebaseSpinner.parentNode) rebaseSpinner.parentNode.removeChild(rebaseSpinner);
          rebaseSpinner = null;
        };

        try {
          const sync = await chrome.storage.sync.get(["autoRebaseThreshold", "updateBranchStrategy"]);
          const threshold = Number(sync && sync.autoRebaseThreshold);
          const strategy = sync && sync.updateBranchStrategy === "rebase" ? "rebase" : "merge";
          const behindBy = Number(current.behind_by) || 0;

          if (window.QM_AUTO_REBASE && Number.isFinite(threshold) && threshold > 0) {
            await window.QM_AUTO_REBASE.rebaseThenMerge({
              owner: pr.owner,
              repo: pr.repo,
              pullNumber: pr.num,
              expectedHeadSha: current.head_sha,
              behindBy,
              autoRebaseThreshold: threshold,
              mergeStrategy: strategy,
              token,
              api: API_HELPERS,
              mergeFn: () => doMerge({ pr, kind: method, token, headSha: current.head_sha }),
              onRebaseStart,
              onRebaseEnd,
            });
          } else {
            await doMerge({ pr, kind: method, token, headSha: current.head_sha });
          }
          toast(`Merged ${prKey(pr)}`, "ok");
          row.style.opacity = "0.5";
        } catch (err) {
          onRebaseEnd();
          toast(`Failed: ${err.message || err}`, "error");
          throw err;
        }
      },
    });
    container.appendChild(rowWidget.root);
  } else {
    // Fallback for environments where qm-row-widget didn't load — preserves
    // the v1.0 three-button behavior so the extension never goes blank.
    const squash = makeButton("Squash", "squash");
    const merge = makeButton("Merge", "merge");
    const rebase = makeButton("Rebase", "rebase");
    container.appendChild(squash);
    container.appendChild(merge);
    container.appendChild(rebase);
  }

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

  const prState = state.listMode
    ? { mergeable: null, mergeable_state: null, head_sha: null, listMode: true }
    : await fetchPrState(pr, token);
  setRowState(container, prState);
  if (rowWidget) rowWidget.setState(prState);
  applyStaleBadge(container, prState, pr);
  if (state.listMode) {
    const note = document.createElement("span");
    note.className = "qm-list-mode-note";
    note.textContent = "fast";
    note.title = "Fast mode: GitHub list endpoint doesn't return mergeable_state. Toggle off in options for full state.";
    container.appendChild(note);
  }

  // If null/pending (and not list mode), retry once after a short delay.
  if (!state.listMode && prState && prState.mergeable === null) {
    setTimeout(async () => {
      state.cache.delete(prKey(pr));
      const refreshed = await fetchPrState(pr, token);
      setRowState(container, refreshed);
      if (rowWidget) rowWidget.setState(refreshed);
    }, 3000);
  }

  // Fallback click path — only fires when the widget isn't loaded and the
  // legacy 3-button stack is in the DOM. The widget self-handles its own
  // clicks via the onMerge callback constructed above.
  if (!rowWidget) {
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
        toast(`Merged ${prKey(pr)}`, "ok");
        row.style.opacity = "0.5";
      } catch (err) {
        status.textContent = "✕";
        toast(`Failed: ${err.message}`, "error");
        setButtonsDisabled(container, false);
      }
    });
  }

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
  if (!ctx || !ctx.container || !ctx.pr) return;
  const { container, pr, prData, token, row } = ctx;
  const queueLib = window.QM_MERGE_QUEUE;
  const updateLib = window.QM_UPDATE_BRANCH;
  const queueKey = queueLib ? queueLib.makeKey({ owner: pr.owner, repo: pr.repo, pullNumber: pr.num }) : `${pr.owner}/${pr.repo}#${pr.num}`;

  // QM-052 — Update button when the PR is behind base.
  if (token && prData && Number(prData.behind_by) > 0 && updateLib) {
    const updateBtn = document.createElement("button");
    updateBtn.type = "button";
    updateBtn.className = "qm-btn qm-update-btn";
    updateBtn.dataset.qmKind = "update";
    updateBtn.textContent = `Update (${prData.behind_by})`;
    updateBtn.title = `Sync this branch with ${prData.base || "base"}`;
    updateBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (updateBtn.disabled) return;
      updateBtn.disabled = true;
      const orig = updateBtn.textContent;
      updateBtn.textContent = "Updating…";
      try {
        const sync = await chrome.storage.sync.get("updateBranchStrategy");
        const strategy = sync && sync.updateBranchStrategy === "rebase" ? "rebase" : "merge";
        await updateLib.updateBranch({
          owner: pr.owner,
          repo: pr.repo,
          pullNumber: pr.num,
          expectedHeadSha: prData.head_sha,
          strategy,
          token,
          api: API_HELPERS,
        });
        toast(`Update queued for ${queueKey}`, "ok");
        // GitHub processes asynchronously — refresh after ~3s.
        setTimeout(async () => {
          state.cache.delete(prKey(pr));
          const refreshed = await fetchPrState(pr, token);
          setRowState(container, refreshed);
          if (refreshed && Number(refreshed.behind_by) === 0) {
            updateBtn.remove();
          } else {
            updateBtn.disabled = false;
            updateBtn.textContent = `Update (${(refreshed && refreshed.behind_by) || prData.behind_by})`;
          }
        }, 3000);
      } catch (err) {
        updateBtn.disabled = false;
        updateBtn.textContent = orig;
        toast(`Update failed: ${err.message || err}`, "error");
      }
    });
    container.appendChild(updateBtn);
  }

  // QM-056 / QM-057 — merge-queue badge + Watch / Cancel button.
  if (queueLib && token) {
    const badge = document.createElement("span");
    badge.className = "qm-queue-badge";
    badge.dataset.qmKey = queueKey;

    const watchBtn = document.createElement("button");
    watchBtn.type = "button";
    watchBtn.className = "qm-btn qm-watch-btn";
    watchBtn.dataset.qmKey = queueKey;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "qm-btn qm-cancel-watch-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.dataset.qmKey = queueKey;

    function renderQueueState(entry) {
      // entry is the merge-queue record or null.
      if (!entry) {
        badge.textContent = "";
        badge.dataset.kind = "";
        watchBtn.textContent = "Watch";
        watchBtn.title = "Auto-merge once all checks pass";
        watchBtn.style.display = "";
        cancelBtn.style.display = "none";
        return;
      }
      if (entry.status === "watching") {
        badge.textContent = "🟡 watching";
        badge.dataset.kind = "watching";
        watchBtn.style.display = "none";
        cancelBtn.style.display = "";
      } else if (entry.status === "merged") {
        badge.textContent = "✅ merged";
        badge.dataset.kind = "merged";
        watchBtn.style.display = "none";
        cancelBtn.style.display = "none";
      } else {
        badge.textContent = "❌ failed";
        badge.dataset.kind = "failed";
        watchBtn.textContent = "Retry watch";
        watchBtn.style.display = "";
        cancelBtn.style.display = "none";
      }
    }

    watchBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await queueLib.enqueue({ owner: pr.owner, repo: pr.repo, pullNumber: pr.num }, chrome.storage.local);
        toast(`Watching ${queueKey} — will merge when green`, "ok");
      } catch (err) {
        toast(`Watch failed: ${err.message || err}`, "error");
      }
    });

    cancelBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await queueLib.dequeue(queueKey, chrome.storage.local);
      toast(`Stopped watching ${queueKey}`, "ok");
    });

    container.appendChild(badge);
    container.appendChild(watchBtn);
    container.appendChild(cancelBtn);

    // Initial render from current queue state.
    queueLib.list(chrome.storage.local).then((entries) => {
      const found = entries.find((e) => queueLib.makeKey(e) === queueKey);
      renderQueueState(found || null);
    }).catch(() => renderQueueState(null));

    // Live updates from the background poller.
    const onChanged = (changes, area) => {
      if (area !== "local" || !changes[queueLib.KEY]) return;
      const newMap = changes[queueLib.KEY].newValue || {};
      renderQueueState(newMap[queueKey] || null);
    };
    chrome.storage.onChanged.addListener(onChanged);
    // Detach when the row is removed from the DOM.
    const obs = new MutationObserver(() => {
      if (!document.body.contains(container)) {
        chrome.storage.onChanged.removeListener(onChanged);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  void row;
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
    <button class="qm-btn qm-bulk-close">Close selected</button>
    <button class="qm-btn qm-bulk-label">Label selected</button>
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
  bar.querySelector(".qm-bulk-close").addEventListener("click", onBulkClose);
  bar.querySelector(".qm-bulk-label").addEventListener("click", onBulkLabel);
  return bar;
}

// QM-061 — flash a row green/red after a bulk action.
function flashRow(container, ok, message) {
  if (!container) return;
  const cls = ok ? "qm-row-ok-flash" : "qm-row-err-flash";
  container.classList.add(cls);
  if (message) {
    const pill = document.createElement("span");
    pill.className = `qm-row-flash-pill ${ok ? "qm-row-flash-ok" : "qm-row-flash-err"}`;
    pill.textContent = message;
    pill.title = message;
    container.appendChild(pill);
    setTimeout(() => pill.remove(), 6000);
  }
  setTimeout(() => container.classList.remove(cls), 2000);
}

function _groupSelectedByRepo() {
  const byRepo = new Map();
  for (const [, sel] of state.selected) {
    const key = `${sel.pr.owner}/${sel.pr.repo}`;
    if (!byRepo.has(key)) byRepo.set(key, []);
    byRepo.get(key).push(sel);
  }
  return byRepo;
}

// QM-059 — Close selected.
async function onBulkClose() {
  if (state.selected.size === 0) {
    toast("No PRs selected", "warn");
    return;
  }
  const total = state.selected.size;
  const threshold = (BULK_OPS.DEFAULT_CONFIRM_THRESHOLD || 5);
  const msg = total >= threshold
    ? `You're about to close ${total} pull requests. This cannot be undone from the extension. Continue?`
    : `Close ${total} pull request${total === 1 ? "" : "s"}?`;
  if (!confirm(msg)) return;
  const token = state.token;
  if (!token) { toast("Set a token in options first", "warn"); return; }

  const byRepo = _groupSelectedByRepo();
  for (const [repoKey, items] of byRepo) {
    if (!BULK_OPS.closePRs) { toast("bulk-ops lib missing", "error"); return; }
    const numbers = items.map((s) => s.pr.num);
    const results = await BULK_OPS.closePRs(repoKey, numbers, token, { api: API_HELPERS });
    for (const r of results) {
      const sel = items.find((s) => s.pr.num === r.number);
      if (!sel) continue;
      if (r.ok) {
        flashRow(sel.container, true, "Closed");
        sel.row.style.opacity = "0.5";
      } else {
        flashRow(sel.container, false, `Close failed: ${r.error || "unknown"}`);
      }
    }
  }
  // Clear selections that succeeded.
  state.selected.clear();
  document.querySelectorAll(".qm-select:checked").forEach((cb) => { cb.checked = false; });
  renderBulkBar();
}

// QM-060 — Label selected.
async function onBulkLabel() {
  if (state.selected.size === 0) {
    toast("No PRs selected", "warn");
    return;
  }
  const raw = prompt("Apply which label(s)? Comma-separated:", "");
  if (raw === null) return;
  const labels = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (labels.length === 0) {
    toast("No labels entered", "warn");
    return;
  }
  const token = state.token;
  if (!token) { toast("Set a token in options first", "warn"); return; }

  const byRepo = _groupSelectedByRepo();
  for (const [repoKey, items] of byRepo) {
    if (!BULK_OPS.labelPRs) { toast("bulk-ops lib missing", "error"); return; }
    const numbers = items.map((s) => s.pr.num);
    const results = await BULK_OPS.labelPRs(repoKey, numbers, labels, token, { api: API_HELPERS });
    for (const r of results) {
      const sel = items.find((s) => s.pr.num === r.number);
      if (!sel) continue;
      if (r.ok) {
        flashRow(sel.container, true, `Labels: ${labels.join(", ")}`);
      } else {
        flashRow(sel.container, false, `Label failed: ${r.error || "unknown"}`);
      }
    }
  }
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

  const overlay = document.createElement("div");
  overlay.id = "qm-pro-modal";
  overlay.className = "qm-sponsor-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "qm-sponsor-title");

  const card = document.createElement("div");
  card.className = "qm-sponsor-card";

  const content = document.createElement("div");
  content.className = "qm-sponsor-content";

  // Pro badge with mark
  const badge = document.createElement("span");
  badge.className = "qm-badge qm-badge-pro";
  badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1l2.4 7.2H22l-6 4.4 2.3 7.2L12 15.4 5.7 19.8 8 12.6 2 8.2h7.6z"/></svg>';
  badge.appendChild(document.createTextNode(" Sponsor"));
  content.appendChild(badge);

  const title = document.createElement("h2");
  title.id = "qm-sponsor-title";
  title.className = "qm-sponsor-title";
  title.textContent = "Like this? Support development.";
  content.appendChild(title);

  const lede = document.createElement("p");
  lede.className = "qm-sponsor-lede";
  lede.textContent = "PR Quick Merge is free and open source. A small monthly sponsorship keeps it maintained — and unlocks an early say in the roadmap.";
  content.appendChild(lede);

  const tiers = document.createElement("ul");
  tiers.className = "qm-sponsor-list";
  for (const t of [
    "☕ $5/mo — keeps the lights on",
    "🛠 $25/mo — for daily users",
    "🏢 $99/mo — small teams",
    "🚀 $499/mo — logo on the repo + roadmap input",
  ]) {
    const li = document.createElement("li");
    const check = document.createElement("span");
    check.className = "qm-sponsor-check";
    check.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    li.appendChild(check);
    li.appendChild(document.createTextNode(" " + t));
    tiers.appendChild(li);
  }
  content.appendChild(tiers);

  const actions = document.createElement("div");
  actions.className = "qm-sponsor-actions";

  const sponsor = document.createElement("a");
  sponsor.className = "qm-button qm-button-accent qm-button-lg qm-pro-sponsor";
  sponsor.style.flex = "1";
  sponsor.style.justifyContent = "center";
  sponsor.href = SPONSORS_URL;
  sponsor.target = "_blank";
  sponsor.rel = "noopener noreferrer";
  sponsor.textContent = "Sponsor on GitHub";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "qm-button qm-button-lg qm-pro-close";
  close.textContent = "Maybe later";

  actions.appendChild(sponsor);
  actions.appendChild(close);
  if (isDev) {
    const dev = document.createElement("button");
    dev.type = "button";
    dev.className = "qm-button qm-button-lg qm-pro-dev";
    dev.textContent = "Enable Pro (dev)";
    actions.appendChild(dev);
  }
  content.appendChild(actions);

  card.appendChild(content);
  overlay.appendChild(card);

  const dismiss = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss();
    if (e.target.classList && e.target.classList.contains("qm-pro-close")) dismiss();
    if (e.target.classList && e.target.classList.contains("qm-pro-sponsor")) dismiss();
  });
  const devBtn = overlay.querySelector(".qm-pro-dev");
  if (devBtn) {
    devBtn.addEventListener("click", async () => {
      await chrome.storage.local.set({ pro: true });
      state.pro = true;
      dismiss();
      toast("Pro mode enabled (dev). Re-click Merge selected.", "ok");
    });
  }

  document.body.appendChild(overlay);
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
