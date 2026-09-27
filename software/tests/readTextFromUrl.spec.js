/** Tests for _readTextFromURL — fetch success, HTTP failure, rate limit, and URL validation. */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, setSandboxGlobal } from "./setup.js";

const _readTextFromURL = getIndexFunction("_readTextFromURL");

/**
 * Builds a minimal fetch Response stand-in.
 * @param {number} status - HTTP status code
 * @param {string} body - Response body text
 * @param {Object<string,string>} [headers] - Response headers
 * @returns {object} Response-like object
 */
function fakeResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
  };
}

describe("_readTextFromURL", () => {
  beforeEach(() => {
    // The vm sandbox exposes neither fetch nor AbortSignal; provide both so the fetch branch runs.
    setSandboxGlobal("AbortSignal", AbortSignal);
    setSandboxGlobal("fetch", undefined);
  });

  it("rejects a non-http target", async () => {
    await expect(_readTextFromURL("ftp://example.test/x")).rejects.toThrow("Invalid URL: ftp://example.test/x");
  });

  it("returns the trimmed body on HTTP 200", async () => {
    setSandboxGlobal("fetch", async () => fakeResponse(200, "  hello world \n"));
    expect(await _readTextFromURL("https://example.test/ok-200")).toBe("hello world");
  });

  it("returns an empty string on HTTP 404", async () => {
    let calledUrl = "";
    setSandboxGlobal("fetch", async (url) => {
      calledUrl = url;
      return fakeResponse(404, "not found");
    });
    expect(await _readTextFromURL("https://example.test/missing-404")).toBe("");
    expect(calledUrl).toBe("https://example.test/missing-404");
  });

  it("returns an empty string when the GitHub API rate limit is exhausted", async () => {
    setSandboxGlobal("fetch", async () => fakeResponse(403, "rate limited", { "x-ratelimit-remaining": "0" }));
    expect(await _readTextFromURL("https://api.github.com/repos/acme/widget-store/releases/latest")).toBe("");
  });
});
