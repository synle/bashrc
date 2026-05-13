/** Tests for installWindowsSetupExe — silent NSIS install on WSL. */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, mockExecCommands, setSandboxGlobal } from "./setup.js";

const installWindowsSetupExe = getIndexFunction("installWindowsSetupExe");

/**
 * Only the OS-/dry-run-gated no-op paths are unit-tested here. The actual
 * silent-install branch reads the lexically-scoped `const is_os_windows` in
 * index.js, which the setup.js const→var rewrite skips because the const is on
 * the same line as a JSDoc prefix — so we can't flip it via `setSandboxGlobal`
 * from inside a test. Matches the precedent for installMacDmg / _forceCloseApp,
 * which are not unit-tested for the same reason.
 */
describe("installWindowsSetupExe", () => {
  beforeEach(() => {
    setSandboxGlobal("IS_DRY_RUN", false);
  });

  it("is a no-op when not on Windows (no exec calls)", async () => {
    await installWindowsSetupExe("/tmp/foo/bar.exe", "bar");
    expect(mockExecCommands.length).toBe(0);
  });

  it("returns without throwing when called with an arbitrary path", async () => {
    await expect(installWindowsSetupExe("/tmp/anything/foo.exe", "foo")).resolves.toBeUndefined();
  });
});
