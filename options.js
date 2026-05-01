import { startDeviceFlow } from "./auth.js";

const $ = (id) => document.getElementById(id);

async function load() {
  const [{ token }, { clientId }, { tokenStale }] = await Promise.all([
    chrome.storage.local.get("token"),
    chrome.storage.sync.get("clientId"),
    chrome.storage.local.get("tokenStale"),
  ]);
  if (clientId) $("clientId").value = clientId;
  if (token) {
    showSignedIn();
  }
  const staleHint = $("tokenStaleHint");
  if (staleHint) staleHint.hidden = !tokenStale;
}

function showSignedIn() {
  const badge = $("signedInBadge");
  if (badge) badge.classList.add("shown");
}

function showSignedOut() {
  const badge = $("signedInBadge");
  if (badge) badge.classList.remove("shown");
}

async function signOut() {
  await chrome.storage.local.remove("token");
  $("token").value = "";
  showSignedOut();
  setStatus("oauthStatus", "Signed out — token cleared.", "ok");
  setStatus("status", "Signed out — token cleared.", "ok");
}

function setStatus(idOrEl, msg, kind = "") {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${kind}`;
}

async function save() {
  const token = $("token").value.trim();
  await chrome.storage.local.set({ token });
  if (token) showSignedIn();
  setStatus("status", "Saved.", "ok");
}

async function test() {
  const token = $("token").value.trim();
  if (!token) {
    setStatus("status", "Enter a token first.", "err");
    return;
  }
  setStatus("status", "Testing…");
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      setStatus("status", `Failed: HTTP ${res.status}`, "err");
      return;
    }
    const data = await res.json();
    setStatus("status", `OK — authenticated as ${data.login}`, "ok");
  } catch (e) {
    setStatus("status", `Failed: ${e.message}`, "err");
  }
}

async function saveClientId() {
  const clientId = $("clientId").value.trim();
  await chrome.storage.sync.set({ clientId });
  setStatus("oauthStatus", "Client ID saved.", "ok");
}

// Module-scoped refs for the device-flow handoff. The copy-and-open button
// listener is wired once at DOMContentLoaded; signIn just updates these.
let pendingCode = null;
let pendingUri = null;

async function onCopyAndOpen() {
  if (!pendingCode || !pendingUri) return;
  try {
    await navigator.clipboard.writeText(pendingCode);
  } catch {
    // clipboard may be unavailable in some contexts; user can still copy manually
  }
  window.open(pendingUri, "_blank", "noopener");
}

async function signIn() {
  const clientId = $("clientId").value.trim();
  if (!clientId) {
    setStatus("oauthStatus", "Enter your OAuth App Client ID first.", "err");
    return;
  }
  await chrome.storage.sync.set({ clientId });

  const box = $("deviceBox");
  const codeEl = $("userCode");
  const linkEl = $("verificationLink");
  const countdownEl = $("countdown");
  const signinBtn = $("signin");

  box.classList.remove("shown");
  codeEl.textContent = "—";
  countdownEl.textContent = "";
  signinBtn.disabled = true;
  pendingCode = null;
  pendingUri = null;
  setStatus("oauthStatus", "Requesting device code…");

  try {
    const result = await startDeviceFlow(clientId, {
      onCode: ({ user_code, verification_uri }) => {
        pendingCode = user_code;
        pendingUri = verification_uri;
        codeEl.textContent = user_code;
        linkEl.href = verification_uri;
        linkEl.textContent = verification_uri;
        box.classList.add("shown");
      },
      onTick: (remaining) => {
        const m = Math.floor(remaining / 60);
        const s = String(remaining % 60).padStart(2, "0");
        countdownEl.textContent = remaining > 0 ? `Code expires in ${m}:${s}` : "Code expired.";
      },
      onStatus: (msg) => setStatus("oauthStatus", msg),
      onError: (msg) => setStatus("oauthStatus", msg, "err"),
    });

    if (result.ok) {
      const who = result.login ? `Signed in as ${result.login}` : "Signed in.";
      setStatus("oauthStatus", who, "ok");
      showSignedIn();
    }
  } catch (e) {
    setStatus("oauthStatus", `Failed: ${e.message || e}`, "err");
  } finally {
    signinBtn.disabled = false;
  }
}

/* Per-repo defaults UI. Backed by lib/repo-defaults.js (loaded as a classic
 * script in options.html, so its API is on window.QM_REPO_DEFAULTS). The
 * underlying store contract is the chrome.storage.sync shape: get(key) →
 * Promise<{[key]: value}>, set(obj) → Promise, remove(key) → Promise.
 */
const syncStore = {
  get: (k) => chrome.storage.sync.get(k),
  set: (obj) => chrome.storage.sync.set(obj),
  remove: (k) => chrome.storage.sync.remove(k),
};

function defaultsApi() {
  return typeof window !== "undefined" ? window.QM_REPO_DEFAULTS : null;
}

async function renderDefaults() {
  const api = defaultsApi();
  const list = $("defaultsList");
  if (!api || !list) return;
  let entries;
  try {
    entries = await api.listDefaults(syncStore);
  } catch (e) {
    setStatus("defaultsStatus", `Failed to load: ${e.message}`, "err");
    return;
  }
  list.innerHTML = "";
  const keys = Object.keys(entries).sort();
  if (keys.length === 0) {
    const li = document.createElement("li");
    li.className = "qm-d-empty";
    li.textContent = "No per-repo defaults yet.";
    list.appendChild(li);
    return;
  }
  for (const k of keys) {
    const li = document.createElement("li");
    const repo = document.createElement("span");
    repo.className = "qm-d-repo";
    repo.textContent = k;
    const method = document.createElement("span");
    method.className = "qm-d-method";
    method.textContent = entries[k];
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "qm-d-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeDefault(k));
    li.appendChild(repo);
    li.appendChild(method);
    li.appendChild(remove);
    list.appendChild(li);
  }
}

function parseRepoInput(raw) {
  const v = (raw || "").trim().replace(/^\/+|\/+$/g, "");
  const m = v.match(/^([^\s/]+)\/([^\s/]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

// Repo-name autocomplete (QM-037). Populates a <datalist> from /user/repos
// when the per-repo defaults input gets focus. One fetch per options-page session.

let repoSuggestionsLoaded = false;

function populateDatalist(datalistEl, repos) {
  if (!datalistEl) return;
  while (datalistEl.firstChild) datalistEl.removeChild(datalistEl.firstChild);
  for (const r of repos) {
    const opt = document.createElement("option");
    opt.value = r;
    datalistEl.appendChild(opt);
  }
}

async function loadRepoSuggestions() {
  if (repoSuggestionsLoaded) return;
  repoSuggestionsLoaded = true;
  const { token } = await chrome.storage.local.get("token");
  if (!token) return;
  try {
    const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return;
    const data = await res.json();
    const slugs = Array.isArray(data) ? data.map((r) => r && r.full_name).filter(Boolean) : [];
    populateDatalist($("qm-repo-suggestions"), slugs);
  } catch {
    // Silent — datalist stays empty on network/auth failure.
  }
}

async function addDefault() {
  const api = defaultsApi();
  if (!api) {
    setStatus("defaultsStatus", "Defaults module not loaded.", "err");
    return;
  }
  const raw = $("defaultRepo").value;
  const parsed = parseRepoInput(raw);
  if (!parsed) {
    setStatus("defaultsStatus", "Enter as owner/repo (e.g. octocat/hello-world).", "err");
    return;
  }
  const method = $("defaultMethod").value;
  const existing = await api.getDefault(parsed.owner, parsed.repo, syncStore);
  if (existing && existing !== method) {
    if (!confirm(`Overwrite existing default (${existing}) for ${parsed.owner}/${parsed.repo}?`)) {
      return;
    }
  }
  try {
    await api.setDefault(parsed.owner, parsed.repo, method, syncStore);
    $("defaultRepo").value = "";
    setStatus("defaultsStatus", `Saved ${parsed.owner}/${parsed.repo} → ${method}.`, "ok");
    await renderDefaults();
  } catch (e) {
    setStatus("defaultsStatus", `Failed: ${e.message}`, "err");
  }
}

async function removeDefault(key) {
  const api = defaultsApi();
  if (!api) return;
  const slash = key.indexOf("/");
  if (slash < 0) return;
  const owner = key.slice(0, slash);
  const repo = key.slice(slash + 1);
  try {
    await api.clearDefault(owner, repo, syncStore);
    setStatus("defaultsStatus", `Removed ${key}.`, "ok");
    await renderDefaults();
  } catch (e) {
    setStatus("defaultsStatus", `Failed: ${e.message}`, "err");
  }
}

// ---------------------------------------------------------------------------
// Templates editor (QM-033)
// ---------------------------------------------------------------------------

const syncStorageStore = chrome.storage.sync;

async function renderTemplates() {
  const list = $("templatesList");
  if (!list || !window.QM_TEMPLATES) return;
  const map = await window.QM_TEMPLATES.listTemplates(syncStorageStore);
  list.innerHTML = "";
  const names = Object.keys(map).sort();
  if (names.length === 0) {
    const li = document.createElement("li");
    li.className = "qm-d-empty";
    li.textContent = "No templates saved yet.";
    list.appendChild(li);
    return;
  }
  for (const name of names) {
    const li = document.createElement("li");
    const nameEl = document.createElement("span");
    nameEl.className = "qm-list-name";
    nameEl.textContent = name;
    const bodyEl = document.createElement("pre");
    bodyEl.className = "qm-list-body";
    bodyEl.textContent = map[name];
    const removeBtn = document.createElement("button");
    removeBtn.className = "qm-list-remove";
    removeBtn.textContent = "Remove";
    removeBtn.type = "button";
    removeBtn.addEventListener("click", async () => {
      await window.QM_TEMPLATES.deleteTemplate(name, syncStorageStore);
      setStatus("templatesStatus", `Removed "${name}".`, "ok");
      renderTemplates();
    });
    li.appendChild(nameEl);
    li.appendChild(bodyEl);
    li.appendChild(removeBtn);
    list.appendChild(li);
  }
}

async function saveTemplate() {
  if (!window.QM_TEMPLATES) return;
  const name = $("templateName").value.trim();
  const body = $("templateBody").value;
  if (!name) {
    setStatus("templatesStatus", "Template name is required.", "err");
    return;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    setStatus("templatesStatus", "Template name: letters, digits, dash, underscore only.", "err");
    return;
  }
  try {
    await window.QM_TEMPLATES.saveTemplate(name, body, syncStorageStore);
    setStatus("templatesStatus", `Saved "${name}".`, "ok");
    $("templateName").value = "";
    $("templateBody").value = "";
    renderTemplates();
    renderRepoTemplateBindings(); // refresh dropdown options
  } catch (e) {
    setStatus("templatesStatus", `Failed: ${e.message || e}`, "err");
  }
}

function clearTemplateForm() {
  $("templateName").value = "";
  $("templateBody").value = "";
  setStatus("templatesStatus", "");
}

// QM-175 — per-repo template bindings.
const REPO_TEMPLATE_BINDINGS_KEY = "qm_repo_template_bindings";

async function _readRepoTemplateBindings() {
  const data = await chrome.storage.sync.get(REPO_TEMPLATE_BINDINGS_KEY);
  const m = data && data[REPO_TEMPLATE_BINDINGS_KEY];
  return m && typeof m === "object" ? m : {};
}

async function _writeRepoTemplateBindings(map) {
  await chrome.storage.sync.set({ [REPO_TEMPLATE_BINDINGS_KEY]: map });
}

async function renderRepoTemplateBindings() {
  const list = $("repoTemplateBindingsList");
  const sel = $("repoTemplateBindingName");
  if (!list || !sel || !window.QM_TEMPLATES) return;
  const [bindings, templates] = await Promise.all([
    _readRepoTemplateBindings(),
    window.QM_TEMPLATES.listTemplates(syncStorageStore),
  ]);
  const names = Object.keys(templates).sort();

  // Refresh the dropdown options.
  sel.innerHTML = "";
  if (names.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(no templates saved)";
    opt.disabled = true;
    sel.appendChild(opt);
  } else {
    for (const n of names) {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      sel.appendChild(opt);
    }
  }

  // Refresh the bindings list.
  list.innerHTML = "";
  const repoSlugs = Object.keys(bindings).sort();
  if (repoSlugs.length === 0) {
    const li = document.createElement("li");
    li.className = "qm-d-empty";
    li.textContent = "No per-repo bindings yet.";
    list.appendChild(li);
    return;
  }
  for (const repo of repoSlugs) {
    const name = bindings[repo];
    const li = document.createElement("li");
    const repoEl = document.createElement("span");
    repoEl.className = "qm-d-repo";
    repoEl.textContent = repo;
    const methodEl = document.createElement("span");
    methodEl.className = "qm-d-method";
    methodEl.textContent = name + (templates[name] ? "" : " (missing)");
    if (!templates[name]) methodEl.style.color = "var(--qm-danger, #cf222e)";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "qm-d-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const next = { ...(await _readRepoTemplateBindings()) };
      delete next[repo];
      await _writeRepoTemplateBindings(next);
      setStatus("repoTemplateBindingsStatus", `Removed binding for ${repo}.`, "ok");
      renderRepoTemplateBindings();
    });
    li.appendChild(repoEl);
    li.appendChild(methodEl);
    li.appendChild(removeBtn);
    list.appendChild(li);
  }
}

async function addRepoTemplateBinding() {
  const repo = $("repoTemplateBindingRepo").value.trim();
  const name = $("repoTemplateBindingName").value;
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo)) {
    setStatus("repoTemplateBindingsStatus", "Use the format owner/repo.", "err");
    return;
  }
  if (!name) {
    setStatus("repoTemplateBindingsStatus", "Save a template first, then bind it.", "err");
    return;
  }
  const bindings = await _readRepoTemplateBindings();
  bindings[repo] = name;
  await _writeRepoTemplateBindings(bindings);
  setStatus("repoTemplateBindingsStatus", `Bound ${repo} → ${name}.`, "ok");
  $("repoTemplateBindingRepo").value = "";
  renderRepoTemplateBindings();
}

// ---------------------------------------------------------------------------
// Shortcuts editor (QM-036)
// ---------------------------------------------------------------------------

async function getShortcutBindings() {
  const SHORTCUTS = window.QM_SHORTCUTS;
  if (!SHORTCUTS) return [];
  const data = await chrome.storage.sync.get("qm_shortcuts");
  const stored = Array.isArray(data && data.qm_shortcuts) ? data.qm_shortcuts : null;
  if (!stored || stored.length === 0) {
    return SHORTCUTS.DEFAULT_BINDINGS.map((b) => ({ ...b }));
  }
  // Merge stored overrides with the default action set so newly-added defaults
  // still appear if the user updates the extension after customising shortcuts.
  const byId = new Map(stored.map((b) => [b.id, b]));
  return SHORTCUTS.DEFAULT_BINDINGS.map((d) => {
    const override = byId.get(d.id);
    return override ? { ...d, shortcut: override.shortcut } : { ...d };
  });
}

async function saveShortcutBindings(bindings) {
  await chrome.storage.sync.set({ qm_shortcuts: bindings.map((b) => ({ id: b.id, shortcut: b.shortcut })) });
}

let editingShortcutId = null;

function comboFromKeyEvent(e) {
  if (e.key === "Escape") return "Escape";
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  if (e.metaKey) parts.push("Meta");
  let key = e.key;
  if (key === " ") key = "Space";
  // Skip if only a modifier key was pressed (e.g. user just pressed Shift).
  if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") return null;
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join("+");
}

async function renderShortcuts() {
  const tbody = $("shortcutsTbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const bindings = await getShortcutBindings();
  for (const b of bindings) {
    const tr = document.createElement("tr");

    const tdAction = document.createElement("td");
    tdAction.textContent = b.description || b.id;
    tr.appendChild(tdAction);

    const tdCombo = document.createElement("td");
    const combo = document.createElement("span");
    combo.className = "qm-shortcut-combo" + (editingShortcutId === b.id ? " editing" : "");
    combo.textContent = editingShortcutId === b.id ? "Press a key…" : b.shortcut;
    if (editingShortcutId === b.id) {
      combo.tabIndex = 0;
      combo.addEventListener("keydown", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = comboFromKeyEvent(e);
        if (next === null) return; // ignore raw modifier presses
        if (next === "Escape") {
          editingShortcutId = null;
          renderShortcuts();
          return;
        }
        try {
          window.QM_SHORTCUTS.parseShortcut(next);
        } catch (err) {
          setStatus("shortcutsStatus", `Invalid combo: ${err.message}`, "err");
          return;
        }
        const updated = (await getShortcutBindings()).map((bb) => bb.id === b.id ? { ...bb, shortcut: next } : bb);
        await saveShortcutBindings(updated);
        editingShortcutId = null;
        setStatus("shortcutsStatus", `Updated "${b.id}" → ${next}.`, "ok");
        renderShortcuts();
      });
      setTimeout(() => combo.focus(), 0);
    }
    tdCombo.appendChild(combo);
    tr.appendChild(tdCombo);

    const tdEdit = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "qm-shortcut-edit";
    editBtn.textContent = editingShortcutId === b.id ? "Cancel" : "Edit";
    editBtn.type = "button";
    editBtn.addEventListener("click", () => {
      editingShortcutId = editingShortcutId === b.id ? null : b.id;
      renderShortcuts();
    });
    tdEdit.appendChild(editBtn);
    tr.appendChild(tdEdit);

    tbody.appendChild(tr);
  }
}

async function resetShortcuts() {
  if (!confirm("Reset all keyboard shortcuts to their defaults?")) return;
  await chrome.storage.sync.remove("qm_shortcuts");
  setStatus("shortcutsStatus", "Reset to defaults.", "ok");
  editingShortcutId = null;
  renderShortcuts();
}

// ---------------------------------------------------------------------------
// Per-repo stale thresholds (QM-063) + fast mode toggle (QM-067)
// ---------------------------------------------------------------------------

const REPO_STALE_KEY = "qm_repo_stale_thresholds";
const SLUG_RE_OPT = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

async function loadRepoStaleThresholds() {
  const data = await chrome.storage.sync.get(REPO_STALE_KEY);
  return (data && data[REPO_STALE_KEY] && typeof data[REPO_STALE_KEY] === "object") ? data[REPO_STALE_KEY] : {};
}

async function saveRepoStaleThresholds(map) {
  await chrome.storage.sync.set({ [REPO_STALE_KEY]: map });
}

async function renderRepoStaleList() {
  const list = $("repoStaleList");
  if (!list) return;
  const map = await loadRepoStaleThresholds();
  list.innerHTML = "";
  const slugs = Object.keys(map).sort();
  if (slugs.length === 0) {
    const li = document.createElement("li");
    li.className = "qm-d-empty";
    li.textContent = "No per-repo overrides yet.";
    list.appendChild(li);
    return;
  }
  for (const slug of slugs) {
    const li = document.createElement("li");
    const nameEl = document.createElement("span");
    nameEl.className = "qm-list-name";
    nameEl.textContent = slug;
    const bodyEl = document.createElement("span");
    bodyEl.className = "qm-list-body";
    bodyEl.style.flex = "0 1 auto";
    bodyEl.textContent = `${map[slug]} days`;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "qm-list-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const next = await loadRepoStaleThresholds();
      delete next[slug];
      await saveRepoStaleThresholds(next);
      setStatus("staleStatus", `Removed override for ${slug}.`, "ok");
      renderRepoStaleList();
    });
    li.appendChild(nameEl);
    li.appendChild(bodyEl);
    li.appendChild(removeBtn);
    list.appendChild(li);
  }
}

async function addRepoStaleOverride() {
  const slug = $("repoStaleRepo").value.trim();
  const days = Number($("repoStaleDays").value);
  if (!SLUG_RE_OPT.test(slug)) {
    setStatus("staleStatus", "Repo: format owner/repo.", "err");
    return;
  }
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    setStatus("staleStatus", "Days: integer 1–365.", "err");
    return;
  }
  const map = await loadRepoStaleThresholds();
  map[slug] = days;
  await saveRepoStaleThresholds(map);
  $("repoStaleRepo").value = "";
  $("repoStaleDays").value = "";
  setStatus("staleStatus", `Saved override for ${slug} (${days}d).`, "ok");
  renderRepoStaleList();
}

async function loadListMode() {
  const cb = $("listModeEnabled");
  if (!cb) return;
  const data = await chrome.storage.sync.get("listModeEnabled");
  cb.checked = !!(data && data.listModeEnabled);
}

async function onListModeChange() {
  const cb = $("listModeEnabled");
  if (!cb) return;
  await chrome.storage.sync.set({ listModeEnabled: !!cb.checked });
  setStatus("listModeStatus", cb.checked ? "Fast mode ON. Reload the GitHub PR list." : "Fast mode OFF.", "ok");
}

// ---------------------------------------------------------------------------
// Sentry crash-report consent (QM-169)
//
// Telemetry is **off by default** and only fires when the user explicitly
// opts in. The flag lives at chrome.storage.sync.qm_sentry_consent and is
// read by lib/sentry-init.js at SW boot — toggling here doesn't retro-init
// an already-running SDK; it gates the next service-worker startup.
// ---------------------------------------------------------------------------

async function loadSentryConsent() {
  const cb = $("sentryConsent");
  if (!cb) return;
  const data = await chrome.storage.sync.get("qm_sentry_consent");
  cb.checked = !!(data && data.qm_sentry_consent);
}

async function onSentryConsentChange() {
  const cb = $("sentryConsent");
  if (!cb) return;
  await chrome.storage.sync.set({ qm_sentry_consent: !!cb.checked });
  setStatus(
    "sentryConsentStatus",
    cb.checked
      ? "Crash reports ON. Takes effect next time the service worker restarts."
      : "Crash reports OFF.",
    "ok",
  );
}

// ---------------------------------------------------------------------------
// Update-branch strategy (QM-053) + auto-rebase threshold (QM-069)
// ---------------------------------------------------------------------------

async function loadUpdateBranchStrategy() {
  const sel = $("updateBranchStrategy");
  if (!sel) return;
  const data = await chrome.storage.sync.get("updateBranchStrategy");
  const v = data && data.updateBranchStrategy;
  sel.value = v === "rebase" ? "rebase" : "merge";
}

async function onUpdateBranchStrategyChange() {
  const sel = $("updateBranchStrategy");
  if (!sel) return;
  const v = sel.value === "rebase" ? "rebase" : "merge";
  await chrome.storage.sync.set({ updateBranchStrategy: v });
  setStatus("updateBranchStatus", `Saved (${v}).`, "ok");
}

async function loadAutoRebaseThreshold() {
  const inp = $("autoRebaseThreshold");
  if (!inp) return;
  const data = await chrome.storage.sync.get("autoRebaseThreshold");
  const v = Number(data && data.autoRebaseThreshold);
  inp.value = Number.isFinite(v) && v >= 0 ? v : 0;
}

async function onAutoRebaseThresholdChange() {
  const inp = $("autoRebaseThreshold");
  if (!inp) return;
  const v = Number(inp.value);
  if (!Number.isInteger(v) || v < 0 || v > 999) {
    setStatus("autoRebaseStatus", "Enter a whole number between 0 and 999.", "err");
    return;
  }
  await chrome.storage.sync.set({ autoRebaseThreshold: v });
  setStatus("autoRebaseStatus", v === 0 ? "Saved (disabled)." : `Saved (rebase when ≥ ${v} behind).`, "ok");
}

// ---------------------------------------------------------------------------
// Stale threshold (QM-040)
// ---------------------------------------------------------------------------

async function loadStaleThreshold() {
  const data = await chrome.storage.sync.get("qm_stale_days");
  const v = Number(data && data.qm_stale_days);
  $("staleDaysInput").value = Number.isFinite(v) && v >= 1 && v <= 365 ? v : 14;
}

async function onStaleDaysChange() {
  const raw = $("staleDaysInput").value;
  const v = Number(raw);
  if (!Number.isInteger(v) || v < 1 || v > 365) {
    setStatus("staleStatus", "Enter a whole number between 1 and 365.", "err");
    return;
  }
  await chrome.storage.sync.set({ qm_stale_days: v });
  setStatus("staleStatus", `Saved (${v} days).`, "ok");
}

// ---------------------------------------------------------------------------
// Import / export (QM-038)
// ---------------------------------------------------------------------------

async function exportSettings() {
  if (!window.QM_IMPORT_EXPORT) return;
  try {
    const blob = await window.QM_IMPORT_EXPORT.exportAll(syncStorageStore);
    const json = JSON.stringify(blob, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pr-quick-merge-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setStatus("ioStatus", "Exported.", "ok");
  } catch (e) {
    setStatus("ioStatus", `Export failed: ${e.message || e}`, "err");
  }
}

function triggerImport() {
  $("importFileInput").click();
}

async function onImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const blob = window.QM_IMPORT_EXPORT.parseBlob(text);
    const yes = confirm(
      "Import will OVERWRITE these settings:\n" +
        Object.keys(blob).filter((k) => k !== "_schema" && k !== "exportedAt").join(", ") +
        "\n\nContinue?",
    );
    if (!yes) {
      setStatus("ioStatus", "Import cancelled.", "");
      return;
    }
    await window.QM_IMPORT_EXPORT.importAll(blob, syncStorageStore);
    setStatus("ioStatus", "Imported.", "ok");
    // Re-render anything that's settings-driven on this page.
    await Promise.all([renderDefaults(), renderTemplates(), renderShortcuts(), loadStaleThreshold()]);
  } catch (err) {
    setStatus("ioStatus", `Import failed: ${err.message || err}`, "err");
  } finally {
    e.target.value = "";
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("save").addEventListener("click", save);
  $("test").addEventListener("click", test);
  $("saveClientId").addEventListener("click", saveClientId);
  $("signin").addEventListener("click", signIn);
  $("copyAndOpen").addEventListener("click", onCopyAndOpen);
  const signOutBtn = $("signOut");
  if (signOutBtn) signOutBtn.addEventListener("click", signOut);
  const addBtn = $("addDefault");
  if (addBtn) addBtn.addEventListener("click", addDefault);
  const repoInput = $("defaultRepo");
  if (repoInput) repoInput.addEventListener("focus", loadRepoSuggestions);

  if ($("templateSave")) {
    $("templateSave").addEventListener("click", saveTemplate);
    $("templateClear").addEventListener("click", clearTemplateForm);
  }
  if ($("shortcutsReset")) $("shortcutsReset").addEventListener("click", resetShortcuts);
  if ($("staleDaysInput")) $("staleDaysInput").addEventListener("change", onStaleDaysChange);
  if ($("updateBranchStrategy")) $("updateBranchStrategy").addEventListener("change", onUpdateBranchStrategyChange);
  if ($("autoRebaseThreshold")) $("autoRebaseThreshold").addEventListener("change", onAutoRebaseThresholdChange);
  if ($("repoStaleAdd")) $("repoStaleAdd").addEventListener("click", addRepoStaleOverride);
  if ($("listModeEnabled")) $("listModeEnabled").addEventListener("change", onListModeChange);
  if ($("sentryConsent")) $("sentryConsent").addEventListener("change", onSentryConsentChange);
  if ($("exportBtn")) $("exportBtn").addEventListener("click", exportSettings);
  if ($("importBtn")) $("importBtn").addEventListener("click", triggerImport);
  if ($("importFileInput")) $("importFileInput").addEventListener("change", onImportFile);
  if ($("repoTemplateBindingAdd")) $("repoTemplateBindingAdd").addEventListener("click", addRepoTemplateBinding);

  renderDefaults();
  renderTemplates();
  renderRepoTemplateBindings();
  renderShortcuts();
  loadStaleThreshold();
  loadUpdateBranchStrategy();
  loadAutoRebaseThreshold();
  renderRepoStaleList();
  loadListMode();
  loadSentryConsent();
});
