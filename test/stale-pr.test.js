import { describe, it, expect } from "vitest";
import helpers from "../lib/stale-pr.js";

const { classifyStaleness, DEFAULT_THRESHOLDS, formatStaleLabel, getStaleBucket } =
  helpers;

const DAY = 86_400_000;
const NOW = new Date("2026-04-29T12:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY);

describe("DEFAULT_THRESHOLDS", () => {
  it("exposes the documented defaults", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      warmingDays: 7,
      staleDays: 14,
      abandonedDays: 30,
    });
  });
});

describe("classifyStaleness", () => {
  it("1. brand-new PR (0 days) => fresh", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(0), draft: false, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("fresh");
  });

  it("2. 6 days old => fresh (under warmingDays=7)", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(6), draft: false, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("fresh");
  });

  it("3. 7 days old => warming (inclusive lower bound)", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(7), draft: false, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("warming");
  });

  it("4. 13 days old => warming", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(13), draft: false, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("warming");
  });

  it("5. 14 days old => stale", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(14), draft: false, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("stale");
  });

  it("6. 29 days old => stale", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(29), draft: false, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("stale");
  });

  it("7. 30 days old => abandoned", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(30), draft: false, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("abandoned");
  });

  it("8. 100 days old => abandoned", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(100), draft: false, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("abandoned");
  });

  it("9. draft PR at 30 days => warming (cap applies)", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(30), draft: true, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("warming");
  });

  it("10. draft PR at 5 days => fresh (cap doesn't downgrade)", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(5), draft: true, hasReviewerRequested: true },
        undefined,
        NOW
      )
    ).toBe("fresh");
  });

  it("11. no reviewer + 14 days => bumped to abandoned", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(14), draft: false, hasReviewerRequested: false },
        undefined,
        NOW
      )
    ).toBe("abandoned");
  });

  it("12. no reviewer + 7 days => stays warming (no bump below stale)", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(7), draft: false, hasReviewerRequested: false },
        undefined,
        NOW
      )
    ).toBe("warming");
  });

  it("13. custom thresholds: staleDays=3 marks 3-day-old PR as stale", () => {
    expect(
      classifyStaleness(
        { updatedAt: daysAgo(3), draft: false, hasReviewerRequested: true },
        { warmingDays: 1, staleDays: 3, abandonedDays: 10 },
        NOW
      )
    ).toBe("stale");
  });

  it("16. now-injection: same updatedAt + later now changes classification", () => {
    const updatedAt = new Date("2026-04-01T12:00:00Z");
    const earlyNow = new Date("2026-04-04T12:00:00Z"); // 3 days
    const lateNow = new Date("2026-05-05T12:00:00Z"); // 34 days
    expect(
      classifyStaleness(
        { updatedAt, draft: false, hasReviewerRequested: true },
        undefined,
        earlyNow
      )
    ).toBe("fresh");
    expect(
      classifyStaleness(
        { updatedAt, draft: false, hasReviewerRequested: true },
        undefined,
        lateNow
      )
    ).toBe("abandoned");
  });

  it("accepts updatedAt as ISO string", () => {
    expect(
      classifyStaleness(
        {
          updatedAt: daysAgo(14).toISOString(),
          draft: false,
          hasReviewerRequested: true,
        },
        undefined,
        NOW
      )
    ).toBe("stale");
  });
});

describe("getStaleBucket", () => {
  it("buckets purely by day-delta without draft/reviewer logic", () => {
    expect(getStaleBucket(daysAgo(0), NOW, DEFAULT_THRESHOLDS)).toBe("fresh");
    expect(getStaleBucket(daysAgo(7), NOW, DEFAULT_THRESHOLDS)).toBe("warming");
    expect(getStaleBucket(daysAgo(14), NOW, DEFAULT_THRESHOLDS)).toBe("stale");
    expect(getStaleBucket(daysAgo(30), NOW, DEFAULT_THRESHOLDS)).toBe(
      "abandoned"
    );
  });

  it("respects custom thresholds", () => {
    expect(
      getStaleBucket(daysAgo(3), NOW, {
        warmingDays: 1,
        staleDays: 3,
        abandonedDays: 10,
      })
    ).toBe("stale");
  });
});

describe("formatStaleLabel", () => {
  it("14. fresh => returns label + kind shape", () => {
    const out = formatStaleLabel("fresh");
    expect(out).toHaveProperty("label");
    expect(out).toHaveProperty("kind");
    expect(typeof out.label).toBe("string");
    expect(typeof out.kind).toBe("string");
  });

  it("15. returns the same shape for all four classifications", () => {
    for (const c of ["fresh", "warming", "stale", "abandoned"]) {
      const out = formatStaleLabel(c);
      expect(out).toHaveProperty("label");
      expect(out).toHaveProperty("kind");
      expect(typeof out.label).toBe("string");
      expect(typeof out.kind).toBe("string");
      expect(out.label.length).toBeGreaterThan(0);
      expect(out.kind.length).toBeGreaterThan(0);
    }
  });

  it("stale label mentions a day threshold", () => {
    expect(formatStaleLabel("stale").label).toMatch(/14/);
  });

  it("abandoned label mentions its threshold", () => {
    expect(formatStaleLabel("abandoned").label).toMatch(/30/);
  });
});
