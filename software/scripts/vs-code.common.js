// fs.existsSync

function _getVsCodePath() {
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

global._getTargetPaths = function (){
  const res = []
    let targetPath = '';
    targetPath =_getVsCodePath();
    if(targetPath){
      res.push(targetPath)
    }

    return res;
}

// TODO: remove me
// C:\Users\Sy Le\AppData\Roaming\VSCodium\User\settings.json
// C:\Users\Sy Le\AppData\Roaming\Code\User\settings.json
