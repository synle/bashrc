/** @type {string} GitHub repo identifier for skippy-ff releases. */
const SKIPPY_FF_REPO = "synle/skippy-ff";

/** Downloads and installs the skippy-ff Chrome extension. Release asset is published as `skippy.zip`, not `skippy-ff.zip`. */
async function doWork() {
  exitIfNoChromiumBrowser();
  await installBrowserExtension(SKIPPY_FF_REPO, "skippy.zip");
}
