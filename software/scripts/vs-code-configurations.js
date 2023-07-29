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

async function doInit() {
  COMMON_CONFIGS = {
    'breadcrumbs.enabled': true,
    'editor.bracketPairColorization.enabled': true,
    'editor.fontFamily': EDITOR_CONFIGS.fontFamily,
    'editor.fontLigatures': true,
    'editor.fontSize': EDITOR_CONFIGS.fontSize,
    'terminal.integrated.fontSize': EDITOR_CONFIGS.fontSize,
    'editor.fontWeight': '500',
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
    'workbench.editor.tabCloseButton': 'off',
    'workbench.iconTheme': 'vscode-great-icons',
    'workbench.tree.indent': 4,
    'editor.codeActionsOnSave': {
      // "source.fixAll": true,
      // 'source.organizeImports': true,
    },
    'telemetry.enableTelemetry': false,
    'telemetry.enableCrashReporter': false,
    'telemetry.telemetryLevel': 'off',
    'enable-crash-reporter': false,
    'update.mode': 'none',
    'remote.SSH.remotePlatform': {
      '127.0.0.1': 'linux',
    },
  };
}

async function doWork() {
  const targetPath = _getVsCodePath();
  let targetFile;

  // write to build file
  const commentNote = '// Preferences Open User Settings (JSON)';
  writeToBuildFile([['vs-code-configurations', COMMON_CONFIGS, true, commentNote]]);

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
