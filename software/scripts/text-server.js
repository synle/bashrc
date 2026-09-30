/**
 * Registers `text-server`: a bash launcher that streams the zero-dependency Node web
 * editor (software/scripts/text-server.cjs) from the repo on every run, so nothing is
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
      # Same arguments as code-server. Server code is curl-fetched from the repo each run. Side effects: copies the LAN URL, opens the browser.
      function text-server() {
        if is_help_arg "\${1:-}"; then
          echo "
            text-server: browse/create/edit/delete files in the browser on the LAN (no auth)
              text-server                        serve ./ on port 9998
              text-server <path>                 serve <path> on port 9998
              text-server <path> <port>          serve <path> on <port>
            WARNING: binds 0.0.0.0. No auth: anyone on the network can read/write files under <path>.
          "
          return 0
        fi

        local folder="\${1:-.}"
        local port="\${2:-9998}"
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
        # Fetched fresh each run so the upstream copy is the only one maintained.
        local server_code
        server_code=$(command curl -fsSL "$(get_github_raw_url software/scripts/text-server.cjs)") || {
          echo "text-server: could not download server code" >&2
          return 1
        }

        local url="http://$(_docker_share_host_ip):$port/"
        local local_url="http://localhost:$port/"

        print_action_summary "$folder"
        echo "text-server:"
        echo "  LAN:   $url"
        echo "  Local: $local_url"
        echo "  (LAN URL copied to clipboard; Ctrl+C to stop)"
        type copy &> /dev/null && copy "$url"

        if ((is_os_mac)); then
          ( sleep 2 && command open "$local_url" > /dev/null 2>&1 ) &
        elif type -P xdg-open &> /dev/null; then
          ( sleep 2 && xdg-open "$local_url" > /dev/null 2>&1 ) &
        fi

        node - "$folder" "$port" <<< "$server_code"
      }
    `,
  );
}

/** Remove the `text-server` bash function. */
async function undoWork() {
  _removeLegacyPayload();
  await removeFromBashSyleProfile("Text Server");
}
