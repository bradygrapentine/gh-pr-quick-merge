/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// The adapter file self-registers at import time. vi.resetModules()
// drops the cache so a fresh import re-runs the IIFE; we wipe the
// globals it touches so each test starts clean.
async function loadFreshHostStack() {
  vi.resetModules();
  delete window.QM_HOSTS;
  delete window.QM_API;
  delete window.QM_GITHUB_SELECTORS;
  delete window.QM_GITHUB_ADAPTER;
  const hostsMod = await import("../lib/hosts/index.js");
  const apiMod = await import("../lib/hosts/github/api.js");
  const selectorsMod = await import("../lib/hosts/github/selectors.js");
  await import("../lib/hosts/github/adapter.js");
  return {
    hosts: hostsMod.default || window.QM_HOSTS,
    githubApi: apiMod.default || window.QM_API,
    selectors: selectorsMod.default || window.QM_GITHUB_SELECTORS,
    adapter: window.QM_GITHUB_ADAPTER,
  };
}

describe("hosts/github/adapter — QM-302", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("self-registers on load and exposes itself as window.QM_GITHUB_ADAPTER", async () => {
    const { adapter, hosts } = await loadFreshHostStack();
    expect(adapter).toBeTruthy();
    expect(hosts.getAdapter({ hostname: "github.com" })).toBe(adapter);
  });

  it("satisfies the HostAdapter shape contract", async () => {
    const { hosts, adapter } = await loadFreshHostStack();
    expect(hosts.assertHostAdapterShape(adapter)).toBe(true);
  });

  it("hostId + hostMatches mirror the REGISTRY entry", async () => {
    const { hosts, adapter } = await loadFreshHostStack();
    expect(adapter.hostId).toBe("github");
    expect(adapter.hostMatches).toEqual(hosts.REGISTRY.github.hostMatches);
  });

  it("composes selectors + api by reference (not copies)", async () => {
    const { adapter, githubApi, selectors } = await loadFreshHostStack();
    expect(adapter.api).toBe(githubApi);
    expect(adapter.findPrAnchor).toBe(selectors.findPrAnchor);
    expect(adapter.parsePrLink).toBe(selectors.parsePrLink);
    expect(adapter.ROW_SELECTOR).toBe(selectors.ROW_SELECTOR);
    expect(adapter.INJECTED_ATTR).toBe(selectors.INJECTED_ATTR);
  });

  it("getAdapter for an unsupported host returns null even when the GitHub adapter is loaded", async () => {
    const { hosts } = await loadFreshHostStack();
    expect(hosts.getAdapter({ hostname: "example.com" })).toBeNull();
    expect(hosts.getAdapter({ hostname: "gitlab.com" })).toBeNull();
  });
});
