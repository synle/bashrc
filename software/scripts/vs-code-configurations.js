includeSource('software/scripts/vs-code.common.js');

let COMMON_CONFIGS;

/**
 * Converts lists of files and folders into a VS Code compatible settings object.
 * @param {string[]} files - Array of filenames or extensions
 * @param {string[]} folders - Array of folder names
 * @param {boolean} isWatcher - If true, adds git-specific watcher optimizations
 */
function _convertIgnoredFilesAndFoldersForVSCode(files = [], folders = [], isWatcher = false) {
  const res = {};

  // Process Files (**/filename)
  files.forEach((file) => {
    res[`**/${file}`] = true;
  });

  // Process Folders (**/folder and **/folder/**)
  folders.forEach((folder) => {
    res[`**/${folder}`] = true;
    res[`**/${folder}/**`] = true;

    // Extra protection for watchers against high-churn git internal files
    if (isWatcher && folder === '.git') {
      res['**/.git/objects/**'] = true;
      res['**/.git/subtree-cache/**'] = true;
    }
  });

  return res;
}

const fontSizeToUse = 14; // EDITOR_CONFIGS.fontSize

async function doInit() {
  const syntaxHighlightOpts = {
    'editor.spellcheck.enabled': false, // for some specific custom builds
    'editor.suggest.showWords': false,
    'editor.wordWrap': 'on',
  };
  const syntaxFormatterOpts = {
    'editor.defaultFormatter': 'esbenp.prettier-vscode',
    'editor.formatOnSave': true,
  };

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
    'editor.hover.delay': 200, // Show tooltips instantly (or set to 10000 to "hide" them)
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

    // Speed up the UI even more
    'workbench.tree.renderIndentGuides': 'none',
    'editor.guides.indentation': false,

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
    'editor.showUnused': false, // Stops fading out unused variables (saves a full scan)
    'editor.lightbulb.enabled': 'off', // The final nail in the lightbulb's coffin

    // --- Kill All Git/SCM (The "Speed" Move) ---
    'git.enabled': true, // needed to tell vscode to ignore git files
    'git.autorefresh': false,
    'git.decorations.enabled': false,
    'git.ignoreLimitWarning': true, // "I know my repo is huge, stop bugging me."
    'git.autofetch': true, // (Optional) Keeps your local git status synced with the server.
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

    // --- Explorer Behavior ---
    'explorer.excludeGitIgnore': true, // exclude git ignore

    // --- Files & Search Performance ---
    'files.eol': '\n',
    'files.insertFinalNewline': true,
    'files.trimTrailingWhitespace': true,
    'files.hotExit': 'off',
    'search.followSymlinks': false,
    'search.useIgnoreFiles': true,

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

    // --- Search Index and Cleanup
    // VISUAL: Hide all files and folders in your lists from the sidebar
    'files.exclude': _convertIgnoredFilesAndFoldersForVSCode(EDITOR_CONFIGS.ignoredFiles, EDITOR_CONFIGS.ignoredFolders),

    // SEARCH: Ignore everything in your lists during Global Search
    // We use the same lists because if it's hidden from the UI,
    // you usually don't want results popping up from it.
    'search.exclude': _convertIgnoredFilesAndFoldersForVSCode(EDITOR_CONFIGS.ignoredFiles, EDITOR_CONFIGS.ignoredFolders),

    // PERFORMANCE: Only pass folders here.
    // VS Code watchers ignore folders as a whole; individual files
    // are usually too granular for the watcher to care about.
    'files.watcherExclude': _convertIgnoredFilesAndFoldersForVSCode(
      [],
      EDITOR_CONFIGS.ignoredFolders,
      true, // isWatcher = true
    ),

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
      ...syntaxFormatterOpts,
      ...syntaxHighlightOpts,
    },
    '[markdown]': {
      ...syntaxFormatterOpts,
      ...syntaxHighlightOpts,
    },
    '[plaintext]': {
      ...syntaxFormatterOpts,
      ...syntaxHighlightOpts,
    },
  };

  // mac only
  if (is_os_darwin_mac) {
    COMMON_CONFIGS['workbench.fontAliasing'] = 'antialiased'; // Mac specific, but keeps text sharp without heavy load
  }
}

async function doWork() {
  console.log(`  >> VS Code Configurations / Settings:`);

  // write to build file
  const commentNote = '// Preferences Open User Settings (JSON)';
  writeToBuildFile([['vs-code-configurations', COMMON_CONFIGS, true, commentNote]]);
}
