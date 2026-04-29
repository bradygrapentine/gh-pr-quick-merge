/* Tiny pure helper: populate a <datalist> with <option value> children.
 * Extracted for testability (options.js is an ES module loaded only in the
 * options page; tests can't easily import it without jsdom setup).
 */

function populateDatalist(datalistEl, values) {
  if (!datalistEl) return;
  while (datalistEl.firstChild) datalistEl.removeChild(datalistEl.firstChild);
  for (const v of values) {
    if (typeof v !== "string" || !v) continue;
    const opt = (datalistEl.ownerDocument || document).createElement("option");
    opt.value = v;
    datalistEl.appendChild(opt);
  }
}

const helpers = { populateDatalist };
if (typeof module !== "undefined") module.exports = helpers;
if (typeof window !== "undefined") window.QM_DATALIST = helpers;
