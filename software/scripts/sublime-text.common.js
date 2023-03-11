global._getPathSublimeText = async function () {
  try {
    if (is_os_window) {
      return findDirSingle(getWindowAppDataRoamingUserPath(), /Sublime[ ]*Text/i);
    }

    if (is_os_darwin_mac) {
      return findDirSingle(getOsxApplicationSupportCodeUserPath(), /Sublime[ ]*Text/i);
    }

    if (is_os_chromeos) {
      return path.join(process.env.HOME, '.config/sublime-text');
    }

    if (is_os_arch_linux) {
      return path.join(process.env.HOME, '.var/app/com.sublimetext.three/config/sublime-text-3');
    }

    // for debian or chrome os debian linux
    return findDirSingle(globalThis.BASE_HOMEDIR_LINUX + '/.config', /Sublime[ -]*Text/i);
  } catch (err) {
    console.log('      >> Failed to get the path', err);
  }

  return null;
};
