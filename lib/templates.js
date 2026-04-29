/* Merge-commit template module.
 * Mustache-style placeholder substitution for PR merge messages.
 * Pure module — no DOM access.
 */

const KNOWN_TOKENS = [
  "title",
  "number",
  "author",
  "body",
  "branch",
  "base",
  "repo",
];

const TOKEN_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

const DEFAULT_SQUASH_TEMPLATE = "{{title}} (#{{number}})\n\n{{body}}";
const DEFAULT_MERGE_TEMPLATE =
  "Merge pull request #{{number}} from {{branch}}\n\n{{title}}";

function applyTemplate(template, ctx) {
  const safeCtx = ctx || {};
  const unresolved = [];
  const text = String(template == null ? "" : template).replace(
    TOKEN_RE,
    (match, name) => {
      if (KNOWN_TOKENS.indexOf(name) !== -1) {
        const v = safeCtx[name];
        if (v === undefined || v === null) return "";
        return String(v);
      }
      if (unresolved.indexOf(name) === -1) unresolved.push(name);
      return match;
    },
  );
  return { text, unresolved };
}

function validateTemplate(template) {
  const errors = [];
  const unknown = [];
  const src = String(template == null ? "" : template);

  // Strip valid tokens first, then check leftover braces for imbalance.
  const stripped = src.replace(TOKEN_RE, (m, name) => {
    if (KNOWN_TOKENS.indexOf(name) === -1) {
      const lower = name.toLowerCase();
      if (unknown.indexOf(lower) === -1) unknown.push(lower);
    }
    return "";
  });

  // Any leftover {{ or }} (with anything between or not) is malformed.
  if (stripped.indexOf("{{") !== -1) {
    errors.push("Unbalanced opening '{{' without matching '}}'");
  }
  if (stripped.indexOf("}}") !== -1) {
    errors.push("Stray '}}' without matching opening '{{'");
  }

  const valid = errors.length === 0 && unknown.length === 0;
  return { valid, unknown, errors };
}

async function saveTemplate(name, body, store) {
  const result = validateTemplate(body);
  if (!result.valid) {
    throw new Error(
      "Invalid template: " +
        [...result.errors, ...result.unknown.map((u) => "unknown token: " + u)].join("; "),
    );
  }
  const data = await store.get("qm_templates");
  const map = (data && data.qm_templates) || {};
  map[name] = body;
  await store.set({ qm_templates: map });
}

async function loadTemplate(name, store) {
  const data = await store.get("qm_templates");
  const map = (data && data.qm_templates) || {};
  return Object.prototype.hasOwnProperty.call(map, name) ? map[name] : null;
}

async function listTemplates(store) {
  const data = await store.get("qm_templates");
  return (data && data.qm_templates) || {};
}

async function deleteTemplate(name, store) {
  const data = await store.get("qm_templates");
  const map = (data && data.qm_templates) || {};
  delete map[name];
  if (Object.keys(map).length === 0) {
    await store.remove("qm_templates");
  } else {
    await store.set({ qm_templates: map });
  }
}

const templates = {
  applyTemplate,
  validateTemplate,
  saveTemplate,
  loadTemplate,
  listTemplates,
  deleteTemplate,
  DEFAULT_SQUASH_TEMPLATE,
  DEFAULT_MERGE_TEMPLATE,
};

if (typeof module !== "undefined") module.exports = templates;
if (typeof window !== "undefined") window.QM_TEMPLATES = templates;
