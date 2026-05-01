/* qm-onboarding.js — first-run onboarding tour (QM-174 / Epic 8 F8.6 polish).
 *
 * Renders inside the popup when (no clientId AND no token AND not previously
 * dismissed). Three-step tour:
 *
 *   1. Welcome + merge-method explainer
 *   2. Row widget — how to merge from the PR list
 *   3. Auto-Merge — queue a PR to ship when CI turns green
 *
 * Final step's CTA opens the device-flow auth in options. Earlier steps
 * have Skip + Next; the last has Back + Connect-GitHub. Dismiss writes
 * chrome.storage.local.onboardingDismissed = true so re-opens stay quiet.
 *
 * Source: handoff_pr_quick_merge_design/components/extras.jsx (`OnboardingCard`)
 * extended for the multi-step pager.
 */

(function attach(scope) {
  const STORE_KEY = "onboardingDismissed";
  const TOTAL_STEPS = 3;

  /**
   * @param {object} args
   * @returns {boolean}
   */
  function shouldShow({ clientId, token, dismissed } = {}) {
    if (dismissed) return false;
    if (clientId) return false;
    if (token) return false;
    return true;
  }

  // ---- Step body builders ----------------------------------------------------

  function _buildStep1Body() {
    const wrap = document.createElement("div");

    const lede = document.createElement("p");
    lede.className = "qm-onboarding-lede";
    lede.textContent = "Squash, merge, or rebase pull requests directly from the GitHub PR list — without opening each one.";
    wrap.appendChild(lede);

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
    wrap.appendChild(steps);
    return wrap;
  }

  function _buildStep2Body() {
    const wrap = document.createElement("div");

    const lede = document.createElement("p");
    lede.className = "qm-onboarding-lede";
    lede.textContent = "Each PR row gets a green action button. Click it to ship without leaving the list.";
    wrap.appendChild(lede);

    // Mock row-widget illustration: status pill + main button + caret.
    const mock = document.createElement("div");
    mock.className = "qm-onboarding-mock-row";
    mock.setAttribute("aria-hidden", "true");
    const status = document.createElement("span");
    status.className = "qm-onboarding-mock-status";
    status.textContent = "READY";
    const main = document.createElement("span");
    main.className = "qm-onboarding-mock-main";
    main.textContent = "Squash";
    const caret = document.createElement("span");
    caret.className = "qm-onboarding-mock-caret";
    caret.textContent = "▾";
    mock.appendChild(status);
    mock.appendChild(main);
    mock.appendChild(caret);
    wrap.appendChild(mock);

    const bullets = document.createElement("ul");
    bullets.className = "qm-onboarding-bullets";
    [
      "Green button = your default merge method",
      "Caret picks a different method per PR",
      "Status pill shows ready / behind / blocked at a glance",
    ].forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      bullets.appendChild(li);
    });
    wrap.appendChild(bullets);
    return wrap;
  }

  function _buildStep3Body() {
    const wrap = document.createElement("div");

    const lede = document.createElement("p");
    lede.className = "qm-onboarding-lede";
    lede.textContent = "Or queue Auto-Merge — the extension watches CI and fires the moment it turns green.";
    wrap.appendChild(lede);

    // Mock toggle: idle ↔ watching.
    const mock = document.createElement("div");
    mock.className = "qm-onboarding-mock-toggle";
    mock.setAttribute("aria-hidden", "true");

    const idle = document.createElement("span");
    idle.className = "qm-onboarding-mock-pill";
    idle.textContent = "Auto-Merge";
    mock.appendChild(idle);

    const arrow = document.createElement("span");
    arrow.className = "qm-onboarding-mock-arrow";
    arrow.textContent = "↔";
    mock.appendChild(arrow);

    const watching = document.createElement("span");
    watching.className = "qm-onboarding-mock-pill qm-onboarding-mock-pill-watching";
    watching.textContent = "🟡 watching";
    mock.appendChild(watching);
    wrap.appendChild(mock);

    const bullets = document.createElement("ul");
    bullets.className = "qm-onboarding-bullets";
    [
      "Click once to start watching",
      "Polls every 30 s; fires when checks are green",
      "Click again on the watching pill to stop",
    ].forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      bullets.appendChild(li);
    });
    wrap.appendChild(bullets);
    return wrap;
  }

  const STEP_BUILDERS = [_buildStep1Body, _buildStep2Body, _buildStep3Body];
  const STEP_TITLES = [
    "Welcome to PR Quick Merge",
    "Merge from the list",
    "Watch CI, ship automatically",
  ];

  /**
   * Render a 3-step onboarding card. Caller wires the final CTA + dismiss
   * via the opts callbacks.
   *
   * @param {object} opts
   * @param {() => void} [opts.onConnect] — fires when "Continue — connect GitHub" is clicked on step 3.
   * @param {() => Promise<void>} [opts.onDismiss] — fires when "×" or "Skip" is clicked.
   * @param {number} [opts.startStep] — 1-indexed initial step (test seam).
   * @returns {HTMLElement}
   */
  function makeCard(opts = {}) {
    const card = document.createElement("section");
    card.className = "qm-onboarding qm-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-labelledby", "qm-onboarding-title");

    let currentStep = Math.min(Math.max(Number(opts.startStep) || 1, 1), TOTAL_STEPS);

    // ---- Header: step indicator + dismiss --------------------------------
    const header = document.createElement("header");
    header.className = "qm-onboarding-header";

    const indicator = document.createElement("ol");
    indicator.className = "qm-onboarding-indicator";
    indicator.setAttribute("aria-label", `Step ${currentStep} of ${TOTAL_STEPS}`);
    const dots = [];
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const dot = document.createElement("li");
      dot.className = "qm-onboarding-dot";
      dot.dataset.qmStep = String(i);
      indicator.appendChild(dot);
      dots.push(dot);
    }
    header.appendChild(indicator);

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "qm-onboarding-dismiss qm-button qm-button-ghost qm-button-sm";
    dismiss.setAttribute("aria-label", "Dismiss onboarding");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", () => _close());
    header.appendChild(dismiss);

    card.appendChild(header);

    // ---- Body ------------------------------------------------------------
    const heading = document.createElement("h2");
    heading.id = "qm-onboarding-title";
    heading.className = "qm-onboarding-title";
    card.appendChild(heading);

    const body = document.createElement("div");
    body.className = "qm-onboarding-body";
    card.appendChild(body);

    // ---- Footer: Back / Skip / Next / Connect ----------------------------
    const footer = document.createElement("footer");
    footer.className = "qm-onboarding-footer";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "qm-onboarding-back qm-button qm-button-ghost qm-button-sm";
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", () => _setStep(currentStep - 1));
    footer.appendChild(backBtn);

    const spacer = document.createElement("span");
    spacer.className = "qm-onboarding-footer-spacer";
    footer.appendChild(spacer);

    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "qm-onboarding-skip qm-button qm-button-ghost qm-button-sm";
    skipBtn.textContent = "Skip";
    skipBtn.addEventListener("click", () => _close());
    footer.appendChild(skipBtn);

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "qm-onboarding-next qm-button qm-button-primary qm-button-sm";
    nextBtn.textContent = "Next →";
    nextBtn.addEventListener("click", () => _setStep(currentStep + 1));
    footer.appendChild(nextBtn);

    const connectBtn = document.createElement("button");
    connectBtn.type = "button";
    connectBtn.className = "qm-onboarding-cta qm-button qm-button-primary";
    connectBtn.textContent = "Continue — connect GitHub";
    connectBtn.addEventListener("click", () => {
      if (typeof opts.onConnect === "function") opts.onConnect();
    });
    footer.appendChild(connectBtn);

    card.appendChild(footer);

    // ---- Privacy link ----------------------------------------------------
    const privacy = document.createElement("a");
    privacy.className = "qm-onboarding-privacy";
    privacy.href = "https://bradygrapentine.github.io/gh-pr-quick-merge/privacy-policy.html";
    privacy.target = "_blank";
    privacy.rel = "noopener noreferrer";
    privacy.textContent = "Privacy policy — what data the extension touches";
    card.appendChild(privacy);

    // ---- State machine ---------------------------------------------------
    function _setStep(n) {
      const next = Math.min(Math.max(n, 1), TOTAL_STEPS);
      currentStep = next;
      heading.textContent = STEP_TITLES[next - 1];
      body.replaceChildren(STEP_BUILDERS[next - 1]());
      indicator.setAttribute("aria-label", `Step ${next} of ${TOTAL_STEPS}`);
      card.dataset.qmStep = String(next);
      dots.forEach((d, i) => {
        d.dataset.qmActive = i + 1 === next ? "true" : "false";
        d.dataset.qmDone = i + 1 < next ? "true" : "false";
      });

      // Footer button visibility per step:
      //   step 1: [hide back] [skip] [next]
      //   step 2: [back]      [skip] [next]
      //   step 3: [back]               [connect]
      backBtn.hidden = next === 1;
      const onLast = next === TOTAL_STEPS;
      skipBtn.hidden = onLast;
      nextBtn.hidden = onLast;
      connectBtn.hidden = !onLast;
    }

    async function _close() {
      try {
        if (typeof opts.onDismiss === "function") await opts.onDismiss();
      } finally {
        card.remove();
      }
    }

    _setStep(currentStep);

    // Test seam: expose step controls.
    Object.defineProperty(card, "__qmGoToStep", { value: _setStep, enumerable: false });
    Object.defineProperty(card, "__qmCurrentStep", { get: () => currentStep, enumerable: false });

    return card;
  }

  /**
   * Read state and render only if shouldShow.
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

  const api = { shouldShow, makeCard, maybeRender, STORE_KEY, TOTAL_STEPS };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_ONBOARDING = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
