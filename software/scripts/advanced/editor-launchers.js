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

      # code-server: serve VS Code in the browser (code serve-web) on 0.0.0.0, token-protected.
      # Token comes from CODE_SERVER_AUTH_TOKEN; when missing or invalid a new one is generated
      # with openssl and persisted to ~/.bashrc. CODE_SERVER_ADDRESS overrides the shared base URL.
      # Side effects: writes the token file, copies the LAN URL to the clipboard, opens the browser.
      function code-server() {
        if is_help_arg "\${1:-}"; then
          echo "
            code-server: serve VS Code in the browser (code serve-web) on the LAN, token-protected
              code-server                        serve ./ on port 9999
              code-server <path>                 serve <path> on port 9999
              code-server <path> <port>          serve <path> on <port>
              CODE_SERVER_AUTH_TOKEN=xxx code-server ...            use this token (16+ letters/digits)
              CODE_SERVER_ADDRESS=http://host:port code-server ...  override the URL printed and copied
            Missing/invalid token -> generated with openssl and saved to ~/.bashrc.
            WARNING: binds 0.0.0.0. Anyone on the network with the token gets full VS Code, terminal included.
          "
          return 0
        fi
        if ((is_os_wsl)); then
          echo "code-server: not supported inside WSL (VS Code here is the Windows app); run code-server from PowerShell" >&2
          return 1
        fi

        local folder="\${1:-.}"
        local port="\${2:-9999}"
        if [ ! -d "$folder" ]; then
          echo "code-server: not a folder: $folder" >&2
          return 1
        fi
        folder=$(cd "$folder" && pwd) || return 1
        case "$port" in
        '' | *[!0-9]*)
          echo "code-server: port must be a number: $port" >&2
          return 1
          ;;
        esac
        if ((port < 1 || port > 65535)); then
          echo "code-server: port out of range 1-65535: $port" >&2
          return 1
        fi

        local target_binary
        target_binary=$(find_editor "code" "\${_CODE_PATHS[@]}") || return 1

        # Reuse CODE_SERVER_AUTH_TOKEN when valid; otherwise generate and persist to ~/.bashrc
        # (prior export line replaced, so the file holds exactly one).
        local token="\${CODE_SERVER_AUTH_TOKEN:-}"
        local token_re='^[A-Za-z0-9]{16,}$'
        if ! [[ "$token" =~ $token_re ]]; then
          token=$(openssl rand -hex 16) || return 1
          local bashrc_file="$HOME/.bashrc"
          local bashrc_kept
          safe_touch "$bashrc_file"
          bashrc_kept=$(command grep -v "^export CODE_SERVER_AUTH_TOKEN=" "$bashrc_file")
          if [ $? -gt 1 ]; then
            echo "code-server: could not read $bashrc_file" >&2
            return 1
          fi
          printf '%s\nexport CODE_SERVER_AUTH_TOKEN="%s"\n' "$bashrc_kept" "$token" > "$bashrc_file"
          export CODE_SERVER_AUTH_TOKEN="$token"
          echo ">> Generated new CODE_SERVER_AUTH_TOKEN, saved to $bashrc_file"
        fi

        # serve-web reads the token from a private file so it never shows up in ps / history.
        local token_folder="$HOME/.config/code-serve-web"
        local token_file="$token_folder/token"
        safe_mkdir "$token_folder"
        (
          umask 077
          printf '%s' "$token" > "$token_file"
        )

        local address="\${CODE_SERVER_ADDRESS:-}"
        if [ -z "$address" ]; then
          address="http://$(_docker_share_host_ip):$port"
        fi
        address="\${address%/}"
        local url="$address/?tkn=$token"
        local local_url="http://localhost:$port/?tkn=$token"

        print_action_summary "$folder"
        echo "code-server:"
        echo "  LAN:   $url"
        echo "  Local: $local_url"
        echo "  (LAN URL copied to clipboard; Ctrl+C to stop)"
        type copy &> /dev/null && copy "$url"

        # Open the local URL once the server has had a moment to start.
        if ((is_os_mac)); then
          ( sleep 3 && command open "$local_url" > /dev/null 2>&1 ) &
        elif type -P xdg-open &> /dev/null; then
          ( sleep 3 && xdg-open "$local_url" > /dev/null 2>&1 ) &
        fi

        "$target_binary" serve-web \\
          --host 0.0.0.0 \\
          --port "$port" \\
          --connection-token-file "$token_file" \\
          --default-folder "$folder" \\
          --accept-server-license-terms \\
          --disable-telemetry
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
