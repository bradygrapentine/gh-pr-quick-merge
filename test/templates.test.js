import { describe, it, expect, vi } from "vitest";
import templates from "../lib/templates.js";

const {
  applyTemplate,
  validateTemplate,
  saveTemplate,
  loadTemplate,
  listTemplates,
  deleteTemplate,
  DEFAULT_SQUASH_TEMPLATE,
  DEFAULT_MERGE_TEMPLATE,
} = templates;

function makeStore(initial = {}) {
  let db = { ...initial };
  return {
    get: vi.fn(async (key) => {
      return Object.prototype.hasOwnProperty.call(db, key) ? { [key]: db[key] } : {};
    }),
    set: vi.fn(async (obj) => {
      Object.assign(db, obj);
    }),
    remove: vi.fn(async (key) => {
      delete db[key];
    }),
    _db: db,
  };
}

describe("applyTemplate", () => {
  const fullCtx = {
    title: "Fix bug",
    number: 42,
    author: "octocat",
    body: "Body text",
    branch: "feature/x",
    base: "main",
    repo: "owner/repo",
  };

  it("substitutes {{title}}", () => {
    const r = applyTemplate("T: {{title}}", fullCtx);
    expect(r.text).toBe("T: Fix bug");
    expect(r.unresolved).toEqual([]);
  });

  it("substitutes {{number}} as string (coercion)", () => {
    const r = applyTemplate("#{{number}}", fullCtx);
    expect(r.text).toBe("#42");
    expect(r.unresolved).toEqual([]);
  });

  it("substitutes {{author}}", () => {
    expect(applyTemplate("@{{author}}", fullCtx).text).toBe("@octocat");
  });

  it("substitutes {{body}}", () => {
    expect(applyTemplate("{{body}}", fullCtx).text).toBe("Body text");
  });

  it("substitutes {{branch}} and {{base}}", () => {
    const r = applyTemplate("{{branch}}->{{base}}", fullCtx);
    expect(r.text).toBe("feature/x->main");
  });

  it("substitutes {{repo}}", () => {
    expect(applyTemplate("{{repo}}", fullCtx).text).toBe("owner/repo");
  });

  it("preserves unknown token literally and reports it", () => {
    const r = applyTemplate("hi {{nope}} end", fullCtx);
    expect(r.text).toBe("hi {{nope}} end");
    expect(r.unresolved).toEqual(["nope"]);
  });

  it("renders missing optional ctx as empty without flagging unresolved", () => {
    const r = applyTemplate("[{{body}}]", { title: "x" });
    expect(r.text).toBe("[]");
    expect(r.unresolved).toEqual([]);
  });

  it("performs multiple substitutions", () => {
    const r = applyTemplate("{{title}} (#{{number}}) by {{author}}", fullCtx);
    expect(r.text).toBe("Fix bug (#42) by octocat");
    expect(r.unresolved).toEqual([]);
  });

  it("passes through templates with no tokens unchanged", () => {
    const r = applyTemplate("plain text\nline 2", fullCtx);
    expect(r.text).toBe("plain text\nline 2");
    expect(r.unresolved).toEqual([]);
  });

  it("does not recursively substitute body containing literal {{ token }}", () => {
    const ctx = { ...fullCtx, body: "see {{title}} please" };
    const r = applyTemplate("{{body}}", ctx);
    expect(r.text).toBe("see {{title}} please");
    expect(r.unresolved).toEqual([]);
  });

  it("treats whitespace-padded tokens as unknown", () => {
    const r = applyTemplate("{{ title }}", fullCtx);
    expect(r.text).toBe("{{ title }}");
    // padded tokens don't match the matcher, so not in unresolved either
    expect(r.unresolved).toEqual([]);
  });
});

describe("validateTemplate", () => {
  it("empty template is valid", () => {
    const r = validateTemplate("");
    expect(r.valid).toBe(true);
    expect(r.unknown).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("single known token is valid", () => {
    const r = validateTemplate("{{title}}");
    expect(r.valid).toBe(true);
    expect(r.unknown).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("single unknown token is caught (lowercased)", () => {
    const r = validateTemplate("hello {{Foo}}");
    expect(r.valid).toBe(false);
    expect(r.unknown).toEqual(["foo"]);
  });

  it("flags unbalanced opening {{ as error", () => {
    const r = validateTemplate("oops {{title");
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("flags stray }} without opening as error", () => {
    const r = validateTemplate("oops }} here");
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("DEFAULT_SQUASH_TEMPLATE validates clean", () => {
    const r = validateTemplate(DEFAULT_SQUASH_TEMPLATE);
    expect(r.valid).toBe(true);
    expect(r.unknown).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("DEFAULT_MERGE_TEMPLATE validates clean", () => {
    const r = validateTemplate(DEFAULT_MERGE_TEMPLATE);
    expect(r.valid).toBe(true);
    expect(r.unknown).toEqual([]);
    expect(r.errors).toEqual([]);
  });
});

describe("storage helpers", () => {
  it("saveTemplate + loadTemplate roundtrip", async () => {
    const store = makeStore();
    await saveTemplate("myTpl", "{{title}} (#{{number}})", store);
    const body = await loadTemplate("myTpl", store);
    expect(body).toBe("{{title}} (#{{number}})");
  });

  it("saveTemplate validates body and rejects invalid template", async () => {
    const store = makeStore();
    await expect(saveTemplate("bad", "{{unknownToken}}", store)).rejects.toThrow();
    await expect(saveTemplate("bad2", "unclosed {{", store)).rejects.toThrow();
  });

  it("listTemplates returns {} for empty store", async () => {
    const store = makeStore();
    const map = await listTemplates(store);
    expect(map).toEqual({});
  });

  it("listTemplates returns the full map when populated", async () => {
    const store = makeStore({ qm_templates: { a: "{{title}}", b: "{{body}}" } });
    const map = await listTemplates(store);
    expect(map).toEqual({ a: "{{title}}", b: "{{body}}" });
  });

  it("deleteTemplate removes a single entry", async () => {
    const store = makeStore({ qm_templates: { a: "{{title}}", b: "{{body}}" } });
    await deleteTemplate("a", store);
    const map = await listTemplates(store);
    expect(map).toEqual({ b: "{{body}}" });
    expect(store.remove).not.toHaveBeenCalled();
  });

  it("deleteTemplate of last entry removes the qm_templates key", async () => {
    const store = makeStore({ qm_templates: { only: "{{title}}" } });
    await deleteTemplate("only", store);
    expect(store.remove).toHaveBeenCalledWith("qm_templates");
  });

  it("saveTemplate overwrites existing name", async () => {
    const store = makeStore({ qm_templates: { myTpl: "{{title}}" } });
    await saveTemplate("myTpl", "{{title}} by {{author}}", store);
    const body = await loadTemplate("myTpl", store);
    expect(body).toBe("{{title}} by {{author}}");
  });
});

describe("default templates content", () => {
  it("squash default matches spec", () => {
    expect(DEFAULT_SQUASH_TEMPLATE).toBe("{{title}} (#{{number}})\n\n{{body}}");
  });

  it("merge default matches spec", () => {
    expect(DEFAULT_MERGE_TEMPLATE).toBe(
      "Merge pull request #{{number}} from {{branch}}\n\n{{title}}",
    );
  });
});
