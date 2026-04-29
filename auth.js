/* GitHub OAuth Device Flow for MV3 extension options page.
 *
 * Saves the resulting access_token to chrome.storage.local.token (kept out
 * of chrome.storage.sync to prevent credentials roaming across browser
 * profiles).
 */

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

/**
 * Start the GitHub OAuth Device Flow.
 *
 * @param {string} clientId  GitHub OAuth App client ID (Device Flow enabled).
 * @param {object} hooks
 *   @param {(info: {user_code, verification_uri, expires_in, interval}) => void} hooks.onCode
 *   @param {(remainingSec: number) => void} [hooks.onTick]
 *   @param {(message: string) => void} [hooks.onStatus]
 *   @param {(login: string, token: string) => void} [hooks.onSuccess]
 *   @param {(message: string) => void} [hooks.onError]
 * @returns {Promise<{ok: boolean, token?: string, login?: string, error?: string}>}
 */
export async function startDeviceFlow(clientId, hooks = {}) {
  const { onCode, onTick, onStatus, onSuccess, onError } = hooks;
  const status = (m) => onStatus && onStatus(m);
  const fail = (msg) => {
    if (onError) onError(msg);
    return { ok: false, error: msg };
  };

  if (!clientId) return fail("Missing Client ID.");

  // 1. Request a device + user code.
  let codeData;
  try {
    const res = await fetch(DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ client_id: clientId, scope: "repo" }).toString(),
    });
    if (!res.ok) return fail(`Device code request failed: HTTP ${res.status}`);
    codeData = await res.json();
  } catch (e) {
    return fail(`Network error requesting device code: ${e.message || e}`);
  }

  if (codeData.error) {
    return fail(`Device code error: ${codeData.error_description || codeData.error}`);
  }

  const {
    device_code,
    user_code,
    verification_uri,
    expires_in = 900,
    interval = 5,
  } = codeData;

  if (!device_code || !user_code || !verification_uri) {
    return fail("Malformed device code response.");
  }

  if (onCode) onCode({ user_code, verification_uri, expires_in, interval });
  status("Waiting for you to authorize on GitHub…");

  // 2. Poll for the access token.
  let pollInterval = interval;
  const deadline = Date.now() + expires_in * 1000;

  // Drive a 1s countdown tick independent of the polling cadence.
  let tickHandle = null;
  if (onTick) {
    const tick = () => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      onTick(remaining);
      if (remaining > 0) tickHandle = setTimeout(tick, 1000);
    };
    tick();
  }

  const stopTick = () => {
    if (tickHandle) clearTimeout(tickHandle);
    tickHandle = null;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  while (Date.now() < deadline) {
    await sleep(pollInterval * 1000);
    if (Date.now() >= deadline) break;

    let tokenData;
    try {
      const res = await fetch(ACCESS_TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }).toString(),
      });
      tokenData = await res.json();
    } catch (e) {
      status(`Network error while polling: ${e.message || e}. Retrying…`);
      continue;
    }

    if (tokenData.error) {
      if (tokenData.error === "authorization_pending") continue;
      if (tokenData.error === "slow_down") {
        const serverInterval = Number(tokenData.interval);
        const next = Number.isFinite(serverInterval) && serverInterval > pollInterval
          ? serverInterval
          : pollInterval + 5;
        pollInterval = Math.min(60, next);
        status(`GitHub asked us to slow down. Polling every ${pollInterval}s.`);
        continue;
      }
      stopTick();
      const TERMINAL_MESSAGES = {
        expired_token: "Code expired before you authorized. Try again.",
        access_denied: "Authorization was denied.",
      };
      const friendly = TERMINAL_MESSAGES[tokenData.error];
      return fail(friendly || `OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    if (tokenData.access_token) {
      stopTick();
      const token = tokenData.access_token;
      await chrome.storage.local.set({ token });
      status("Token saved. Fetching account info…");

      // Best-effort: fetch the user's login for the success message.
      let login = null;
      try {
        const userRes = await fetch("https://api.github.com/user", {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (userRes.ok) {
          const u = await userRes.json();
          login = u.login || null;
        }
      } catch {
        /* ignore — token is still saved */
      }

      if (onSuccess) onSuccess(login, token);
      return { ok: true, token, login };
    }

    // No error, no token — treat as pending and keep polling.
  }

  stopTick();
  return fail("Timed out waiting for authorization.");
}
