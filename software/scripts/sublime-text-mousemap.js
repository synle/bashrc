includeSource('software/scripts/sublime-text.common.js');

let SUBLIME_VERSION;

let OS_KEY;

const WINDOWS_OS_KEY = 'alt';
const MAC_OSX_KEY = 'super';
const LINUX_OS_KEY = 'alt';

let MOUSE_MAPS = [
  {
    button: 'button1',
    count: 1,
    modifiers: ['OS_KEY'],
    press_command: 'drag_select',
    command: 'goto_definition',
  },
];

function _formatKey(mouseMaps, osKeyToUse) {
  osKeyToUse = osKeyToUse || OS_KEY;

  mouseMaps = clone(mouseMaps);

  for (const mouseMap of mouseMaps) {
    mouseMap.modifiers = mouseMap.modifiers.map((s) => s.replace(/OS_KEY/g, osKeyToUse));
  }

  return mouseMaps;
}

async function doInit() {
  OS_KEY = is_os_darwin_mac ? MAC_OSX_KEY : WINDOWS_OS_KEY;
}

async function doWork() {
  let targetPath = await _getPathSublimeText();

  console.log(`  >> Setting up Sublime Text MouseMaps:`, consoleLogColor4(targetPath));

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

  const winMouseMapPath = path.join(targetPath, 'Packages/User/Default (Windows).sublime-mousemap');
  console.log('    >> Windows', winMouseMapPath);
  writeJson(winMouseMapPath, _formatKey(MOUSE_MAPS, WINDOWS_OS_KEY));

  const linuxMouseMapPath = path.join(targetPath, 'Packages/User/Default (Linux).sublime-mousemap');
  console.log('    >> Linux', linuxMouseMapPath);
  writeJson(linuxMouseMapPath, _formatKey(MOUSE_MAPS, LINUX_OS_KEY));

  const osxMouseMapPath = path.join(targetPath, 'Packages/User/Default (OSX).sublime-mousemap');
  console.log('    >> OSX', osxMouseMapPath);
  writeJson(osxMouseMapPath, _formatKey(MOUSE_MAPS, MAC_OSX_KEY));
}
