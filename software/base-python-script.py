import os
import re

path = os.path

def getWindowUserBaseDir():
  return 'aaa'


BASE_WINDOW = '/mnt/c/Users'
BASE_HOMEDIR_LINUX = os.path.expanduser('~')
BASE_BASH_SYLE = path.join(BASE_HOMEDIR_LINUX, '.bash_syle')

"""
if you need to override these with your local settings, use the following
  export FONT_SIZE=15
  export FONT_FAMILY='Fira Code'
  export TAB_SIZE=2
"""
try:
  fontSize = int(os.environ.get('FONT_SIZE'))
except:
  fontSize = 10
if (fontSize <= 10):
  fontSize = 10

fontFamily = os.environ.get('FONT_FAMILY', 'Fira Code')

try:
  tabSize = int(os.environ.get('TAB_SIZE'))
except:
  tabSize = 2
if (tabSize <= 2):
  tabSize = 2

EDITOR_CONFIGS = {
  'fontSize': fontSize,
  'fontFamily': fontFamily,
  'tabSize': tabSize,
  'maxLineSize': 140,
  'ignoredFiles': [
    '*.rej',
    '*.class',
    '*.db',
    '*.dll',
    '*.doc',
    '*.docx',
    '*.dylib',
    '*.exe',
    '*.idb',
    '*.jar',
    '*.js.map',
    '*.lib',
    '*.min.js',
    '*.mp3',
    '*.ncb',
    '*.o',
    '*.obj',
    '*.ogg',
    '*.pdb',
    '*.pdf',
    '*.pid',
    '*.pid.lock',
    '*.psd',
    '*.pyc',
    '*.pyo',
    '*.sdf',
    '*.seed',
    '*.sln',
    '*.so',
    '*.sqlite',
    '*.suo',
    '*.swf',
    '*.swp',
    '*.woff',
    '*.woff2',
    '*.zip',
    '.DS_Store',
    '.eslintcache',
    'yarn.lock',
    'package-lock.json',
  ],
  'ignoredFolders': [
    '.cache',
    '.ebextensions',
    '.generated',
    '.git',
    '.gradle',
    '.hg',
    '.idea',
    '.sass-cache',
    '.svn',
    'bower_components',
    'build',
    'CVS',
    'dist',
    'node_modules',
    'tmp',
    'webpack-dist',
    '__pycache__',
    '.mypy_cache',
    '.pytest_cache',
  ],
}

"""
The host config is located here:
host name => host ip
"""
HOME_HOST_NAMES = []

"""
os flags
"""
for envKey, envVal in os.environ.items():
  if 'is_os_' in envKey:
    globals()[envKey] = int(envVal) > 0


# setting up the path for the extra tweaks
BASE_SY_CUSTOM_TWEAKS_DIR = path.join(getWindowUserBaseDir(), '...sy', '_extra') if is_os_window else  path.join(globalThis.BASE_HOMEDIR_LINUX, '_extra')

DEBUG_WRITE_TO_DIR = len(os.environ.get('DEBUG_WRITE_TO_DIR', '')) > 0

repoName = 'synle/bashrc'
repoBranch = 'master'
REPO_PREFIX_URL = "https://raw.githubusercontent.com/{repoName}/{repoBranch}".format(**locals())


isTestScriptMode = int(os.environ.get('TEST_SCRIPT_MODE', '0')) == 1


def getFilePath(aDir):
  pathToUse = aDir
  if (len(DEBUG_WRITE_TO_DIR) > 0):
    fileName = aDir
    fileName = re.sub("[\/\\\(\)]", '_', fileName)
    fileName = re.sub(" ", '_', fileName)
    fileName = re.sub("_\.", '.', fileName)
    fileName = re.sub("__+", '_', fileName)

    pathToUse = path.join(DEBUG_WRITE_TO_DIR, fileName)

  return pathToUse




def findDirList(srcDir, targetMatch, returnFirstMatch):
  try:
    dirFiles = []
    for partialPath in os.listdir(srcDir):
      newDirFile = path.join(srcDir, partialPath)
      if path.isdir(newDirFile) and re.search(targetMatch, newDirFile):
        dirFiles.append(path.join(srcDir, partialPath))

    if (returnFirstMatch):
      return dirFiles[0]

    return dirFiles
  except:
    if (returnFirstMatch):
      return None
    return []


def findDirSingle(srcDir, targetMatch):
  return findDirList(srcDir, targetMatch, True);


"""
find and return the first dir that matches the prop

@param  {array} findProps must contains "src" and "match"
targetPath = findFirstDirFromList([
  ['/mnt/d/', 'Documents'],
  [getWindowUserBaseDir(), 'Documents'],
]);

@return {string} the path of the first dir and undefined otherwise
"""
def findFirstDirFromList(findProps):
  for [src, match] in findProps :
    matchedDir = findDirSingle(src, match);
    if (matchedDir):
      return matchedDir

  return None;



print(findFirstDirFromList([
  ['/home/syle/git', 'basha'],
  ['/home/syle/git', 'bash'],
]))
