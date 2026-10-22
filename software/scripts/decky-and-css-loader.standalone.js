/** Opt-in Decky Loader, nine pinned plugins, and nine CSS Loader themes for Linux desktops. */

/** Install only when explicitly selected; stage Node helpers locally, then emit the shared installer invocation. */
async function doWork() {
  exitIfUnsupportedOs("is_os_wsl");
  exitIfNotTargetOs("is_os_steamos", "is_os_arch_linux", "is_os_ubuntu", "is_os_redhat");
  if (IS_CI || IS_DRY_RUN) {
    log(">>> Decky: explicit installer skipped in CI/dry-run; no downloads or protected writes");
    return;
  }
  const folder = fs.mkdtempSync(path.join(BASHRC_TEMP_DIR, "decky-"));
  fs.mkdirSync(path.join(folder, "software/scripts/decky"), { recursive: true });
  fs.mkdirSync(path.join(folder, "software/metadata"), { recursive: true });
  for (const name of ["decky-runtime.common.js", "decky-zip.common.js", "decky-install.common.js"]) {
    await writeText(path.join(folder, "software/scripts/decky", name), await readText`software/scripts/decky/${name}`);
  }
  await writeText(path.join(folder, "software/metadata/decky-packages.json"), await readText`software/metadata/decky-packages.json`);
  emitBash(code`
    ${"'" + process.execPath.replace(/'/g, "'\\''") + "'"} << 'DECKY_NODE' || exit $?
    require(${JSON.stringify(path.join(folder, "software/scripts/decky/decky-runtime.common.js"))}).install().catch((error) => {
      process.stderr.write(">>> Decky installation failed: " + error.message + "\\n");
      process.exitCode = 1;
    });
DECKY_NODE
  `);
}
