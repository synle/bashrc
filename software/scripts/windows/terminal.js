// guide: refer to this
// https://docs.microsoft.com/en-us/windows/terminal/get-started
// https://docs.microsoft.com/en-us/windows/terminal/customize-settings/key-bindings#accepted-modifiers-and-keys
//
// for profile icons (use this website - https://www.compart.com/). Pick UTF-16
const historySize = 50000;

const UUID_POWERSHELL_PROFILE = `{c993c0b6-0023-5562-a928-3ea11eb283ce}`;
const UUID_LOCAL_VM_SSH_PROFILE = '{ae240490-446d-462c-bb40-0a92fc3c7a3f}';
const UUID_WSL_DEBIAN_PROFILE = '{58ad8b0c-3ef8-5f4d-bc6f-13e4c00f2530}';
const UUID_SY_MACPRO_PROFILE = '{8e8e313c-1df0-4519-850c-d1532dd63843}';

let BASE_CONFIG = {};
let DEFAULT_PROFILES = {};
let DEFAULT_PROFILE_STYLES = {};

async function doInit() {
  DEFAULT_PROFILE_STYLES = {
    cursorShape: 'vintage',
    cursorHeight: 50,
    fontFace: EDITOR_CONFIGS.fontFamily,
    fontSize: Math.min(EDITOR_CONFIGS.fontSize, 9),
    padding: '2 0 2 0',
    bellStyle: 'all',
    historySize,
    // useAcrylic: true,
  };

  BASE_CONFIG = {
    // global config
    copyOnSelect: false,
    copyFormatting: false,
    useTabSwitcher: false,
    multiLinePasteWarning: false,
    rowsToScroll: 5,
    initialCols: 80,
    initialRows: 30,
    tabWidthMode: 'compact',
    initialPosition: '5,5',
    confirmCloseAllTabs: true,
    disableAnimations: true,
    focusFollowMouse: true,
    'experimental.rendering.forceFullRepaint': true,

    // schema
    schemes: [
      {
        name: 'Dracula',
        background: '#282a36',
        black: '#21222c',
        blue: '#bd93f9',
        brightBlack: '#6272a4',
        brightBlue: '#d6acff',
        brightCyan: '#a4ffff',
        brightGreen: '#69ff94',
        brightPurple: '#ff92df',
        brightRed: '#ff6e6e',
        brightWhite: '#ffffff',
        brightYellow: '#ffffa5',
        cyan: '#8be9fd',
        foreground: '#f8f8f2',
        green: '#50fa7b',
        purple: '#ff79c6',
        red: '#ff5555',
        white: '#f8f8f2',
        yellow: '#f1fa8c',
        selectionBackground: '#cccccc',
        cursor: '#cccccc',
      },
      {
        name: 'Retro',
        background: '#000000',
        black: '#00ff00',
        blue: '#00ff00',
        brightBlack: '#00ff00',
        brightBlue: '#00ff00',
        brightCyan: '#00ff00',
        brightGreen: '#00ff00',
        brightPurple: '#00ff00',
        brightRed: '#00ff00',
        brightWhite: '#00ff00',
        brightYellow: '#00ff00',
        cyan: '#00ff00',
        foreground: '#00ff00',
        green: '#00ff00',
        purple: '#00ff00',
        red: '#00ff00',
        white: '#00ff00',
        yellow: '#00ff00',
      },
      {
        name: 'Campbell',
        cursorColor: '#ffffff',
        selectionBackground: '#ffffff',
        background: '#0c0c0c',
        foreground: '#cccccc',
        black: '#0c0c0c',
        blue: '#0037da',
        cyan: '#3a96dd',
        green: '#13a10e',
        purple: '#881798',
        red: '#c50f1f',
        white: '#cccccc',
        yellow: '#c19c00',
        brightBlack: '#767676',
        brightBlue: '#3b78ff',
        brightCyan: '#61d6d6',
        brightGreen: '#16c60c',
        brightPurple: '#b4009e',
        brightRed: '#e74856',
        brightWhite: '#f2f2f2',
        brightYellow: '#f9f1a5',
      },
    ],

    // keybindings
    keybindings: [...(parseJsonWithComments(await fetchUrlAsString('software/scripts/windows/terminal.keybinding.jsonc')) || [])],
  };

  DEFAULT_PROFILES = {
    profiles: {
      defaults: {},
      list: [
        {
          name: 'Windows PowerShell',
          commandline: '%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoLogo',
          colorScheme: 'Campbell',
          icon: '\ud83d\udcbb', // 💻 - https://www.compart.com/en/unicode/U+1F4BB
          guid: UUID_POWERSHELL_PROFILE,
          ...DEFAULT_PROFILE_STYLES,
        },
        {
          name: 'SSH Localhost',
          commandline: 'ssh syle@127.0.0.1',
          colorScheme: 'Dracula',
          icon: '\ud83d\ude80', // 🚀 - https://www.compart.com/en/unicode/U+1F680
          guid: UUID_LOCAL_VM_SSH_PROFILE,
          ...DEFAULT_PROFILE_STYLES,
        },
        {
          name: 'WSL Linux',
          source: 'Windows.Terminal.Wsl',
          guid: UUID_WSL_DEBIAN_PROFILE,
          ...DEFAULT_PROFILE_STYLES,
        },
      ],
    },
  };
}

