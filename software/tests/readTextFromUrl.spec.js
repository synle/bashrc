/** Tests for _readTextFromURL / makeRESTAPI — fetch success, HTTP failure + error body, rate limit, and URL/method validation. */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, setSandboxGlobal } from "./setup.js";

const _readTextFromURL = getIndexFunction("_readTextFromURL");
const makeRESTAPI = getIndexFunction("makeRESTAPI");
const _describeRESTErrorBody = getIndexFunction("_describeRESTErrorBody");

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

  it("proxies to makeRESTAPI as a bodiless GET", async () => {
    let calledOptions = null;
    setSandboxGlobal("fetch", async (url, options) => {
      calledOptions = options;
      return fakeResponse(200, "ok");
    });
    expect(await _readTextFromURL("https://example.test/proxy-get")).toBe("ok");
    expect(calledOptions.method).toBe("GET");
    expect(calledOptions.body).toBe(undefined);
  });
});

describe("makeRESTAPI", () => {
  beforeEach(() => {
    setSandboxGlobal("AbortSignal", AbortSignal);
    setSandboxGlobal("fetch", undefined);
  });

  it("sends a JSON body with the given method", async () => {
    let call = null;
    setSandboxGlobal("fetch", async (url, options) => {
      call = { url, options };
      return fakeResponse(200, '{"status":"success"}');
    });
    const out = await makeRESTAPI("http://127.0.0.1:11434/api/pull", "post", { model: "acme:1b", stream: false });
    expect(out).toBe('{"status":"success"}');
    expect(call.url).toBe("http://127.0.0.1:11434/api/pull");
    expect(call.options.method).toBe("POST");
    expect(call.options.body).toBe('{"model":"acme:1b","stream":false}');
    expect(call.options.headers["Content-Type"]).toBe("application/json");
  });

  it("returns an empty string on HTTP 500 with a JSON error body", async () => {
    setSandboxGlobal("fetch", async () => fakeResponse(500, '{"error":"requires a newer version of Ollama"}'));
    expect(await makeRESTAPI("http://127.0.0.1:11434/api/pull", "POST", { model: "acme:1b" })).toBe("");
  });

  it("rejects a method that is not a plain verb", async () => {
    await expect(makeRESTAPI("https://example.test/x", "GET; rm")).rejects.toThrow("Invalid HTTP method: GET; rm");
  });
});

describe("_describeRESTErrorBody", () => {
  it("extracts the error field from a JSON body", () => {
    expect(_describeRESTErrorBody('{"error":"pull model manifest: 412:\\nneeds newer Ollama"}')).toBe(
      "pull model manifest: 412: needs newer Ollama",
    );
  });

  it("returns raw text for a non-JSON body", () => {
    expect(_describeRESTErrorBody("Bad Gateway")).toBe("Bad Gateway");
  });

  it("returns an empty string for an empty body", () => {
    expect(_describeRESTErrorBody("")).toBe("");
  });
});
