/* Pure helpers extracted for unit testing.
 * Mirrors logic in content.js but accepts plain strings/objects (no DOM).
 */

const PR_HREF_RE = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

function parsePrLink(href) {
  if (!href || typeof href !== "string") return null;
  let url;
  try {
    // Accept both absolute URLs and root-relative paths.
    url = new URL(href, "https://github.com");
  } catch (_e) {
    return null;
  }
  // F-09: only github.com, only https. Protocol-relative URLs like
  // `//evil.com/owner/repo/pull/1` resolve to host=evil.com and must not
  // be parsed as legitimate PR links.
  if (url.host !== "github.com" || url.protocol !== "https:") return null;
  const m = url.pathname.match(PR_HREF_RE);
  if (!m) return null;
  return { owner: m[1], repo: m[2], num: Number(m[3]) };
}

function classifyMergeState({ mergeable, mergeable_state } = {}) {
  const blocked =
    mergeable === false ||
    mergeable_state === "dirty" ||
    mergeable_state === "blocked";
  const ready =
    mergeable === true &&
    (mergeable_state === "clean" ||
      mergeable_state === "unstable" ||
      mergeable_state === "has_hooks");
  if (ready) return "ready";
  if (blocked) return "blocked";
  return "pending";
}

function mergeMethodFromKind(kind) {
  return kind === "squash" ? "squash" : kind === "rebase" ? "rebase" : "merge";
}

const helpers = {
  parsePrLink,
  classifyMergeState,
  mergeMethodFromKind,
  PR_HREF_RE,
};

if (typeof module !== "undefined") module.exports = helpers;
if (typeof window !== "undefined") window.QM_HELPERS = helpers;
