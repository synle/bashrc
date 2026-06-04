/** @type {string} GitHub repo identifier for skippy-ff releases. */
const SKIPPY_FF_REPO = "synle/skippy-ff";

/** Downloads and installs the skippy-ff Chrome extension. */
async function doWork() {
  exitIfNoChromiumBrowser();
  await installBrowserExtension(SKIPPY_FF_REPO);
}
