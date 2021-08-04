async function doWork() {
  const softwareFiles = await getSoftwareScriptFiles();

  console.log(
    echoColor1(
      `>> Installing Configurations and Tweaks: ${softwareFiles.length} Files`
    )
  );

  // Print OS Environments
  console.log(`
    node -e """
      console.log('===================== OS Flags ========================');
      Object.keys(process.env)
        .filter(envKey => envKey.indexOf('is_os_') === 0)
        .forEach(envKey => console.log('= ', envKey.padEnd(22, ' ') + ': ', process.env[envKey]))
      console.log('=======================================================');
    """
  `);

  for (let i = 0; i < softwareFiles.length; i++) {
    let file = softwareFiles[i];

    // add the prefix if needed
    if (!file.includes("software/scripts/")) {
      file = `software/scripts/${file}`;
    }

    console.log(
      echoColor2(
        `>> ${file} (${calculatePercentage(i + 1, softwareFiles.length)}%)`
      )
    );

    processScriptFile(file);
  }
}
