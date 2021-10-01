async function doWork() {
  const softwareFiles = await getSoftwareScriptFiles(true);

  const files = [];
  for (let i = 0; i < softwareFiles.length; i++) {
    let file = softwareFiles[i];

    // add the prefix if needed
    if (!file.includes('software/scripts/')) {
      file = `software/scripts/${file}`;
    }

    files.push(file);
  }

  const targetPath = process.env.SCRIPT_INDEX_CONFIG_FILE || './software/metadata/script-list.config';
  writeText(targetPath, files.join('\n'));
}
