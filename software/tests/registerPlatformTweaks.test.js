import { describe, it, expect } from "vitest";
import { getIndexFunction, fileSystem } from "./setup.js";

const registerPlatformTweaks = getIndexFunction("registerPlatformTweaks");

describe("registerPlatformTweaks", () => {
  it("should write tweaks content to the target file", () => {
    registerPlatformTweaks("Only Mac", ".bash_syle_only_mac", "# mac tweaks\nalias ls='ls -G'");
    const targetKey = Object.keys(fileSystem).find((k) => k.includes(".bash_syle_only_mac"));
    expect(targetKey).toBeDefined();
    expect(fileSystem[targetKey]).toContain("mac tweaks");
  });

  it("should register source line in bash_syle profile", () => {
    registerPlatformTweaks("Only Ubuntu", ".bash_syle_only_ubuntu", "# ubuntu tweaks");
    const profile = fileSystem["/mock/home/.bash_syle"] || "";
    expect(profile).toContain("Only Ubuntu - PLATFORM SPECIFIC TWEAKS");
  });

  it("should use sourceOverride when provided", () => {
    registerPlatformTweaks("Android Termux", ".bash_syle_only_termux", "# termux tweaks", ". ~/custom-source");
    const profile = fileSystem["/mock/home/.bash_syle"] || "";
    expect(profile).toContain("custom-source");
  });
});
