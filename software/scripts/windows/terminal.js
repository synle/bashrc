// guide: refer to this
// https://docs.microsoft.com/en-us/windows/terminal/get-started
// https://docs.microsoft.com/en-us/windows/terminal/customize-settings/key-bindings#accepted-modifiers-and-keys

async function doWork() {
  const targetPath = path.join(_getPath(), 'LocalState/settings.json');
  if (!fs.existsSync(targetPath)) {
    console.log('  >> Skipped Windows Terminal Config - Settings Path Not Found: ', consoleLogColor4(targetPath));
    return process.exit();
  }

  console.log('  >> Setting up Microsoft Windows Terminal', consoleLogColor4(targetPath));

  const oldProfiles = readJson(targetPath);
  const newProfiles = Object.assign(oldProfiles, {
    // global config
    copyOnSelect: false,
    copyFormatting: false,
    useTabSwitcher: false,
    multiLinePasteWarning: false,
    rowsToScroll: 5,
    initialCols: 120,
    initialRows: 45,
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
    keybindings: [
      { command: 'commandPalette', keys: 'ctrl+shift+p' },
      {
        command: 'copy',
        keys: 'alt+c',
      },
      {
        command: 'paste',
        keys: 'ctrl+v',
      },
      {
        command: 'nextTab',
        keys: 'ctrl+pgdn',
      },
      {
        command: 'prevTab',
        keys: 'ctrl+pgup',
      },
      {
        command: 'resetFontSize',
        keys: 'ctrl+0',
      },
      {
        command: 'find',
        keys: 'ctrl+f',
      },
      {
        command: 'decreaseFontSize',
        keys: 'ctrl+-',
      },
      {
        command: 'increaseFontSize',
        keys: 'ctrl+=',
      },
      {
        command: 'scrollDown',
        keys: 'ctrl+down',
      },
      {
        command: 'scrollDownPage',
        keys: 'ctrl+right',
      },
      {
        command: 'scrollUp',
        keys: 'ctrl+up',
      },
      {
        command: 'scrollUpPage',
        keys: 'ctrl+left',
      },
      {
        command: 'newTab',
        keys: ['ctrl+t'],
      },
      {
        command: {
          action: 'switchToTab',
          index: 0,
        },
        keys: 'ctrl+1',
      },
      {
        command: {
          action: 'switchToTab',
          index: 1,
        },
        keys: 'ctrl+2',
      },
      {
        command: {
          action: 'switchToTab',
          index: 2,
        },
        keys: 'ctrl+3',
      },
      {
        command: {
          action: 'switchToTab',
          index: 3,
        },
        keys: 'ctrl+4',
      },
      {
        command: {
          action: 'switchToTab',
          index: 4,
        },
        keys: 'ctrl+5',
      },
      {
        command: {
          action: 'switchToTab',
          index: 5,
        },
        keys: 'ctrl+6',
      },
      {
        command: {
          action: 'switchToTab',
          index: 6,
        },
        keys: 'ctrl+7',
      },
      {
        command: {
          action: 'switchToTab',
          index: 7,
        },
        keys: 'ctrl+8',
      },
      {
        command: {
          action: 'switchToTab',
          index: 8,
        },
        keys: 'ctrl+9',
      },
      {
        command: 'closePane',
        keys: 'ctrl+w',
      },
      { command: 'closeWindow', keys: 'ctrl+q' },
      {
        command: {
          action: 'splitPane',
          split: 'horizontal',
          splitMode: 'duplicate',
        },
        keys: "ctrl+'",
      },
      {
        command: {
          action: 'splitPane',
          split: 'vertical',
          splitMode: 'duplicate',
        },
        keys: 'ctrl+d',
      },
      { command: { action: 'moveFocus', direction: 'down' }, keys: 'ctrl+down' },
      { command: { action: 'moveFocus', direction: 'left' }, keys: 'ctrl+left' },
      {
        command: { action: 'moveFocus', direction: 'right' },
        keys: 'ctrl+right',
      },
      { command: { action: 'moveFocus', direction: 'up' }, keys: 'ctrl+up' },
      {
        command: { action: 'resizePane', direction: 'down' },
        keys: 'ctrl+shift+down',
      },
      {
        command: { action: 'resizePane', direction: 'left' },
        keys: 'ctrl+shift+left',
      },
      {
        command: { action: 'resizePane', direction: 'right' },
        keys: 'ctrl+shift+right',
      },
      {
        command: { action: 'resizePane', direction: 'up' },
        keys: 'ctrl+shift+up',
      },
      {
        command: { action: 'adjustFontSize', delta: 1 },
        keys: 'ctrl+=',
      },
      {
        command: { action: 'adjustFontSize', delta: -1 },
        keys: 'ctrl+-',
      },
      { command: 'resetFontSize', keys: 'ctrl+0' },
      {
        command: {
          action: 'splitPane',
          split: 'horizontal',
          splitMode: 'duplicate',
        },
        keys: 'ctrl+shift+d',
      },
      {
        command: {
          action: 'toggleFocusMode',
        },
        keys: 'f11',
      },
      {
        command: {
          action: 'toggleFocusMode',
        },
        keys: 'alt+\\',
      },
      {
        command: {
          action: 'openTabRenamer',
        },
        keys: 'f6',
      },
    ],
  });

  // setup the profile color scheme
  let foundDefaultProfile = false;
  newProfiles.profiles = (newProfiles.profiles.list || newProfiles.profiles || []).map((profile) => {
    profile = Object.assign(profile, {
      cursorShape: 'vintage',
      cursorHeight: 50,
      fontFace: EDITOR_CONFIGS.fontFamily,
      fontSize: Math.min(EDITOR_CONFIGS.fontSize, 9),
      padding: '2 0 2 0',
      bellStyle: 'all',
      // useAcrylic: true,
    });

    switch (profile.commandline) {
      case 'powershell.exe':
        profile.colorScheme = 'Campbell';
        break;
      case 'cmd.exe':
        profile.colorScheme = 'Retro';
        break;
      default:
        profile.colorScheme = 'Dracula';
        break;
    }

    // set default profile
    if (!foundDefaultProfile && [/Debian/i, /Ubuntu/i].some((distroToUseForDefault) => profile.name.match(distroToUseForDefault))) {
      newProfiles.defaultProfile = profile.guid;
      foundDefaultProfile = true;
    }

    return profile;
  });

  if (!foundDefaultProfile) {
    newProfiles.defaultProfile = newProfiles.profiles[0].guid;
  }

  // done - write to file
  writeJson(targetPath, newProfiles);
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
