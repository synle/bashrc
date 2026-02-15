// Main entry point for scripts
// Gets the list of scripts and executes them one by one (live mode)
async function doWork() {
  const softwareFiles = await getSoftwareScriptFiles();

  console.log(
    echoColor1(
      `
>> Installing Configurations: ${softwareFiles.length} Files
`,
    ),
  );

  printOsFlags(); // Print OS Environments
  printScriptsToRun(softwareFiles);

  for (let i = 0; i < softwareFiles.length; i++) {
    let file = softwareFiles[i];

    // add the prefix if needed
    if (!file.includes('software/scripts/')) {
      file = `software/scripts/${file}`;
    }

    console.log(echoColor2(`>> ${file} (${calculatePercentage(i + 1, softwareFiles.length)}%)`));

    processScriptFile(file);
  }
}
