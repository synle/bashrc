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

  const files = filesToTest
    .split(/[,;\s]/) // list can be separated by ; or , or \n or \r
    .map((s) => s.trim())
    .filter((s) => !!s);

  console.log(`echo '''>> Parsed Scripts: \n${files.join("\n")}'''`);

  for (let file of files) {
    // add the prefix if needed
    if (!file.includes("software/scripts/")) {
      file = `software/scripts/${file}`;
    }

    const url = `https://raw.githubusercontent.com/synle/bashrc/master/${file}`;

    console.log(echoColor1(`>> ${file}`));
    processScriptFile(file, url);
  }
}
