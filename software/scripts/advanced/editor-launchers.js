/**
 * Editor launcher functions and shell aliases for subl/code/zed.
 *
 * NOTE: Each launcher is emitted as `function name() { ... }` (not `name() { ... }`).
 * The `function` keyword is MANDATORY for two reasons:
 *   1. CLAUDE.md repo convention — "Bash functions must use the function keyword."
 *   2. Old bash 3.2 builds (pre-Catalina macOS) sometimes fail to parse `name()` inside an
 *      `if [ -z "$CLAUDECODE" ]; then ... fi` block, reporting
 *      "syntax error near unexpected token `('". The `function` keyword disambiguates the
 *      definition before the parser sees the `(`, avoiding the crash. See commits 43ca073/5fd4f9c.
 */
// SOURCE software/scripts/advanced/editor.common.js

/** Registers editor launcher functions (find_editor, run_editor, run_editor_cli) and shell aliases for subl/code. */
async function doWork() {
  log(">> Editor Launchers:");

  if (is_os_android_termux) {
    log(">> Skipped: Editor launchers not supported on Android Termux");
    return;
  }

  log(">> Registering editor launchers (find_editor, run_editor, subl, smerge, code)");

  // Section 1b: Vim launcher (wraps vim to track recent files via run_editor_cli)
  registerWithBashSyleProfile(
    "Editor Launchers - Vim",
    code`
      _VIM_PATHS=(
        /usr/bin/vim
        /usr/local/bin/vim
        /opt/homebrew/bin/vim
      )
      _register_editor "vim" "_VIM_PATHS"

      function vim() {
        local editor_paths=("\${_VIM_PATHS[@]}")
        run_editor_cli "vim" "$@"
      }
    `,
  );

  // Section 2: Sublime Text launcher
  registerWithBashSyleProfile(
    "Editor Launchers - Sublime Text",
    code`
      _SUBL_PATHS=(
        ${_SUBL_PATHS.map((p) => `"${p}"`).join("\n")}
      )
      _register_editor "subl" "_SUBL_PATHS"

      function subl() {
        local editor_args
        # editor_args=("-n" "$@") # -n: always open a new window
        # editor_args=("-a" "$@") # -a: add to last active window (merges into existing project)
        editor_args=("$@") # no flag: reuses window if path is already open, otherwise new window

        run_editor "subl" "\${_SUBL_PATHS[@]}"
      }
    `,
  );

  // Section 2b: Sublime Merge launcher
  registerWithBashSyleProfile(
    "Editor Launchers - Sublime Merge",
    code`
      _SMERGE_PATHS=(
        ${_SMERGE_PATHS.map((p) => `"${p}"`).join("\n")}
      )
      _register_editor "smerge" "_SMERGE_PATHS"

      function smerge() {
        local editor_args
        editor_args=("$@")

        run_editor "smerge" "\${_SMERGE_PATHS[@]}"
      }
    `,
  );

  // Section 3: VS Code launcher
  registerWithBashSyleProfile(
    "Editor Launchers - VS Code",
    code`
      _CODE_PATHS=(
        ${_CODE_PATHS.map((p) => `"${p}"`).join("\n")}
      )
      _register_editor "code" "_CODE_PATHS"

      function code() {
        local editor_args
        # editor_args=("-n" "$@") # -n: always open a new window
        # editor_args=("-r" "$@") # -r: reuse last active window (replaces current project)
        editor_args=("$@") # no flag: reuses window if path is already open, otherwise new window

        run_editor "code" "\${_CODE_PATHS[@]}"
      }

      function code_list_extensions() {
        local editor_paths=("\${_CODE_PATHS[@]}")
        run_editor_cli "code" --list-extensions
      }
    `,
  );

  // Section 4: Zed editor launcher
  registerWithBashSyleProfile(
    "Editor Launchers - Zed",
    code`
      _ZED_PATHS=(
        ${_ZED_PATHS.map((p) => `"${p}"`).join("\n")}
      )
      _register_editor "zed" "_ZED_PATHS"

      function zed() {
        local editor_args
        editor_args=("$@")

        run_editor "zed" "\${_ZED_PATHS[@]}"
      }
    `,
  );
}
