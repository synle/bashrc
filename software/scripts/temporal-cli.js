/** Budget for `curl … | sh` — the archive is tens of MB, so the 30s execBash default can kill a healthy download. */
const TEMPORAL_INSTALL_TIMEOUT_MS = 120_000;

/** Installs the Temporal CLI and registers it with bashrc. */
async function doWork() {
  log(">> Setting up Temporal CLI");

  exitIfLimitedSupportOs();

  const temporalDir = path.join(BASE_HOMEDIR_LINUX, ".temporalio");
  const temporalBin = path.join(temporalDir, "bin", "temporal");

  if (isForceRefreshStale(temporalBin)) {
    await deleteFolder(temporalDir);
  }

  if (!fs.existsSync(temporalBin)) {
    log(">> Installing Temporal CLI:", temporalDir);
    await execBash(`curl -fsSL https://temporal.download/cli.sh | sh`, {
      timeout: TEMPORAL_INSTALL_TIMEOUT_MS,
    });
    // execBash never rejects and `curl | sh` exits 0 on an empty script, so a
    // timed-out or half-downloaded install looks like success. Fail loudly here
    // instead of leaving a missing binary behind.
    if (!fs.existsSync(temporalBin)) {
      throw new Error(`Temporal CLI install produced no binary at ${temporalBin}`);
    }
  }

  registerWithBashSyleProfile(
    "temporal-cli",
    code`
      export PATH="${temporalDir}/bin:\$PATH"
    `,
  );
}

/** Removes the Temporal CLI installation and profile block. */
async function undoWork() {
  const temporalDir = path.join(BASE_HOMEDIR_LINUX, ".temporalio");
  log(">> Removing Temporal CLI:", temporalDir);
  await deleteFolder(temporalDir);
  removeFromBashSyleProfile("temporal-cli");
}
