/**
 * Downloads the TightVNC Java viewer application for Windows.
 * Skipped on a headless host — the viewer renders a remote desktop into a local
 * window, so with no display there is nowhere to draw it.
 */
async function doWork() {
  exitIfNoGui();

  await downloadApp("tightvnc", "tightvnc-jviewer.jar");
}
