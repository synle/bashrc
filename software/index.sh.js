async function doWork() {
  const softwareFiles = await getSoftwareScriptFiles();

  console.log(
    echoColor1(
      `>> Installing Configurations and Tweaks: ${softwareFiles.length} Files`
    )
  );

  for (let i = 0; i < softwareFiles.length; i++) {
    let file = softwareFiles[i];

    // add the prefix if needed
    if (!file.includes("software/scripts/")) {
      file = `software/scripts/${file}`;
    }

    processScriptFile(file);
  }
}
