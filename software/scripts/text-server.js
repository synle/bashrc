/**
 * Registers `text-server`: a bash launcher that downloads the zero-dependency Node web
 * editor (software/scripts/text-server.cjs + its UI, text-server.html) from the repo on every run, so nothing is
 * installed locally and the latest upstream version always runs.
 */

/** @type {string} Legacy installed payload path, removed so a stale copy cannot linger. */
const TEXT_SERVER_LEGACY_PAYLOAD = path.join(BASE_HOMEDIR_LINUX, `.local`, `bin`, `text-server-app`);

/**
 * Delete the payload older versions of this script installed.
 */
function _removeLegacyPayload() {
  if (IS_DRY_RUN || !fs.existsSync(TEXT_SERVER_LEGACY_PAYLOAD)) return;
  fs.unlinkSync(TEXT_SERVER_LEGACY_PAYLOAD);
  log(`Removed legacy ${TEXT_SERVER_LEGACY_PAYLOAD}`);
}

/** Register the `text-server` bash function. */
async function doWork() {
  _removeLegacyPayload();

  registerWithBashSyleProfile(
    "Text Server",
    code`
      # text-server: tiny browser file editor (Node, no deps) on 0.0.0.0, no auth.
      # Same arguments as code-server. Locked to files directly in <path> unless --allow-cd.
      # Server code is curl-fetched from the repo each run. Side effects: copies the LAN URL, opens the browser.
      function text-server() {
        if is_help_arg "\${1:-}"; then
          echo "
            text-server: browse/create/edit/delete files in the browser on the LAN (no auth)
              text-server                        serve ./ on port 9998
              text-server <path>                 serve <path> on port 9998
              text-server <path> <port>          serve <path> on <port>
              text-server --allow-cd ...         also allow browsing/creating/deleting subfolders
            Default: locked to files directly inside <path>; folders are hidden and cannot be entered.
            Never reaches outside <path> (.., absolute paths, and symlink escapes are rejected).
            WARNING: binds 0.0.0.0. No auth: anyone on the network can read/write files under <path>.
          "
          return 0
        fi

        local allow_cd=0
        local positional=()
        local arg
        for arg in "$@"; do
          case "$arg" in
          --allow-cd) allow_cd=1 ;;
          --no-allow-cd) allow_cd=0 ;;
          -*)
            echo "text-server: unknown flag: $arg" >&2
            return 1
            ;;
          *) positional+=("$arg") ;;
          esac
        done
        if ((\${#positional[@]} > 2)); then
          echo "text-server: too many arguments (see text-server --help)" >&2
          return 1
        fi

        local folder="\${positional[0]:-.}"
        local port="\${positional[1]:-9998}"
        if [ ! -d "$folder" ]; then
          echo "text-server: not a folder: $folder" >&2
          return 1
        fi
        folder=$(cd "$folder" && pwd) || return 1
        case "$port" in
        '' | *[!0-9]*)
          echo "text-server: port must be a number: $port" >&2
          return 1
          ;;
        esac
        if ((port < 1 || port > 65535)); then
          echo "text-server: port out of range 1-65535: $port" >&2
          return 1
        fi

        if ! type -P node &> /dev/null; then
          echo "text-server: node not found on PATH" >&2
          return 1
        fi
        # Fetched fresh each run so the upstream copy is the only one maintained. The server reads
        # text-server.html from its own folder, so both files land side by side in a temp folder.
        local app_folder app_file
        app_folder=$(mktemp -d) || {
          echo "text-server: mktemp failed" >&2
          return 1
        }
        for app_file in text-server.cjs text-server.html; do
          command curl -fsSL -o "$app_folder/$app_file" "$(get_github_raw_url "software/scripts/$app_file")" || {
            echo "text-server: could not download $app_file" >&2
            command rm -rf "$app_folder"
            return 1
          }
        done

        local url="http://$(_docker_share_host_ip):$port/"
        local local_url="http://localhost:$port/"

        print_action_summary "$folder"
        echo "text-server:"
        echo "  LAN:   $url"
        echo "  Local: $local_url"
        if ((allow_cd)); then
          echo "  Mode:  subfolders allowed (still confined to $folder)"
        else
          echo "  Mode:  locked to files in $folder (pass --allow-cd for subfolders)"
        fi
        echo "  (LAN URL copied to clipboard; Ctrl+C to stop)"
        type copy &> /dev/null && copy "$url"

        if ((is_os_mac)); then
          ( sleep 2 && command open "$local_url" > /dev/null 2>&1 ) &
        elif type -P xdg-open &> /dev/null; then
          ( sleep 2 && xdg-open "$local_url" > /dev/null 2>&1 ) &
        fi

        node "$app_folder/text-server.cjs" "$folder" "$port" "$allow_cd"
        command rm -rf "$app_folder"
      }

      # copy-server: text-server on a fresh mktemp folder — a LAN scratchpad for pasting text between machines.
      # Args after the folder pass through to text-server ([<port>] [--allow-cd]). Side effects: creates a temp folder (left in place).
      function copy-server() {
        if is_help_arg "\${1:-}"; then
          echo "
            copy-server: text-server on a new empty temp folder (LAN scratchpad; alias: paste-server)
              copy-server                        serve a new temp folder on port 9998
              copy-server <port>                 serve a new temp folder on <port>
              copy-server ... --allow-cd         pass-through flag, see text-server --help
          "
          return 0
        fi
        local folder
        folder=$(mktemp -d) || {
          echo "copy-server: mktemp failed" >&2
          return 1
        }
        text-server "$folder" "$@"
      }
      alias paste-server='copy-server'
    `,
  );
}

/** Remove the `text-server` bash function. */
async function undoWork() {
  _removeLegacyPayload();
  await removeFromBashSyleProfile("Text Server");
}
