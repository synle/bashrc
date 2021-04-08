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
    )}'''`
  );

  for (let i = 0; i < softwareFiles.length; i++) {
    let file = softwareFiles[i];

    // add the prefix if needed
    if (!file.includes("software/scripts/")) {
      file = `software/scripts/${file}`;
    }

    console.log(
      echoColor1(
        `>> ${file} (${calculatePercentage(i + 1, softwareFiles.length)}%)`
      )
    );

    processScriptFile(file);
  }
}
