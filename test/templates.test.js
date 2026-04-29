import { describe, it, expect } from "vitest";
import templates from "../lib/templates.js";

const {
  applyTemplate,
  validateTemplate,
  DEFAULT_SQUASH_TEMPLATE,
  DEFAULT_MERGE_TEMPLATE,
} = templates;

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
