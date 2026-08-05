import { describe, it, expect } from "vitest";
import { fileSystem, getIndexFunction, getIndexConstant } from "./setup.js";

const INSTALLED_VERSION_STAMP_SUFFIX = getIndexConstant("INSTALLED_VERSION_STAMP_SUFFIX");
const getInstalledVersionStampPath = getIndexFunction("getInstalledVersionStampPath");
const readInstalledVersionStamp = getIndexFunction("readInstalledVersionStamp");
const writeInstalledVersionStamp = getIndexFunction("writeInstalledVersionStamp");

// ---- tests ----

describe("getInstalledVersionStampPath", () => {
  it("should place the stamp beside the install folder, never inside it", () => {
    // Chrome refuses to load an unpacked extension whose folder holds a dot-prefixed
    // entry, so the stamp must be a sibling of the payload folder.
    expect(getInstalledVersionStampPath("/mock/_extra/url-porter")).toBe(`/mock/_extra/url-porter${INSTALLED_VERSION_STAMP_SUFFIX}`);
  });

  it("should use the .installed.json suffix", () => {
    expect(INSTALLED_VERSION_STAMP_SUFFIX).toBe(".installed.json");
  });
});

describe("readInstalledVersionStamp", () => {
  it("should return empty string when the stamp does not exist", () => {
    expect(readInstalledVersionStamp("/mock/missing.installed.json")).toBe("");
  });

  it("should return empty string for malformed json", () => {
    fileSystem["/mock/bad.installed.json"] = "{not json";
    expect(readInstalledVersionStamp("/mock/bad.installed.json")).toBe("");
  });

  it("should return empty string when the stamp has no version field", () => {
    fileSystem["/mock/noversion.installed.json"] = JSON.stringify({ repo: "synle/url-porter" });
    expect(readInstalledVersionStamp("/mock/noversion.installed.json")).toBe("");
  });

  it("should return the recorded version", () => {
    fileSystem["/mock/good.installed.json"] = JSON.stringify({ repo: "synle/url-porter", version: "v1.88.0" });
    expect(readInstalledVersionStamp("/mock/good.installed.json")).toBe("v1.88.0");
  });
});

describe("writeInstalledVersionStamp", () => {
  it("should round-trip a version through the stamp file", async () => {
    const stampPath = getInstalledVersionStampPath("/mock/_extra/skippy-ff");
    await writeInstalledVersionStamp(stampPath, "v0.28.0", "synle/skippy-ff");

    const written = JSON.parse(fileSystem[stampPath]);
    expect(written.version).toBe("v0.28.0");
    expect(written.repo).toBe("synle/skippy-ff");
    expect(written.installedAt).toBeTruthy();
    expect(readInstalledVersionStamp(stampPath)).toBe("v0.28.0");
  });
});
