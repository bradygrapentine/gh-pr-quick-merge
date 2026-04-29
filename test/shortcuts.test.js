import { describe, it, expect } from "vitest";
import shortcuts from "../lib/shortcuts.js";

const { parseShortcut, matchEvent, DEFAULT_BINDINGS, findBinding } = shortcuts;

describe("parseShortcut", () => {
  it("parses a basic single key", () => {
    expect(parseShortcut("s")).toEqual({
      key: "s",
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
    });
  });

  it("parses a single modifier + key", () => {
    expect(parseShortcut("Shift+A")).toEqual({
      key: "a",
      ctrl: false,
      shift: true,
      alt: false,
      meta: false,
    });
  });

  it("parses multiple modifiers", () => {
    expect(parseShortcut("Ctrl+Shift+S")).toEqual({
      key: "s",
      ctrl: true,
      shift: true,
      alt: false,
      meta: false,
    });
  });

  it("aliases Cmd to meta", () => {
    expect(parseShortcut("Cmd+K").meta).toBe(true);
    expect(parseShortcut("Command+K").meta).toBe(true);
    expect(parseShortcut("Meta+K").meta).toBe(true);
  });

  it("aliases Control to ctrl", () => {
    expect(parseShortcut("Control+P").ctrl).toBe(true);
  });

  it("aliases Option to alt", () => {
    expect(parseShortcut("Option+X").alt).toBe(true);
    expect(parseShortcut("Alt+X").alt).toBe(true);
  });

  it("lowercases the key", () => {
    expect(parseShortcut("Shift+A").key).toBe("a");
    expect(parseShortcut("S").key).toBe("s");
  });

  it("throws if only modifiers are given", () => {
    expect(() => parseShortcut("Ctrl+Shift")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => parseShortcut("")).toThrow();
  });

  it("throws on trailing plus (empty key segment)", () => {
    expect(() => parseShortcut("Ctrl+")).toThrow();
  });
});

describe("matchEvent", () => {
  it("returns true on exact match", () => {
    const parsed = parseShortcut("Shift+A");
    const ev = { key: "A", ctrlKey: false, shiftKey: true, altKey: false, metaKey: false };
    expect(matchEvent(parsed, ev)).toBe(true);
  });

  it("returns false when extra modifier is held (exact, not subset)", () => {
    const parsed = parseShortcut("Shift+A");
    const ev = { key: "A", ctrlKey: true, shiftKey: true, altKey: false, metaKey: false };
    expect(matchEvent(parsed, ev)).toBe(false);
  });

  it("returns false on key mismatch", () => {
    const parsed = parseShortcut("Shift+A");
    const ev = { key: "B", ctrlKey: false, shiftKey: true, altKey: false, metaKey: false };
    expect(matchEvent(parsed, ev)).toBe(false);
  });

  it("matches case-insensitively on event.key", () => {
    const parsed = parseShortcut("s");
    const ev = { key: "S", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
    expect(matchEvent(parsed, ev)).toBe(true);
  });

  it("returns false when modifier is required but absent", () => {
    const parsed = parseShortcut("Ctrl+S");
    const ev = { key: "s", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
    expect(matchEvent(parsed, ev)).toBe(false);
  });
});

describe("DEFAULT_BINDINGS", () => {
  it("is an array of binding shapes", () => {
    expect(Array.isArray(DEFAULT_BINDINGS)).toBe(true);
    for (const b of DEFAULT_BINDINGS) {
      expect(typeof b.id).toBe("string");
      expect(typeof b.shortcut).toBe("string");
      expect(typeof b.description).toBe("string");
    }
  });

  it("contains all 5 expected ids", () => {
    const ids = DEFAULT_BINDINGS.map((b) => b.id).sort();
    expect(ids).toEqual(
      ["clearSelection", "mergeSelected", "rebaseSelected", "selectAll", "squashSelected"].sort()
    );
  });

  it("all default shortcuts parse without throwing", () => {
    for (const b of DEFAULT_BINDINGS) {
      expect(() => parseShortcut(b.shortcut)).not.toThrow();
    }
  });
});

describe("findBinding", () => {
  it("finds the matching binding id", () => {
    const ev = { key: "A", ctrlKey: false, shiftKey: true, altKey: false, metaKey: false };
    expect(findBinding(ev, DEFAULT_BINDINGS)).toBe("selectAll");
  });

  it("returns null when no binding matches", () => {
    const ev = { key: "z", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
    expect(findBinding(ev, DEFAULT_BINDINGS)).toBe(null);
  });

  it("returns null on empty bindings array", () => {
    const ev = { key: "a", ctrlKey: false, shiftKey: true, altKey: false, metaKey: false };
    expect(findBinding(ev, [])).toBe(null);
  });
});
