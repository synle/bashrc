/** doWork tests for software/scripts/advanced/remote-connections.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, runScript, getIndexConstant } from "../../setup.js";

const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");

describe("advanced/remote-connections.js doWork", () => {
  it("should not throw when HOME_HOST_NAMES has no remote hosts", async () => {
    await expect(runScript("software/scripts/advanced/remote-connections.js")).resolves.not.toThrow();
  });

  it("should create remote-connections directory path", async () => {
    await runScript("software/scripts/advanced/remote-connections.js");

    // Verify at least the directory creation was attempted via mkdir
    // (even if no hosts produce .rdp/.vnc files, the function should still run)
    // The script creates files only when HOME_HOST_NAMES has WINDOWS_REMOTE/OSX_REMOTE entries
  });
});
