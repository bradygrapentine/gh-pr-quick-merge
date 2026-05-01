/* hosts/github/adapter.js — GitHub HostAdapter (QM-302).
 *
 * Composes the existing per-concern modules (api, selectors) into the
 * single HostAdapter object the content script consumes via
 * window.QM_HOSTS.getAdapter(). Self-registers at load time.
 *
 * Loaded via manifest content_scripts AFTER lib/hosts/index.js,
 * lib/hosts/github/api.js, and lib/hosts/github/selectors.js — see
 * manifest.json for the order.
 */

(function attach(scope) {
  if (!scope) return;
  const hosts = scope.QM_HOSTS;
  const githubApi = scope.QM_API;
  const selectors = scope.QM_GITHUB_SELECTORS;

  if (!hosts || !githubApi || !selectors) {
    // One of the dependencies didn't load. Surface loudly in dev; in
    // production this means the manifest order is wrong.
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[QM] hosts/github/adapter.js: missing dependency",
        { hosts: !!hosts, githubApi: !!githubApi, selectors: !!selectors },
      );
    }
    return;
  }

  const adapter = {
    hostId: hosts.REGISTRY.github.hostId,
    hostMatches: hosts.REGISTRY.github.hostMatches,
    api: githubApi,
    findPrAnchor: selectors.findPrAnchor,
    parsePrLink: selectors.parsePrLink,
    ROW_SELECTOR: selectors.ROW_SELECTOR,
    INJECTED_ATTR: selectors.INJECTED_ATTR,
  };

  hosts.register(adapter);

  // Expose the constructed adapter on its own global so non-content
  // contexts (background SW, tests) can grab it without re-detecting.
  scope.QM_GITHUB_ADAPTER = adapter;

  if (typeof module !== "undefined" && module.exports) module.exports = adapter;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
