// BEGIN software/scripts/editor.common.js
/** Color theme constants */
const SUBLIME_DARK_COLOR_SCHEME = "Monokai.sublime-color-scheme";
const SUBLIME_LIGHT_COLOR_SCHEME = "Breakers.sublime-color-scheme";
const SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME = "High Contrast Dark.sublime-color-scheme";
const SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME = "High Contrast Light.sublime-color-scheme";
const VSCODE_DARK_COLOR_THEME = "Default High Contrast";
const VSCODE_LIGHT_COLOR_THEME = "Default High Contrast Light";

/** Glob patterns for locating the Sublime Text binary across platforms */
const _SUBL_PATHS = [
  // macOS (Sublime 3 & 4)
  "/Applications/Sublime*Text.app/Contents/SharedSupport/bin/subl",
  "/Applications/Sublime*Text.app/Contents/MacOS/sublime_text",

  // Windows (WSL paths)
  "/mnt/c/Program*Files/Sublime*Text*/sublime*.exe",
  "/mnt/c/Program*Files/Sublime*Text*/subl*.exe",
  "/mnt/c/Users/*/AppData/Local/Programs/Sublime*Text/sublime*.exe",

  // Linux
  "/opt/sublime_text/subl*",
  "/usr/bin/subl",
  "/usr/local/bin/subl",
];

/** Glob patterns for locating the VS Code / VSCodium binary across platforms */
const _CODE_PATHS = [
  // macOS
  "/Applications/Visual*Studio*Code.app/Contents/Resources/app/bin/code",
  "/Applications/Visual*Studio*Code*Insiders.app/Contents/Resources/app/bin/code",
  "/Applications/VSCodium.app/Contents/Resources/app/bin/codium",

  // macOS (Homebrew / manual CLI install)
  "/opt/homebrew/bin/code",
  "/opt/homebrew/bin/codium",
  "/usr/local/bin/code",
  "/usr/local/bin/codium",

  // Windows (WSL paths)
  "/mnt/c/Users/*/AppData/Local/Programs/Microsoft*Code/Code.exe",
  "/mnt/c/Users/*/AppData/Local/Programs/Microsoft*Code*Insiders/Code*.exe",
  "/mnt/c/Program*Files/Microsoft*VS*Code/Code.exe",
  "/mnt/c/Program*Files/VSCodium/VSCodium.exe",

  // Linux
  "/usr/bin/code",
  "/usr/local/bin/code",
  "/usr/bin/codium",
  "/usr/local/bin/codium",
  "/snap/bin/code",
  "/snap/bin/codium",
];

/**
 * Searches standard OS paths for VS Code and VSCodium installation directories.
 * @returns {string[]} Array of absolute paths to found VS Code/VSCodium config directories.
 */
function _getVSCodeAndVSCodiumPaths() {
  const res = [];
  const home = process.env.HOME || process.env.USERPROFILE;

  // 1. Initialize search roots with standard OS locations
  const searchRoots = [
    process.env.APPDATA, // Windows Native
    path.join(home, "Library/Application Support"), // macOS
    path.join(home, ".config"), // Linux Standard
    path.join(home, ".var/app/com.visualstudio.code/config"), // Linux Flatpak
    path.join(home, ".var/app/com.vscodium/config"), // Linux Flatpak
  ];

  // 2. Account for WSL and Git Bash Windows mounts
  // Iterates through C:\Users\* to find Roaming folders
  const windowsMounts = ["/mnt/c/Users", "/c/Users"];
  windowsMounts.forEach((mount) => {
    if (fs.existsSync(mount)) {
      try {
        const directoryItems = fs.readdirSync(mount);
        for (const item of directoryItems) {
          const roamingPath = path.join(mount, item, "AppData/Roaming");
          if (fs.existsSync(roamingPath)) {
            searchRoots.push(roamingPath);
          }
        }
      } catch (e) {
        // Skip folders with permission issues (like System folders)
      }
    }
  });

  // 3. Patterns for the apps we want to find
  const patterns = [/Code/i, /VSCodium/i];

  // 4. Execution logic using your findDirSingle method
  searchRoots.forEach((root) => {
    if (!root || !fs.existsSync(root)) return;

    patterns.forEach((pattern) => {
      try {
        // Use your method to find the matching directory (e.g., "Code")
        const foundAppPath = findDirSingle(root, pattern);

        if (foundAppPath && fs.existsSync(foundAppPath)) {
          // Normalize the path and ensure it's not already in the array
          const absolutePath = path.resolve(foundAppPath);
          if (!res.includes(absolutePath)) {
            res.push(absolutePath);
          }
        }
      } catch (err) {
        // Silent fail for locked directories
      }
    });
  });

  return res;
}

/**
 * Searches for the Sublime Text config directory based on the current OS.
 * @returns {Promise<string|null>} Path to the Sublime Text config directory, or null if not found.
 */
