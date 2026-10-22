/** Build a verified, deterministic Decky binary-cache bundle using Node.js and curl. */
const path = require("path");
const { build } = require("../scripts/decky/decky-runtime.common.js");

if (process.argv.length !== 3) {
  process.stderr.write("Usage: node software/tools/decky-bundle.js OUTPUT.zip\n");
  process.exitCode = 2;
} else {
  build(path.resolve(process.argv[2]))
    .then(() => {
      process.stderr.write(">>> Decky bundle ready\n");
    })
    .catch((error) => {
      process.stderr.write(`>>> Decky bundle failed: ${error.message}\n`);
      process.exitCode = 1;
    });
}
