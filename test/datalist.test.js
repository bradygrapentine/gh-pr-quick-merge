import { describe, it, expect } from "vitest";
import datalist from "../lib/datalist.js";

const { populateDatalist } = datalist;

// Minimal DOM stub — the helper only uses createElement on ownerDocument
// and appendChild/firstChild/removeChild on the passed element.
function makeNode(tag = "datalist") {
  const children = [];
  const node = {
    tagName: tag.toUpperCase(),
    children,
    get firstChild() {
      return children[0] || null;
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    removeChild(child) {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      return child;
    },
  };
  node.ownerDocument = {
    createElement: (t) => ({ tagName: t.toUpperCase(), value: "" }),
  };
  return node;
}

describe("populateDatalist", () => {
  it("creates one <option> per value", () => {
    const node = makeNode();
    populateDatalist(node, ["octo/alpha", "octo/beta", "octo/gamma"]);
    expect(node.children).toHaveLength(3);
    expect(node.children.map((c) => c.value)).toEqual([
      "octo/alpha",
      "octo/beta",
      "octo/gamma",
    ]);
  });

  it("clears existing children before populating", () => {
    const node = makeNode();
    populateDatalist(node, ["a"]);
    populateDatalist(node, ["x", "y"]);
    expect(node.children).toHaveLength(2);
    expect(node.children.map((c) => c.value)).toEqual(["x", "y"]);
  });

  it("empty array clears the node", () => {
    const node = makeNode();
    populateDatalist(node, ["a", "b"]);
    populateDatalist(node, []);
    expect(node.children).toHaveLength(0);
  });

  it("ignores null/undefined/non-string entries", () => {
    const node = makeNode();
    populateDatalist(node, ["valid", null, undefined, 42, "", "another"]);
    expect(node.children.map((c) => c.value)).toEqual(["valid", "another"]);
  });

  it("returns silently when node is null/undefined", () => {
    expect(() => populateDatalist(null, ["x"])).not.toThrow();
    expect(() => populateDatalist(undefined, ["x"])).not.toThrow();
  });

  it("does not replace the datalist node itself", () => {
    const node = makeNode();
    const ref = node;
    populateDatalist(node, ["a", "b"]);
    expect(node).toBe(ref);
  });
});
