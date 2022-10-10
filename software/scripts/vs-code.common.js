global._getVsCodePath = function () {
  if (is_os_window) {
    return findDirSingle(getWindowAppDataRoamingUserPath(), /Code/);
  }
  if (is_os_darwin_mac) {
    return findDirSingle(getOsxApplicationSupportCodeUserPath(), /Code/);
  }
  if (is_os_arch_linux) {
    return path.join(process.env.HOME, '.var/app/com.visualstudio.code/config/Code');
  }
  return null;
};
