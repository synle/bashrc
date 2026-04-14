/** Platform init for MSYS2 / Cygwin / MinGW64 - detects shell environment. */
async function doWork() {
  // log detected MinGW environment for debugging
  const msystem = process.env.MSYSTEM || "unknown";
  const msysHome = process.env.MSYS_HOME || process.env.HOME;
  log(">> MinGW64 environment detected: MSYSTEM=" + msystem, "HOME=" + msysHome);
}
