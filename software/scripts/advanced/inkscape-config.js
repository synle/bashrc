/** Configures Inkscape: autosave 5min (max 10 backups), 128MB render cache, high filter quality, 20 recent docs. */
/**
 * Finds the Inkscape preferences.xml path across platforms.
 * @returns {string|undefined} Path to preferences.xml, or undefined if not found.
 */
function _getInkscapePrefsPath() {
  const candidates = [
    path.join(BASE_HOMEDIR_LINUX, ".config/inkscape/preferences.xml"), // Linux
    path.join(BASE_HOMEDIR_LINUX, "Library/Application Support/org.inkscape.Inkscape/config/inkscape/preferences.xml"), // macOS
    `/mnt/c/Users/${CURRENT_USER}/AppData/Roaming/inkscape/preferences.xml`, // Windows (WSL)
  ];
  return candidates.find((p) => pathExists(p));
}

/**
 * Sets an attribute on an Inkscape preferences.xml group element identified by its id path.
 * Path format: "options.autosave" means <group id="options"><group id="autosave">.
 * Creates missing group elements as needed.
 * @param {string} content - The XML content.
 * @param {string} groupPath - Dot-separated group id path (e.g., "options.autosave").
 * @param {string} attr - Attribute name to set.
 * @param {string} value - Attribute value.
 * @returns {string} Updated XML content.
 */
function _setInkscapePref(content, groupPath, attr, value) {
  const ids = groupPath.split(".");

  // Build a regex that matches the deepest group element
  // For "options.autosave" -> find <group id="autosave" within <group id="options">
  const lastId = ids[ids.length - 1];

  // find the group tag with the matching id
  const groupTagPattern = new RegExp(`(<group\\s+id="${lastId}")(\\s[^>]*?)(\\s*/?>)`, "m");
  const groupTagPatternNoAttrs = new RegExp(`(<group\\s+id="${lastId}")(\\s*/?>)`, "m");
  const attrPattern = new RegExp(`\\b${attr}="[^"]*"`, "m");

  // check if the group exists with attributes
  let match = content.match(groupTagPattern);
  if (match) {
    const fullTag = match[0];
    if (attrPattern.test(fullTag)) {
      // attribute exists - replace value
      return content.replace(fullTag, fullTag.replace(attrPattern, `${attr}="${value}"`));
    }
    // attribute doesn't exist - add it before the closing
    return content.replace(fullTag, `${match[1]}${match[2]} ${attr}="${value}"${match[3]}`);
  }

  // check for group tag with no extra attributes
  match = content.match(groupTagPatternNoAttrs);
  if (match) {
    return content.replace(match[0], `${match[1]} ${attr}="${value}"${match[2]}`);
  }

  // group doesn't exist - find parent group and add child before its closing tag
  if (ids.length >= 2) {
    const parentId = ids[ids.length - 2];
    // look for the parent's closing tag or self-closing and inject the child
    const parentOpenPattern = new RegExp(`(<group\\s+id="${parentId}"[^>]*?)\\s*/>`, "m");
    const parentMatch = content.match(parentOpenPattern);
    if (parentMatch) {
      // parent is self-closing - expand it and add child
      return content.replace(parentMatch[0], `${parentMatch[1]}>\n    <group id="${lastId}" ${attr}="${value}" />\n  </group>`);
    }
  }

  // last resort - add before closing </inkscape> tag
  const closingTag = "</inkscape>";
  if (content.includes(closingTag)) {
    return content.replace(closingTag, `  <group id="${lastId}" ${attr}="${value}" />\n${closingTag}`);
  }

  return content;
}

/**
 * Returns the desired Inkscape preference settings.
 * @returns {Array<{path: string, attr: string, value: string}>} Settings list.
 */
function _getInkscapeSettings() {
  return [
    // ---- Autosave ----
    { path: "options.autosave", attr: "enable", value: "1" }, // enable periodic autosave
    { path: "options.autosave", attr: "interval", value: "300" }, // autosave interval in seconds (300 = 5 min)
    { path: "options.autosave", attr: "max", value: "10" }, // keep up to 10 autosave backups

    // ---- Rendering / Performance ----
    { path: "options.rendering", attr: "tile_size", value: "16" }, // render tile size (smaller = less latency, more overhead)
    { path: "options.rendering", attr: "render_time_limit", value: "80" }, // ms before aborting a render frame
    { path: "options.renderingcache", attr: "size", value: "128" }, // rendering cache in MB (default 64)

    // ---- Quality ----
    { path: "options.filterquality", attr: "value", value: "1" }, // 0=normal, 1=best quality blur/filter rendering

    // ---- UI ----
    { path: "options.maxrecentdocuments", attr: "value", value: "20" }, // recent documents list size
    { path: "options.bitmapautoreload", attr: "value", value: "1" }, // auto-reload linked bitmaps when changed on disk
  ];
}

/** Applies optimized Inkscape rendering, autosave, and UI preferences. */
async function doWork() {
  log(">> Install Inkscape configs");

  const prefsPath = _getInkscapePrefsPath();
  if (!prefsPath) {
    log(">>> Skipped: Inkscape preferences.xml not found (not installed or not launched yet)");
    return;
  }

  log(">>> Inkscape preferences:", prefsPath);
  await backupConfigFile(prefsPath);

  let content = await readText`${prefsPath}`;
  for (const { path: groupPath, attr, value } of _getInkscapeSettings()) {
    log(`>>>> ${groupPath}.${attr} = ${value}`);
    content = _setInkscapePref(content, groupPath, attr, value);
  }

  await writeText(prefsPath, content);
  log(">>> Done. Restart Inkscape for changes to take effect.");
}
