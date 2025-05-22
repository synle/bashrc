/**
 * Scans the repository for all software script files and writes the sorted list to the script-list config.
 */
async function doWork() {
  const files = await getAllRepoSoftwareFiles();

  log("Total New Script Files", files.length);
  const targetPath = process.env.SCRIPT_INDEX_CONFIG_FILE || "./software/metadata/script-list.config";
  await writeText(targetPath, files.join("\n"));
}
