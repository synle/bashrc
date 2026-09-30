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
              text-server <path> <port>          serve <path> on <port> (busy port -> any free port)
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
        # Fetch fresh from upstream each run, validate, then promote into a local snapshot folder; the server
        # always runs from that snapshot. A failed download or an invalid copy (bad push) falls back to the
        # last good snapshot, so the tool works offline and one broken commit does not break every machine.
        local snapshot_folder="$HOME/.text-server"
        local app_folder app_file download_ok=1
        app_folder=$(mktemp -d) || {
          echo "text-server: mktemp failed" >&2
          return 1
        }
        for app_file in text-server.cjs text-server.html; do
          command curl -fsSL --max-time 15 -o "$app_folder/$app_file" "$(get_github_raw_url "software/scripts/$app_file")" || {
            echo "text-server: could not download $app_file" >&2
            download_ok=0
            break
          }
        done
        # Valid = the server parses and the page is the real template (not an error page or a truncated file).
        if ((download_ok)) && ! { node --check "$app_folder/text-server.cjs" 2> /dev/null && grep -q "__APP_VERSION__" "$app_folder/text-server.html" && grep -q "</html>" "$app_folder/text-server.html"; }; then
          echo "text-server: downloaded copy failed validation" >&2
          download_ok=0
        fi
        if ((download_ok)); then
          # Version = file mtime; a fresh download's mtime is "now", so stamp each file with its last git
          # commit time (GitHub API, best-effort: on failure the version is just the download time).
          # curl + node (no fetch): the profile's node can be older than v18.
          for app_file in text-server.cjs text-server.html; do
            command curl -fsS --max-time 5 "https://api.github.com/repos/$REPO_PATH_IDENTIFIER/commits?per_page=1&path=software/scripts/$app_file" 2> /dev/null \
              | node -e 'const fs = require("fs"); const when = new Date(JSON.parse(fs.readFileSync(0, "utf8"))[0].commit.committer.date); fs.utimesSync(process.argv[1], when, when);' "$app_folder/$app_file" 2> /dev/null \
              || echo "text-server: could not stamp $app_file with its git commit time; version uses the download time" >&2
          done
          safe_mkdir "$snapshot_folder"
          # cp -p keeps the stamped mtimes, which are the version.
          command cp -p "$app_folder/text-server.cjs" "$app_folder/text-server.html" "$snapshot_folder/" || {
            echo "text-server: could not update snapshot in $snapshot_folder" >&2
            command rm -rf "$app_folder"
            return 1
          }
        elif [ -f "$snapshot_folder/text-server.cjs" ] && [ -f "$snapshot_folder/text-server.html" ]; then
          echo "text-server: using last good snapshot in $snapshot_folder" >&2
        else
          echo "text-server: no download and no snapshot in $snapshot_folder; cannot start" >&2
          command rm -rf "$app_folder"
          return 1
        fi
        command rm -rf "$app_folder"
        app_folder="$snapshot_folder"

        # Requested port busy -> let the OS pick a free one, so the printed/opened URLs match the server.
        port=$(node -e '
          const net = require("net"), wanted = Number(process.argv[1]), probe = net.createServer();
          probe.once("error", () => probe.listen(0, "0.0.0.0", () => { console.log(probe.address().port); probe.close(); }));
          probe.listen(wanted, "0.0.0.0", () => { console.log(wanted); probe.close(); });
        ' "$port") || {
          echo "text-server: could not find a free port" >&2
          return 1
        }

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
      }

      # copy-server: text-server on a fresh mktemp folder holding an empty clipboard.txt — a LAN scratchpad for pasting text between machines.
      # Args after the folder pass through to text-server ([<port>] [--allow-cd]). Side effects: creates a temp folder (left in place).
      function copy-server() {
        if is_help_arg "\${1:-}"; then
          echo "
            copy-server: text-server on a new temp folder seeded with an empty clipboard.txt (LAN scratchpad; alias: paste-server)
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
        # Seed the scratchpad copy-from-server reads; being the only file, the UI also auto-opens it.
        : > "$folder/clipboard.txt"
        text-server "$folder" "$@"
      }
      alias paste-server='copy-server'

      # copy-to-server: push text to every CODE_SERVER_REMOTE copy-server. Each send writes a history file
      # (Temp-<date_time>.txt, or --name) AND overwrites clipboard.txt, the file copy-from-server reads.
      # Content source, first match wins: piped stdin, an existing file path, literal text args, the clipboard.
      # Targets come from CODE_SERVER_REMOTE_HOSTS (baked by run.sh from ip-address.config).
      # Side effects: two HTTP PUTs per host; replaces the local clipboard with the first sent URL
      # (unless --no-copy-url); creates and removes a temp file.
      function copy-to-server() {
        if is_help_arg "\${1:-}"; then
          echo "
            copy-to-server: send text to every copy-server tagged CODE_SERVER_REMOTE
              copy-to-server                     send the clipboard
              copy-to-server <file>              send the content of <file>
              copy-to-server <text...>           send the literal text
              <cmd> | copy-to-server             send piped stdin
            Options (before the content):
              --name <name>                      history file name (default Temp-<date_time>.txt)
              --no-copy-url                      leave the local clipboard alone (default: copy the sent URL)
            Every send also overwrites clipboard.txt, so copy-from-server on another machine gets it back.
            Targets: \\$CODE_SERVER_REMOTE_HOSTS (from software/metadata/ip-address.config; re-run run.sh to refresh)
          "
          return 0
        fi
        local name="" copy_url=1
        while [ $# -gt 0 ]; do
          case "$1" in
          --name)
            name="\${2:-}"
            shift 2 || shift
            ;;
          --no-copy-url)
            copy_url=0
            shift
            ;;
          --)
            shift
            break
            ;;
          *) break ;;
          esac
        done
        if [ -z "\${CODE_SERVER_REMOTE_HOSTS:-}" ]; then
          echo "copy-to-server: no host tagged CODE_SERVER_REMOTE in ip-address.config (CODE_SERVER_REMOTE_HOSTS is empty; re-run run.sh)" >&2
          return 1
        fi

        local payload mode
        payload=$(mktemp) || {
          echo "copy-to-server: mktemp failed" >&2
          return 1
        }
        if [ $# -eq 0 ] && [ ! -t 0 ]; then
          mode="stdin"
          command cat > "$payload"
        elif [ $# -eq 1 ] && [ -f "$1" ]; then
          mode="file ($1)"
          command cat -- "$1" > "$payload"
        elif [ $# -gt 0 ]; then
          mode="raw text"
          printf '%s' "$*" > "$payload"
        else
          mode="clipboard"
          paste > "$payload"
        fi
        if [ ! -s "$payload" ]; then
          echo "copy-to-server: content from $mode is empty; nothing sent" >&2
          command rm -f "$payload"
          return 1
        fi

        [ -n "$name" ] || name="Temp-$(date +%Y-%m-%d_%H-%M-%S).txt"
        local encoded
        encoded=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$name") || {
          command rm -f "$payload"
          return 1
        }
        local bytes=$(wc -c < "$payload" | tr -d ' ')
        echo "copy-to-server: mode=$mode, $bytes bytes -> $name (+ clipboard.txt)"
        local host target sent=0 failed=0 first_url=""
        for host in $CODE_SERVER_REMOTE_HOSTS; do
          target="$encoded"
          if command curl -fs --max-time 5 -X PUT --data-binary @"$payload" "http://$host/api/file?path=$target" > /dev/null 2>&1; then
            [ "$name" = "clipboard.txt" ] \
              || command curl -fs --max-time 5 -X PUT --data-binary @"$payload" "http://$host/api/file?path=clipboard.txt" > /dev/null 2>&1 \
              || echo "  warn   http://$host: history file sent, clipboard.txt update failed" >&2
            echo "  sent   http://$host/?path=$target"
            [ -n "$first_url" ] || first_url="http://$host/?path=$target"
            sent=$((sent + 1))
          else
            echo "  failed http://$host (is copy-server running there?)" >&2
            failed=$((failed + 1))
          fi
        done
        command rm -f "$payload"
        echo "copy-to-server: $sent sent, $failed failed"
        if ((copy_url)) && [ -n "$first_url" ]; then
          printf '%s' "$first_url" | copy --raw
          echo "copy-to-server: URL copied to the clipboard: $first_url"
        fi
        ((sent > 0))
      }

      # copy-from-server: fetch clipboard.txt (or <name>) from the FIRST reachable CODE_SERVER_REMOTE copy-server,
      # put it on the local clipboard, and print it to stdout (status lines go to stderr, so it pipes cleanly).
      # Hosts are tried in CODE_SERVER_REMOTE_HOSTS order; an unreachable one is skipped, but the first one that
      # answers is final — a missing file there is reported, not looked up on the next host.
      # Side effects: overwrites the local clipboard; creates and removes a temp file.
      function copy-from-server() {
        if is_help_arg "\${1:-}"; then
          echo "
            copy-from-server: pull a file from the first reachable CODE_SERVER_REMOTE copy-server into the clipboard
              copy-from-server                   fetch clipboard.txt, copy it, and print it
              copy-from-server <name>            fetch <name> instead (path relative to the served folder)
            Targets: \\$CODE_SERVER_REMOTE_HOSTS (from software/metadata/ip-address.config; re-run run.sh to refresh)
          "
          return 0
        fi
        if [ -z "\${CODE_SERVER_REMOTE_HOSTS:-}" ]; then
          echo "copy-from-server: no host tagged CODE_SERVER_REMOTE in ip-address.config (CODE_SERVER_REMOTE_HOSTS is empty; re-run run.sh)" >&2
          return 1
        fi

        local name="\${1:-clipboard.txt}"
        local encoded
        encoded=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$name") || return 1
        local response
        response=$(mktemp) || {
          echo "copy-from-server: mktemp failed" >&2
          return 1
        }

        local host status
        for host in $CODE_SERVER_REMOTE_HOSTS; do
          # 000 = no HTTP answer (down / not running) -> try the next host; any real status means this host is the one.
          status=$(command curl -s --max-time 5 -o "$response" -w '%{http_code}' "http://$host/api/file?path=$encoded")
          if [ "$status" = "000" ]; then
            echo "copy-from-server: skip   http://$host (not reachable)" >&2
            continue
          fi
          if [ "$status" != "200" ]; then
            echo "copy-from-server: http://$host/?path=$encoded -> HTTP $status: $(command cat "$response")" >&2
            command rm -f "$response"
            return 1
          fi
          echo "copy-from-server: using  http://$host/?path=$encoded" >&2
          local content
          content=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).content + "x")' "$response") || {
            echo "copy-from-server: unexpected response from http://$host" >&2
            command rm -f "$response"
            return 1
          }
          command rm -f "$response"
          content="\${content%x}" # drop the sentinel that protected trailing newlines from \$( )
          printf '%s' "$content" | copy --raw
          printf '%s' "$content"
          [[ "$content" == *$'\\n' ]] || echo # end the terminal line without doubling a trailing newline
          echo "copy-from-server: \${#content} chars copied to the clipboard" >&2
          return 0
        done
        command rm -f "$response"
        echo "copy-from-server: no CODE_SERVER_REMOTE host reachable ($CODE_SERVER_REMOTE_HOSTS)" >&2
        return 1
      }
    `,
  );
}

/** Remove the `text-server` bash function. */
async function undoWork() {
  _removeLegacyPayload();
  await removeFromBashSyleProfile("Text Server");
}
