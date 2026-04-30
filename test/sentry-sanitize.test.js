import { describe, it, expect } from "vitest";
import sanitize from "../lib/sentry-sanitize.js";

describe("sentry-sanitize.redactString", () => {
  it("redacts a classic GitHub PAT", () => {
    expect(sanitize.redactString("token=ghp_abc123def456ghi789jkl012mno345pqr678stu")).toContain("[redacted]");
  });
  it("redacts an OAuth user-to-server token", () => {
    expect(sanitize.redactString("ghu_abc123def456ghi789jkl012mno345pqr678stu xyz")).toContain("[redacted]");
  });
  it("redacts a Bearer header value", () => {
    expect(sanitize.redactString("Authorization: Bearer abcdefghij1234567890zzzz"))
      .toBe("Authorization: [redacted]");
  });
  it("redacts client_secret query param", () => {
    expect(sanitize.redactString("/oauth?code=x&client_secret=topsecret123"))
      .toContain("[redacted]");
  });
  it("leaves non-sensitive strings untouched", () => {
    expect(sanitize.redactString("hello world")).toBe("hello world");
  });
  it("returns non-strings unchanged", () => {
    expect(sanitize.redactString(42)).toBe(42);
    expect(sanitize.redactString(null)).toBe(null);
  });
});

describe("sentry-sanitize.redactGithubUrl", () => {
  it("redacts a github.com URL", () => {
    expect(sanitize.redactGithubUrl("https://github.com/foo/bar")).toBe("[github-url-redacted]");
  });
  it("redacts an api.github.com URL", () => {
    expect(sanitize.redactGithubUrl("https://api.github.com/repos/x/y/pulls/1")).toBe("[github-url-redacted]");
  });
  it("preserves unrelated URLs", () => {
    expect(sanitize.redactGithubUrl("https://example.com/page")).toBe("https://example.com/page");
  });
});

describe("sentry-sanitize.beforeSend", () => {
  it("passes null through", () => {
    expect(sanitize.beforeSend(null)).toBeNull();
  });

  it("redacts tokens in event.message", () => {
    const ev = { message: "merge failed Bearer abcdefghij1234567890zzz" };
    expect(sanitize.beforeSend(ev).message).toBe("merge failed [redacted]");
  });

  it("scrubs Authorization from request headers", () => {
    const ev = {
      request: { headers: { Authorization: "Bearer secret", "User-Agent": "qm/1.0" }, url: "https://github.com/x/y" },
    };
    const out = sanitize.beforeSend(ev);
    expect(out.request.headers.Authorization).toBe("[redacted]");
    expect(out.request.headers["User-Agent"]).toBe("qm/1.0");
    expect(out.request.url).toBe("[github-url-redacted]");
  });

  it("strips cookies from request", () => {
    const ev = { request: { cookies: { logged_in: "yes" } } };
    expect(sanitize.beforeSend(ev).request.cookies).toBeUndefined();
  });

  it("redacts tokens in exception values + stack frame filenames", () => {
    const ev = {
      exception: {
        values: [
          {
            value: "GitHub API 401 with token ghp_abc123def456ghi789jkl012mno345pqr678stu",
            stacktrace: {
              frames: [{ filename: "https://github.com/owner/repo/blob/main/src/x.js" }],
            },
          },
        ],
      },
    };
    const out = sanitize.beforeSend(ev);
    expect(out.exception.values[0].value).toContain("[redacted]");
    expect(out.exception.values[0].stacktrace.frames[0].filename).toBe("[github-url-redacted]");
  });

  it("scrubs sensitive keys from contexts and extra", () => {
    const ev = {
      contexts: { auth: { token: "ghp_xxx" }, runtime: { name: "Chrome" } },
      extra: { secret: "hunter2", strategy: "squash" },
      tags: { api_key: "abc", env: "prod" },
    };
    const out = sanitize.beforeSend(ev);
    expect(out.contexts.auth).toBe("[redacted]");
    expect(out.contexts.runtime.name).toBe("Chrome");
    expect(out.extra.secret).toBe("[redacted]");
    expect(out.extra.strategy).toBe("squash");
    expect(out.tags.api_key).toBe("[redacted]");
    expect(out.tags.env).toBe("prod");
  });

  it("sanitizes breadcrumbs in event", () => {
    const ev = {
      breadcrumbs: [
        { category: "navigation", data: { from: "https://github.com/a", to: "https://example.com/b" } },
        { category: "fetch", message: "GET ghp_abc123def456ghi789jkl012mno345pqr678stu", data: { url: "https://api.github.com/zen" } },
      ],
    };
    const out = sanitize.beforeSend(ev);
    expect(out.breadcrumbs[0].data.from).toBe("[github-url-redacted]");
    expect(out.breadcrumbs[0].data.to).toBe("https://example.com/b");
    expect(out.breadcrumbs[1].message).toContain("[redacted]");
    expect(out.breadcrumbs[1].data.url).toBe("[github-url-redacted]");
  });
});

describe("sentry-sanitize.beforeBreadcrumb", () => {
  it("passes null through", () => {
    expect(sanitize.beforeBreadcrumb(null)).toBeNull();
  });
  it("redacts a navigation breadcrumb URL", () => {
    const out = sanitize.beforeBreadcrumb({
      category: "navigation",
      data: { from: "https://github.com/a", to: "https://github.com/b" },
    });
    expect(out.data.from).toBe("[github-url-redacted]");
    expect(out.data.to).toBe("[github-url-redacted]");
  });
});
