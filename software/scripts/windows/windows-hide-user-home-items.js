/** Hides selected top-level Windows home folders and files from Explorer. */
async function doWork() {
  if (!global.is_os_wsl) return;

  const windowsHome = getWindowUserBaseDir();
  if (!windowsHome) {
    log(">> Skipped hiding Windows home items: home folder not found");
    return;
  }

  const dotFolders = findPathList(windowsHome, /^\..+$/, { type: "folder" });
  const namedFolders = ["Links", "Saved Games", "Searches"].map((name) => findPath(windowsHome, name, { type: "folder" })).filter(Boolean);
  const hiddenFiles = findPathList(windowsHome, /^\..+$/, { type: "file" });
  const backupFiles = findPathList(windowsHome, /\.bak_/, { type: "file" });
  const pathsToHide = [...new Set([...dotFolders, ...namedFolders, ...hiddenFiles, ...backupFiles])];

  log(`>> Hiding ${pathsToHide.length} top-level Windows home items`);
  log(pathsToHide.join("\n"));
  await hidePaths(pathsToHide, true, false);
}
