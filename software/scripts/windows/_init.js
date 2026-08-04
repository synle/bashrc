/** Platform init for Windows - creates common directories and initializes the PowerShell profile. */
async function doWork() {
  // fetch the PowerShell profile template and write it with placeholders intact
  // later scripts append blocks via registerWithPowershellProfile()
  log(">> Initializing PowerShell profile template:", POWERSHELL_SYLE_PATH);
  const psTemplate = await readText`software/scripts/windows/powershell-profile.ps1.bash`;
  writeText(POWERSHELL_SYLE_PATH, psTemplate.replace(/\{\{MAX_NESTED_DEPTH\}\}/g, String(MAX_NESTED_DEPTH)));

  let targetPath = "/mnt/d";

  log(">> mkdir for D Drive", targetPath);

  if (!pathExists(targetPath)) {
    log(">>> Skipped - Path Not Found: ", targetPath);
  } else {
    const pathsToCreate = set`
    ${path.join(targetPath, "Applications")}
    ${path.join(targetPath, "Desktop")}
    ${path.join(targetPath, "Documents")}
    ${path.join(targetPath, "Downloads")}
    ${path.join(targetPath, "Games")}
    ${path.join(targetPath, "Pictures")}
  `;

    log(">>> total", pathsToCreate.length);

    for (const pathToCreate of pathsToCreate) {
      log(">>>> ", pathToCreate);
      await mkdir(pathToCreate);
    }
  }

  // copy PowerShell setup scripts to the user's Desktop (right-click → Run as administrator)
  const windowsUserDir = getWindowUserBaseDir();
  if (windowsUserDir) {
    const desktopPath = path.join(windowsUserDir, "Desktop");
    if (pathExists(desktopPath)) {
      log(">> Copying PowerShell setup scripts to Desktop:", desktopPath);
      const bootstrapScript = await readText`software/scripts/windows/_full-setup-bootstrap.ps1.bash`;
      const setupScript = await readText`software/scripts/windows/_full-setup.ps1.bash`;
      writeText(path.join(desktopPath, "_full-setup-bootstrap.ps1"), bootstrapScript);
      writeText(path.join(desktopPath, "_full-setup.ps1"), setupScript);
    }
  }
}
