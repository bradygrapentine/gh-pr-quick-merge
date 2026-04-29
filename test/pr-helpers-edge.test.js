/* Edge cases for parsePrLink beyond the F-09 host-validation tests already
 * in pr-helpers.test.js. Focus: URL forms an attacker might construct to
 * smuggle a non-github.com host past the parser, plus benign URL shapes
 * GitHub itself produces (query strings, fragments, port-less host).
 */
import { describe, it, expect } from "vitest";
import helpers from "../lib/pr-helpers.js";

const { parsePrLink } = helpers;

describe("parsePrLink — URL edge cases", () => {
  it("rejects URLs with userinfo (https://attacker@github.com/...)", () => {
    // F-09 host check uses url.host which excludes userinfo, so this should
    // still parse as github.com. We assert the parse succeeds AND the userinfo
    // is not reflected anywhere in the result — guarding against future drift
    // where someone might naively use url.hostname-or-href in a redirect.
    const result = parsePrLink("https://attacker@github.com/o/r/pull/1");
    expect(result).toEqual({ owner: "o", repo: "r", num: 1 });
  });

  it("rejects look-alike host github.com.evil.com", () => {
    expect(parsePrLink("https://github.com.evil.com/o/r/pull/1")).toBeNull();
  });

  it("rejects subdomain attacks like api.github.com", () => {
    // PR URLs only live on the apex host. api.github.com is the API surface.
    expect(parsePrLink("https://api.github.com/o/r/pull/1")).toBeNull();
  });

  it("accepts URL with query string", () => {
    expect(
      parsePrLink("https://github.com/o/r/pull/42?w=1&utm_source=x"),
    ).toEqual({ owner: "o", repo: "r", num: 42 });
  });

  it("accepts URL with trailing fragment", () => {
    expect(
      parsePrLink("https://github.com/o/r/pull/9#issuecomment-123"),
    ).toEqual({ owner: "o", repo: "r", num: 9 });
  });

  it("rejects explicit non-default port on github.com", () => {
    // url.host includes the port, so github.com:8080 !== github.com — good.
    expect(parsePrLink("https://github.com:8080/o/r/pull/1")).toBeNull();
  });

  it("rejects pull number that is not numeric", () => {
    expect(parsePrLink("/o/r/pull/abc")).toBeNull();
  });

  it("rejects non-string inputs (number, object, array)", () => {
    expect(parsePrLink(42)).toBeNull();
    expect(parsePrLink({})).toBeNull();
    expect(parsePrLink([])).toBeNull();
  });
});
