/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from "vitest";
import api from "../lib/hosts/index.js";
import githubApi from "../lib/hosts/github/api.js";
import githubSelectors from "../lib/hosts/github/selectors.js";

const { detect, assertHostAdapterShape, REGISTRY, INTERFACE_VERSION, register, getAdapter, _resetAdaptersForTests } = api;

describe("hosts/index — detect", () => {
  it("identifies github.com as 'github'", () => {
    expect(detect({ hostname: "github.com" })).toBe("github");
    expect(detect("https://github.com/foo/bar/pulls")).toBe("github");
  });

  it("identifies gitlab.com as 'gitlab'", () => {
    expect(detect({ hostname: "gitlab.com" })).toBe("gitlab");
    expect(detect("https://gitlab.com/group/proj/-/merge_requests")).toBe("gitlab");
  });

  it("returns null for unrecognized hostnames", () => {
    expect(detect({ hostname: "example.com" })).toBeNull();
    expect(detect("https://bitbucket.org/foo/bar")).toBeNull();
  });

  it("returns null on malformed input", () => {
    expect(detect(null)).toBeNull();
    expect(detect(undefined)).toBeNull();
    expect(detect("not-a-url")).toBeNull();
    expect(detect({})).toBeNull();
  });

  it("does not partial-match (subdomains must register explicitly)", () => {
    // example: gist.github.com isn't a PR list page, so must NOT resolve.
    expect(detect({ hostname: "gist.github.com" })).toBeNull();
    expect(detect({ hostname: "raw.githubusercontent.com" })).toBeNull();
  });
});

describe("hosts/index — REGISTRY", () => {
  it("exposes a stable hostId per entry", () => {
    expect(REGISTRY.github.hostId).toBe("github");
    expect(REGISTRY.gitlab.hostId).toBe("gitlab");
  });

  it("INTERFACE_VERSION is a positive integer", () => {
    expect(typeof INTERFACE_VERSION).toBe("number");
    expect(INTERFACE_VERSION).toBeGreaterThan(0);
  });
});

describe("hosts/index — assertHostAdapterShape", () => {
  function validAdapter(overrides = {}) {
    return {
      hostId: "test",
      hostMatches: ["test.example"],
      api: { apiGet: () => {}, apiPost: () => {}, apiPut: () => {} },
      findPrAnchor: () => null,
      parsePrLink: () => null,
      ROW_SELECTOR: ".row",
      INJECTED_ATTR: "data-x",
      ...overrides,
    };
  }

  it("accepts a fully populated adapter", () => {
    expect(assertHostAdapterShape(validAdapter())).toBe(true);
  });

  it("rejects missing required keys with a descriptive error", () => {
    const a = validAdapter();
    delete a.hostId;
    expect(() => assertHostAdapterShape(a)).toThrow(/hostId/);
  });

  it("rejects empty hostMatches", () => {
    expect(() => assertHostAdapterShape(validAdapter({ hostMatches: [] }))).toThrow(/hostMatches/);
  });

  it("rejects non-function api methods", () => {
    expect(() => assertHostAdapterShape(validAdapter({ api: { apiGet: 1, apiPost: () => {}, apiPut: () => {} } })))
      .toThrow(/apiGet/);
  });

  it("rejects null candidate", () => {
    expect(() => assertHostAdapterShape(null)).toThrow(/object/);
  });
});

describe("hosts/github/api — re-exposes the same shape as lib/api.js", () => {
  it("has apiGet/apiPost/apiPut/apiDelete + GitHubApiError", () => {
    expect(typeof githubApi.apiGet).toBe("function");
    expect(typeof githubApi.apiPost).toBe("function");
    expect(typeof githubApi.apiPut).toBe("function");
    expect(typeof githubApi.apiDelete).toBe("function");
    expect(githubApi.GitHubApiError).toBeDefined();
    expect(githubApi.API_BASE).toBe("https://api.github.com");
  });
});

describe("hosts/github/selectors — extracted from content.js", () => {
  it("ROW_SELECTOR + INJECTED_ATTR are the canonical strings", () => {
    expect(githubSelectors.ROW_SELECTOR).toBe(".js-issue-row, [data-testid='issue-pr-title-link']");
    expect(githubSelectors.INJECTED_ATTR).toBe("data-qm-injected");
  });

  it("findPrAnchor finds the data-hovercard variant first", () => {
    const row = document.createElement("div");
    row.innerHTML = `
      <a href="/foo/bar/pull/9">Plain</a>
      <a id="issue_5" href="/foo/bar/pull/5">Legacy</a>
      <a data-hovercard-type="pull_request" href="/foo/bar/pull/1">Modern</a>
    `;
    const a = githubSelectors.findPrAnchor(row);
    expect(a.getAttribute("href")).toBe("/foo/bar/pull/1");
  });

  it("findPrAnchor falls through to legacy id selector", () => {
    const row = document.createElement("div");
    row.innerHTML = `<a id="issue_5" href="/foo/bar/pull/5">x</a>`;
    expect(githubSelectors.findPrAnchor(row).id).toBe("issue_5");
  });

  it("findPrAnchor returns null when nothing matches", () => {
    const row = document.createElement("div");
    row.innerHTML = `<a href="/foo/bar/issues/3">issue not pr</a>`;
    expect(githubSelectors.findPrAnchor(row)).toBeNull();
  });

  it("findPrAnchor handles a null row safely", () => {
    expect(githubSelectors.findPrAnchor(null)).toBeNull();
  });

  it("parsePrLink delegates through QM_HELPERS", async () => {
    // Load the helpers module so window.QM_HELPERS is populated.
    await import("../lib/pr-helpers.js");
    const a = document.createElement("a");
    a.setAttribute("href", "/octocat/hello-world/pull/42");
    const out = githubSelectors.parsePrLink(a);
    expect(out).toEqual({ owner: "octocat", repo: "hello-world", num: 42 });
  });
});

