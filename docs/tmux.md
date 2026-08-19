# tmux

Config lives in `software/scripts/advanced/tmux.config`, installed to `~/.tmux.conf` by
`software/scripts/advanced/tmux.js`. Keybindings — both the custom `alt+` chords and the
stock `ctrl+b` prefix chords — are documented in
[`docs/editor-keybindings.md`](./editor-keybindings.md), the single source of truth for
keys. This file covers the workflow patterns around them.

The workspace functions described below ship for real in
`software/scripts/bash-tmux-workspace.profile.bash`, sourced into `~/.bash_syle` by a
`# SOURCE` marker in `software/bootstrap/profile-advanced.sh`:

| Function                | Alias  | Does                                                       |
| ----------------------- | ------ | ---------------------------------------------------------- |
| `workspace_create`      | `ws`   | Build a session from a JSON config, or attach if it exists |
| `workspace_open`        | `wso`  | Attach to a running session, or pick one from a list       |
| `workspace_sample_json` | `wssj` | Write a starter config named `<datetime>.json`             |
| `workspace_freeze`      | `wsf`  | Snapshot a running session back into a config              |
| `workspace_list`        | `wsls` | List sessions with window counts                           |
| `workspace_close`       | `wsc`  | Kill one session by exact name                             |
| `workspace_close_all`   | `wsca` | Kill every session, after confirming                       |
| `workspace_temp_create` | `wst`  | Run one throwaway command in the shared temp session       |
| `workspace_temp_open`   | `wsto` | Attach to the shared temp session                          |
| `workspace_temp_close`  | `wstc` | Kill every temp session                                    |

Aliases are the first letter of each word after `workspace`, with two carve-outs. The bare
prefix (`ws`, `wst`) is **create**, the primary verb — which is what frees `wsc` for
`workspace_close`, since `create` and `close` both start with `c`. And `workspace_list` is
`wsls`, not `wsl`, because `wsl` is the Windows Subsystem for Linux launcher and sits on
`PATH` under MinGW / Git Bash.

The shipped versions use the **simple schema** (one window per entry, no panes) and depend
only on `tmux` + `jq`. The pane-capable `workspace_tmuxp` and the Node converter further
down are documented here but deliberately not installed — reach for real `tmuxp` when you
need panes and layouts.

Configs live in `$WORKSPACE_CONFIG_FOLDER`, which is `$SY_HOME_FOLDER/workspaces_tmux` —
i.e. `~/sy/workspaces_tmux`. `$SY_HOME_FOLDER` is declared once in
`software/bootstrap/common-env.sh` as the personal root: one visible folder under `$HOME`
owning everything this setup creates for the user rather than for a tool, named to match
the `sy` namespace already used by `sy-commands`, the `/sy-*` corpus, and `_SY_LLM_SPECS`.
Derive a subfolder from it; never write a second `$HOME` path.

That one declaration reaches both surfaces, so bash and node always agree on the path:

| Surface             | How it gets there                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `run.sh` and node   | `common-env.sh` is inlined into `run.sh` and sourced, so every script inherits it as an env var |
| Interactive shells  | `run.sh` re-exports it into `~/.bash_syle_common`, which is wired up as `$BASH_ENV`             |
| `software/index.js` | the `SY_HOME_FOLDER` global reads that same env var                                             |

Declaring it in `common-env.sh` alone is **not** enough for an interactive shell — only a
hand-listed subset of those exports is re-emitted into `~/.bash_syle_common`. Adding a new
shared variable means adding it to that block too; `software/tests/syHomeFolder.spec.js`
pins both halves.

Consumers fall back to a bare `$HOME` when the variable is unset (`${SY_HOME_FOLDER:-$HOME}`),
never to a repeated `sy` — that keeps a partial sourceable on its own in a test or a bare
shell without becoming a second declaration that can drift out of sync. The name `sy`
appears in exactly one hand-written file, and the spec above fails the build if a second
copy shows up.

---

## Table of Contents