async function _getPathSublimeText() {
  exitIfLimitedSupportOs();
  const regexBinary = /Sublime[ -]*Text[0-9]*[0-9]*/i;

  try {
    if (is_os_windows) {
      return findDirSingle(getWindowAppDataRoamingUserPath(), regexBinary);
    }

    if (is_os_mac) {
      return findDirSingle(getOsxApplicationSupportCodeUserPath(), regexBinary);
    }

    if (is_os_arch_linux) {
      return findDirSingle(path.join(process.env.HOME, ".var/app/com.sublimetext.three/config"), regexBinary);
    }

    // for debian or chrome os debian linux
    return findDirSingle(BASE_HOMEDIR_LINUX + "/.config", regexBinary);
  } catch (err) {
    log(">>>> Failed to get the path", err);
  }

  return null;
}
// END software/scripts/editor.common.js

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
    if (isWatcher && folder === ".git") {
      res["**/.git/objects/**"] = true;
      res["**/.git/subtree-cache/**"] = true;
    }
  });

  return res;
}

/**
 * Builds the full VS Code settings object with editor, performance, theming, and language configs.
 * @param {object} options - Configuration options.
 * @param {boolean} [options.is_prebuilt_config] - Whether to use fallback font sizes for prebuilt configs.
 * @param {boolean} [options.is_os_mac] - Whether the target OS is macOS.
 * @returns {object} The VS Code settings object.
 */
