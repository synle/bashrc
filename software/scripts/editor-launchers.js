/// <reference path="../index.js" />

/** * Registers editor launcher functions (find_editor, run_editor, run_editor_cli) and shell aliases for subl/code. */
async function doWork() {
  console.log("  >> Editor Launchers:");

  if (is_os_android_termux) {
    console.log("  >> Skipped: Editor launchers not supported on Android Termux");
    return;
  }

  console.log("  >> Registering editor launchers (find_editor, run_editor, subl, code)");

  // Section 1: Common editor launcher functions
  registerWithBashSyle(
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

        if [[ "$target_binary" == "flatpak:vscodium" ]]; then
          (nohup flatpak run com.vscodium.codium "\${editor_args[@]}" >/dev/null 2>&1 &)
        else
          (nohup "$target_binary" "\${editor_args[@]}" >/dev/null 2>&1 &)
        fi

        echo """
      ====================================
      \\"$target_binary\\" \${editor_args[@]}
      PWD:    $(pwd)
      Path:   $(realpath .)
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
  registerWithBashSyle(
    "Editor Launchers - Sublime Text",
    trimLeftSpaces(`
      _SUBL_PATHS=(
        /Applications/Sublime*Text.app/Contents/SharedSupport/bin/subl
        /mnt/c/Program*Files/Sublime*Text*/sublime*.exe
        /mnt/c/Program*Files/Sublime*Text*/subl*
        /opt/sublime_text/subl*
        /usr/bin/subl
        /usr/local/bin/subl
      )

      subl() {
        local editor_args
        # editor_args=("-n" "$@") # -n: always open a new window
        # editor_args=("-a" "$@") # -a: add to last active window (merges into existing project)
        editor_args=("$@") # no flag: reuses window if path is already open, otherwise new window

        run_editor "sublime" "\${_SUBL_PATHS[@]}"
      }
    `),
  );

  // Section 3: VS Code / VSCodium launcher
  registerWithBashSyle(
    "Editor Launchers - VS Code",
    trimLeftSpaces(`
      _CODE_PATHS=(
        /mnt/c/Users/Sy*/AppData/Local/Programs/Microsoft*Code/Code.exe
        /mnt/c/Users/Le*/AppData/Local/Programs/Microsoft*Code/Code.exe
        /mnt/c/Program*Files/VSCodium/VSCodium.exe
        /mnt/c/Program*Files/Microsoft*VS*Code/Code.exe
        /usr/local/bin/codium
        /usr/local/bin/code
        /usr/bin/codium
        /usr/bin/code
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
