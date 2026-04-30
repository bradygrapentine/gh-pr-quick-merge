/* GitHub PR Quick Merge — content script
 * Injects merge buttons into rows on the Pull Requests list page.
 */

const API = "https://api.github.com";
// QM-304 — selectors live in lib/hosts/github/selectors.js so the GitLab
// adapter (Phase 1) has a parallel file. Fall back to the inline values if
// the lib didn't load (defensive — older zips may be in flight).
const _GH_SEL = (typeof window !== "undefined" && window.QM_GITHUB_SELECTORS) || {};
const ROW_SELECTOR = _GH_SEL.ROW_SELECTOR || ".js-issue-row, [data-testid='issue-pr-title-link']";
const INJECTED_ATTR = _GH_SEL.INJECTED_ATTR || "data-qm-injected";
const SPONSORS_URL = "https://github.com/sponsors/bradygrapentine";
// pr-helpers.js exposes parsePrLink / classifyMergeState /
// mergeMethodFromKind as top-level `function`s. Each of those becomes a
// lexical binding in the content-script isolated world. Destructuring
// any of those names directly into a `const` here would collide.
// Rebind into qm-prefixed locals.
const _QM_HELPERS = window.QM_HELPERS;
const parsePrHref = _QM_HELPERS.parsePrLink;
const qmClassifyMergeState = _QM_HELPERS.classifyMergeState;
const qmMergeMethodFromKind = _QM_HELPERS.mergeMethodFromKind;
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
  // QM-209 — "active" enables hover hint on row widget primary button.
  shortcutMode: "off",
  // Track active widgets so a shortcutMode flip re-renders them.
  rowWidgets: new Set(),
  // QM-214 — flipped by Pause button on the bulk bar to abort the merge loop.
  bulkPaused: false,
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
        "qm_shortcut_mode",
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
  state.shortcutMode = syncStore.qm_shortcut_mode === "active" ? "active" : "off";
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

// QM-304 — parsePrLink + findPrAnchor delegate to lib/hosts/github/selectors.js
// when present; inline implementations remain as the fallback so a missing
// selectors lib doesn't blank the extension.
function qmParsePrLink(anchor) {
  if (!anchor) return null;
  if (_GH_SEL.parsePrLink) return _GH_SEL.parsePrLink(anchor);
  return parsePrHref(anchor.getAttribute("href") || anchor.href);
}

