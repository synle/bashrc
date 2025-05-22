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
    await execBash(`curl -fsSL https://temporal.download/cli.sh | sh`);
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
