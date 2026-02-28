// BEGIN software/scripts/sublime-text.common.js
// END software/scripts/sublime-text.common.js

let SUBLIME_VERSION;

let OS_KEY;

const WINDOWS_OS_KEY = "alt";
const MAC_OSX_KEY = "super";
const LINUX_OS_KEY = "alt";

let MOUSE_MAPS = [
  {
    button: "button1",
    count: 1,
    modifiers: ["OS_KEY"],
    press_command: "drag_select",
    command: "goto_definition",
  },
  {
    button: "button2",
    count: 1,
    modifiers: ["OS_KEY"],
    command: "goto_reference",
  },
  { button: "button4", command: "jump_back" },
  { button: "button5", command: "jump_forward" },
  // tripple click to select scope
  {
    button: "button1",
    count: 3,
    command: "expand_selection",
    args: { to: "scope" },
  },
];

/**
 * Replaces OS_KEY placeholders in mouse map modifier arrays with the actual OS-specific key.
 * @param {object[]} mouseMaps - Array of Sublime Text mouse map objects.
 * @param {string} osKeyToUse - The OS-specific modifier key to substitute.
 * @returns {object[]} Mouse maps with resolved modifier keys.
 */
function _formatKey(mouseMaps, osKeyToUse) {
  osKeyToUse = osKeyToUse || OS_KEY;

  mouseMaps = clone(mouseMaps);

  for (const mouseMap of mouseMaps) {
    mouseMap.modifiers = mouseMap.modifiers?.map((s) => s.replace(/OS_KEY/g, osKeyToUse));
  }

  return mouseMaps;
}

/**
 * Resolves OS key, writes prebuilt mouse map configs per platform, and applies the config to the local Sublime Text installation.
 */
async function doWork() {
  exitIfUnsupportedOs("is_os_android_termux", "is_os_arch_linux", "is_os_chromeos");
  OS_KEY = resolveOsKey({ windows: WINDOWS_OS_KEY, mac: MAC_OSX_KEY, linux: LINUX_OS_KEY });

  console.log(`  >> Setting up Sublime Text MouseMaps`);

  // write to build file
  console.log(`    >> For prebuilt configs`);
  writeToBuildFile([
    { file: "sublime-text-mouse", data: _formatKey(MOUSE_MAPS, WINDOWS_OS_KEY), isJson: true },
    { file: "sublime-text-mouse-macosx", data: _formatKey(MOUSE_MAPS, MAC_OSX_KEY), isJson: true },
  ]);

  // for my own system
  let targetPath = await _getPathSublimeText();
  console.log("    >> For my system", targetPath);
  exitIfPathNotFound(targetPath);

  const fileDestPath = path.join(targetPath, "Packages/User/Default.sublime-mousemap");
  console.log("      >> fileDestPath", fileDestPath);
  writeJson(fileDestPath, _formatKey(MOUSE_MAPS, is_os_darwin_mac ? MAC_OSX_KEY : WINDOWS_OS_KEY));
}
