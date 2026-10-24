/** Execute emitted WSL startup code through the oldest local bash without changing the host profile. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { spawnSync } from "child_process";
import { getIndexFunction } from "./setup.js";

/**
 * Generate the actual WSL platform block, then execute it with a supplied logical launch folder.
 * @param {string} folder Logical PWD normally supplied by WSL on Windows.
 * @param {number} wsl Runtime WSL flag.
 * @param {string} afterStartup Optional shell code executed after the initial startup block.
 * @returns {Promise<object>} Child status and output containing the resulting logical folder.
 */
async function startShell(folder, wsl = 1, afterStartup = "") {
  let profile;
  const context = {
    code: getIndexFunction("code"),
    registerPlatformTweaks: (_platform, content) => {
      profile = content;
    },
  };
  let source = fs.readFileSync("software/scripts/wsl/_only.js", "utf8");
  if (process.env.BASHRC_TEST_COVERAGE === "1") {
    const { createInstrumenter } = createRequire(import.meta.url)("istanbul-lib-instrument");
    source = createInstrumenter({ coverageVariable: "__VITEST_COVERAGE__", coverageGlobalScope: "globalThis" }).instrumentSync(
      source,
      path.resolve("software/scripts/wsl/_only.js"),
    );
    context.__VITEST_COVERAGE__ = globalThis.__VITEST_COVERAGE__;
  }
  vm.runInNewContext(source, context);
  await context.doWork();
  return spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
    PWD="$START_FOLDER"
    ${profile}
    ${afterStartup}
    printf '%s\\n' "$PWD"
  `,
    ],
    {
      env: { ...process.env, START_FOLDER: folder, is_os_wsl: String(wsl), BASH_ENV: "/dev/null" },
      encoding: "utf8",
      timeout: 10000,
    },
  );
}

describe("WSL System32 startup folder", () => {
  it.each(["/mnt/c/WINDOWS/system32", "/mnt/c/Windows/System32", "/mnt/c/windows/system32"])("goes home from %s", async (folder) => {
    const result = await startShell(folder, 1, "pwd -P");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(`${fs.realpathSync(process.env.HOME)}\n${fs.realpathSync(process.env.HOME)}`);
  });

  it.each(["/mnt/c/Users/Test User/project", "/mnt/c/WINDOWS/system32/subfolder", "/mnt/d/WINDOWS/system32", "/home/test/project"])(
    "preserves the explicit launch folder %s",
    async (folder) => {
      const result = await startShell(folder);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe(folder);
    },
  );

  it("does not redirect a non-WSL shell", async () => {
    const result = await startShell("/mnt/c/WINDOWS/system32", 0);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("/mnt/c/WINDOWS/system32");
  });

  it.each(["/home/test/project", "/mnt/c/WINDOWS/system32"])(
    "checks only once even after reloading from System32 (launch: %s)",
    async (folder) => {
      let profile;
      const context = {
        code: getIndexFunction("code"),
        registerPlatformTweaks: (_platform, content) => {
          profile = content;
        },
      };
      vm.runInNewContext(fs.readFileSync("software/scripts/wsl/_only.js", "utf8"), context);
      await context.doWork();
      const result = await startShell(folder, 1, `PWD=/mnt/c/WINDOWS/system32\n${profile}`);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe("/mnt/c/WINDOWS/system32");
    },
  );
});
