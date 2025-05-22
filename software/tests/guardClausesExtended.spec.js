import { describe, it, expect } from "vitest";
import { getIndexFunction, mockFsExistence, setSandboxGlobal } from "./setup.js";

const exitIfPathCheck = getIndexFunction("exitIfPathCheck");
const exitIfPathNotFound = getIndexFunction("exitIfPathNotFound");
const exitIfPathFound = getIndexFunction("exitIfPathFound");
const exitIfUnsupportedOs = getIndexFunction("exitIfUnsupportedOs");
const exitIfNotTargetOs = getIndexFunction("exitIfNotTargetOs");
const exitIfLimitedSupportOs = getIndexFunction("exitIfLimitedSupportOs");
const ScriptSkipError = getIndexFunction("ScriptSkipError");

describe("exitIfPathCheck", () => {
  it("should throw ScriptSkipError when path not found and exitIfFound is false", () => {
    expect(() => exitIfPathCheck("/nonexistent/path", false)).toThrow(ScriptSkipError);
  });

  it("should not throw when path exists and exitIfFound is false", () => {
    mockFsExistence["/exists/path"] = true;
    expect(() => exitIfPathCheck("/exists/path", false)).not.toThrow();
  });

  it("should throw ScriptSkipError when path exists and exitIfFound is true", () => {
    mockFsExistence["/exists/path"] = true;
    expect(() => exitIfPathCheck("/exists/path", true)).toThrow(ScriptSkipError);
  });

  it("should not throw when path not found and exitIfFound is true", () => {
    expect(() => exitIfPathCheck("/nonexistent/path", true)).not.toThrow();
  });
});

describe("exitIfPathNotFound", () => {
  it("should throw ScriptSkipError when path does not exist", () => {
    expect(() => exitIfPathNotFound("/missing/path")).toThrow(ScriptSkipError);
  });

  it("should not throw when path exists", () => {
    mockFsExistence["/found/path"] = true;
    expect(() => exitIfPathNotFound("/found/path")).not.toThrow();
  });
});

describe("exitIfPathFound", () => {
  it("should throw ScriptSkipError when path exists", () => {
    mockFsExistence["/already/here"] = true;
    expect(() => exitIfPathFound("/already/here")).toThrow(ScriptSkipError);
  });

  it("should not throw when path does not exist", () => {
    expect(() => exitIfPathFound("/not/here")).not.toThrow();
  });
});

describe("exitIfUnsupportedOs", () => {
  it("should throw ScriptSkipError when OS flag is set", () => {
    setSandboxGlobal("is_os_android_termux", true);
    expect(() => exitIfUnsupportedOs("is_os_android_termux")).toThrow(ScriptSkipError);
    setSandboxGlobal("is_os_android_termux", false);
  });

  it("should not throw when OS flag is not set", () => {
    setSandboxGlobal("is_os_android_termux", false);
    expect(() => exitIfUnsupportedOs("is_os_android_termux")).not.toThrow();
  });

  it("should handle multiple OS flags", () => {
    setSandboxGlobal("is_os_chromeos", false);
    setSandboxGlobal("is_os_steamos", true);
    expect(() => exitIfUnsupportedOs("is_os_chromeos", "is_os_steamos")).toThrow(ScriptSkipError);
    setSandboxGlobal("is_os_steamos", false);
  });

  it("should not throw when no flags match", () => {
    setSandboxGlobal("is_os_chromeos", false);
    setSandboxGlobal("is_os_steamos", false);
    expect(() => exitIfUnsupportedOs("is_os_chromeos", "is_os_steamos")).not.toThrow();
  });
});

describe("exitIfNotTargetOs", () => {
  it("should not throw when current OS matches a target flag", () => {
    setSandboxGlobal("is_os_mac", true);
    expect(() => exitIfNotTargetOs("is_os_mac")).not.toThrow();
    setSandboxGlobal("is_os_mac", false);
  });

  it("should throw ScriptSkipError when current OS does not match any target flag", () => {
    setSandboxGlobal("is_os_mac", false);
    setSandboxGlobal("is_os_windows", false);
    expect(() => exitIfNotTargetOs("is_os_mac", "is_os_windows")).toThrow(ScriptSkipError);
  });

  it("should not throw when one of multiple flags matches", () => {
    setSandboxGlobal("is_os_mac", false);
    setSandboxGlobal("is_os_ubuntu", true);
    expect(() => exitIfNotTargetOs("is_os_mac", "is_os_ubuntu")).not.toThrow();
    setSandboxGlobal("is_os_ubuntu", false);
  });
});

describe("exitIfLimitedSupportOs", () => {
  it("should throw ScriptSkipError when running on limited support OS", () => {
    setSandboxGlobal("is_os_android_termux", true);
    expect(() => exitIfLimitedSupportOs()).toThrow(ScriptSkipError);
    setSandboxGlobal("is_os_android_termux", false);
  });
});
