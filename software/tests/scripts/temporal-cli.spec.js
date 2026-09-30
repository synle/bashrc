/**
 * doWork tests for software/scripts/temporal-cli.js.
 *
 * Background: the script installs via `curl -fsSL https://temporal.download/cli.sh | sh`
 * and then registered the PATH block unconditionally. execBash never rejects and a
 * `curl | sh` pipeline exits 0 even when the curl half failed or was killed by the
 * 30s exec timeout, so a slow CI download produced a "Success" script and a missing
 * `temporal` binary — caught much later, as `Binary verification failed: 1/49
 * binaries missing` in build-ubuntu. The install must verify its own result.
 */
import { describe, it, expect } from "vitest";
import path from "path";
import { runScript, fileSystem, mockFsExistence, getIndexConstant } from "../setup.js";

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");
const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");

/** Where the installer is expected to leave the binary. */
const TEMPORAL_BIN = path.join(BASE_HOMEDIR_LINUX, ".temporalio", "bin", "temporal");
/** The PATH entry the profile block must export. */
const TEMPORAL_BIN_FOLDER = path.join(BASE_HOMEDIR_LINUX, ".temporalio", "bin");

describe("temporal-cli.js doWork", () => {
  it("should throw when the installer produced no binary", async () => {
    // The faked child_process.exec never creates anything, so this is exactly the
    // failed-install case: the command "succeeded" and the binary is absent.
    await expect(runScript("software/scripts/temporal-cli.js")).rejects.toThrow(
      `Temporal CLI install produced no binary at ${TEMPORAL_BIN}`,
    );
  });

  it("should register the PATH block and skip the install when the binary exists", async () => {
    mockFsExistence[TEMPORAL_BIN] = true;
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/temporal-cli.js");

    expect(fileSystem[BASH_SYLE_PATH]).toContain(TEMPORAL_BIN_FOLDER);
  });
});
