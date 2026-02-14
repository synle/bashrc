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
  const syntaxHighlightOpts = {
    'editor.spellcheck.enabled': false, // for some specific custom builds
    'editor.suggest.showWords': false
    'editor.wordWrap': 'on',
  }
  const syntaxFormatterOpts = {
    'editor.defaultFormatter': 'esbenp.prettier-vscode',
    'editor.formatOnSave': true,
  }

  COMMON_CONFIGS = {
    // --- Total Lockdown: Updates & Telemetry ---
    'update.mode': 'none',
    'update.showReleaseNotes': false,
    'extensions.autoUpdate': false, // Stops background extension updates
    'extensions.autoCheckUpdates': false, // Stops checking for extension updates
    'extensions.ignoreRecommendations': true, // Stops the background "You might like this extension" logic
    'telemetry.telemetryLevel': 'off', // Disables all data collection
    'workbench.settings.enableNaturalLanguageSearch': false, // Stops sending settings searches to MS servers

    // --- Instant UI Response ---
    'editor.hover.delay': 0, // Show tooltips instantly (or set to 10000 to "hide" them)
    'editor.hover.enabled': true, // Set to false if you want zero tooltips
    'editor.quickSuggestionsDelay': 0, // No "pause" before the suggestion box pops up
    'editor.suggest.snippetsPreventQuickSuggestions': false,

    // --- UI Performance ---
    'editor.minimap.enabled': false,
    'breadcrumbs.enabled': false,
    'editor.renderWhitespace': 'all',
    'editor.renderControlCharacters': true,
    'editor.maxTokenizationLineLength': 7000,
    'editor.folding': false, // Disable code folding to save CPU on large files
    'editor.cursorBlinking': 'solid', // Saves rendering cycles
    'editor.occurrencesHighlight': false, // Stops background "same word" searching
    'editor.selectionHighlight': false,
    'editor.codeLens': false, // Massive CPU saver: disables reference counts
    'editor.links': false, // Stops regex scanning for URLs
    'editor.matchBrackets': 'never', // Stops VS Code from looking for the matching bracket as you move
    'editor.renderLineHighlight': 'none', // Saves a tiny bit of GPU draw time per frame
    'workbench.editor.enablePreview': false,
    'workbench.startupEditor': 'none',
    'workbench.activityBar.location': 'top',
    'window.zoomLevel': 0.5,

    // --- Scrolling & Navigation ---
    'editor.mouseWheelScrollSensitivity': 2,
    'editor.fastScrollSensitivity': 5,
    'workbench.list.smoothScrolling': false, // Native scrolling is faster than simulated
    'editor.smoothScrolling': false,
    'workbench.tree.indent': 4,
    'workbench.editor.showTabs': true,
    'workbench.editor.limit.enabled': true, // Keeps memory low by limiting open tabs
    'workbench.editor.limit.value': 10,
    'workbench.editor.limit.perEditorGroup': true,

    // --- Kill Hints & Squiggles ---
  'editor.unicodeHighlight.ambiguousCharacters': false, // Stops highlighting chars that look like others
  'editor.unicodeHighlight.invisibleCharacters': false, // Stops checking for invisible space bugs
  'editor.showUnused': false,                           // Stops fading out unused variables (saves a full scan)
  'editor.lightbulb.enabled': "off",                    // The final nail in the lightbulb's coffin

    // --- Kill All Git/SCM (The "Speed" Move) ---
    'git.enabled': false, // Turns off Git integration entirely
    'git.autorefresh': false,
    'git.decorations.enabled': false,
    'scm.diffDecorations': 'none', // Removes gutter color indicators
    'github.codespaces.showStatusbar': false,

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
      '**/dist/**': true,
    },
    'search.followSymlinks': false,
    'search.useIgnoreFiles': true,
    'search.exclude': {
      '**/node_modules': true,
      '**/bower_components': true,
      '**/*.code-search': true,
    },

    // --- Languages & Formatting ---
    'editor.codeActionsOnSave': {
      'source.fixAll': true,
      'source.organizeImports': true,
    },
    'javascript.updateImportsOnFileMove.enabled': 'always',
    'javascript.inlayHints.variableTypes.enabled': true,
    'javascript.suggestionActions.enabled': false, // Disables the lightbulb
    'typescript.updateImportsOnFileMove.enabled': 'always',
    'typescript.inlayHints.variableTypes.enabled': true,
    'typescript.suggestionActions.enabled': false, // Disables the lightbulb

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

    // --- Formatter Overrides (Prettier) ---
    '[javascript]': { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    '[javascriptreact]': { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    '[typescript]': { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    '[typescriptreact]': { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    '[json]': { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    '[graphql]': { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    '[handlebars]': { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    '[yaml]': { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    '[xml]': { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    '[html]': {
      ...syntaxFormatterOpts, ...syntaxHighlightOpts
    },
    '[markdown]': {
      ...syntaxFormatterOpts, ...syntaxHighlightOpts
    },
    '[plaintext]': {
      ...syntaxFormatterOpts, ...syntaxHighlightOpts
    }
  };
}

async function doWork() {
  console.log(`  >> VS Code Configurations / Settings:`);

  // write to build file
  const commentNote = '// Preferences Open User Settings (JSON)';
  writeToBuildFile([['vs-code-configurations', COMMON_CONFIGS, true, commentNote]]);
}
