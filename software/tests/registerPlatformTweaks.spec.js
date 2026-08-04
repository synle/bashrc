import { describe, it, expect } from "vitest";
import { getIndexFunction, fileSystem } from "./setup.js";

/** @type {(platformName: string, content: string, subKey?: string) => void} */
const registerPlatformTweaks = getIndexFunction("registerPlatformTweaks");
/** @type {() => Promise<void>} */
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

  it("should produce a sub-keyed configKey when subKey is supplied", async () => {
    registerPlatformTweaks("Mac", "# mac base\nalias ls='ls -G'");
    registerPlatformTweaks("Mac", "# mac iterm\n:", "iTerm2");
    await flushProfileBlocks();
    const profile = fileSystem["/mock/home/.bash_syle"] || "";
    expect(profile).toContain("Mac OS-specific Tweaks");
    expect(profile).toContain("Mac OS-specific Tweaks - iTerm2");
    expect(profile).toContain("mac base");
    expect(profile).toContain("mac iterm");
  });

  it("should throw on duplicate configKey within the same flush window", () => {
    registerPlatformTweaks("Mac", "# first call");
    expect(() => registerPlatformTweaks("Mac", "# second call")).toThrow(/Duplicate profile block key/);
  });
});
