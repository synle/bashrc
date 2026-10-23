/** Guards mutable sandbox flags against inline-JSDoc lexical declarations in the real engine. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getIndexFunction, setSandboxGlobal } from "./setup.js";

beforeEach(() => {
  setSandboxGlobal("is_os_mac", false);
  setSandboxGlobal("is_os_windows", false);
});

afterEach(() => {
  setSandboxGlobal("is_os_mac", false);
  setSandboxGlobal("is_os_windows", false);
});

describe("sandbox flags with inline JSDoc", () => {
  it("changes Windows behavior inside real engine functions", () => {
    setSandboxGlobal("is_os_windows", true);
    expect(getIndexFunction("resolveOsKey")({ mac: "mac", windows: "windows", linux: "linux" })).toBe("windows");
    setSandboxGlobal("is_os_windows", false);
    expect(getIndexFunction("resolveOsKey")({ mac: "mac", windows: "windows", linux: "linux" })).toBe("linux");
  });

  it("changes macOS behavior inside real engine functions", () => {
    setSandboxGlobal("is_os_mac", true);
    expect(getIndexFunction("resolveOsKey")({ mac: "mac", windows: "windows", linux: "linux" })).toBe("mac");
    setSandboxGlobal("is_os_mac", false);
    expect(getIndexFunction("resolveOsKey")({ mac: "mac", windows: "windows", linux: "linux" })).toBe("linux");
  });
});