function _getConfigs({ is_prebuilt_config = false, is_os_mac = false }) {
  const fontSizeToUse = is_prebuilt_config ? EDITOR_CONFIGS.fontSizeDefaultFallback : EDITOR_CONFIGS.fontSize;

  const syntaxHighlightOpts = {
    "editor.spellcheck.enabled": false, // Disable per-language spell check
    "editor.suggest.showWords": false, // Don't suggest plain-text words — only real completions
    "editor.wordWrap": "on", // Wrap long lines visually instead of horizontal scrolling
  };
  const syntaxFormatterOpts = {
    "editor.defaultFormatter": "esbenp.prettier-vscode", // Use Prettier as the default formatter
    "editor.formatOnSave": true, // Auto-format the file on every save
  };

  const configs = {
    // --- Updates & Telemetry ---
    "update.mode": "none", // Disable auto-update checks entirely
    "update.showReleaseNotes": false, // Don't show release notes after updates
    "extensions.autoUpdate": false, // Stop background extension updates
    "extensions.autoCheckUpdates": false, // Stop polling for extension update availability
    "extensions.ignoreRecommendations": true, // Suppress "recommended extension" popups
    "telemetry.telemetryLevel": "off", // Disable all telemetry data collection
    "workbench.settings.enableNaturalLanguageSearch": false, // Don't send settings searches to Microsoft servers

    // --- AI & Copilot ---
    "github.copilot.enable": { "*": false }, // Disable GitHub Copilot completions for all languages
    "chat.agent.enabled": false, // Disable AI chat agent
    "chat.mcp.enabled": false, // Disable MCP (Model Context Protocol) servers
    "workbench.enableExperiments": false, // Disable A/B experiments from Microsoft

    // --- Suggestions & Hover ---
    "editor.hover.delay": 200, // Delay in ms before showing hover tooltips
    "editor.hover.enabled": true, // Show hover tooltips (type info, docs)
    "editor.quickSuggestionsDelay": 0, // Show autocomplete immediately with no pause
    "editor.suggest.snippetsPreventQuickSuggestions": false, // Allow quick suggestions even inside snippet placeholders

    // --- UI Performance ---
    "editor.minimap.enabled": false, // Disable the code minimap — saves rendering overhead
    "breadcrumbs.enabled": false, // Hide breadcrumb navigation bar at top of editor
    "editor.renderWhitespace": "all", // Show dots for all whitespace characters
    "editor.renderControlCharacters": true, // Show control characters (tabs, zero-width spaces)
    "editor.maxTokenizationLineLength": 7000, // Skip syntax highlighting for lines longer than this
    "editor.folding": true, // Enable code folding
    "editor.cursorBlinking": "solid", // No cursor blink animation — saves rendering cycles
    "editor.occurrencesHighlight": "off", // Don't highlight other occurrences of the selected word
    "editor.selectionHighlight": false, // Don't highlight text matching the current selection
    "editor.codeLens": false, // Disable CodeLens (reference counts) — major CPU saver
    "editor.links": false, // Don't scan for and underline URLs in code
    "editor.matchBrackets": "never", // Don't highlight matching bracket pairs
    "editor.renderLineHighlight": "none", // Don't highlight the current line — saves GPU draw time
    "workbench.editor.enablePreview": false, // Always open files in a full tab, not a preview tab
    "workbench.startupEditor": "none", // Show nothing on startup — no welcome tab or recent files
    "workbench.activityBar.location": "top", // Move activity bar to top for more horizontal space
    "window.zoomLevel": 0.5, // Slight zoom-in for readability
    "workbench.tree.renderIndentGuides": "none", // Hide indent guides in sidebar trees
    "editor.guides.indentation": false, // Hide indentation guides in the editor

    // --- Scrolling & Navigation ---
    "editor.mouseWheelScrollSensitivity": 2, // 2x scroll speed with mouse wheel
    "editor.fastScrollSensitivity": 5, // 5x scroll speed when holding Alt+scroll
    "workbench.list.smoothScrolling": false, // Disable smooth scrolling in lists — native scrolling is faster
    "editor.smoothScrolling": false, // Disable smooth scrolling in the editor
    "workbench.tree.indent": 4, // Indent level in sidebar trees (px)
    "workbench.editor.showTabs": true, // Show editor tabs
    "workbench.editor.limit.enabled": true, // Limit the number of open tabs to save memory
    "workbench.editor.limit.value": 10, // Max 10 open tabs per editor group
    "workbench.editor.limit.perEditorGroup": true, // Apply tab limit per editor group, not globally

    // --- Hints & Diagnostics ---
    "editor.unicodeHighlight.ambiguousCharacters": false, // Don't flag characters that look like others (e.g. Cyrillic 'а' vs Latin 'a')
    "editor.unicodeHighlight.invisibleCharacters": false, // Don't flag invisible/zero-width characters
    "editor.showUnused": false, // Don't fade out unused variables — saves a full file scan
    "editor.lightbulb.enabled": "off", // Disable the lightbulb quick-fix icon

    // --- Git & Source Control ---
    "git.enabled": false, // Disable git integration entirely — reduces background I/O
    "git.autorefresh": false, // Don't auto-refresh git status — reduces I/O on large repos
    "git.decorations.enabled": false, // Hide git status badges on files in sidebar
    "git.ignoreLimitWarning": true, // Suppress "repository has too many changes" warnings
    "git.autofetch": false, // Don't auto-fetch from remote — reduces background network I/O
    "scm.diffDecorations": "none", // Remove gutter diff color indicators (added/modified/deleted)
    "github.codespaces.showStatusbar": false, // Hide Codespaces status bar item

    // --- Editor Behavior ---
    "editor.bracketPairColorization.enabled": true, // Color-code matching bracket pairs for readability
    "editor.fontFamily": is_prebuilt_config ? EDITOR_CONFIGS.fontFamilyDefaultFallback : EDITOR_CONFIGS.fontFamily, // Primary editor font
    "editor.fontLigatures": true, // Enable font ligatures (e.g. => becomes arrow in supported fonts)
    "editor.fontSize": fontSizeToUse, // Base font size for the editor
    "editor.fontWeight": "bold", // Bold font weight for the editor
    "editor.formatOnPaste": true, // Auto-format code when pasting
    "editor.linkedEditing": true, // Rename matching HTML tags automatically when editing one
    "editor.multiCursorModifier": "ctrlCmd", // Use Cmd/Ctrl+click for multi-cursor instead of Alt+click
    "editor.snippetSuggestions": "top", // Show snippet suggestions at the top of the autocomplete list
    "editor.suggestSelection": "first", // Always pre-select the first autocomplete suggestion
    "editor.tabSize": EDITOR_CONFIGS.tabSize, // Number of spaces per tab
    "editor.wordWrap": "wordWrapColumn", // Wrap lines at a specific column
    "editor.wordWrapColumn": EDITOR_CONFIGS.maxLineSize, // Column at which to wrap lines

    // --- Files & Search ---
    "files.eol": "\n", // Use LF line endings by default
    "files.insertFinalNewline": true, // Always end files with a newline (POSIX convention)
    "files.trimTrailingWhitespace": true, // Remove trailing whitespace on save
    "files.hotExit": "off", // Don't save unsaved buffers on close — start fresh every time
    "search.followSymlinks": false, // Don't follow symlinks during search — prevents infinite loops
    "search.useIgnoreFiles": false, // Don't use .gitignore for search — ensures all project files are searchable

    // --- Languages & Formatting ---
    "editor.codeActionsOnSave": {
      "source.fixAll": true, // Auto-fix all fixable lint errors on save
      "source.organizeImports": true, // Auto-sort and remove unused imports on save
    },
    "javascript.updateImportsOnFileMove.enabled": "always", // Auto-update JS import paths when files are moved
    "javascript.inlayHints.variableTypes.enabled": true, // Show inferred variable types as inline hints in JS
    "javascript.suggestionActions.enabled": false, // Disable JS lightbulb suggestions
    "typescript.updateImportsOnFileMove.enabled": "always", // Auto-update TS import paths when files are moved
    "typescript.inlayHints.variableTypes.enabled": true, // Show inferred variable types as inline hints in TS
    "typescript.suggestionActions.enabled": false, // Disable TS lightbulb suggestions

    // --- Terminal & System ---
    "terminal.integrated.fontSize": fontSizeToUse, // Font size for the integrated terminal
    "terminal.integrated.gpuAcceleration": "auto", // Let VS Code decide whether to use GPU for terminal rendering
    "scm.inputFontSize": fontSizeToUse, // Font size for the SCM commit message input
    "chat.editor.fontSize": fontSizeToUse, // Font size for the Copilot Chat editor
    "security.workspace.trust.enabled": false, // Disable workspace trust prompts — trust all workspaces
    "explorer.copyRelativePathSeparator": "/", // Always use forward slashes when copying relative paths
    "remote.SSH.remotePlatform": { "127.0.0.1": "linux" }, // Default remote platform for localhost SSH
    "remote.SSH.localServerDownload": "auto", // Auto-download VS Code server to remote hosts
    "remote.SSH.connectTimeout": 120, // SSH connection timeout in seconds (2 minutes)
    "terminal.integrated.enablePersistentSessions": false, // Don't restore terminal sessions on restart
    "terminal.integrated.defaultProfile.linux": "bash", // Use bash as default terminal shell on Linux
    "terminal.integrated.defaultProfile.osx": "bash", // Use bash as default terminal shell on macOS

    // --- Theming ---
    "window.autoDetectColorScheme": true, // Follow the OS light/dark mode preference
    "workbench.preferredLightColorTheme": VSCODE_LIGHT_COLOR_THEME, // Theme for light mode
    "workbench.preferredDarkColorTheme": VSCODE_DARK_COLOR_THEME, // Theme for dark mode
    "workbench.colorTheme": VSCODE_DARK_COLOR_THEME, // Fallback theme when auto-detect is off
    "workbench.iconTheme": "material-icon-theme", // File icon theme for sidebar

    // --- Misc ---
    "window.newWindowDimensions": "maximized", // New windows open maximized
    "window.restoreWindows": "none", // Don't restore previous windows on startup — start fresh
    "editor.accessibilitySupport": "off", // Disable accessibility features for performance (screen reader detection)
    "editor.dragAndDrop": false, // Disable drag-and-drop of selected text — prevents accidental moves
    "editor.copyWithSyntaxHighlighting": false, // Copy plain text without HTML formatting — faster paste
    "editor.emptySelectionClipboard": false, // Don't copy the entire line when nothing is selected

    // --- Search Index & Cleanup ---
    "files.exclude": _convertIgnoredFilesAndFoldersForVSCode(EDITOR_CONFIGS.ignoredFiles, EDITOR_CONFIGS.ignoredFolders), // Files and folders hidden from sidebar and Goto Anything
    "search.exclude": _convertIgnoredFilesAndFoldersForVSCode(EDITOR_CONFIGS.ignoredFiles, EDITOR_CONFIGS.ignoredFolders), // Files and folders excluded from global search results
    "files.watcherExclude": _convertIgnoredFilesAndFoldersForVSCode(
      [],
      EDITOR_CONFIGS.ignoredFolders,
      true, // isWatcher = true — adds extra git object exclusions
    ), // Folders excluded from the file watcher — reduces I/O

    // --- Formatter Overrides (Prettier) ---
    "[javascript]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[javascriptreact]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[typescript]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[typescriptreact]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[json]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[graphql]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[handlebars]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[yaml]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[xml]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[html]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[markdown]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
    "[plaintext]": { ...syntaxFormatterOpts, ...syntaxHighlightOpts },
  };

  // Mac-specific overrides
  if (is_os_mac) {
    configs["workbench.fontAliasing"] = "antialiased"; // Sharper text rendering on macOS Retina displays
  }

  return configs;
}

/**
 * Writes VS Code settings to prebuilt config files and applies them to the local VS Code installation.
 */
async function doWork() {
  exitIfUnsupportedOs("is_os_android_termux");
  log(`>> VS Code Configurations / Settings:`);

  // write to build file
  const comments = "Preferences Open User Settings (JSON)";
  writeToBuildFile([
    { file: "vs-code-config", data: _getConfigs({ is_os_mac: false }), isJson: true, comments, commentStyle: "json" },
    { file: "vs-code-config-macosx", data: _getConfigs({ is_os_mac: true }), isJson: true, comments, commentStyle: "json" },
  ]);

  // for my own system
  let targetPaths = await _getVSCodeAndVSCodiumPaths();
  log(">>> For my own system: ", targetPaths?.length);
  for (const targetPath of targetPaths) {
    writeConfigToFile(targetPath, "User/settings.json", _getConfigs({ is_os_mac: is_os_mac }));
  }
}
