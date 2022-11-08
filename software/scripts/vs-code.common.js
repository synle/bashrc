global._getVsCodePath = function () {
  try {
    if (is_os_window) {
      return findDirSingle(getWindowAppDataRoamingUserPath(), /Code/);
    }

    if (is_os_darwin_mac) {
      return findDirSingle(getOsxApplicationSupportCodeUserPath(), /Code/);
    }

    if (is_os_chromeos) {
      return path.join(process.env.HOME, '.config/Code');
    }

    if (is_os_arch_linux) {
      return path.join(process.env.HOME, '.var/app/com.visualstudio.code/config/Code');
    }
  } catch (err) {
    console.log('      >> Failed to get the path', err);
  }

  return null;
};
