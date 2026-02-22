async function doWork() {
  const softwareFiles = (await getSoftwareScriptFiles({ skipOsFiltering: true, useLocalFiles: true })).sort();

  const files = [];
  for (let i = 0; i < softwareFiles.length; i++) {
    let file = softwareFiles[i];

    // add the prefix if needed
    if (!file.includes('software/scripts/')) {
      file = `software/scripts/${file}`;
    }

    // we want to ignore any common script (.common.js) or config file (.config)
    if (!file.match(/\.common.js/) && !file.match(/\.json/) && !file.match(/\.config/)) {
      files.push(file);
    }
  }

  const targetPath = process.env.SCRIPT_INDEX_CONFIG_FILE || './software/metadata/script-list.config';
  writeText(targetPath, files.join('\n'));
}
