includeSource('software/scripts/vs-code.common.js');

let COMMON_CONFIGS;

function _convertIgnoredFilesAndFolders(ignoredFiles) {
  const res = {};

  for (const ignoredFile of ignoredFiles) {
    const key = `**/${ignoredFile}`;
    res[key] = true;
  }

  return res;
}

const fontSizeToUse = 14; // EDITOR_CONFIGS.fontSize

async function doInit() {
  COMMON_CONFIGS = {
    'breadcrumbs.enabled': true,
    'editor.bracketPairColorization.enabled': true, // use built in default bracket rainbow color
    'editor.fontFamily': EDITOR_CONFIGS.fontFamily,
    'editor.fontLigatures': true,
    'editor.fontSize': fontSizeToUse,
    'terminal.integrated.fontSize': fontSizeToUse,
    'scm.inputFontSize': fontSizeToUse,
    'chat.editor.fontSize': fontSizeToUse,
    'editor.fontWeight': 'bold',
    'breadcrumbs.enabled': false, // disable breadcrumb
    'editor.formatOnPaste': true,
    'editor.linkedEditing': true, // for linked editing (tag renames)
    'editor.maxTokenizationLineLength': 10000,
    'editor.minimap.enabled': false,
    'editor.mouseWheelScrollSensitivity': 0,
    'editor.multiCursorModifier': 'ctrlCmd',
    'editor.renderControlCharacters': true,
    'editor.renderWhitespace': 'all',
    'editor.snippetSuggestions': 'top',
    'editor.suggestSelection': 'first',
    'editor.tabSize': EDITOR_CONFIGS.tabSize,
    'editor.wordWrap': 'wordWrapColumn',
    'editor.wordWrapColumn': EDITOR_CONFIGS.maxLineSize,
    'explorer.copyRelativePathSeparator': '/', // always use / for path in all OS's
    // theme
    'window.autoDetectColorScheme': true,
    'workbench.preferredLightColorTheme': 'Default High Contrast Light',
    'workbench.preferredDarkColorTheme': 'Default High Contrast',
    //
    'files.eol': '\n', // LF Unix mode
    'files.exclude': {
      ..._convertIgnoredFilesAndFolders(EDITOR_CONFIGS.ignoredFiles),
      ..._convertIgnoredFilesAndFolders(EDITOR_CONFIGS.ignoredFolders),
    },
    'files.hotExit': 'off',
    'files.insertFinalNewline': true,
    'files.trimTrailingWhitespace': true,
    // specific to js
    'javascript.updateImportsOnFileMove.enabled': 'always',
    'javascript.inlayHints.variableTypes.enabled': true,
    // specific typescript
    'typescript.updateImportsOnFileMove.enabled': 'always',
    'typescript.inlayHints.variableTypes.enabled': true,
    'window.zoomLevel': 0.5,
    'workbench.colorTheme': 'Dracula Soft',
    'workbench.editor.showTabs': true,
    'workbench.iconTheme': 'material-icon-theme',
    'workbench.tree.indent': 4,
    'workbench.editor.enablePreview': false, // single click to open file instead of preview it
    'workbench.activityBar.location': 'top', // move the activity bar up top to save spaces
    'editor.codeActionsOnSave': {
      'source.fixAll': true,
      'source.organizeImports': true,
    },
    'update.mode': 'none',
    'remote.SSH.remotePlatform': {
      '127.0.0.1': 'linux',
    },
    'security.workspace.trust.enabled': false, // this is to disable the trusted domain message
    'workbench.startupEditor': 'none', // this disables the startup wizard
    'telemetry.telemetryLevel': 'off', // disable telemetry
    // prettier formatting, requires esbenp.prettier-vscode
    '[javascript]': {
      'editor.javascript': 'esbenp.prettier-vscode',
    },
    '[javascriptreact]': {
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
    },
    '[typescript]': {
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
    },
    '[typescriptreact]': {
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
    },
    '[json]': {
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
    },
    '[graphql]': {
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
    },
    '[handlebars]': {
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
    },
  };
}

async function doWork() {
  // write to build file
  const commentNote = '// Preferences Open User Settings (JSON)';
  writeToBuildFile([['vs-code-configurations', COMMON_CONFIGS, true, commentNote]]);

  const targetPath = _getVsCodePath();
  let targetFile;

  if (!filePathExist(targetPath)) {
    console.log('Not supported - Exit - targetPath not found: ', consoleLogColor4(targetPath));
    return process.exit();
  }

  console.log(`  >> Setting up Microsoft VS Code Configurations:`, consoleLogColor4(targetPath));

  // get os specific settings
  const osSpecificSettings = {};

  // settings.json
  const vsCodeMainConfigPath = path.join(targetPath, 'User/settings.json');
  console.log(`    >> `, vsCodeMainConfigPath);
  writeJsonWithMerge(vsCodeMainConfigPath, Object.assign(COMMON_CONFIGS, osSpecificSettings));
}
