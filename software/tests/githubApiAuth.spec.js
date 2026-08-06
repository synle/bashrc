/**
 * GitHub API authentication + rate-limit handling.
 *
 * Anonymous api.github.com is 60 requests/hour per IP, shared with every other tool on the
 * machine. A setup run spends several on release lookups, so the budget runs out — and the
 * old failure mode was silent: a 403 body has no `tag_name`, so every affected script
 * reported "No official release found" and skipped an install that was perfectly valid.
 * These tests pin both halves of the fix: a token is found and reused, and an exhausted
 * budget is reported as itself rather than as a missing release.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getIndexFunction, getIndexConstant, setSandboxGlobal, getSandboxProcess, fetchResponses } from "./setup.js";

const GITHUB_API_URL_PREFIX = getIndexConstant("_GITHUB_API_URL_PREFIX");

/** Clears the memoized token so each case resolves from scratch. */
function resetTokenCache() {
  setSandboxGlobal("_githubApiTokenCache", undefined);
}

describe("_GITHUB_API_URL_PREFIX", () => {
  it("is the exact api.github.com origin with a trailing slash", () => {
    expect(GITHUB_API_URL_PREFIX).toBe("https://api.github.com/");
  });

  it("does not match a lookalike host that merely starts with the origin text", () => {
    // The trailing slash is load-bearing: without it "https://api.github.com.evil.test/"
    // would pass a startsWith check and receive the Authorization header.
    expect("https://api.github.com.evil.test/repos/x/y".startsWith(GITHUB_API_URL_PREFIX)).toBe(false);
    expect("https://api.github.com/repos/x/y".startsWith(GITHUB_API_URL_PREFIX)).toBe(true);
  });
});

describe("_getGitHubApiToken", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...getSandboxProcess().env };
    resetTokenCache();
  });

  afterEach(() => {
    getSandboxProcess().env = originalEnv;
    resetTokenCache();
  });

  it("prefers GH_TOKEN over anything else", () => {
    getSandboxProcess().env.GH_TOKEN = "gh-token-value";
    getSandboxProcess().env.GITHUB_TOKEN = "github-token-value";
    expect(getIndexFunction("_getGitHubApiToken")()).toBe("gh-token-value");
  });

  it("falls back to GITHUB_TOKEN", () => {
    delete getSandboxProcess().env.GH_TOKEN;
    getSandboxProcess().env.GITHUB_TOKEN = "github-token-value";
    expect(getIndexFunction("_getGitHubApiToken")()).toBe("github-token-value");
  });

  it("trims surrounding whitespace from an env token", () => {
    getSandboxProcess().env.GH_TOKEN = "  padded-token\n";
    expect(getIndexFunction("_getGitHubApiToken")()).toBe("padded-token");
  });

  it("memoizes the result so the gh subprocess is paid at most once", () => {
    // index.js is inlined into every bundled node heredoc, so an unmemoized lookup would
    // shell out to `gh auth token` dozens of times in a single run.
    getSandboxProcess().env.GH_TOKEN = "first-value";
    expect(getIndexFunction("_getGitHubApiToken")()).toBe("first-value");

    getSandboxProcess().env.GH_TOKEN = "changed-after-first-call";
    expect(getIndexFunction("_getGitHubApiToken")()).toBe("first-value");
  });

  it("caches the empty result too, so a logged-out host does not re-shell on every call", () => {
    delete getSandboxProcess().env.GH_TOKEN;
    delete getSandboxProcess().env.GITHUB_TOKEN;
    setSandboxGlobal("hasBinary", () => false);

    expect(getIndexFunction("_getGitHubApiToken")()).toBe("");
    expect(getIndexConstant("_githubApiTokenCache")).toBe("");
  });

  it("stays anonymous instead of throwing when gh is present but not logged in", () => {
    delete getSandboxProcess().env.GH_TOKEN;
    delete getSandboxProcess().env.GITHUB_TOKEN;
    setSandboxGlobal("hasBinary", () => true);
    setSandboxGlobal("execBashSync", () => {
      throw new Error("gh: not logged in");
    });

    expect(getIndexFunction("_getGitHubApiToken")()).toBe("");
  });
});

describe("fetchGitHubReleaseVersion", () => {
  const RELEASE_URL = "https://api.github.com/repos/synle/url-porter/releases/latest";

  beforeEach(() => {
    setSandboxGlobal("_githubApiRateLimited", false);
  });

  afterEach(() => {
    setSandboxGlobal("_githubApiRateLimited", false);
  });

  it("returns the tag_name on success", async () => {
    fetchResponses[RELEASE_URL] = JSON.stringify({ tag_name: "v1.88.0" });
    await expect(getIndexFunction("fetchGitHubReleaseVersion")("synle/url-porter")).resolves.toBe("v1.88.0");
  });

  it("reports a genuinely release-less repo as such", async () => {
    fetchResponses[RELEASE_URL] = JSON.stringify({});
    await expect(getIndexFunction("fetchGitHubReleaseVersion")("synle/url-porter")).rejects.toThrow(/No official release found/);
  });

  it("blames the rate limit, not the repo, when the budget is exhausted", async () => {
    // The regression this pins: six repos that all have releases were reported as having
    // none, and their installs were skipped as though that were correct.
    fetchResponses[RELEASE_URL] = JSON.stringify({});
    setSandboxGlobal("_githubApiRateLimited", true);

    await expect(getIndexFunction("fetchGitHubReleaseVersion")("synle/url-porter")).rejects.toThrow(/rate limit exhausted/);
  });

  it("still raises ScriptSkipError when rate limited, so the run skips rather than fails", async () => {
    fetchResponses[RELEASE_URL] = JSON.stringify({});
    setSandboxGlobal("_githubApiRateLimited", true);

    await expect(getIndexFunction("fetchGitHubReleaseVersion")("synle/url-porter")).rejects.toBeInstanceOf(getIndexConstant("ScriptSkipError"));
  });
});
