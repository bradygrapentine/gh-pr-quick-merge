/* Stale-PR classification — pure module.
 * No DOM, no network. Inject `now` for deterministic tests.
 * See plans/stale-pr-module.md for the spec.
 */

const DAY_MS = 86_400_000;

const DEFAULT_THRESHOLDS = Object.freeze({
  warmingDays: 7,
  staleDays: 14,
  abandonedDays: 30,
});

const ORDER = ["fresh", "warming", "stale", "abandoned"];

function toMs(d) {
  if (d instanceof Date) return d.getTime();
  if (typeof d === "number") return d;
  if (typeof d === "string") {
    const t = Date.parse(d);
    return Number.isNaN(t) ? NaN : t;
  }
  return NaN;
}

function getStaleBucket(updatedAt, now, thresholds) {
  const t = thresholds || DEFAULT_THRESHOLDS;
  const nowMs = toMs(now);
  const updMs = toMs(updatedAt);
  const days = Math.floor((nowMs - updMs) / DAY_MS);
  if (days >= t.abandonedDays) return "abandoned";
  if (days >= t.staleDays) return "stale";
  if (days >= t.warmingDays) return "warming";
  return "fresh";
}

function bumpOne(bucket) {
  const i = ORDER.indexOf(bucket);
  if (i < 0 || i >= ORDER.length - 1) return bucket;
  return ORDER[i + 1];
}

function capAt(bucket, ceiling) {
  const i = ORDER.indexOf(bucket);
  const c = ORDER.indexOf(ceiling);
  if (i < 0 || c < 0) return bucket;
  return i > c ? ceiling : bucket;
}

function classifyStaleness(
  { updatedAt, draft = false, hasReviewerRequested = true } = {},
  options,
  now
) {
  const thresholds = options || DEFAULT_THRESHOLDS;
  const effectiveNow = now || new Date();
  let bucket = getStaleBucket(updatedAt, effectiveNow, thresholds);

  // No-reviewer bump: if past stale threshold, bump one toward abandoned.
  if (
    hasReviewerRequested === false &&
    (bucket === "stale" || bucket === "abandoned")
  ) {
    bucket = bumpOne(bucket);
  }

  // Draft cap: drafts can't go past warming.
  if (draft === true) {
    bucket = capAt(bucket, "warming");
  }

  return bucket;
}

const LABELS = {
  fresh: { label: "Fresh", kind: "info" },
  warming: { label: "Warming (7d+)", kind: "info" },
  stale: { label: "Stale (14d+)", kind: "warn" },
  abandoned: { label: "Abandoned (30d+)", kind: "danger" },
};

function formatStaleLabel(classification) {
  return LABELS[classification] || { label: "Unknown", kind: "info" };
}

const helpers = {
  classifyStaleness,
  DEFAULT_THRESHOLDS,
  formatStaleLabel,
  getStaleBucket,
};

if (typeof module !== "undefined") module.exports = helpers;
if (typeof window !== "undefined") window.QM_STALE_PR = helpers;