async function doWork() {
  // write to build file
  const comments = '// Open settings file (JSON)';
  const prebuiltConfigs = clone({ ...BASE_CONFIG, ...DEFAULT_PROFILES });
  prebuiltConfigs.defaultProfile = prebuiltConfigs.profiles.list[0].guid;

  writeToBuildFile([{ file: 'windows-terminal', data: prebuiltConfigs, isJson: true, comments }]);

  const targetPath = path.join(_getPath(), 'LocalState/settings.json');
  if (!filePathExist(targetPath)) {
    console.log('  >> Skipped Windows Terminal Config - Settings Path Not Found: ', consoleLogColor4(targetPath));
    return process.exit();
  }

  console.log('  >> Setting up Microsoft Windows Terminal', consoleLogColor4(targetPath));

  const oldSettings = readJson(targetPath);

  // keep track of actions
  const actions = oldSettings.actions || [];
  delete oldSettings.actions;

  BASE_CONFIG.keybindings = [...actions, ...BASE_CONFIG.keybindings];

  const newSettings = Object.assign(oldSettings, BASE_CONFIG);

  // setup the profile color scheme
  let foundDefaultProfile = false;
  let foundLocalVMSSHProfile = false;
  let foundSyMacproProfile = false;

  const allProfiles = newSettings.profiles.list || newSettings.profiles || [];

  // here we see if we need to add a new default profile for local vm
  allProfiles.forEach((profile) => {
    if (profile.guid === UUID_LOCAL_VM_SSH_PROFILE) {
      foundLocalVMSSHProfile = true;
    }

    if (profile.guid === UUID_SY_MACPRO_PROFILE) {
      foundSyMacproProfile = true;
    }
  });

  if (!foundLocalVMSSHProfile) {
    allProfiles.push({
      commandline: 'ssh syle@127.0.0.1',
      guid: UUID_LOCAL_VM_SSH_PROFILE,
      hidden: false,
      colorScheme: 'Solarized Dark',
      name: 'SSH VirtualBox',
      icon: '\ud83d\ude80', // 🚀
    });
  }

  if (!foundSyMacproProfile) {
    allProfiles.push({
      commandline: 'ssh syle@sy-macpro',
      guid: UUID_SY_MACPRO_PROFILE,
      hidden: false,
      colorScheme: 'Tango Dark',
      name: 'SSH Sy-MacPro',
      icon: '\ud83d\udea2', //🚢
    });
  }

  newSettings.profiles = allProfiles.map((profile) => {
    profile = Object.assign(profile, DEFAULT_PROFILE_STYLES);

    let mainColorScheme;
    switch (profile.commandline) {
      case 'powershell.exe':
        mainColorScheme = 'Campbell';
        break;
      case 'cmd.exe':
        mainColorScheme = 'Retro';
        break;
      default:
        mainColorScheme = 'Dracula';
        break;
    }
    profile.colorScheme = profile.colorScheme || mainColorScheme;

    // TODO: this is for dark mode vs light mode switching
    // will likely wait for Windows Terminal supports it
    // profile.colorSchemeDark = 'One Half Dark';
    // profile.colorSchemeLight = 'One Half Light';
    // profile.colorScheme = profile.colorSchemeDark;

    // set default profile
    if (!foundDefaultProfile && [/Debian/i, /Ubuntu/i].some((distroToUseForDefault) => profile.name.match(distroToUseForDefault))) {
      newSettings.defaultProfile = profile.guid;
      foundDefaultProfile = true;
    }

    return profile;
  });

  // fall back to set and use powershell to set default profile, pick the first one
  if (!foundDefaultProfile) {
    newSettings.defaultProfile = allProfiles[0].guid;
  }

  // done - write to file
  writeJson(targetPath, newSettings);
}

function _getPath() {
  try {
    if (is_os_window) {
      const localPackgesPath = path.join(getWindowUserBaseDir(), 'AppData/Local/Packages/');
      return findDirSingle(localPackgesPath, /Microsoft\.WindowsTerminal/i);
    }
    return null;
  } catch (e) {
    console.log('  >> Skipped Windows Terminal Config - Error');
    return process.exit();
  }
}
