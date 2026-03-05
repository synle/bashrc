import { describe, it, expect } from "vitest";
import { getIndexFunction, fileSystem } from "./setup.js";

const registerPlatformTweaks = getIndexFunction("registerPlatformTweaks");

describe("registerPlatformTweaks", () => {
  it("should append tweaks content directly into bash_syle profile", () => {
    registerPlatformTweaks("Mac", "# mac tweaks\nalias ls='ls -G'");
    const profile = fileSystem["/mock/home/.bash_syle"] || "";
    expect(profile).toContain("mac tweaks");
    expect(profile).toContain("Mac - PLATFORM SPECIFIC TWEAKS");
  });

  it("should register platform name as config key", () => {
    registerPlatformTweaks("Ubuntu", "# ubuntu tweaks");
    const profile = fileSystem["/mock/home/.bash_syle"] || "";
    expect(profile).toContain("Ubuntu - PLATFORM SPECIFIC TWEAKS");
    expect(profile).toContain("ubuntu tweaks");
  });
});
