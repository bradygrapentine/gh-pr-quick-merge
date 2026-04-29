/* Keyboard shortcut parsing & matching helpers.
 * Pure logic so it can be unit tested without DOM.
 */

const MODIFIER_ALIASES = {
  ctrl: "ctrl",
  control: "ctrl",
  shift: "shift",
  alt: "alt",
  option: "alt",
  cmd: "meta",
  command: "meta",
  meta: "meta",
};

function parseShortcut(str) {
  if (typeof str !== "string" || str.length === 0) {
    throw new Error("parseShortcut: empty shortcut string");
  }
  const parts = str.split("+").map((s) => s.trim());
  if (parts.some((p) => p.length === 0)) {
    throw new Error(`parseShortcut: empty segment in "${str}"`);
  }

  const out = { key: null, ctrl: false, shift: false, alt: false, meta: false };
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const lower = part.toLowerCase();
    const isLast = i === parts.length - 1;
    const modKey = MODIFIER_ALIASES[lower];
    if (modKey && !isLast) {
      out[modKey] = true;
      continue;
    }
    if (modKey && isLast && parts.length > 1) {
      // Trailing modifier with no actual key.
      throw new Error(`parseShortcut: no key in "${str}"`);
    }
    // Treat as the key.
    out.key = lower;
  }

  if (!out.key) {
    throw new Error(`parseShortcut: no key in "${str}"`);
  }
  return out;
}

function matchEvent(parsed, event) {
  if (!parsed || !event) return false;
  const evKey = typeof event.key === "string" ? event.key.toLowerCase() : "";
  if (evKey !== parsed.key) return false;
  return (
    !!event.ctrlKey === !!parsed.ctrl &&
    !!event.shiftKey === !!parsed.shift &&
    !!event.altKey === !!parsed.alt &&
    !!event.metaKey === !!parsed.meta
  );
}

const DEFAULT_BINDINGS = [
  { id: "selectAll", shortcut: "Shift+A", description: "Select all visible PRs" },
  { id: "mergeSelected", shortcut: "Shift+M", description: "Merge selected PRs" },
  { id: "squashSelected", shortcut: "Shift+S", description: "Squash-merge selected PRs" },
  { id: "rebaseSelected", shortcut: "Shift+R", description: "Rebase-merge selected PRs" },
  { id: "clearSelection", shortcut: "Escape", description: "Clear selection" },
];

const _parseCache = new WeakMap();
function _getParsed(binding) {
  let p = _parseCache.get(binding);
  if (!p) {
    p = parseShortcut(binding.shortcut);
    _parseCache.set(binding, p);
  }
  return p;
}

function findBinding(event, bindings) {
  if (!Array.isArray(bindings) || bindings.length === 0) return null;
  for (const b of bindings) {
    let parsed;
    try {
      parsed = _getParsed(b);
    } catch (_e) {
      continue;
    }
    if (matchEvent(parsed, event)) return b.id;
  }
  return null;
}

const shortcuts = {
  parseShortcut,
  matchEvent,
  DEFAULT_BINDINGS,
  findBinding,
};

if (typeof module !== "undefined") module.exports = shortcuts;
if (typeof window !== "undefined") window.QM_SHORTCUTS = shortcuts;
