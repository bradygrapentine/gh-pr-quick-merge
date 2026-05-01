/* qm-brand.js — brand mark + wordmark constructors.
 *
 * Pure DOM helpers; no chrome.* dependencies so they're trivially testable.
 * Source mark glyph: handoff_pr_quick_merge_design/components/primitives.jsx
 * (`QMMark`). Re-rendered as a plain SVG string for the vanilla-DOM stack.
 */

(function attach(scope) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  // Brand glyph circles: [cx, cy] pairs for the three nodes.
  const MARK_NODES = [[5, 4], [15, 17], [19, 6]];

  // Reference SVG string — kept for tests + any external consumer that
  // wants to embed the glyph as a background-image data URL. NOT used
  // at runtime to construct DOM (see _buildMarkSvg) because innerHTML
  // assignment trips MV3 reviewers' static linter.
  const MARK_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M5 4v9a4 4 0 0 0 4 4h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />' +
    '<circle cx="5" cy="4" r="2.2" fill="currentColor" />' +
    '<circle cx="15" cy="17" r="2.2" fill="currentColor" />' +
    '<circle cx="19" cy="6" r="2.2" fill="currentColor" />' +
    '</svg>';

  // Build the brand mark via pure DOM (no innerHTML) so MV3 reviewers'
  // static linter (UNSAFE_VAR_ASSIGNMENT) doesn't flag it.
  function _buildMarkSvg() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M5 4v9a4 4 0 0 0 4 4h6");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2.2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    for (const [cx, cy] of MARK_NODES) {
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", String(cx));
      c.setAttribute("cy", String(cy));
      c.setAttribute("r", "2.2");
      c.setAttribute("fill", "currentColor");
      svg.appendChild(c);
    }
    return svg;
  }

  /**
   * Build a `.qm-mark` element containing the brand glyph.
   * @param {object} [opts]
   * @param {string} [opts.title] — accessible title; if absent, mark is aria-hidden.
   * @returns {HTMLElement}
   */
  function makeMark({ title } = {}) {
    const span = document.createElement("span");
    span.className = "qm-mark";
    span.appendChild(_buildMarkSvg());
    if (title) {
      span.setAttribute("role", "img");
      span.setAttribute("aria-label", title);
    } else {
      span.setAttribute("aria-hidden", "true");
    }
    return span;
  }

  /**
   * Build a `.qm-wordmark` element: brand mark + product name + optional tag.
   * @param {object} [opts]
   * @param {string} [opts.tag] — small uppercase label appended (e.g. "EXT", "SETTINGS").
   * @param {string} [opts.label] — overrides the default product name.
   * @returns {HTMLElement}
   */
  function makeWordmark({ tag, label } = {}) {
    const wrap = document.createElement("span");
    wrap.className = "qm-wordmark";
    wrap.appendChild(makeMark());
    const name = document.createElement("span");
    name.className = "qm-wordmark-name";
    name.textContent = label || "PR Quick Merge";
    wrap.appendChild(name);
    if (tag) {
      const t = document.createElement("span");
      t.className = "qm-wordmark-tag";
      t.textContent = tag;
      wrap.appendChild(t);
    }
    return wrap;
  }

  const api = { makeMark, makeWordmark, MARK_SVG };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_BRAND = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