- [Scripted workspace sessions](#scripted-workspace-sessions)
  - [The pattern](#the-pattern)
  - [How it works, line by line](#how-it-works-line-by-line)
  - [Gotchas](#gotchas)
  - [Variations](#variations)
- [Data-driven workspaces (JSON)](#data-driven-workspaces-json)
  - [Use `tmuxp` unless you have a reason not to](#use-tmuxp-unless-you-have-a-reason-not-to)
  - [The zero-dependency version: a `workspace` function](#the-zero-dependency-version-a-workspace-function)
  - [Review notes — what the first draft got wrong](#review-notes--what-the-first-draft-got-wrong)
  - [Generating a tmuxp config from the simple schema (Node)](#generating-a-tmuxp-config-from-the-simple-schema-node)
  - [Template: one function per project, config inline](#template-one-function-per-project-config-inline)
  - [`workspace_tmuxp` — parse tmuxp's schema with no tmuxp](#workspace_tmuxp--parse-tmuxps-schema-with-no-tmuxp)
  - [`workspace_sample_json` — a config to start from](#workspace_sample_json--a-config-to-start-from)
  - [`workspace_freeze` — the cheap knockoff of `tmuxp freeze`](#workspace_freeze--the-cheap-knockoff-of-tmuxp-freeze)
  - [`workspace_close` / `workspace_close_all` — tearing down](#workspace_close--workspace_close_all--tearing-down)
  - [`workspace_temp_*` — one throwaway command, no JSON](#workspace_temp_--one-throwaway-command-no-json)
  - [Which one to use](#which-one-to-use)

---

## Scripted workspace sessions

A "workspace launcher" is a shell function that builds a named tmux session with one window
per long-running process — dev server, watcher, log tail, a spare shell — so a whole project
comes up with one command and survives a closed terminal.

### The pattern

```bash
# dev_workspace: start (or re-attach to) the project's tmux workspace
function dev_workspace() {
  if is_help_arg "${1:-}"; then
    echo "dev_workspace: start or attach the project tmux workspace
  --force    kill the existing session and rebuild it from scratch"
    return 0
  fi

  local SESSION="my_project_session"
  local FORCE=false

  ## check if --force flag was passed
  if [[ "$1" == "--force" ]]; then
    FORCE=true
  fi

  ## if the session exists, either rebuild it or just attach
  if tmux has-session -t "$SESSION" 2> /dev/null; then
    if [[ "$FORCE" == "true" ]]; then
      tmux kill-session -t "$SESSION"
    else
      tmux attach-session -t "$SESSION"
      return 0
    fi
  fi

  ## create the session detached, with the first window and its command
  tmux new-session -d -s "$SESSION" -n window_one_name 'bash -ic "command_one; exec bash"'

  ## spawn the remaining windows and commands
  tmux new-window -t "$SESSION:" -n window_two_name 'bash -ic "command_two; exec bash"'
  tmux new-window -t "$SESSION:" -n window_three_name 'bash -ic "command_three; exec bash"'

  ## attach
  tmux attach-session -t "$SESSION"
}
```

Idempotent by construction: run it any number of times and you land in the same session.
`--force` is the escape hatch when a window's command needs a clean restart.

### How it works, line by line

| Piece                       | Why                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tmux has-session -t "$S"`  | Exit status is the whole test — `0` when it exists. `2> /dev/null` hides the "can't find session" noise on the first run.                                   |
| `new-session -d`            | Detached. Builds every window before anything is visible, so you never watch panes pop in, and the later windows are created against a session that exists. |
| `-s "$SESSION"`             | Names the session, which is what makes re-attach and `--force` possible. An unnamed session gets a number and is unfindable.                                |
| `-n window_one_name`        | Names the window so the status bar reads `1:api 2:web` instead of `1:bash 2:bash`.                                                                          |
| `-t "$SESSION:"`            | Trailing colon means "this session, next free window index". Without it a bare `-t "$SESSION"` targets the session's _current window_ in some commands.     |
| `bash -ic "…"`              | Interactive (`-i`) so `~/.bashrc` / `~/.bash_syle` is sourced — aliases, `nvm`, PATH tweaks, and shell functions all exist inside the window.               |
| `; exec bash`               | Keeps the window alive after the command exits or is `ctrl+c`'d. Without it tmux closes the window and you lose the output that explained the crash.        |
| `exec` (not plain `bash`)   | Replaces the process instead of nesting one, so `ctrl+d` closes the window once, not twice.                                                                 |
| `attach-session` at the end | The only interactive step. Everything above is setup.                                                                                                       |

### Gotchas

- **Attaching from inside tmux fails.** `attach-session` errors with `sessions should be
nested with care` when `$TMUX` is set. Handle both cases:

  ```bash
  if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "$SESSION"
  else
    tmux attach-session -t "$SESSION"
  fi
  ```

- **Window indices start at 1 here**, not 0 — `tmux.config` sets `base-index 1` (and
  `pane-base-index 1`) so the numbers match the `alt+1-9` chords. Any `select-window -t
"$SESSION:1"` you write is the _first_ window on this config and the _second_ one on a
  stock tmux. Prefer targeting by name (`-t "$SESSION:window_two_name"`) — immune to both
  the base index and to `renumber-windows on`, which reindexes everything when a window closes.
- **`--force` kills work.** `kill-session` takes down every process in the session with no
  prompt. It is the right default for dev servers and watchers, and the wrong one for a
  window holding a long build or an editor with unsaved buffers.
- **Only `$1` is checked.** `dev_workspace foo --force` silently does not force. Loop over
  `"$@"` if the function grows a second flag.
- **Quote the command carefully.** The command is single-quoted with a double-quoted `bash
-ic` string inside, so a literal `"` or `$` in the command needs escaping. When it gets
  hairy, put the steps in a script and run that instead.
- **`bash -ic` is not `bash -lc`.** Interactive sources `~/.bashrc`; login sources
  `~/.bash_profile`. On macOS the PATH-setting bits often live in the login file — use
  `bash -lic` when a tool is missing inside the window but present in your terminal.
- **No `cd` in the pattern above** — every window inherits the folder the function ran from.
  Pin it explicitly with `-c` (`new-session -d -s "$S" -c "$HOME/git/myrepo"`) so the
  workspace is the same regardless of where it was launched.

### Variations

```bash
## split a window into panes instead of adding a window
tmux new-window -t "$SESSION:" -n logs 'bash -ic "tail -f app.log; exec bash"'
tmux split-window -t "$SESSION:logs" -v 'bash -ic "tail -f err.log; exec bash"'

## start each window in a specific folder
tmux new-window -t "$SESSION:" -n api -c "$HOME/git/myrepo/api" 'bash -ic "npm run dev; exec bash"'

## land on a chosen window rather than the last one created
tmux select-window -t "$SESSION:window_one_name"

## send a command to an already-running window (no new window)
tmux send-keys -t "$SESSION:api" 'npm test' C-m

## list what a launcher actually built — the fastest way to debug one
tmux list-windows -t "$SESSION" -F '#I #W #{pane_current_command}'
```

Sessions outlive the terminal that started them, so a launcher plus `ctrl+b d` (detach) is a
complete "close the laptop, come back tomorrow" workflow. `tmux ls` lists what is still
running; `tmux kill-session -t <name>` tears one down.

---

## Data-driven workspaces (JSON)

One function per project does not scale — the session name, window names, and commands are
the only things that change, so they belong in data. Two ways to get there, and the ladder
says try the existing tool first.

### Use `tmuxp` unless you have a reason not to

`tmuxp` already does this, natively, in JSON. Verified against its README on 2026-08-17:

| Capability                   | Command / form                                                         |
| ---------------------------- | ---------------------------------------------------------------------- |
| Load a config                | `tmuxp load ./my_project.json` (JSON **and** YAML both supported)      |
| Load by folder               | `tmuxp load path/to/project/` — picks up `.tmuxp.json` / `.tmuxp.yaml` |
| Load by name                 | `tmuxp load mysession` — from `~/.config/tmuxp/mysession.json`         |
| Override the session name    | `tmuxp load -s other_name ./my_project.json`                           |
| Load detached                | `tmuxp load -d …`                                                      |
| Snapshot a live session back | `tmuxp freeze session-name`                                            |
| Convert between formats      | `tmuxp convert filename`                                               |

Install: `brew install tmuxp` (formula `tmuxp`, stable 1.74.0 at time of writing) or
`pip install tmuxp`. `tmuxinator` (Ruby, `gem install tmuxinator`, `brew install tmuxinator`,
3.4.1) is the older equivalent and is YAML-only; tmuxp can read tmuxinator and teamocil
configs.

Its schema is one level deeper than the shape below, because panes are first class:

```json
{
  "session_name": "my_project_session",
  "windows": [
    { "window_name": "editor", "panes": [{ "shell_command": ["nvim"] }] },
    { "window_name": "server", "panes": [{ "shell_command": ["npm run dev"] }] }
  ]
}
```

That extra nesting is the feature — `layout`, `start_directory`, `shell_command_before`,
`before_script`, environment variables, and multi-pane splits all have a place to live.
Pick tmuxp when the workspace has panes, needs a pre-load hook, or you want `freeze` to
write the config for you.

### The zero-dependency version: a `workspace` function

Worth writing only when you want no Python/Ruby runtime in the loop and a schema you fully
control. Same JSON shape you sketched, one window per entry:

```json
{
  "session": "my_project_session",
  "folder": "~/git/my_project",
  "windows": [
    { "name": "editor", "command": "nvim" },
    { "name": "server", "command": "npm run dev" },
    { "name": "logs", "command": "tail -f logs/app.log", "folder": "/var/log" }
  ]
}
```

`folder` is optional at both levels — window-level wins, session-level is the fallback, and
`$PWD` is the last resort.

```bash
# workspace: build or attach a tmux session described by a JSON file
function workspace() {
  if is_help_arg "${1:-}"; then
    echo "workspace: build or attach a tmux session from a JSON config
  workspace <name|path.json> [--force]
  --force    kill the existing session and rebuild it
  looks up <name> as ./<name>.json then \$HOME/sy/workspaces_tmux/<name>.json"
    return 0
  fi

  local config_file="" force=false arg
  for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
      force=true
    elif [ -z "$config_file" ]; then
      config_file="$arg"
    fi
  done

  if ! type -P jq > /dev/null 2>&1; then
    echo "workspace: jq is required" >&2
    return 1
  fi

  ## resolve a bare name to a config file
  local candidate found=""
  for candidate in "$config_file" "$config_file.json" "$PWD/$config_file.json" "$HOME/sy/workspaces_tmux/$config_file.json"; do
    if [ -n "$config_file" ] && [ -f "$candidate" ]; then
      found="$candidate"
      break
    fi
  done
  if [ -z "$found" ]; then
    echo "workspace: config not found: ${config_file:-<none>}" >&2
    return 1
  fi
  config_file="$found"

  if ! jq -e . "$config_file" > /dev/null 2>&1; then
    echo "workspace: invalid JSON: $config_file" >&2
    return 1
  fi

  local session
  session=$(jq -r '.session // empty' "$config_file")
  if [ -z "$session" ]; then
    echo "workspace: config has no .session" >&2
    return 1
  fi

  ## existing session: rebuild on --force, otherwise just go there
  if tmux has-session -t "=$session" 2> /dev/null; then
    if [ "$force" = "true" ]; then
      tmux kill-session -t "=$session"
    else
      _workspace_attach "$session"
      return $?
    fi
  fi

  local root
  root=$(jq -r '.folder // empty' "$config_file")
  root=${root/#\~/$HOME}

  local index=0 name cmd folder quoted
  while IFS=$'\t' read -r name cmd folder; do
    [ -n "$name" ] || name="win$index"
    folder=${folder/#\~/$HOME}
    [ -n "$folder" ] || folder="$root"
    [ -n "$folder" ] || folder="$PWD"

    ## printf %q makes the command safe to hand to tmux, which runs it through sh
    quoted=$(printf '%q' "$cmd; exec bash")

    if [ "$index" -eq 0 ]; then
      tmux new-session -d -s "$session" -n "$name" -c "$folder" "bash -ic $quoted" || return 1
    else
      tmux new-window -t "$session:" -n "$name" -c "$folder" "bash -ic $quoted" || return 1
    fi
    index=$((index + 1))
  done < <(jq -r '.windows[]? | [(.name // ""), (.command // ""), (.folder // "")] | @tsv' "$config_file")

  if [ "$index" -eq 0 ]; then
    echo "workspace: no windows defined in $config_file" >&2
    return 1
  fi

  tmux select-window -t "$session:" > /dev/null 2>&1
  _workspace_attach "$session"
}

# _workspace_attach: attach from outside tmux, switch from inside it
function _workspace_attach() {
  if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "=$1"
  else
    tmux attach-session -t "=$1"
  fi
}
```

### Review notes — what the first draft got wrong

The straightforward `jq`-in-a-`for`-loop draft has five defects worth naming, because each
one is easy to reintroduce:

| Defect                                                                                                                                                                                                                        | Fix                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`}` closing an `if`.** `if …; then … }` is a syntax error — bash closes `if` with `fi`, only functions and command groups take `}`. It hit three blocks at once.                                                            | `fi`. Catch it with `bash -n <file>` before sourcing anything.                                                                                               |
| **`"bash -ic '$cmd; exec bash'"`.** The command is interpolated inside single quotes inside double quotes. One apostrophe in a command (`echo "it's up"`) ends the quoting early and the window silently runs something else. | `quoted=$(printf '%q' "$cmd; exec bash")`, then `"bash -ic $quoted"`. `printf %q` emits shell-safe quoting for arbitrary input.                              |
| **`has-session -t "$session"` prefix-matches.** tmux target names are prefix matches, so a session named `api` finds an existing `api_staging` and attaches to the wrong workspace.                                           | `-t "=$session"` — the `=` forces an exact match. Applies to `has-session`, `kill-session`, `attach-session`, `switch-client`.                               |
| **`attach-session` from inside tmux fails** with `sessions should be nested with care`, which is exactly where you run this most.                                                                                             | Branch on `$TMUX` and use `switch-client` — the `_workspace_attach` helper.                                                                                  |
| **One `jq` process per field.** `2N + 2` process spawns for N windows, and no validation that the file is even JSON.                                                                                                          | One `jq … \| @tsv` call feeding a `while read` loop, plus `jq -e .` up front so a trailing comma reports itself instead of producing a session named `null`. |

Two smaller ones: `jq` is not guaranteed present (guard with `type -P`), and a missing
`.session` key yields the literal string `null` from `jq -r`, which happily becomes a
session named `null` — hence `// empty` plus an explicit check.

Both variants above were run for real against tmux 3.6a: three windows built with correct
per-window folders, an apostrophe-and-`$HOME` command survived intact, `--force` rebuilt the
session, and a bad config name exited `1` with a message.

### Generating a tmuxp config from the simple schema (Node)

The two schemas differ only in nesting — `session` → `session_name`, `name` →
`window_name`, `command` → `panes[].shell_command[]`. That is a pure data transform, so keep
authoring the short shape and generate tmuxp's. Node is already a hard dependency of this
repo, so no runtime is added:

```js
#!/usr/bin/env node
/** Convert the simple {session, windows:[{name, command}]} schema into a tmuxp config. */
const fs = require("fs");

/**
 * Convert one simple config object into tmuxp's shape.
 * @param {{session: string, folder?: string, windows: Array<{name?: string, command?: string|string[], panes?: Array<string|string[]>, folder?: string, layout?: string}>}} input parsed simple config
 * @returns {object} a tmuxp-compatible config object
 * @throws {Error} when session or windows is missing/empty
 */
function toTmuxp(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("config must be a JSON object");
  }
  if (!input.session) throw new Error("config is missing .session");
  if (!Array.isArray(input.windows) || input.windows.length === 0) {
    throw new Error("config has no .windows entries");
  }

  const out = { session_name: input.session };
  if (input.folder) out.start_directory = input.folder;

  out.windows = input.windows.map((win, i) => {
    const window = { window_name: win.name || `win${i}` };
    if (win.folder) window.start_directory = win.folder;
    if (win.layout) window.layout = win.layout;

    // one pane per entry in .panes; otherwise a single pane running .command
    // (a string, or an array of commands run in sequence in that same pane)
    const panes = Array.isArray(win.panes) ? win.panes : [win.command];
    window.panes = panes.map((pane) => ({
      shell_command: [].concat(pane ?? []).filter(Boolean),
    }));
    return window;
  });

  return out;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write("usage: workspace-to-tmuxp.js <simple-config.json> [> .tmuxp.json]\n");
    process.exit(1);
  }
  try {
    process.stdout.write(JSON.stringify(toTmuxp(JSON.parse(fs.readFileSync(file, "utf8"))), null, 2) + "\n");
  } catch (err) {
    process.stderr.write(`workspace-to-tmuxp: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { toTmuxp };
```

Usage — write `.tmuxp.json` next to the project so `tmuxp load <folder>` finds it:

```bash
node workspace-to-tmuxp.js my_project.json > .tmuxp.json && tmuxp load .

## or skip the file entirely
tmuxp load <(node workspace-to-tmuxp.js my_project.json)
```

Input, exercised end to end against Node 24 — a plain command, a sequence in one pane, and
a real split:

```json
{
  "session": "my_project_session",
  "folder": "~/git/my_project",
  "windows": [
    { "name": "editor", "command": "nvim" },
    { "name": "logs", "command": ["cd logs", "tail -f app.log"] },
    { "name": "split", "layout": "tiled", "panes": ["npm run dev", ["cd api", "npm start"]] }
  ]
}
```

Output (windows only, compacted):

```json
{ "window_name": "editor", "panes": [{ "shell_command": ["nvim"] }] }
{ "window_name": "logs",   "panes": [{ "shell_command": ["cd logs", "tail -f app.log"] }] }
{ "window_name": "split", "layout": "tiled",
  "panes": [{ "shell_command": ["npm run dev"] }, { "shell_command": ["cd api", "npm start"] }] }
```

Design notes:

- **`command` and `panes` are different axes.** A string or array in `command` is _one_
  pane — an array being several commands run in sequence there, which is what tmuxp's
  `shell_command` array already means. Splitting a window needs `panes`, one entry per pane.
  Collapsing the two (mapping every command in an array to its own pane) is the easy bug:
  `["cd logs", "tail -f app.log"]` would silently become two panes, with the `cd` applying
  to the wrong one.
- **No `; exec bash`.** tmuxp keeps panes alive on its own; that suffix belongs only to the
  raw `tmux` launchers earlier in this file.
- **`~` is passed through untouched** — tmuxp expands `start_directory` itself, unlike the
  raw `tmux -c` flag, which needs a real path.
- **Validation is three checks, all fatal**: object, `.session`, non-empty `.windows`. A
  missing key otherwise produces `session_name: undefined`, which `JSON.stringify` drops
  and tmuxp then rejects with a much worse message.
- **`toTmuxp` is exported** so it is unit-testable without spawning a process; the CLI half
  sits behind `require.main === module`.

### Template: one function per project, config inline

Once `workspace_create` exists, a per-project launcher is a heredoc and one call. The config
never has to live on disk as a tracked file — generate it inline, hand it over, done:

```bash
# my_workspace: build or attach the project workspace
function my_workspace() {
  local config="${TMPDIR:-/tmp}/my_workspace.json"

  ## the workspace as data - workspace_create handles attach-vs-create, --force,
  ## exact-match targeting, and command quoting
  command cat > "$config" << 'JSON_EOF'
{
  "session": "my_project_session",
  "windows": [
    { "name": "Build the App", "command": "build_project" },
    { "name": "Run the Tests", "command": "run_tests --watch" },
    { "name": "Watch the Logs", "command": "watch_logs" }
  ]
}
JSON_EOF

  workspace_create "$config" "$@"
}
```

```console
$ my_workspace            # build it, or attach if it is already running
$ my_workspace --force    # rebuild from scratch
```

Why this beats the hand-rolled `tmux new-session` / `new-window` function it replaces:

- **`"$@"` passes flags straight through**, so `--force` works without the function knowing
  what the flag means.
- **Everything hard is in one place.** Attach-vs-create, `=` exact-match targeting,
  `switch-client` when already inside tmux, `printf %q` quoting, and per-window folders live
  in `workspace_create` — fix one bug there and every launcher gets it.
- **The window list is data**, so it can be edited, diffed, and pasted between projects
  without touching shell syntax. Window names with spaces (`Build the App`) need no quoting
  care at all.
- **`command cat`**, not a bare `cat`, since `cat` may be aliased to `bat` and would mangle
  the JSON.
- **`${TMPDIR:-/tmp}`** keeps the generated file out of the repo. Point it at
  `$WORKSPACE_CONFIG_FOLDER/<name>.json` instead when you want `ws <name>` to find it by
  name later.

Swap the three dummy commands for whatever the project actually needs — a dev server, a log
tail, a REPL, a spare shell (omit `command` entirely for that one).

### `workspace_tmuxp` — parse tmuxp's schema with no tmuxp

If the config is already in tmuxp's shape but you do not want the Python runtime on that
machine, parse it directly. This is a sibling of `workspace`, not a replacement — `workspace`
reads the short schema, `workspace_tmuxp` reads `session_name` / `window_name` /
`panes[].shell_command[]` and builds real splits.

```bash
# workspace_tmuxp: build or attach a tmux session from a tmuxp-style JSON config
function workspace_tmuxp() {
  local config_file="" force=false arg
  for arg in "$@"; do
    if [ "$arg" = "--force" ]; then force=true
    elif [ -z "$config_file" ]; then config_file="$arg"; fi
  done

  if ! type -P jq > /dev/null 2>&1; then echo "workspace_tmuxp: jq is required" >&2; return 1; fi

  local candidate found=""
  for candidate in "$config_file" "$config_file.json" "$PWD/$config_file.json" "$config_file/.tmuxp.json" "$HOME/.config/tmuxp/$config_file.json"; do
    if [ -n "$config_file" ] && [ -f "$candidate" ]; then found="$candidate"; break; fi
  done
  if [ -z "$found" ]; then echo "workspace_tmuxp: config not found: ${config_file:-<none>}" >&2; return 1; fi
  config_file="$found"

  if ! jq -e . "$config_file" > /dev/null 2>&1; then echo "workspace_tmuxp: invalid JSON: $config_file" >&2; return 1; fi

  local session
  session=$(jq -r '.session_name // empty' "$config_file")
  if [ -z "$session" ]; then echo "workspace_tmuxp: config has no .session_name" >&2; return 1; fi

  if tmux has-session -t "=$session" 2> /dev/null; then
    if [ "$force" = "true" ]; then tmux kill-session -t "=$session"
    else _workspace_attach "$session"; return $?; fi
  fi

  local root
  root=$(jq -r '.start_directory // empty' "$config_file")
  root=${root/#\~/$HOME}

  local win_count
  win_count=$(jq '.windows | length' "$config_file")
  if [ "${win_count:-0}" -eq 0 ]; then echo "workspace_tmuxp: no windows defined in $config_file" >&2; return 1; fi

  local i j name folder layout pane_count cmd quoted target created=0
  i=0
  while [ "$i" -lt "$win_count" ]; do
    name=$(jq -r ".windows[$i].window_name // \"win$i\"" "$config_file")
    folder=$(jq -r ".windows[$i].start_directory // empty" "$config_file")
    folder=${folder/#\~/$HOME}
    [ -n "$folder" ] || folder="$root"
    [ -n "$folder" ] || folder="$PWD"
    layout=$(jq -r ".windows[$i].layout // \"tiled\"" "$config_file")

    pane_count=$(jq ".windows[$i].panes | length" "$config_file")
    [ "${pane_count:-0}" -gt 0 ] || pane_count=1

    j=0
    while [ "$j" -lt "$pane_count" ]; do
      # a pane is {shell_command: [...]}, or the shorthand string / array form
      cmd=$(jq -r "[.windows[$i].panes[$j] | if type == \"object\" then (.shell_command // []) else . end] | flatten | map(select(. != null and . != \"\")) | join(\"; \")" "$config_file" 2> /dev/null)

      if [ -n "$cmd" ]; then
        quoted=$(printf '%q' "$cmd; exec bash")
        quoted="bash -ic $quoted"
      else
        quoted=""
      fi

      if [ "$created" -eq 0 ]; then
        tmux new-session -d -s "$session" -n "$name" -c "$folder" ${quoted:+"$quoted"} || return 1
        created=1
      elif [ "$j" -eq 0 ]; then
        tmux new-window -t "=$session:" -n "$name" -c "$folder" ${quoted:+"$quoted"} || return 1
      else
        tmux split-window -t "$target" -c "$folder" ${quoted:+"$quoted"} || return 1
      fi

      if [ "$j" -eq 0 ]; then
        target=$(tmux display-message -p -t "=$session:" '#{session_name}:#{window_index}')
      fi
      j=$((j + 1))
    done

    [ "$pane_count" -le 1 ] || tmux select-layout -t "$target" "$layout" > /dev/null
    i=$((i + 1))
  done

  tmux select-window -t "=$session:" > /dev/null 2>&1
  _workspace_attach "$session"
}
```

Supported subset, and what is deliberately not: `session_name`, `start_directory` (session
and window level), `windows[].window_name`, `windows[].layout`, and `windows[].panes[]` in
both the object (`{"shell_command": [...]}`) and shorthand (a bare string or array) forms.
Not handled — `shell_command_before`, `before_script`, `environment`, `options`, `focus`,
`suppress_history`, per-pane `start_directory`, and every YAML input. Run real `tmuxp` when
you need those; this is the 80% that is one `jq` away.

Beyond the five defects listed above, which all apply again, the pane loop adds four:

| Defect                                                                                                                                                                                                                                  | Fix                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **`split-window -t "$session:$win_name"` targets by name.** tmux matches window names by prefix too, so two windows named `api` and `api_docs` send the split to whichever matches first — and `renumber-windows on` does not save you. | Capture the real target once per window (`display-message -p '#{session_name}:#{window_index}'`) and split against that.       |
| **`select-layout` inside the pane loop** re-tiles after every single split, and runs even for a one-pane window.                                                                                                                        | Once per window, only when `pane_count > 1`.                                                                                   |
| **Shorthand panes break the extractor.** tmuxp allows `"panes": ["echo hi"]`; `.panes[$j].shell_command[]` on a string errors out and yields an empty command, so the pane silently starts a bare shell.                                | One jq expression handling both: `if type == "object" then (.shell_command // []) else . end`, flattened and joined with `; `. |
| **An empty `shell_command` still gets `bash -ic ''`.** That is a window running an extra nested shell for nothing.                                                                                                                      | Build the argument only when the command is non-empty and pass it as `${quoted:+"$quoted"}`, so tmux sees no argument at all.  |

Verified against tmux 3.6a with a three-window config: per-window `start_directory` honored
(`cd sub` landed in `/private/tmp/sub`), an apostrophe in a command survived, the `tiled`
window came up with 3 panes, and `--force` rebuilt cleanly.

### `workspace_sample_json` — a config to start from

Hand-writing the first config is where most of the friction is. This emits a valid tmuxp
config named for the moment it was created, with the same timestamp in the session name so
a file on disk and a running session are never ambiguous.

```bash
# workspace_sample_json: write a sample tmuxp config named <datetime>.json
function workspace_sample_json() {
  local stamp target="" arg to_stdout=false
  for arg in "$@"; do
    if [ "$arg" = "--stdout" ]; then to_stdout=true
    elif [ -z "$target" ]; then target="$arg"; fi
  done

  ## one stamp for both the file name and the session name, so they always match
  stamp=$(date +%Y-%m-%d_%H-%M-%S)

  local json
  json=$(command cat << JSON_EOF
{
  "session_name": "my_project_session_$stamp",
  "start_directory": "$PWD",
  "windows": [
    {
      "window_name": "shell",
      "panes": [
        {
          "shell_command": ["git status --short --branch"]
        }
      ]
    },
    {
      "window_name": "monitor",
      "layout": "even-horizontal",
      "panes": [
        {
          "shell_command": ["top"]
        },
        {
          "shell_command": ["df -h"]
        }
      ]
    },
    {
      "window_name": "logs",
      "panes": [
        {
          "shell_command": ["git log --oneline --graph --decorate -20"]
        }
      ]
    }
  ]
}
JSON_EOF
  )

  if [ "$to_stdout" = "true" ]; then
    printf '%s\n' "$json"
    return 0
  fi

  [ -n "$target" ] || target="$PWD"
  if [ -d "$target" ]; then target="$target/$stamp.json"; fi
  printf '%s\n' "$json" > "$target" || return 1
  echo "$target"
}
```

```console
$ workspace_sample_json
/tmp/demo/2026-08-16_20-24-43.json

$ jq -r .session_name 2026-08-16_20-24-43.json
my_project_session_2026-08-16_20-24-43

$ workspace_sample_json --stdout | jq -c '.windows[].window_name'
"shell"
"monitor"
"logs"
```

The windows are deliberately boring and universally available — `git status`, `top`, `df`,
`git log` — rather than `nvim` and `npm run dev`. A sample that assumes an editor or a
package manager that is not installed fails on the machine where you are most likely to be
trying it out for the first time, and the failure looks like the function is broken. Every
command here works in any git checkout on macOS, Linux, and WSL, and each pane keeps its
shell after the command exits, so the sample doubles as a scratch workspace.

Notes:

- **One `stamp` for both names.** Computing `date` twice can straddle a second boundary and
  produce a file whose session name does not match it — rare, and maddening when it happens.
- **`--stdout` prints instead of writing**, for piping straight into a loader:
  `tmuxp load <(workspace_sample_json --stdout)`.
- **A folder argument writes inside it** (`workspace_sample_json ~/.config/tmuxp`), any
  other argument is taken as the exact file path.
- **The path is the only thing on stdout**, so `f=$(workspace_sample_json)` works.
- **`command cat` in the heredoc** — a bare `cat` may be aliased to `bat` and would mangle
  the JSON.

### `workspace_freeze` — the cheap knockoff of `tmuxp freeze`

`tmuxp freeze -o my_project.yaml` snapshots a live session back into a config. Same idea
here, JSON out, no Python:

```console
$ workspace_freeze my_active_session my_project.json
my_project.json

$ workspace_freeze my_active_session          # no output file - prints to stdout
$ workspace_freeze                            # no session - freezes the one you are in
```

```bash
# workspace_freeze: snapshot a live tmux session into a tmuxp-style JSON config
function workspace_freeze() {
  local session="" out="" arg next_is_out=false force=false
  for arg in "$@"; do
    if [ "$next_is_out" = "true" ]; then out="$arg"; next_is_out=false
    elif [ "$arg" = "-o" ] || [ "$arg" = "--output" ]; then next_is_out=true
    elif [ "$arg" = "--force" ]; then force=true
    elif [ -z "$session" ]; then session="$arg"
    elif [ -z "$out" ]; then out="$arg"; fi
  done

  if ! type -P jq > /dev/null 2>&1; then echo "workspace_freeze: jq is required" >&2; return 1; fi
  [ -n "$session" ] || session=$(tmux display-message -p '#{session_name}' 2> /dev/null)
  if [ -z "$session" ]; then echo "workspace_freeze: usage: workspace_freeze <session> [-o file.json]" >&2; return 1; fi
  if ! tmux has-session -t "=$session" 2> /dev/null; then
    echo "workspace_freeze: no such session: $session" >&2
    return 1
  fi

  local root json
  root=$(tmux display-message -p -t "=$session:" '#{pane_current_path}')

  json=$(tmux list-panes -s -t "=$session" -F '#{window_index}	#{window_name}	#{window_layout}	#{pane_current_path}	#{pane_current_command}' \
    | jq -R -s --arg session "$session" --arg root "$root" '
        [ split("\n")[] | select(length > 0) | split("\t")
          | { index: .[0], name: .[1], layout: .[2], folder: .[3], command: .[4] } ]
        | group_by(.index)
        | { session_name: $session, start_directory: $root,
            windows: [ .[] | {
              window_name: .[0].name,
              layout: .[0].layout,
              start_directory: .[0].folder,
              panes: [ .[] | { shell_command: (if (.command | test("^(bash|zsh|sh|fish)$")) then [] else [.command] end) } ]
            } ] }
        | .windows |= map(with_entries(select(.value != "")))
        | with_entries(select(.value != ""))')

  if [ -z "$json" ]; then echo "workspace_freeze: captured nothing from $session" >&2; return 1; fi

  if [ -n "$out" ]; then
    if [ -e "$out" ] && [ "$force" != "true" ]; then
      echo "workspace_freeze: $out exists (pass --force to overwrite)" >&2
      return 1
    fi
    printf '%s\n' "$json" > "$out" || return 1
    echo "$out"
  else
    printf '%s\n' "$json"
  fi
}
```

**What it captures:** session name, window names and order, window layout string, per-window
folder, and one entry per pane. What it cannot capture is the honest limitation, and real
`tmuxp freeze` shares it: `#{pane_current_command}` is the **running process name, without
arguments** — a pane running `tail -f logs/app.log` freezes as `["tail"]`, and one sitting at
an idle prompt freezes as `bash`. Idle shells are mapped to an empty `shell_command` (a plain
pane) rather than to a literal `bash` that would nest a second shell on reload; everything
else needs the arguments filled back in by hand. Treat the output as a scaffold, not a
backup.

Round-tripped for real: a 2-window / 3-pane session frozen to `my_project.json`, closed, and
rebuilt with `workspace_tmuxp my_project.json` — same window names, same pane counts.

The obvious implementation — nested loops appending to a JSON string — has six defects:

| Defect                                                                                                                                                                                                          | Fix                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hand-built JSON via string concatenation.** A window named `weird "name"` (tmux allows it) emits `"window_name": "weird "name""` — invalid JSON, and the failure surfaces later in whatever tries to read it. | Let `jq` build the document. It escapes quotes, backslashes, and control characters by construction. Verified with a session literally named `freeze test` holding a window named `weird "name"`. |
| **A stray leading comma.** `first_win` toggles, then the very next line appends `",\n    {"` unconditionally, so the array opens with `[,{`. Every frozen file is invalid, first window included.               | No manual separators at all — see above.                                                                                                                                                          |
| **`for win in $windows` word-splits on whitespace.** tmux window and session names may contain spaces (`freeze test`), so one window becomes two loop iterations and the JSON is nonsense.                      | One `tmux list-panes -s -F` call with tab separators, parsed by `jq -R -s`.                                                                                                                       |
| **`-t "$session_name"` prefix-matches**, so freezing `api` can snapshot `api_staging`.                                                                                                                          | `-t "=$session"`, as everywhere else in this file.                                                                                                                                                |
| **`echo -e`** is not portable — `sh` and some shells print the `-e` literally, and this is exactly the kind of function that gets copied into a `#!/bin/sh` script.                                             | `printf '%s\n'`.                                                                                                                                                                                  |
| **`display-message` once per pane** is `1 + W + P` tmux invocations; and the default `workspace.json` silently overwrites an existing snapshot.                                                                 | One `list-panes -s` for the whole session, and refuse to overwrite unless `--force`.                                                                                                              |

Two smaller ones: layout and per-window folder were not captured at all, so a "frozen"
session reloaded as a stack of single-pane windows in the wrong folders; and keys whose
value tmux could not determine are dropped rather than written as `""` — an empty
`start_directory` is a lie that makes a reload land somewhere arbitrary.

### `workspace_close` / `workspace_close_all` — tearing down

```bash
# workspace_close: kill one tmux session by exact name
function workspace_close() {
  local session="$1"
  if [ -z "$session" ]; then echo "workspace_close: usage: workspace_close <session>" >&2; return 1; fi
  if ! tmux has-session -t "=$session" 2> /dev/null; then
    echo "workspace_close: no such session: $session" >&2
    return 1
  fi
  tmux kill-session -t "=$session" && echo "workspace_close: killed $session"
}

# workspace_close_all: kill every tmux session, after confirming
function workspace_close_all() {
  local force=false
  if [ "${1:-}" = "--force" ] || [ "${1:-}" = "-y" ]; then force=true; fi

  local sessions
  sessions=$(tmux list-sessions -F '#{session_name}' 2> /dev/null)
  if [ -z "$sessions" ]; then
    echo "workspace_close_all: no tmux sessions running"
    return 0
  fi

  ## destructive and unrecoverable - every process in every session dies
  echo "workspace_close_all: about to kill $(echo "$sessions" | wc -l | tr -d ' ') session(s):"
  echo "$sessions" | sed 's/^/  /'
  if [ "$force" != "true" ]; then
    local reply=""
    printf 'Kill all of them? [y/N] '
    read -r reply
    case "$reply" in
      [yY] | [yY][eE][sS]) ;;
      *)
        echo "workspace_close_all: aborted"
        return 1
        ;;
    esac
  fi

  echo "$sessions" | while IFS= read -r s; do
    [ -n "$s" ] || continue
    tmux kill-session -t "=$s" 2> /dev/null && echo "workspace_close_all: killed $s"
  done
  return 0
}
```

- **`=` again.** `workspace_close api` with a plain `-t` would kill `api_staging`. Exact
  match is the whole safety story for a command whose only job is destruction.
- **`workspace_close_all` confirms by default.** It prints the session list and the count,
  then reads `y/N`; `--force` / `-y` skips the prompt for scripts. Every process in every
  session dies with no way back — an unsaved editor buffer, a half-finished migration, a
  long build, someone else's agent session. Do not drop the prompt to save a keystroke.
  This was learned the expensive way while testing these functions.
- **No `kill-server`.** Killing the last session ends the server anyway, and `kill-server`
  additionally drops server-level state and any session created between the list and the kill.
- **The list is captured before the loop**, so a session started mid-teardown is left alone
  rather than raced.

### `workspace_temp_*` — one throwaway command, no JSON

Everything above builds a _named_ session from a _config_. The opposite need shows up
constantly and is badly served by that: one long command — a migration, a build, an agent
job — that has to outlive the shell that launched it, with no session name worth inventing
and no config worth writing. `nohup cmd &` loses the output; `tmux new-session -d -s
$(date +%s) "cmd"` works but leaves a graveyard of sessions nobody can name to kill.

The temp helpers are a thin alias into tmux against **one hardcoded session name**, so
nothing ever has to name a session:

```bash
_WORKSPACE_TEMP_SESSION="syle_temp_workspace"

workspace_temp_create --force --detach 'long_running_job'   # park it
workspace_temp_open                                          # watch it
workspace_temp_close                                         # kill every temp session
```

- **One shared name is the feature, not a shortcut.** `workspace_temp_open` takes no
  argument because there is only ever one place to look, and `workspace_temp_close` needs
  no list because it matches the name as a _prefix_. The cost is that a second
  `workspace_temp_create` collides with the first — which is exactly why it asks.
- **The name is underscore-prefixed and personally namespaced.** `_WORKSPACE_TEMP_SESSION`
  is internal, and its value is not a bare `workspace_temp` — a name that generic will
  eventually collide with a session another tool or another person created on the same box,
  and `workspace_temp_close` kills by prefix.
- **`--force` matches `workspace_create`'s meaning**, and nothing else: it skips the
  "session already exists, kill it and rebuild?" prompt. Answering no — also what an
  unattended shell answers — attaches to the running session and leaves the command unrun,
  so a stray call never destroys a job someone is watching.
- **`--detach` is what makes it scriptable, and `workspace_create` takes it too.** Both
  builders attach at the end, which blocks a script until a human detaches; `--detach`
  builds the session, says where it went, and returns. One `_workspace_attach_unless_detached`
  helper implements it for both, so the two cannot drift.
- **`bash -ic '<cmd>; exec bash'`**, same as `workspace_create`: `-i` so the window sees the
  profile's functions and aliases, `exec bash` so the window survives the command and its
  output stays readable instead of the pane vanishing on exit.
- **No prompt on close.** `workspace_close_all` confirms because it kills sessions you named
  and care about; a temp session is disposable by definition and its name says so. It still
  prints each kill, and it still captures the list before the loop.
- **Reach for `workspace_create` the moment there are two commands.** A second window means
  it is a workspace, and a workspace deserves a name and a config.

### Which one to use

| Situation                                                              | Use                                                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Panes, layouts, pre-load hooks, env vars, `freeze` an existing session | `tmuxp`                                                                                             |
| Sharing configs with people already on tmuxinator                      | `tmuxinator`                                                                                        |
| One window per command, no runtime beyond `bash` + `jq`, own schema    | `workspace`                                                                                         |
| tmuxp's schema on a box with no Python                                 | `workspace_tmuxp`                                                                                   |
| Snapshotting a session you built by hand                               | `workspace_freeze`, then fill the command arguments back in                                         |
| The short schema plus tmuxp's features                                 | the Node converter above                                                                            |
| A single project you launch daily and nothing else                     | `dev_workspace` — the hardcoded function above is fine, do not build a config format for one caller |
| One throwaway command that must outlive the shell, no name, no config  | `workspace_temp_create --force --detach '<cmd>'`                                                    |
