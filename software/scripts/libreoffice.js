/**
 * Finds the LibreOffice user profile directory across versions (3, 4, etc.).
 * @returns {string|undefined} The path to the user profile directory, or undefined if not found
 */
function _getLibreOfficeUserDir() {
  const candidates = [
    path.join(BASE_HOMEDIR_LINUX, ".config/libreoffice"), // Linux
    path.join(BASE_HOMEDIR_LINUX, "Library/Application Support/LibreOffice"), // macOS
    `/mnt/c/Users/${CURRENT_USER}/AppData/Roaming/LibreOffice`, // Windows (WSL)
  ];

  const baseDir = candidates.find((d) => filePathExist(d));
  if (!baseDir) return undefined;

  // find the highest version directory (4, 3, etc.)
  try {
    const versions = fs
      .readdirSync(baseDir)
      .filter((d) => /^\d+$/.test(d))
      .sort((a, b) => Number(b) - Number(a));
    if (versions.length > 0) {
      const userDir = path.join(baseDir, versions[0], "user");
      if (filePathExist(userDir)) return userDir;
    }
  } catch (err) {}

  return undefined;
}

/** * Optimizes LibreOffice for performance and MS Office compatibility across all supported platforms. */
async function doWork() {
  exitIfUnsupportedOs("is_os_android_termux", "is_os_mingw64");

  log(">> Install libreoffice configs");

  // ---- disable splash screen via sofficerc ----
  const sofficeRcPaths = [
    "/etc/libreoffice/sofficerc", // Linux
    "/Applications/LibreOffice.app/Contents/Resources/sofficerc", // macOS
    "/mnt/c/Program Files/LibreOffice/program/sofficerc", // Windows (WSL)
  ];
  for (const sofficeRcPath of sofficeRcPaths) {
    if (filePathExist(sofficeRcPath)) {
      log(">>> Disable splash screen (sofficerc):", sofficeRcPath);
      let rcContent = readText(sofficeRcPath);
      rcContent = rcContent.replace(/Logo=[0-9]/, "").trim();
      rcContent += `\nLogo=0`;
      rcContent = rcContent.replace(/[\n][\n]+/, "\n");
      writeText(sofficeRcPath, rcContent);
      break;
    }
  }

  // ---- registry tweaks via registrymodifications.xcu ----
  const userDir = _getLibreOfficeUserDir();
  if (!userDir) {
    log(">>> Skipped: LibreOffice user profile not found (not installed or not launched yet)");
    return;
  }

  const registryPath = path.join(userDir, "registrymodifications.xcu");
  log(">>> Registry tweaks:", registryPath);

  if (!filePathExist(registryPath)) {
    log(">>>> Skipped: registrymodifications.xcu not found");
    return;
  }

  let regContent = readText(registryPath);
  const closingTag = "</oor:items>";

  function _setRegistryValue(oorPath, propName, value) {
    const escapedPath = oorPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existsPattern = new RegExp(`oor:path="${escapedPath}".*?oor:name="${propName}"`);
    if (existsPattern.test(regContent)) {
      log(`>>>> ${propName} (already set)`);
      return;
    }
    log(`>>>> ${propName} = ${value}`);
    const item = `<item oor:path="${oorPath}"><prop oor:name="${propName}" oor:op="fuse"><value>${value}</value></prop></item>`;
    regContent = regContent.replace(closingTag, `${item}\n${closingTag}`);
  }

  // ---- MS Office compatibility ----
  log(">>> MS Office compatibility tweaks");

  // default save formats: docx, xlsx, pptx instead of ODF
  _setRegistryValue(
    "/org.openoffice.Setup/Office/Factories/com.sun.star.text.TextDocument",
    "ooSetupFactoryDefaultFilter",
    "MS Word 2007 XML",
  );
  _setRegistryValue(
    "/org.openoffice.Setup/Office/Factories/com.sun.star.sheet.SpreadsheetDocument",
    "ooSetupFactoryDefaultFilter",
    "Calc MS Excel 2007 XML",
  );
  _setRegistryValue(
    "/org.openoffice.Setup/Office/Factories/com.sun.star.presentation.PresentationDocument",
    "ooSetupFactoryDefaultFilter",
    "Impress MS PowerPoint 2007 XML",
  );

  // use MS Office font substitutions (Calibri, Cambria, etc.)
  _setRegistryValue("/org.openoffice.Office.Common/Font/Substitution", "Replacement", "true");

  // default font to DejaVu Sans
  _setRegistryValue("/org.openoffice.Office.Writer/DefaultFont", "Standard", "DejaVu Sans");
  _setRegistryValue("/org.openoffice.Office.Writer/DefaultFont", "StandardHeight", "240");
  _setRegistryValue("/org.openoffice.Office.Calc/DefaultFont", "Standard", "DejaVu Sans");
  _setRegistryValue("/org.openoffice.Office.Calc/DefaultFont", "StandardHeight", "240");
  _setRegistryValue("/org.openoffice.Office.Impress/DefaultFont", "Standard", "DejaVu Sans");
  _setRegistryValue("/org.openoffice.Office.Impress/DefaultFont", "StandardHeight", "240");

  // use tabbed UI (Notebookbar) for a ribbon-like interface
  _setRegistryValue("/org.openoffice.Office.UI.ToolbarMode", "ActiveWriter", "notebookbar_groups.ui");
  _setRegistryValue("/org.openoffice.Office.UI.ToolbarMode", "ActiveCalc", "notebookbar_groups.ui");
  _setRegistryValue("/org.openoffice.Office.UI.ToolbarMode", "ActiveImpress", "notebookbar_groups.ui");

  // default unit: inches (matches MS Office default)
  _setRegistryValue("/org.openoffice.Office.Writer/Layout/Other", "MeasureUnit", "1");
  _setRegistryValue("/org.openoffice.Office.Calc/Layout/Other", "MeasureUnit", "1");
  _setRegistryValue("/org.openoffice.Office.Impress/Layout/Other", "MeasureUnit", "1");

  // ---- performance ----
  log(">>> Performance tweaks");

  // disable splash screen (registry backup for sofficerc method)
  _setRegistryValue("/org.openoffice.Setup/Office", "ooSetupShowIntro", "false");

  // disable Java runtime (saves ~100MB RAM, not needed for most tasks)
  _setRegistryValue("/org.openoffice.Office.Common/Java", "Enabled", "false");

  // increase undo steps for safety
  _setRegistryValue("/org.openoffice.Office.Common/Undo", "Steps", "100");

  // increase graphics cache to 256MB (smoother image/chart handling)
  _setRegistryValue("/org.openoffice.Office.Common/Cache", "GraphicManager/TotalCacheSize", "256000000");

  // disable autocorrect (faster typing, no background processing)
  _setRegistryValue("/org.openoffice.Office.Common/AutoCorrect", "Enabled", "false");

  // enable autosave to prevent data loss (interval in minutes)
  _setRegistryValue("/org.openoffice.Office.Recovery/AutoSave", "Enabled", "true");
  _setRegistryValue("/org.openoffice.Office.Recovery/AutoSave", "TimeIntervall", "5");

  // disable macro execution (faster document open + security)
  _setRegistryValue("/org.openoffice.Office.Common/Security/Scripting", "DisableMacrosExecution", "true");

  writeText(registryPath, regContent);
}
