/* qm-onboarding.js — first-run onboarding card.
 *
 * Renders inside the popup when (no clientId AND no token AND not previously
 * dismissed). Dismiss writes chrome.storage.local.onboardingDismissed = true.
 *
 * Source: handoff_pr_quick_merge_design/components/extras.jsx (`OnboardingCard`).
 */

(function attach(scope) {
  const STORE_KEY = "onboardingDismissed";

  /**
   * @param {object} args
   * @param {string} [args.clientId]
   * @param {string} [args.token]
   * @param {boolean} [args.dismissed]
   * @returns {boolean}
   */
  function shouldShow({ clientId, token, dismissed } = {}) {
    if (dismissed) return false;
    if (clientId) return false;
    if (token) return false;
    return true;
  }

  /**
   * @param {object} opts
   * @param {() => void} [opts.onConnect] — fires when "Continue" is clicked.
   * @param {() => Promise<void>} [opts.onDismiss] — fires when "×" is clicked.
   * @returns {HTMLElement}
   */
  function makeCard(opts = {}) {
    const card = document.createElement("section");
    card.className = "qm-onboarding qm-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-labelledby", "qm-onboarding-title");

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "qm-onboarding-dismiss qm-button qm-button-ghost qm-button-sm";
    dismiss.setAttribute("aria-label", "Dismiss onboarding");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", async () => {
      try {
        if (typeof opts.onDismiss === "function") await opts.onDismiss();
      } finally {
        card.remove();
      }
    });
    card.appendChild(dismiss);

    const heading = document.createElement("h2");
    heading.id = "qm-onboarding-title";
    heading.className = "qm-onboarding-title";
    heading.textContent = "Welcome to PR Quick Merge";
    card.appendChild(heading);

    const lede = document.createElement("p");
    lede.className = "qm-onboarding-lede";
    lede.textContent = "Squash, merge, or rebase pull requests directly from the GitHub PR list.";
    card.appendChild(lede);

    const steps = document.createElement("ul");
    steps.className = "qm-onboarding-steps";
    const STEP_DATA = [
      { glyph: "S", label: "Squash", note: "default for most teams" },
      { glyph: "M", label: "Merge", note: "preserve commit history" },
      { glyph: "R", label: "Rebase", note: "linear history" },
    ];
    for (const s of STEP_DATA) {
      const li = document.createElement("li");
      li.className = "qm-onboarding-step";
      const glyph = document.createElement("span");
      glyph.className = "qm-onboarding-glyph";
      glyph.textContent = s.glyph;
      glyph.setAttribute("aria-hidden", "true");
      const text = document.createElement("div");
      text.className = "qm-onboarding-step-text";
      const lab = document.createElement("div");
      lab.className = "qm-onboarding-step-label";
      lab.textContent = s.label;
      const note = document.createElement("div");
      note.className = "qm-onboarding-step-note";
      note.textContent = s.note;
      text.appendChild(lab);
      text.appendChild(note);
      li.appendChild(glyph);
      li.appendChild(text);
      steps.appendChild(li);
    }
    card.appendChild(steps);

    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "qm-onboarding-cta qm-button qm-button-primary";
    cta.textContent = "Continue — connect GitHub";
    cta.addEventListener("click", () => {
      if (typeof opts.onConnect === "function") opts.onConnect();
    });
    card.appendChild(cta);

    // Privacy link beneath the CTA — required for CWS / AMO listings
    // and also good practice for first-run consent. Reading-comprehension
    // baseline is "small grey text", not a primary affordance.
    const privacy = document.createElement("a");
    privacy.className = "qm-onboarding-privacy";
    privacy.href = "https://bradygrapentine.github.io/gh-pr-quick-merge/privacy-policy.html";
    privacy.target = "_blank";
    privacy.rel = "noopener noreferrer";
    privacy.textContent = "Privacy policy — what data the extension touches";
    card.appendChild(privacy);

    return card;
  }

  /**
   * Convenience: read state and render only if shouldShow.
   * @param {object} args
   * @param {HTMLElement} args.mount
   * @param {object} args.localStore — { get, set }
   * @param {object} args.syncStore — { get }
   * @param {() => void} args.onConnect
   * @returns {Promise<HTMLElement|null>}
   */
  async function maybeRender({ mount, localStore, syncStore, onConnect }) {
    if (!mount) return null;
    let token = "";
    let clientId = "";
    let dismissed = false;
    try {
      const ls = await localStore.get(["token", STORE_KEY]);
      token = (ls && ls.token) || "";
      dismissed = !!(ls && ls[STORE_KEY]);
    } catch (_e) { /* default values */ }
    try {
      const ss = await syncStore.get("clientId");
      clientId = (ss && ss.clientId) || "";
    } catch (_e) { /* default values */ }

    if (!shouldShow({ clientId, token, dismissed })) return null;
    const card = makeCard({
      onConnect,
      onDismiss: async () => {
        if (localStore && typeof localStore.set === "function") {
          await localStore.set({ [STORE_KEY]: true });
        }
      },
    });
    mount.appendChild(card);
    return card;
  }

  const api = { shouldShow, makeCard, maybeRender, STORE_KEY };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_ONBOARDING = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