describe("hosts/github/selectors — isPullRequestPage (QM-400)", () => {
  // Truth table covers: list pages (false), PR pages with sub-tabs
  // (true), issue pages (false), profile / dashboard pages (false),
  // and edge cases (numeric repo names, empty path, query strings).
  it.each([
    // [pathname, expected, description]
    ["/octocat/hello-world/pull/1", true, "canonical PR url"],
    ["/octocat/hello-world/pull/42", true, "multi-digit PR number"],
    ["/octocat/hello-world/pull/1/files", true, "PR files sub-tab"],
    ["/octocat/hello-world/pull/1/commits", true, "PR commits sub-tab"],
    ["/octocat/hello-world/pull/1/checks", true, "PR checks sub-tab"],
    ["/123-org/456-repo/pull/7", true, "numeric-prefixed owner / repo"],
    ["/pulls", false, "global PR list"],
    ["/octocat/hello-world/pulls", false, "repo PR list"],
    ["/octocat/hello-world/issues/1", false, "issue page"],
    ["/octocat/hello-world/pull", false, "missing PR number"],
    ["/octocat/hello-world/pull/", false, "trailing slash, no number"],
    ["/octocat/hello-world/pull/abc", false, "non-numeric PR id"],
    ["/octocat", false, "user profile"],
    ["/", false, "root"],
    ["", false, "empty path"],
  ])("isPullRequestPage(%j) -> %s (%s)", (path, expected) => {
    expect(githubSelectors.isPullRequestPage(path)).toBe(expected);
  });

  it("falls back to location.pathname when called with no arg", () => {
    const original = window.location.pathname;
    // happy-dom allows direct assignment to location.pathname.
    window.history.replaceState({}, "", "/octocat/hello-world/pull/9");
    try {
      expect(githubSelectors.isPullRequestPage()).toBe(true);
    } finally {
      window.history.replaceState({}, "", original);
    }
  });
});

describe("hosts/github/selectors — hasNativeUpdateBranchControl", () => {
  it("returns false on a page with no native control", () => {
    const root = document.createElement("div");
    root.innerHTML = '<button>Other</button>';
    expect(githubSelectors.hasNativeUpdateBranchControl(root)).toBe(false);
  });
  it("matches the React data-attribute variant", () => {
    const root = document.createElement("div");
    root.innerHTML = '<button data-update-branch-pr>Update branch</button>';
    expect(githubSelectors.hasNativeUpdateBranchControl(root)).toBe(true);
  });
  it("matches the legacy form action", () => {
    const root = document.createElement("div");
    root.innerHTML = '<form action="/octocat/hello-world/update_branch"></form>';
    expect(githubSelectors.hasNativeUpdateBranchControl(root)).toBe(true);
  });
  it("matches the legacy js-update-branch button class", () => {
    const root = document.createElement("div");
    root.innerHTML = '<button class="js-update-branch">Update</button>';
    expect(githubSelectors.hasNativeUpdateBranchControl(root)).toBe(true);
  });
  it("returns false on a non-element argument", () => {
    expect(githubSelectors.hasNativeUpdateBranchControl(null)).toBe(false);
    expect(githubSelectors.hasNativeUpdateBranchControl({})).toBe(false);
  });
});

describe("hosts/index — register + getAdapter (QM-302)", () => {
  function validAdapter(overrides = {}) {
    return {
      hostId: "github",
      hostMatches: ["github.com"],
      api: { apiGet: () => {}, apiPost: () => {}, apiPut: () => {} },
      findPrAnchor: () => null,
      parsePrLink: () => null,
      ROW_SELECTOR: ".js-issue-row",
      INJECTED_ATTR: "data-qm-injected",
      ...overrides,
    };
  }

  it("register returns the adapter when shape is valid", () => {
    _resetAdaptersForTests();
    const a = validAdapter();
    expect(register(a)).toBe(a);
  });

  it("register rejects an unknown hostId", () => {
    _resetAdaptersForTests();
    expect(() => register(validAdapter({ hostId: "bitbucket", hostMatches: ["bitbucket.org"] })))
      .toThrow(/unknown hostId/);
  });

  it("register propagates assertHostAdapterShape errors", () => {
    _resetAdaptersForTests();
    expect(() => register({ hostId: "github" })).toThrow(/missing key/);
  });

  it("getAdapter returns the registered adapter for a matching URL", () => {
    _resetAdaptersForTests();
    const a = validAdapter();
    register(a);
    expect(getAdapter({ hostname: "github.com" })).toBe(a);
    expect(getAdapter("https://github.com/foo/bar/pulls")).toBe(a);
  });

  it("getAdapter returns null when no adapter is registered for the host", () => {
    _resetAdaptersForTests();
    register(validAdapter());
    expect(getAdapter({ hostname: "gitlab.com" })).toBeNull();
  });

  it("getAdapter returns null when input doesn't match any host", () => {
    _resetAdaptersForTests();
    register(validAdapter());
    expect(getAdapter({ hostname: "example.com" })).toBeNull();
    expect(getAdapter("not-a-url")).toBeNull();
  });
});
