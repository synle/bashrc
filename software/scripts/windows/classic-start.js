/** * Downloads and installs Classic Start menu for Windows. */
async function doWork() {
  log(">> Installing Windows Only - Classic Start Configs");
  const res = await fetchUrlAsString(`software/scripts/windows/classic_start.config.xml`);

  writeToBuildFile([{ file: "windows-classic-start-menu.xml", data: res }]);

  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "windows", "classic-start.xml");

  log(">>> Classic Start Configs", targetPath);
  writeText(targetPath, res);
}
