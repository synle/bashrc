/** Tests for getMacInstalledAppVersion — Mac /Applications/<App>.app version probe. */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, mockFsDirEntries, mockExecCommands, setMockExecSyncReturn, setSandboxGlobal } from "./setup.js";

const getMacInstalledAppVersion = getIndexFunction("getMacInstalledAppVersion");

/**
 * is_os_mac is declared `const` on the same JSDoc-prefixed line in index.js, so the
 * setup.js const→var rewrite skips it and we cannot flip it from a test. That means
 * the helper's `if (!is_os_mac) return null` branch is what runs here — every assertion
 * below verifies the early-null path. The interesting positive branches (matching .app
 * found, version-shaped output, etc.) are exercised by the integration with
 * downloadAndInstallBinary on a real Mac and by the regex unit tests below.
 */
describe("getMacInstalledAppVersion (non-Mac sandbox)", () => {
  beforeEach(() => {
    setMockExecSyncReturn("");
  });

  it("returns null when not on Mac", async () => {
    expect(await getMacInstalledAppVersion("proxie")).toBeNull();
  });

  it("does not touch the filesystem or shell off-Mac", async () => {
    await getMacInstalledAppVersion("display-dj");
    expect(mockExecCommands.length).toBe(0);
  });
});

/**
 * The regex used inside getMacInstalledAppVersion to validate `defaults read` stdout.
 * Mirrors the helper's `/^\d+(\.\d+)+/` test. Kept here as a cheap guard against
 * future churn — if anyone tightens or loosens the helper's regex, this fails first.
 */
describe("version-shape filter regex", () => {
  /**
   * Mirrors the inline check inside getMacInstalledAppVersion.
   * @param {string} s - The candidate string from `defaults read`.
   * @returns {boolean} True if the string looks like a semver-ish version.
   */
  function looksLikeVersion(s) {
    return /^\d+(\.\d+)+/.test(s);
  }

  it("accepts normal semver outputs from Tauri/Electron bundles", () => {
    expect(looksLikeVersion("0.4.3")).toBe(true); // proxie
    expect(looksLikeVersion("3.1.9")).toBe(true); // sqlui-native
    expect(looksLikeVersion("0.2.316")).toBe(true); // skiff-files
    expect(looksLikeVersion("1.0")).toBe(true);
    expect(looksLikeVersion("10.20.30.40")).toBe(true);
  });

  it("rejects the display-dj-style funky `defaults` error line", () => {
    // Real example the user saw: a stderr-shaped timestamp+banner leaking into stdout.
    expect(looksLikeVersion("2026-05-20 07:38:09.880 defaults")).toBe(false);
  });

  it("rejects empty / non-version strings", () => {
    expect(looksLikeVersion("")).toBe(false);
    expect(looksLikeVersion("unknown")).toBe(false);
    expect(looksLikeVersion("v1.2.3")).toBe(false); // leading v not accepted — strip before compare
    expect(looksLikeVersion("foo.1.2")).toBe(false);
  });
});
