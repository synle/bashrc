/** @type {string} GitHub repo identifier for url-porter releases. */
const URL_PORTER_REPO = "synle/url-porter";

/** Downloads and installs the url-porter Chrome extension. */
async function doWork() {
  exitIfNoChromiumBrowser();
  await installBrowserExtension(URL_PORTER_REPO);
}
