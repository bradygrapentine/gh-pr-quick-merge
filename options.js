import { startDeviceFlow } from "./auth.js";

const $ = (id) => document.getElementById(id);

async function load() {
  const [{ token }, { clientId }] = await Promise.all([
    chrome.storage.local.get("token"),
    chrome.storage.sync.get("clientId"),
  ]);
  if (clientId) $("clientId").value = clientId;
  if (token) {
    showSignedIn();
  }
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
  renderDefaults();
});
