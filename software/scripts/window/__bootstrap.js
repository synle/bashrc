/** * Creates common Windows directories for applications and tools. */
async function doWork() {
  let targetPath = BASE_D_DIR_WINDOW;

  log("  >> mkdir for D Drive", colorDim(targetPath));

  if (!filePathExist(targetPath)) {
    log("  >> Skipped - Path Not Found: ", colorDim(targetPath));
    return process.exit();
  }

  const pathsToCreate = convertTextToList(`
    ${path.join(targetPath, "Applications")}
    ${path.join(targetPath, "Desktop")}
    ${path.join(targetPath, "Documents")}
    ${path.join(targetPath, "Downloads")}
    ${path.join(targetPath, "Games")}
    ${path.join(targetPath, "Pictures")}
  `);

  log(pathsToCreate);

  for (const pathToCreate of pathsToCreate) {
    log("    >> ", pathToCreate);
    await mkdir(pathToCreate);
  }
}
