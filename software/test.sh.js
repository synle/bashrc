/*
## how to run?
# use code from local
sh ./test.sh "git.js"

# use code from upstream
sh ./test-live.sh "git.js"
*/
let filesToTest;

async function doWork() {
  if (!filesToTest) {
    console.log(`echo '''    >> Skipped'''`);
    return;
  }

  const softwareFiles = filesToTest
    .split(/[,;\s]/) // list can be separated by ; or , or \n or \r
    .map((s) => s.trim())
    .filter((s) => !!s);

  console.log(
    `echo '''>> Parsed Scripts: ${softwareFiles.length} \n${softwareFiles.join(
      "\n"
    )}'''
    `
  );

  // Print OS Environments
  console.log(`
    node -e """
      console.log('===================== OS Flags ========================');
      Object.keys(process.env)
        .filter(envKey => envKey.indexOf('is_os_') === 0)
        .forEach(envKey => console.log('= ', envKey.padEnd(23, ' ') + ':', process.env[envKey]))
      console.log('=======================================================');
    """
  `);

  for (let i = 0; i < softwareFiles.length; i++) {
    let file = softwareFiles[i];

    if (file.includes("software/")) {
      // does not includes the proper prefix
    } else {
      // add the prefix if needed
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