function findPrAnchor(row) {
  if (_GH_SEL.findPrAnchor) return _GH_SEL.findPrAnchor(row);
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
  const klass = qmClassifyMergeState(prState);
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

function fetchPrState(pr, token) {
  // Delegates to lib/hosts/github/pr-state.js so the PR page (Epic 10) can
  // reuse the exact same shape + caching contract as the /pulls list.
  // Prefers the GraphQL piggy-back (one round-trip vs. two) when
  // available; falls back to REST automatically inside the helper.
  const PR_STATE = self.QM_GITHUB_PR_STATE;
  if (PR_STATE && typeof PR_STATE.fetchPrStateAndCi === "function") {
    return PR_STATE.fetchPrStateAndCi(pr, token, { cache: state.cache });
  }
  return PR_STATE.fetchPrState(pr, token, { cache: state.cache });
}

// Auto-rebase opt-in — per-PR map persisted in chrome.storage.sync.
// Loaded once at start, kept hot in `state.autoRebaseMap`, written
// through to storage on every toggle. The set of in-flight rebases is
// tracked separately so a slow rebase doesn't double-fire.
state.autoRebaseMap = state.autoRebaseMap || {};
state.autoRebaseInFlight = state.autoRebaseInFlight || new Set();

async function _hydrateAutoRebaseMap() {
  const T = self.QM_AUTO_REBASE_TOGGLE;
  if (!T) return;
  state.autoRebaseMap = await T.loadAutoRebaseMap();
}
_hydrateAutoRebaseMap();

function _maybeAutoRebase(pr, prState) {
  const T = self.QM_AUTO_REBASE_TOGGLE;
  const updateLib = self.QM_UPDATE_BRANCH;
  if (!T || !updateLib || !prState || !prState.head_sha) return;
  if (!T.isEnabled(pr, state.autoRebaseMap)) return;
  // Only fire when GitHub says the PR is behind.
  const behind = prState.mergeable_state === "behind" || Number(prState.behind_by) > 0;
  if (!behind) return;
  const key = prKey(pr);
  if (state.autoRebaseInFlight.has(key)) return;
  state.autoRebaseInFlight.add(key);
  (async () => {
    try {
      const sync = await chrome.storage.sync.get("updateBranchStrategy");
      const strategy = sync && sync.updateBranchStrategy === "rebase" ? "rebase" : "merge";
      await updateLib.updateBranch({
        owner: pr.owner, repo: pr.repo, pullNumber: pr.num,
        expectedHeadSha: prState.head_sha, strategy,
        token: state.token, api: API_HELPERS,
      });
      toast(`Auto-rebase queued for ${key}`, "ok");
      state.cache.delete(key);
    } catch (e) {
      toast(`Auto-rebase failed for ${key}: ${e && e.message ? e.message : "unknown"}`, "err");
    } finally {
      // Cool-down: clear the in-flight flag after 5s so a sustained
      // 403 / 422 doesn't busy-loop.
      setTimeout(() => state.autoRebaseInFlight.delete(key), 5000);
    }
  })();
}

// Epic 11 Track A — render row badges + render CI state + mount the
// auto-rebase opt-in toggle.
//
// If `prState` came from the GraphQL piggy-back (`fetchPrStateAndCi`),
// `ci_state` is already attached and we render synchronously. Otherwise
// we fall back to the REST roll-up (`fetchCiState`) and apply the CI
// dot when the second fetch returns. Idempotent on its own; safe to
// call from injectRow on every soft-nav.
function applyRowBadgesAndCi(container, prState, pr, token) {
  const ROW_BADGES = self.QM_ROW_BADGES;
  const PR_STATE = self.QM_GITHUB_PR_STATE;
  const T = self.QM_AUTO_REBASE_TOGGLE;
  if (!ROW_BADGES || !prState || prState.error || prState.listMode) return;
  ROW_BADGES.applyRowBadges(container, prState, pr);

  // Auto-rebase toggle — render, persist on toggle, evaluate trigger.
  if (T) {
    T.mountToggle(container, pr, {
      enabled: T.isEnabled(pr, state.autoRebaseMap),
      onChange: async (next) => {
        state.autoRebaseMap = T.setEnabled(pr, state.autoRebaseMap, next);
        await T.saveAutoRebaseMap(state.autoRebaseMap);
        if (next) _maybeAutoRebase(pr, prState);
      },
    });
    _maybeAutoRebase(pr, prState);
  }

  // GraphQL combined-fetch path — single round-trip already covered
  // both row state and CI rollup, no second call needed.
  if (prState.ci_state !== undefined) {
    ROW_BADGES.applyCiState(container, {
      state: prState.ci_state,
      failingContexts: prState.failing_contexts || [],
    });
    return;
  }

  // REST fallback — kick off the second round-trip.
  if (!prState.head_sha || !PR_STATE || typeof PR_STATE.fetchCiState !== "function") return;
  PR_STATE.fetchCiState(prState.head_sha, token, {
    cache: state.cache,
    path: `/repos/${pr.owner}/${pr.repo}/commits/${prState.head_sha}/status`,
  }).then((ci) => {
    if (!container.isConnected) return;
    ROW_BADGES.applyCiState(container, ci);
  }).catch(() => { /* network blip — leave badge unrendered */ });
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
  const method = qmMergeMethodFromKind(kind);
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
  const pr = qmParsePrLink(anchor);
  if (!pr) return;
  row.setAttribute(INJECTED_ATTR, "1");

  const container = document.createElement("span");
  container.className = "qm-container";
  container.dataset.qmKey = prKey(pr);

  // Per-row bulk-select checkbox removed (UI pass 6). Bulk operations
  // remain available; we'll surface a different selection affordance
  // if/when the user wants bulk back. Code below preserves
  // state.selected hooks so the bulk bar code path doesn't blow up,
  // but no DOM element is mounted.
  const checkbox = { checked: false, disabled: true, addEventListener: () => {} };

  const status = makeStatus();
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
      getDefaultMethod: () => state.repoDefaults[`${pr.owner}/${pr.repo}`] || state.repoDefaults["*"] || "merge",
      getShortcutHint: () => state.shortcutMode === "active" ? "▶ S to squash" : null,
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
    state.rowWidgets.add(rowWidget);
    // Drop the widget reference when its row leaves the DOM so the set
    // doesn't leak as the user paginates the PR list.
    const detachObs = new MutationObserver(() => {
      if (!document.body.contains(container)) {
        state.rowWidgets.delete(rowWidget);
        detachObs.disconnect();
      }
    });
    detachObs.observe(document.body, { childList: true, subtree: true });
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

  // Mount as the row's last child + pin top-right via CSS. Avoids
  // jamming buttons next to the title (awkward) and avoids the
  // bottom-of-column position (harder to scan). Reads as an action
  // group on the right side of each row, vertically centered with
  // the title.
  container.classList.add("qm-container-pinned");
  if (getComputedStyle(row).position === "static") {
    row.style.position = "relative";
  }
  row.appendChild(container);

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
  applyRowBadgesAndCi(container, prState, pr, token);
  // Re-apply the active filter to this newly-injected row. Cheap — the
  // keeper fn is one chain of predicates and the row count is bounded by
  // GitHub's page size.
  if (typeof reapplyFilters === "function") reapplyFilters();
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
        // QM-176 — poll /pulls/:n until behind_by hits 0 (or max attempts).
        // Replaces the v0.4 fixed setTimeout(3s) which was too short on busy
        // bases and too long on idle ones.
        const POLL_INTERVAL_MS = 1500;
        const POLL_MAX_ATTEMPTS = 8; // ~12s ceiling
        let lastBehind = prData.behind_by;
        for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          state.cache.delete(prKey(pr));
          const refreshed = await fetchPrState(pr, token);
          setRowState(container, refreshed);
          const behind = refreshed && Number(refreshed.behind_by);
          if (refreshed && behind === 0) {
            updateBtn.remove();
            return;
          }
          if (Number.isFinite(behind)) lastBehind = behind;
          updateBtn.textContent = `Update (${lastBehind})`;
        }
        // Polling timed out — leave the button enabled so the user can retry.
        updateBtn.disabled = false;
        updateBtn.title = "Update still pending after 12s — retry or check on GitHub";
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
        watchBtn.textContent = "Auto-merge when green";
        watchBtn.title = "Once CI is green, automatically merge this PR";
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
  bar.dataset.state = "idle";
  // QM-214 — dark-pill bulk bar. Idle layout: count badge + repo summary +
  // method select + action cluster. Mid-flight: progress text + Pause.
  bar.innerHTML = `
    <span class="qm-bulk-badge"><span class="qm-bulk-count">0</span> selected</span>
    <span class="qm-bulk-repos" aria-hidden="true"></span>
    <span class="qm-bulk-pro" title="Sponsor-only feature">SPONSOR</span>
    <select class="qm-bulk-method qm-input qm-input-sm" aria-label="Merge method">
      <option value="squash">Squash &amp; merge</option>
      <option value="merge">Merge commit</option>
      <option value="rebase">Rebase &amp; merge</option>
    </select>
    <button class="qm-button qm-button-primary qm-button-sm qm-bulk-go" type="button">Merge <span class="qm-bulk-go-count">0</span></button>
    <button class="qm-button qm-button-ghost qm-button-sm qm-bulk-close" type="button">Close</button>
    <button class="qm-button qm-button-ghost qm-button-sm qm-bulk-label" type="button">Label</button>
    <button class="qm-button qm-button-ghost qm-button-sm qm-bulk-clear" type="button">Clear</button>
    <span class="qm-bulk-progress" hidden>
      <span class="qm-bulk-progress-text">0 / 0</span>
      <button class="qm-button qm-button-ghost qm-button-sm qm-bulk-pause" type="button">Pause</button>
    </span>
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
  bar.querySelector(".qm-bulk-pause").addEventListener("click", () => {
    state.bulkPaused = true;
    bar.querySelector(".qm-bulk-pause").disabled = true;
    bar.querySelector(".qm-bulk-pause").textContent = "Stopping…";
  });
  return bar;
}

function setBulkBarState(stateName, payload = {}) {
  const bar = document.getElementById("qm-bulk-bar");
  if (!bar) return;
  bar.dataset.state = stateName;
  const progress = bar.querySelector(".qm-bulk-progress");
  const idleControls = bar.querySelectorAll(".qm-bulk-go, .qm-bulk-close, .qm-bulk-label, .qm-bulk-method");
  if (stateName === "running") {
    if (progress) progress.hidden = false;
    idleControls.forEach((el) => { el.hidden = true; });
    const text = bar.querySelector(".qm-bulk-progress-text");
    if (text) text.textContent = `${payload.done || 0} / ${payload.total || 0}`;
    const pauseBtn = bar.querySelector(".qm-bulk-pause");
    if (pauseBtn) { pauseBtn.disabled = false; pauseBtn.textContent = "Pause"; }
  } else {
    if (progress) progress.hidden = true;
    idleControls.forEach((el) => { el.hidden = false; });
  }
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
  const items = Array.from(state.selected.values());
  // QM-171 — typed confirmation at threshold; quick-confirm under it.
  const ok = total >= threshold
    ? await confirmBulkActionTyped({ items, action: "close", confirmWord: "CLOSE" })
    : confirm(`Close ${total} pull request${total === 1 ? "" : "s"}?`);
  if (!ok) return;
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
  const token = state.token;
  if (!token) { toast("Set a token in options first", "warn"); return; }

  // QM-172 — use the real label-picker if it loaded, otherwise fall back to
  // the v0.4 prompt() flow so the extension never goes blank on a missing lib.
  let labels;
  const picker = window.QM_LABEL_PICKER;
  if (picker && typeof picker.pickLabels === "function") {
    const repoSlugs = Array.from(new Set(
      Array.from(state.selected.values()).map((s) => `${s.pr.owner}/${s.pr.repo}`),
    ));
    labels = await picker.pickLabels({ repos: repoSlugs, token });
    if (!labels) return; // cancelled
  } else {
    const raw = prompt("Apply which label(s)? Comma-separated:", "");
    if (raw === null) return;
    labels = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (labels.length === 0) { toast("No labels entered", "warn"); return; }
  }

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
  const count = bar.querySelector(".qm-bulk-count");
  if (count) count.textContent = String(n);
  const goCount = bar.querySelector(".qm-bulk-go-count");
  if (goCount) goCount.textContent = String(n);
  // Repo summary (e.g. "2 repos") — replaces the old static "selected" label.
  const reposEl = bar.querySelector(".qm-bulk-repos");
  if (reposEl) {
    const repoSet = new Set();
    for (const { pr } of state.selected.values()) repoSet.add(`${pr.owner}/${pr.repo}`);
    reposEl.textContent = repoSet.size > 0
      ? `· ${repoSet.size} repo${repoSet.size === 1 ? "" : "s"}`
      : "";
  }
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

/**
 * Generic typed-confirmation modal. Used by bulk merge (QM-058), bulk close
 * (QM-171), and bulk label (QM-171).
 *
 * @param {object} opts
 * @param {Array<{pr:object}>} opts.items
 * @param {string} opts.action — verb shown in title + button (e.g. "merge", "close", "label")
 * @param {string} [opts.confirmWord] — uppercase word the user must type; defaults to action.toUpperCase()
 * @returns {Promise<boolean>}
 */
function confirmBulkActionTyped({ items, action, confirmWord }) {
  return new Promise((resolve) => {
    const word = (confirmWord || action || "MERGE").toUpperCase();
    const expected = `${word} ${items.length}`;
    const modal = document.createElement("div");
    modal.className = "qm-typed-modal";

    const card = document.createElement("div");
    card.className = "qm-typed-card";

    const heading = document.createElement("h2");
    heading.textContent = `Confirm bulk ${action}`;

    const lede = document.createElement("p");
    lede.textContent = `You are about to ${action} ${items.length} pull request${items.length === 1 ? "" : "s"}:`;

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
    confirmBtn.textContent = expected;
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
    ? await confirmBulkActionTyped({ items, action: method, confirmWord: method })
    : confirm(`${method.toUpperCase()} ${items.length} PR${items.length > 1 ? "s" : ""}?`);
  if (!ok) return;
  const token = getToken();
  if (!token) {
    toast("Set a GitHub token first", "warn");
    return;
  }
  state.bulkPaused = false;
  setBulkBarState("running", { done: 0, total: items.length });
  let success = 0;
  let failed = 0;
  let done = 0;
  for (const { pr, row, container } of items) {
    if (state.bulkPaused) break;
    // Mark this row as in-flight (per-row progress, QM-214).
    container.classList.add("qm-bulk-row-running");
    const cached = state.cache.get(prKey(pr));
    if (!cached?.head_sha) {
      failed++;
      container.classList.remove("qm-bulk-row-running");
      flashRow(container, false, "Not ready");
    } else {
      try {
        await doMerge({ pr, kind: method, token, headSha: cached.head_sha });
        success++;
        row.style.opacity = "0.5";
        container.classList.remove("qm-bulk-row-running");
        const status = container.querySelector(".qm-status");
        if (status) {
          status.textContent = "✓";
          status.dataset.kind = "merged";
        }
        flashRow(container, true, "Merged");
      } catch (e) {
        failed++;
        container.classList.remove("qm-bulk-row-running");
        toast(`Failed ${prKey(pr)}: ${e.message}`, "error");
        flashRow(container, false, `Failed: ${e.message || ""}`);
      }
    }
    done++;
    const text = document.querySelector("#qm-bulk-bar .qm-bulk-progress-text");
    if (text) text.textContent = `${done} / ${items.length}`;
  }
  const stopped = state.bulkPaused;
  state.bulkPaused = false;
  state.selected.clear();
  document.querySelectorAll(".qm-select:checked").forEach((cb) => (cb.checked = false));
  setBulkBarState("idle");
  renderBulkBar();
  if (stopped) {
    toast(`Bulk merge stopped: ${success} ok, ${failed} failed, ${items.length - done} skipped`, "warn");
  } else {
    toast(`Bulk merge: ${success} ok, ${failed} failed`, failed ? "warn" : "ok");
  }
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
  // QM-219 — read accent/density/font and apply CSS vars on the document root
  // so injected widgets pick them up. Best-effort; defaults work if storage
  // is unavailable.
  try {
    if (window.QM_VISUAL_PREFS && chrome.storage && chrome.storage.sync) {
      await window.QM_VISUAL_PREFS.bootstrap({
        root: document.documentElement,
        store: chrome.storage.sync,
      });
    }
  } catch (_e) { /* defaults */ }
  ensureLiveRegion();
  document.addEventListener("keydown", onShortcutKeydown);
  scan();
  observer.observe(document.body, { childList: true, subtree: true });
  renderBulkBar();
  refreshPrPageActionBar();
  initFilterBar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

document.addEventListener("turbo:render", () => {
  scan();
  refreshPrPageActionBar();
  initFilterBar();
});
document.addEventListener("pjax:end", () => {
  scan();
  refreshPrPageActionBar();
  initFilterBar();
});

// === Epic 11 Track B — quick-filter bar (QM-504..508) ====================

const filterState = {
  filters: {},
  keeperFn: () => true,
};

async function initFilterBar() {
  const FILTER_BAR = self.QM_FILTER_BAR;
  const FILTERS = self.QM_FILTERS;
  if (!FILTER_BAR || !FILTERS) return;
  // Mount on /pulls list pages only — not on individual PR pages, where
  // there's no row list to filter.
  const onListPage = location.pathname.endsWith("/pulls")
    || /\/pulls(\?|$)/.test(location.pathname + location.search)
    || /^\/pulls/.test(location.pathname);
  if (!onListPage) {
    FILTER_BAR.removeFilterBar();
    return;
  }
  filterState.filters = await FILTER_BAR.loadFilters();
  FILTER_BAR.ensureFilterBar({
    filters: filterState.filters,
    onChange: async (next) => {
      filterState.filters = next;
      await FILTER_BAR.saveFilters(next);
      reapplyFilters();
    },
  });
  reapplyFilters();
}

function reapplyFilters() {
  const FILTERS = self.QM_FILTERS;
  if (!FILTERS) return;
  const STALE = self.QM_STALE_PR;
  const SIZER = self.QM_SIZE;
  const ctx = {
    viewerLogin: prPageState.viewer && prPageState.viewer.login,
    staleHelpers: STALE,
    sizer: SIZER,
    staleThresholds: STALE && STALE.DEFAULT_THRESHOLDS,
  };
  filterState.keeperFn = FILTERS.composeFilter(filterState.filters, ctx);
  const rows = document.querySelectorAll(".js-issue-row[data-qm-injected='true']");
  FILTERS.applyFiltersToRows(filterState.keeperFn, rows, (row) => {
    const link = (self.QM_GITHUB_SELECTORS && self.QM_GITHUB_SELECTORS.findPrAnchor)
      ? self.QM_GITHUB_SELECTORS.findPrAnchor(row)
      : row.querySelector("a[href*='/pull/']");
    const parsed = link && self.QM_HELPERS && self.QM_HELPERS.parsePrLink
      ? self.QM_HELPERS.parsePrLink(link.getAttribute("href") || "")
      : null;
    if (!parsed) return null;
    const cached = state.cache.get(prKey(parsed));
    if (!cached || cached.error) return null;
    return { state: cached, pr: { ...parsed, author: cached.author } };
  });
}

// === Epic 10 — PR-page action bar (QM-402..408) ============================
//
// Mounts the always-visible rebase / approve bar on /<o>/<r>/pull/<n>.
// Decision logic + DOM live in lib/qm-pr-page-actions.js; this glue
// wires it to content-script context (chrome.storage, fetch, toast).

const prPageState = {
  writePermDenied: false,
  viewer: null,
  inFlight: null,
};

async function fetchViewer(token) {
  if (!token) return null;
  if (prPageState.viewer) return prPageState.viewer;
  try {
    const data = await API_HELPERS.apiGet("/user", { token });
    if (data && data.login) prPageState.viewer = { login: data.login };
    return prPageState.viewer;
  } catch (_e) {
    return null;
  }
}

async function refreshPrPageActionBar() {
  const SELECTORS = self.QM_GITHUB_SELECTORS;
  const PR_ACTIONS = self.QM_PR_PAGE_ACTIONS;
  if (!SELECTORS || !PR_ACTIONS) return;
  if (!SELECTORS.isPullRequestPage()) {
    PR_ACTIONS.removePrPageActionBar();
    return;
  }
  const parts = PR_ACTIONS.parsePrPagePath(location.pathname);
  if (!parts) {
    PR_ACTIONS.removePrPageActionBar();
    return;
  }
  const token = state.token;
  if (!token) {
    PR_ACTIONS.removePrPageActionBar();
    return;
  }

  // Avoid stacking concurrent fetches on rapid soft-nav.
  if (prPageState.inFlight) return;
  prPageState.inFlight = (async () => {
    try {
      // Bypass the row-state cache so the bar reflects the freshest
      // mergeable_state — list-page cache TTL is too long for the PR
      // page, where the user just navigated to take an action.
      state.cache.delete(prKey(parts));
      const [prState, viewer] = await Promise.all([
        fetchPrState(parts, token),
        fetchViewer(token),
      ]);
      if (!SELECTORS.isPullRequestPage()) return; // navigated away mid-fetch
      // DOM-probe GitHub's own merge-status panel — a positive signal
      // that overrides API-state staleness, per
      // dom_injection.md §PR Page Rebase Button Injection.
      const nativeControlPresent = typeof SELECTORS.hasNativeUpdateBranchControl === "function"
        ? SELECTORS.hasNativeUpdateBranchControl()
        : false;
      PR_ACTIONS.ensurePrPageActionBar({
        state: prState || {},
        viewer,
        writePermDenied: prPageState.writePermDenied,
        nativeControlPresent,
        repoDefault: state.repoDefaults[`${parts.owner}/${parts.repo}`] || state.repoDefaults["*"] || "",
        handlers: {
          onRebaseClick: () => onPrPageRebaseClick(parts, prState),
          onApproveClick: () => onPrPageApproveClick(parts, prState),
          onMergeClick: () => onPrPageMergeClick(parts, prState, "merge"),
          onSquashClick: () => onPrPageMergeClick(parts, prState, "squash"),
        },
      });
    } catch (_e) {
      // Network errors leave the bar untouched — better than blanking.
    } finally {
      prPageState.inFlight = null;
    }
  })();
}

async function onPrPageRebaseClick(parts, prState) {
  const PR_ACTIONS = self.QM_PR_PAGE_ACTIONS;
  const updateLib = self.QM_UPDATE_BRANCH;
  if (!PR_ACTIONS || !updateLib) return;
  const trigger = document.querySelector(`#${PR_ACTIONS.BAR_ID} [data-qm-action="rebase"]`);
  const confirmed = await PR_ACTIONS.showRebaseConfirmModal({ trigger });
  if (!confirmed) return;
  try {
    const sync = await chrome.storage.sync.get("updateBranchStrategy");
    const strategy = sync && sync.updateBranchStrategy === "rebase" ? "rebase" : "merge";
    await updateLib.updateBranch({
      owner: parts.owner,
      repo: parts.repo,
      pullNumber: parts.num,
      expectedHeadSha: prState && prState.head_sha,
      strategy,
      token: state.token,
      api: API_HELPERS,
    });
    // Doc-verbatim success copy from
    // github_power_suite_docs_updated/pr_page_rebase_button.md §Safety Copy.
    toast("Branch update started. CI may rerun.", "ok");
    setTimeout(refreshPrPageActionBar, 1500);
  } catch (e) {
    // Doc-verbatim failure copy. Conflict (422) and forbidden (403) get
    // the same shared message so users see consistent guidance — the
    // panel-link fallback is what differentiates them.
    const failCopy = "Could not update branch. Open GitHub's merge panel for details.";
    if (e && e.name === "UpdateConflictError") {
      toast(failCopy, "warn");
      setTimeout(refreshPrPageActionBar, 250);
    } else if (e && e.name === "UpdateForbiddenError") {
      prPageState.writePermDenied = true;
      toast(failCopy, "err");
      refreshPrPageActionBar();
    } else {
      toast(failCopy, "err");
    }
  }
}

