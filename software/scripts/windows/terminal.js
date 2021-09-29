// guide: refer to this
// https://docs.microsoft.com/en-us/windows/terminal/get-started
// https://docs.microsoft.com/en-us/windows/terminal/customize-settings/key-bindings#accepted-modifiers-and-keys

async function doWork() {
  const targetPath = path.join(_getPath(), 'LocalState/settings.json');
  if (!fs.existsSync(targetPath)) {
    console.log('  >> Skipped Windows Terminal Config - Settings Path Not Found: ', targetPath);
    process.exit();
  }

  console.log('  >> Setting up Microsoft Windows Terminal', targetPath);

  const oldProfiles = readJson(targetPath);
  const newProfiles = Object.assign(oldProfiles, {
    // global config
    copyOnSelect: true,
    copyFormatting: false,
    useTabSwitcher: false,
    multiLinePasteWarning: false,
    rowsToScroll: 5,
    initialCols: 110,
    initialRows: 40,
    tabWidthMode: 'compact',
    initialPosition: '5,5',
    confirmCloseAllTabs: true,
    disableAnimations: true,
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
      {
        command: 'copy',
        keys: 'alt+c',
      },
      {
        command: 'paste',
        keys: 'alt+v',
      },
      {
        command: 'nextTab',
        keys: 'alt+shift+]',
      },
      {
        command: 'prevTab',
        keys: 'alt+shift+[',
      },
      {
        command: 'resetFontSize',
        keys: 'alt+0',
      },
      {
        command: 'find',
        keys: 'alt+f',
      },
      {
        command: 'decreaseFontSize',
        keys: 'alt+-',
      },
      {
        command: 'increaseFontSize',
        keys: 'alt+=',
      },
      {
        command: 'scrollDown',
        keys: 'alt+down',
      },
      {
        command: 'scrollDownPage',
        keys: 'alt+right',
      },
      {
        command: 'scrollUp',
        keys: 'alt+up',
      },
      {
        command: 'scrollUpPage',
        keys: 'alt+left',
      },
      {
        command: 'newTab',
        keys: ['alt+t'],
      },
      {
        command: {
          action: 'switchToTab',
          index: 0,
        },
        keys: 'alt+1',
      },
      {
        command: {
          action: 'switchToTab',
          index: 1,
        },
        keys: 'alt+2',
      },
      {
        command: {
          action: 'switchToTab',
          index: 2,
        },
        keys: 'alt+3',
      },
      {
        command: {
          action: 'switchToTab',
          index: 3,
        },
        keys: 'alt+4',
      },
      {
        command: {
          action: 'switchToTab',
          index: 4,
        },
        keys: 'alt+5',
      },
      {
        command: {
          action: 'switchToTab',
          index: 5,
        },
        keys: 'alt+6',
      },
      {
        command: {
          action: 'switchToTab',
          index: 6,
        },
        keys: 'alt+7',
      },
      {
        command: {
          action: 'switchToTab',
          index: 7,
        },
        keys: 'alt+8',
      },
      {
        command: {
          action: 'switchToTab',
          index: 8,
        },
        keys: 'alt+9',
      },
      {
        command: 'closePane',
        keys: 'alt+w',
      },
      {
        command: {
          action: 'splitPane',
          split: 'horizontal',
          splitMode: 'duplicate',
        },
        keys: "alt+'",
      },
      {
        command: {
          action: 'splitPane',
          split: 'vertical',
          splitMode: 'duplicate',
        },
        keys: 'alt+d',
      },
      { command: { action: 'moveFocus', direction: 'down' }, keys: 'alt+down' },
      { command: { action: 'moveFocus', direction: 'left' }, keys: 'alt+left' },
      {
        command: { action: 'moveFocus', direction: 'right' },
        keys: 'alt+right',
      },
      { command: { action: 'moveFocus', direction: 'up' }, keys: 'alt+up' },
      {
        command: { action: 'resizePane', direction: 'down' },
        keys: 'alt+shift+down',
      },
      {
        command: { action: 'resizePane', direction: 'left' },
        keys: 'alt+shift+left',
      },
      {
        command: { action: 'resizePane', direction: 'right' },
        keys: 'alt+shift+right',
      },
      {
        command: { action: 'resizePane', direction: 'up' },
        keys: 'alt+shift+up',
      },
      {
        command: { action: 'adjustFontSize', delta: 1 },
        keys: 'alt+=',
      },
      {
        command: { action: 'adjustFontSize', delta: -1 },
        keys: 'alt+-',
      },
      { command: 'resetFontSize', keys: 'alt+0' },
      {
        command: {
          action: 'splitPane',
          split: 'horizontal',
          splitMode: 'duplicate',
        },
        keys: 'alt+shift+d',
      },
      {
        command: {
          action: 'toggleFocusMode',
        },
        keys: 'f11',
      },
      {
        command: 'togglePaneZoom',
        key: 'alt+z',
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
      fontSize: 10,
      padding: '5 0 5 0',
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
    if (
      !foundDefaultProfile &&
      ['Debian', 'Ubuntu'].some((distroToUseForDefault) => profile.name.toLowerCase().includes(distroToUseForDefault.toLowerCase()))
    ) {
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

      return path.join(
        localPackgesPath,
        fs.readdirSync(localPackgesPath).filter((dir) => dir.indexOf('Microsoft.WindowsTerminal') >= 0)[0],
      );
    }
    return null;
  } catch (e) {
    console.log('  >> Skipped Windows Terminal Config - Error');
    process.exit();
  }
}
