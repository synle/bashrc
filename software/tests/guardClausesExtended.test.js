import { describe, it, expect } from "vitest";
import { getIndexFunction, mockFsExistence, processExitCalled, setSandboxGlobal } from "./setup.js";

const exitIfPathCheck = getIndexFunction("exitIfPathCheck");
const exitIfPathNotFound = getIndexFunction("exitIfPathNotFound");
const exitIfPathFound = getIndexFunction("exitIfPathFound");
const exitIfUnsupportedOs = getIndexFunction("exitIfUnsupportedOs");
const exitIfNotTargetOs = getIndexFunction("exitIfNotTargetOs");
const exitIfLimitedSupportOs = getIndexFunction("exitIfLimitedSupportOs");

describe("exitIfPathCheck", () => {
  it("should call process.exit when path not found and exitIfFound is false", () => {
    exitIfPathCheck("/nonexistent/path", false);
    expect(processExitCalled).toBe(true);
  });

  it("should not call process.exit when path exists and exitIfFound is false", () => {
    mockFsExistence["/exists/path"] = true;
    exitIfPathCheck("/exists/path", false);
    expect(processExitCalled).toBe(false);
  });

  it("should call process.exit when path exists and exitIfFound is true", () => {
    mockFsExistence["/exists/path"] = true;
    exitIfPathCheck("/exists/path", true);
    expect(processExitCalled).toBe(true);
  });

  it("should not call process.exit when path not found and exitIfFound is true", () => {
    exitIfPathCheck("/nonexistent/path", true);
    expect(processExitCalled).toBe(false);
  });
});

describe("exitIfPathNotFound", () => {
  it("should call process.exit when path does not exist", () => {
    exitIfPathNotFound("/missing/path");
    expect(processExitCalled).toBe(true);
  });

  it("should not call process.exit when path exists", () => {
    mockFsExistence["/found/path"] = true;
    exitIfPathNotFound("/found/path");
    expect(processExitCalled).toBe(false);
  });
});

describe("exitIfPathFound", () => {
  it("should call process.exit when path exists", () => {
    mockFsExistence["/already/here"] = true;
    exitIfPathFound("/already/here");
    expect(processExitCalled).toBe(true);
  });

  it("should not call process.exit when path does not exist", () => {
    exitIfPathFound("/not/here");
    expect(processExitCalled).toBe(false);
  });
});

describe("exitIfUnsupportedOs", () => {
  it("should call process.exit when OS flag is set", () => {
    setSandboxGlobal("is_os_android_termux", true);
    exitIfUnsupportedOs("is_os_android_termux");
    expect(processExitCalled).toBe(true);
    setSandboxGlobal("is_os_android_termux", false);
  });

  it("should not call process.exit when OS flag is not set", () => {
    setSandboxGlobal("is_os_android_termux", false);
    exitIfUnsupportedOs("is_os_android_termux");
    expect(processExitCalled).toBe(false);
  });

  it("should handle multiple OS flags", () => {
    setSandboxGlobal("is_os_chromeos", false);
    setSandboxGlobal("is_os_steamos", true);
    exitIfUnsupportedOs("is_os_chromeos", "is_os_steamos");
    expect(processExitCalled).toBe(true);
    setSandboxGlobal("is_os_steamos", false);
  });

  it("should not exit when no flags match", () => {
    setSandboxGlobal("is_os_chromeos", false);
    setSandboxGlobal("is_os_steamos", false);
    exitIfUnsupportedOs("is_os_chromeos", "is_os_steamos");
    expect(processExitCalled).toBe(false);
  });
});

describe("exitIfNotTargetOs", () => {
  it("should not exit when current OS matches a target flag", () => {
    setSandboxGlobal("is_os_mac", true);
    exitIfNotTargetOs("is_os_mac");
    expect(processExitCalled).toBe(false);
    setSandboxGlobal("is_os_mac", false);
  });

  it("should exit when current OS does not match any target flag", () => {
    setSandboxGlobal("is_os_mac", false);
    setSandboxGlobal("is_os_window", false);
    exitIfNotTargetOs("is_os_mac", "is_os_window");
    expect(processExitCalled).toBe(true);
  });

  it("should not exit when one of multiple flags matches", () => {
    setSandboxGlobal("is_os_mac", false);
    setSandboxGlobal("is_os_ubuntu", true);
    exitIfNotTargetOs("is_os_mac", "is_os_ubuntu");
    expect(processExitCalled).toBe(false);
    setSandboxGlobal("is_os_ubuntu", false);
  });
});

describe("exitIfLimitedSupportOs", () => {
  it("should exit when running in lightweight mode", () => {
    // IS_LIGHT_WEIGHT_MODE is read from env at setup time, so we test via exitIfUnsupportedOs path
    // The sandbox has IS_LIGHT_WEIGHT_MODE as false by default, so limited support OS check applies
    setSandboxGlobal("is_os_android_termux", true);
    exitIfLimitedSupportOs();
    expect(processExitCalled).toBe(true);
    setSandboxGlobal("is_os_android_termux", false);
  });
});