async function onPrPageApproveClick(parts, prState) {
  const PR_ACTIONS = self.QM_PR_PAGE_ACTIONS;
  if (!PR_ACTIONS) return;
  try {
    await PR_ACTIONS.submitReview({
      owner: parts.owner,
      repo: parts.repo,
      pullNumber: parts.num,
      token: state.token,
      api: API_HELPERS,
    });
    toast(`Approved ${parts.owner}/${parts.repo}#${parts.num}`, "ok");
    if (prState) prState.viewer_has_approved = true;
    refreshPrPageActionBar();
  } catch (e) {
    toast(`Approve failed: ${e && e.message ? e.message : "unknown"}`, "err");
  }
}

// Merge / Squash from the PR-page action bar. `kind` is "merge" or
// "squash"; we reuse the existing doMerge() so commit-message templates
// + repo-default routing carry over from the /pulls list path.
async function onPrPageMergeClick(parts, prState, kind) {
  const PR_ACTIONS = self.QM_PR_PAGE_ACTIONS;
  if (!PR_ACTIONS) return;
  const sel = `[data-qm-action="${kind}"]`;
  const trigger = document.querySelector(`#${PR_ACTIONS.BAR_ID} ${sel}`);
  const confirmed = await PR_ACTIONS.showActionConfirmModal({ trigger, action: kind });
  if (!confirmed) return;
  try {
    const pr = { owner: parts.owner, repo: parts.repo, num: parts.num };
    await doMerge({ pr, kind, token: state.token, headSha: prState && prState.head_sha });
    toast(`${kind === "squash" ? "Squashed" : "Merged"} ${pr.owner}/${pr.repo}#${pr.num}`, "ok");
    // Force a state refetch — bar will hide once mergeable_state flips
    // off "clean" (PR is now closed).
    state.cache.delete(prKey(parts));
    setTimeout(refreshPrPageActionBar, 800);
  } catch (e) {
    toast(`${kind === "squash" ? "Squash" : "Merge"} failed: ${e && e.message ? e.message : "unknown"}`, "err");
  }
}

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
    if (changes.qm_shortcut_mode) {
      state.shortcutMode = changes.qm_shortcut_mode.newValue === "active" ? "active" : "off";
      // Re-render each live widget so the hint span appears / disappears.
      for (const w of state.rowWidgets) {
        const cached = state.cache.get(w.root.dataset.qmKey) || null;
        try { w.setState(cached); } catch (_e) { /* widget already disposed */ }
      }
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
