/** * Downloads and installs Rufus USB bootable drive creator for Windows. */
async function doWork() {
  await downloadWindowsApp("rufus", (f) => f.includes("rufus"));
}
