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
  // --- Performance & UI Tweaks ---
  'editor.minimap.enabled': false,
  'breadcrumbs.enabled': false,
  'editor.renderWhitespace': 'all',
  'editor.renderControlCharacters': true,
  'editor.maxTokenizationLineLength': 7000,
  'editor.mouseWheelScrollSensitivity': 2, // 2x speed; set to 3 if you want it even faster
  'editor.fastScrollSensitivity': 5,        // Speed when holding 'Alt'
  'workbench.editor.enablePreview': false,
  'workbench.startupEditor': 'none',
  'workbench.activityBar.location': 'top',
  'window.zoomLevel': 0.5,
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',

  // --- Editor Behavior ---
  'editor.bracketPairColorization.enabled': true,
  'editor.fontFamily': EDITOR_CONFIGS.fontFamily,
  'editor.fontLigatures': true,
  'editor.fontSize': fontSizeToUse,
  'editor.fontWeight': 'bold',
  'editor.formatOnPaste': true,
  'editor.linkedEditing': true,
  'editor.multiCursorModifier': 'ctrlCmd',
  'editor.snippetSuggestions': 'top',
  'editor.suggestSelection': 'first',
  'editor.tabSize': EDITOR_CONFIGS.tabSize,
  'editor.wordWrap': 'wordWrapColumn',
  'editor.wordWrapColumn': EDITOR_CONFIGS.maxLineSize,

  // --- Files & Search Performance ---
  'files.eol': '\n',
  'files.insertFinalNewline': true,
  'files.trimTrailingWhitespace': true,
  'files.hotExit': 'off',
  'files.exclude': {
    ..._convertIgnoredFilesAndFolders(EDITOR_CONFIGS.ignoredFiles),
    ..._convertIgnoredFilesAndFolders(EDITOR_CONFIGS.ignoredFolders),
  },
  'files.watcherExclude': {
    '**/.git/objects/**': true,
    '**/.git/subtree-cache/**': true,
    '**/node_modules/*/**': true,
    '**/dist/**': true
  },
  'search.followSymlinks': false,
  'search.useIgnoreFiles': true,
  'search.exclude': {
    '**/node_modules': true,
    '**/bower_components': true,
    '**/*.code-search': true
  },

  // --- Languages & Formatting ---
  'editor.codeActionsOnSave': {
    'source.fixAll': true,
    'source.organizeImports': true,
  },
  'javascript.updateImportsOnFileMove.enabled': 'always',
  'javascript.inlayHints.variableTypes.enabled': true,
  'typescript.updateImportsOnFileMove.enabled': 'always',
  'typescript.inlayHints.variableTypes.enabled': true,

  // --- Terminal & System ---
  'terminal.integrated.fontSize': fontSizeToUse,
  'terminal.integrated.gpuAcceleration': 'auto',
  'scm.inputFontSize': fontSizeToUse,
  'chat.editor.fontSize': fontSizeToUse,
  'security.workspace.trust.enabled': false,
  'explorer.copyRelativePathSeparator': '/',
  'remote.SSH.remotePlatform': { '127.0.0.1': 'linux' },

  // --- Theming ---
  'window.autoDetectColorScheme': true,
  'workbench.preferredLightColorTheme': 'Default High Contrast Light',
  'workbench.preferredDarkColorTheme': 'Default High Contrast',
  'workbench.colorTheme': 'Dracula Theme',
  'workbench.iconTheme': 'material-icon-theme',
  'workbench.tree.indent': 4,
  'workbench.editor.showTabs': true,

  // --- Formatter Overrides ---
  '[javascript]': { 'editor.defaultFormatter': 'esbenp.prettier-vscode' },
  '[javascriptreact]': { 'editor.defaultFormatter': 'esbenp.prettier-vscode' },
  '[typescript]': { 'editor.defaultFormatter': 'esbenp.prettier-vscode' },
  '[typescriptreact]': { 'editor.defaultFormatter': 'esbenp.prettier-vscode' },
  '[json]': { 'editor.defaultFormatter': 'esbenp.prettier-vscode' },
  '[graphql]': { 'editor.defaultFormatter': 'esbenp.prettier-vscode' },
  '[handlebars]': { 'editor.defaultFormatter': 'esbenp.prettier-vscode' },
  '[markdown]': {
    'editor.defaultFormatter': 'esbenp.prettier-vscode',
    'editor.formatOnSave': true,
    'editor.wordWrap': 'on'
  }
};
}

async function doWork() {
  console.log(`  >> VS Code Configurations / Settings:`);

  // write to build file
  const commentNote = '// Preferences Open User Settings (JSON)';
  writeToBuildFile([['vs-code-configurations', COMMON_CONFIGS, true, commentNote]]);
}
