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

/** * Registers editor launcher functions (find_editor, run_editor, run_editor_cli) and shell aliases for subl/code. */
async function doWork() {
  log(">> Editor Launchers:");

  if (is_os_android_termux) {
    log(">> Skipped: Editor launchers not supported on Android Termux");
    return;
  }

  log(">> Registering editor launchers (find_editor, run_editor, subl, code)");

  // Section 1: Common editor launcher functions
  registerWithBashSyleProfile(
    "Editor Launchers - Common",
    trimLeftSpaces(`
      # Resolve editor binary from a list of candidate paths
      find_editor() {
        local editor_name="$1"
        shift
        local paths=("$@")

        shopt -s nullglob nocaseglob
        for binary in "\${paths[@]}"; do
          if [[ -x "$binary" ]]; then
            echo "$binary"
            shopt -u nullglob nocaseglob
            return 0
          fi
        done
        shopt -u nullglob nocaseglob

        # flatpak fallback for code/vscodium
        if [[ "$editor_name" == "code" ]] && command -v flatpak &> /dev/null; then
          echo "flatpak:vscodium"
          return 0
        fi

        echo "Error: $editor_name not found in search paths." >&2
        return 1
      }

      # Launch an editor in the background (GUI mode)
      run_editor() {
        local editor_name="$1"
        shift
        local target_binary
        target_binary=$(find_editor "$editor_name" "$@") || return 1

        # Prepare a new array for the converted paths
        local converted_args=()
        local unresolved_path=""
        local resolved_path=""

        for arg in "\${editor_args[@]}"; do
            # Check if the argument is a path (starts with / or .)
            if [[ "$arg" == /* ]] || [[ "$arg" == .* ]]; then
                unresolved_path=$(realpath "$arg")
                if [ "$is_os_windows" = "1" ]; then
                    resolved_path=$(wslpath -m "$arg")
                else
                    resolved_path="$unresolved_path"
                fi
                converted_args+=("$resolved_path")
            else
                converted_args+=("$arg")
            fi
        done

        if [[ "$target_binary" == "flatpak:vscodium" ]]; then
          (nohup flatpak run com.vscodium.codium "\${editor_args[@]}" >/dev/null 2>&1 &)
        else
          if [ "$is_os_windows" = "1" ]; then
              # Use the converted_args here
              (nohup "$target_binary" "\${converted_args[@]}" >/dev/null 2>&1 &)
          else
              # If not a Windows window, you might still want standard args
              # or the same conversion depending on your setup
              (nohup "$target_binary" "\${editor_args[@]}" >/dev/null 2>&1 &)
          fi
        fi

        echo """
      ====================================
      \\"$target_binary\\" \${editor_args[@]}
      PWD:    $(pwd)
      Path:          $unresolved_path
      Resolved Path: $resolved_path
      ====================================
      """
      }

      # Run an editor command in the foreground (CLI mode, stdout preserved)
      run_editor_cli() {
        local editor_name="$1"
        shift
        local target_binary
        target_binary=$(find_editor "$editor_name" "\${editor_paths[@]}") || return 1

        if [[ "$target_binary" == "flatpak:vscodium" ]]; then
          flatpak run com.vscodium.codium "$@"
        else
          "$target_binary" "$@"
        fi
      }
    `),
  );

  // Section 2: Sublime Text launcher
  registerWithBashSyleProfile(
    "Editor Launchers - Sublime Text",
    trimLeftSpaces(`
      _SUBL_PATHS=(
        ${_SUBL_PATHS.join("\n        ")}
      )

      subl() {
        local editor_args
        # editor_args=("-n" "$@") # -n: always open a new window
        # editor_args=("-a" "$@") # -a: add to last active window (merges into existing project)
        editor_args=("$@") # no flag: reuses window if path is already open, otherwise new window

        run_editor "subl" "\${_SUBL_PATHS[@]}"
      }
    `),
  );

  // Section 3: VS Code / VSCodium launcher
  registerWithBashSyleProfile(
    "Editor Launchers - VS Code",
    trimLeftSpaces(`
      _CODE_PATHS=(
        ${_CODE_PATHS.join("\n        ")}
      )

      code() {
        local editor_args
        # editor_args=("-n" "$@") # -n: always open a new window
        # editor_args=("-r" "$@") # -r: reuse last active window (replaces current project)
        editor_args=("$@") # no flag: reuses window if path is already open, otherwise new window

        run_editor "code" "\${_CODE_PATHS[@]}"
      }

      code_list_extensions(){
        local editor_paths=("\${_CODE_PATHS[@]}")
        run_editor_cli "code" --list-extensions
      }
    `),
  );
}
