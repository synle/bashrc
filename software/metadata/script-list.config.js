async function doWork() {
  const files = (await getAllRepoSoftwareFiles()).sort();
  const targetPath = process.env.SCRIPT_INDEX_CONFIG_FILE || './software/metadata/script-list.config';
  writeText(targetPath, files.join('\n'));
}
