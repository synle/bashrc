/** Downloads and installs Classic Start menu for Windows. */
async function doWork() {
  log(">> Installing Windows Only - Classic Start Configs");
  const res = await readText`software/scripts/windows/classic_start.config.xml`;

  await writeBuildArtifact([{ file: `${BUILD_DIR}/windows-classic-start-menu.xml`, data: res }]);

  const targetPath = await getCustomTweaksPath("windows/classic-start.xml");

  log(">>> Classic Start Configs", targetPath);
  await writeText(targetPath, res);
}
