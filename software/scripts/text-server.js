/**
 * Installs `text-server`: a zero-dependency Node web editor (create/open/edit/delete
 * files in one folder) plus a bash launcher mirroring `code-server`'s arguments and
 * token handling.
 */

/** @type {string} Repo path of the Node server payload. */
const TEXT_SERVER_SOURCE = `software/scripts/text-server.cjs`;

/**
 * Resolve the installed server payload path.
 * @returns {string} Absolute path under ~/.local/bin.
 */
function _textServerDestination() {
  return path.join(BASE_HOMEDIR_LINUX, `.local`, `bin`, `text-server-app`);
}

/** Install the server payload and register the `text-server` bash function. */
async function doWork() {
  const dest = _textServerDestination();
  const content = await readText`${TEXT_SERVER_SOURCE}`;
  if (!IS_DRY_RUN) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
  }
  await writeText(dest, content);
  if (!IS_DRY_RUN) {
    fs.chmodSync(dest, 0o755);
  }
  log(`text-server-app installed at ${dest}`);

  registerWithBashSyleProfile(
    "Text Server",
    code`
      # text-server: tiny browser file editor (Node, no deps) on 0.0.0.0, no auth.
      # Same arguments as code-server. Side effects: copies the LAN URL, opens the browser.
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

        local server_file="$HOME/.local/bin/text-server-app"
        if [ ! -f "$server_file" ]; then
          echo "text-server: $server_file missing; run: bash run.sh --files=text-server.js" >&2
          return 1
        fi
        if ! type -P node &> /dev/null; then
          echo "text-server: node not found on PATH" >&2
          return 1
        fi

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

        node "$server_file" "$folder" "$port"
      }
    `,
  );
}

/** Remove the server payload and the `text-server` bash function. */
async function undoWork() {
  const dest = _textServerDestination();
  if (IS_DRY_RUN) {
    log(`[dry-run] would remove ${dest}`);
  } else if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
    log(`Removed ${dest}`);
  }
  await removeFromBashSyleProfile("Text Server");
}
