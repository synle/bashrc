/** Verify macOS container package selection without changing installed applications. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { spawnSync } from "child_process";

describe("macOS container setup", () => {
  it("queues OrbStack instead of Docker Desktop in macOS setup", () => {
    const setup = readFileSync(new URL("../scripts/mac/_full-setup.sh", import.meta.url), "utf8");
    const guiPackages = setup
      .split("# --- GUI apps (skip if already present in /Applications or brew cask cache) ---")[1]
      .split("# --- Shell Setup (default shell) ---")[0];
    const result = spawnSync(
      "/bin/bash",
      ["--noprofile", "--norc", "-p", "-c", `function installBrewPackageInBackground() { printf '%s\\n' "$*"; }\n${guiPackages}`],
      { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--cask --app=OrbStack.app orbstack\n");
    expect(result.stdout).not.toContain("Docker.app");
    expect(result.stderr).toBe("");
  });
});
