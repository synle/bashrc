global._getPathSublimeText = async function () {
  const regexBinary = /Sublime[ -]*Text[0-9]*[0-9]*/i;

  try {
    if (is_os_window) {
      return findDirSingle(getWindowAppDataRoamingUserPath(), regexBinary);
    }

    if (is_os_darwin_mac) {
      return findDirSingle(getOsxApplicationSupportCodeUserPath(), regexBinary);
    }

    if (is_os_arch_linux) {
      return findDirSingle(path.join(process.env.HOME, '.var/app/com.sublimetext.three/config', regexBinary));
    }

    // for debian or chrome os debian linux
    return findDirSingle(globalThis.BASE_HOMEDIR_LINUX + '/.config', regexBinary);
  } catch (err) {
    console.log('      >> Failed to get the path', err);
  }

  return null;
};
