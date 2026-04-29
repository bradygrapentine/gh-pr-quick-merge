import { startDeviceFlow } from "./auth.js";

const $ = (id) => document.getElementById(id);

async function load() {
  const { token, clientId } = await chrome.storage.sync.get(["token", "clientId"]);
  if (token) $("token").value = token;
  if (clientId) $("clientId").value = clientId;
}

function setStatus(idOrEl, msg, kind = "") {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${kind}`;
}

async function save() {
  const token = $("token").value.trim();
  await chrome.storage.sync.set({ token });
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

async function signIn() {
  const clientId = $("clientId").value.trim();
  if (!clientId) {
    setStatus("oauthStatus", "Enter your OAuth App Client ID first.", "err");
    return;
  }
  // Persist the client ID so users don't lose it on refresh.
  await chrome.storage.sync.set({ clientId });

  const box = $("deviceBox");
  const codeEl = $("userCode");
  const linkEl = $("verificationLink");
  const countdownEl = $("countdown");
  const copyBtn = $("copyAndOpen");
  const signinBtn = $("signin");

  box.classList.remove("shown");
  codeEl.textContent = "—";
  countdownEl.textContent = "";
  signinBtn.disabled = true;
  setStatus("oauthStatus", "Requesting device code…");

  let pendingCode = null;
  let pendingUri = null;

  const onCopyAndOpen = async () => {
    if (!pendingCode || !pendingUri) return;
    try {
      await navigator.clipboard.writeText(pendingCode);
    } catch {
      /* clipboard may be unavailable in some contexts; user can still copy manually */
    }
    window.open(pendingUri, "_blank", "noopener");
  };
  copyBtn.addEventListener("click", onCopyAndOpen);

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
      // Mirror the token into the PAT field so the user can see it's set.
      $("token").value = result.token;
    }
  } catch (e) {
    setStatus("oauthStatus", `Failed: ${e.message || e}`, "err");
  } finally {
    copyBtn.removeEventListener("click", onCopyAndOpen);
    signinBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("save").addEventListener("click", save);
  $("test").addEventListener("click", test);
  $("saveClientId").addEventListener("click", saveClientId);
  $("signin").addEventListener("click", signIn);
});
