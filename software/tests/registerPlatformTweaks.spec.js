import { describe, it, expect } from "vitest";
import { getIndexFunction, fileSystem } from "./setup.js";

const registerPlatformTweaks = getIndexFunction("registerPlatformTweaks");
const flushProfileBlocks = getIndexFunction("flushProfileBlocks");

describe("registerPlatformTweaks", () => {
  it("should append tweaks content directly into bash_syle profile", async () => {
    registerPlatformTweaks("Mac", "# mac tweaks\nalias ls='ls -G'");
    await flushProfileBlocks();
    const profile = fileSystem["/mock/home/.bash_syle"] || "";
    expect(profile).toContain("mac tweaks");
    expect(profile).toContain("Mac OS-specific Tweaks");
  });

  it("should register platform name as config key", async () => {
    registerPlatformTweaks("Ubuntu", "# ubuntu tweaks\n:");
    await flushProfileBlocks();
    const profile = fileSystem["/mock/home/.bash_syle"] || "";
    expect(profile).toContain("Ubuntu OS-specific Tweaks");
    expect(profile).toContain("ubuntu tweaks");
  });
});
