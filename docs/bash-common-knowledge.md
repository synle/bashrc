# Bash Common Knowledge

A reference guide covering essential bash concepts — file descriptors, redirection, background processes, subshells, and other patterns used heavily in this repo.

---

## Table of Contents

- [File Descriptors & Redirection](#file-descriptors--redirection)
- [Background Processes & Job Control](#background-processes--job-control)
- [Subshells](#subshells)
- [Pipes & Process Substitution](#pipes--process-substitution)
- [Heredocs & Here-Strings](#heredocs--here-strings)
- [Functions](#functions)
- [The Double Dash `--` Convention](#the-double-dash----convention)
- [Conditionals & Short-Circuit Evaluation](#conditionals--short-circuit-evaluation)
- [Variable Expansion](#variable-expansion)
- [Pattern Matching & Regex](#pattern-matching--regex)
- [Traps & Signal Handling](#traps--signal-handling)
- [Shell Options](#shell-options)
- [Useful Idioms from This Repo](#useful-idioms-from-this-repo)

---

## File Descriptors & Redirection

Every process has three standard file descriptors:

| FD  | Name   | Default  | Purpose                 |
| --- | ------ | -------- | ----------------------- |
| 0   | stdin  | keyboard | Input to the process    |
| 1   | stdout | terminal | Normal output           |
| 2   | stderr | terminal | Error/diagnostic output |

### Basic Redirection

```bash
# Redirect stdout to a file (overwrite)
command > file.log

# Redirect stdout to a file (append)
command >> file.log

# Redirect stderr to a file
command 2> error.log

# Redirect stderr, appending
command 2>> error.log

# Redirect both stdout and stderr to a file (overwrite)
command &> file.log        # bash shorthand
command > file.log 2>&1    # POSIX equivalent

# Redirect both stdout and stderr to a file (append)
command &>> file.log       # bash shorthand
command >> file.log 2>&1   # POSIX equivalent
```

### Discarding Output with `/dev/null`

`/dev/null` is a special file that discards anything written to it.

```bash
# Discard stdout only (stderr still visible for debugging)
command > /dev/null

# Discard stderr only
command 2> /dev/null

# Discard both stdout and stderr
command &> /dev/null
command > /dev/null 2>&1
```

**This repo's convention:** Use `> /dev/null` (not `&> /dev/null`) for standalone install commands so that stderr remains visible for debugging. Use `&> /dev/null` inside conditionals and checks (`type -P`, `command`, `grep`) where you only care about the exit code.

```bash
# Install: keep stderr visible
curl -fsSL https://example.com/install.sh | bash > /dev/null

# Check: silence everything
if type -P node &> /dev/null; then
  echo "node is installed"
fi
```

### Redirecting stdin with `< /dev/null`

Reading from `/dev/null` gives immediate EOF. This is critical when a command runs inside a heredoc or pipeline and might try to consume stdin that belongs to something else.

**Real-world problem this solves:** In this repo, scripts run inside `bash <<'DELIM' ... DELIM` heredocs. If a command like `brew install` spawns a subprocess that reads stdin, it can consume the remaining heredoc content, causing the bash session to exit prematurely.

```bash
# Without < /dev/null: brew's subprocess reads the heredoc's stdin, eating remaining commands
brew install pkg &>> $BASHRC_TEMP_DIR/fullsetup.log      # DANGEROUS inside heredoc

# With < /dev/null: brew gets empty stdin, heredoc is preserved
brew install pkg < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log   # SAFE
```

This pattern appears across all `_full-setup.sh` scripts:

```bash
# mac/_full-setup.sh
brew install $install_flags "$pkg_name" < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log

# ubuntu/_full-setup.sh
sudo apt-get install -y --fix-missing $@ < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log

# arch_linux/_full-setup.sh
sudo pacman -S --noconfirm --needed $@ < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log
```

### Combining Redirections

You can combine stdin, stdout, and stderr redirections in a single command:

```bash
# Detach stdin + log all output (both stdout and stderr) to a file
command < /dev/null &>> logfile.log

# Breakdown:
#   < /dev/null   →  stdin comes from /dev/null (immediate EOF, prevents stdin stealing)
#   &>>           →  append both stdout AND stderr to logfile.log
```

### Redirecting Between File Descriptors

```bash
# Send stderr to wherever stdout is going
command 2>&1

# Send stdout to wherever stderr is going
command 1>&2
# or shorthand:
command >&2

# Swap stdout and stderr (advanced)
command 3>&1 1>&2 2>&3 3>&-
```

### Redirecting to stderr

When writing shell functions that participate in pipelines, output diagnostic messages to stderr so they don't pollute stdout:

```bash
echo "Warning: something happened" >&2
```

This repo's `log()` function in `index.js` uses `console.error` (fd 2) because the main pipeline is `node | bash` — stdout carries bash commands, so all human-readable messages must go to stderr.

---

## Background Processes & Job Control

### Running Commands in the Background

```bash
# Run a command in the background
command &

# The shell gives you a job number and PID
# [1] 12345
```

### `wait` — Waiting for Background Jobs

```bash
# Wait for ALL background jobs to finish
wait

# Wait for a specific PID
command &
pid=$!
wait $pid

# Check exit status after wait
command &
pid=$!
wait $pid
echo "Exit status: $?"
```

### `$!` — Last Background PID

```bash
long_running_task &
bg_pid=$!
echo "Started background task with PID: $bg_pid"
# ... do other work ...
wait $bg_pid
```

### `disown` vs Subshell Backgrounding

`disown` removes a job from the shell's job table, but this repo avoids it in scripts. Instead, use subshell backgrounding:

```bash
# Avoid in scripts:
command &
disown

# Preferred in this repo — subshell backgrounding:
( command ) &
```

The subshell approach is cleaner because the backgrounded process is already detached from the parent shell's job control.

### Job Control Commands (Interactive Shell)

```bash
# List background jobs
jobs

# Bring job to foreground
fg %1

# Send running job to background
# First: Ctrl+Z (suspends the job)
bg %1

# Kill a background job
kill %1
```

### Timeout Pattern (from this repo)

A sophisticated timeout using nested subshells and background processes:

```bash
function timeout() {
  local delay cmd
  if [ "$#" -eq 1 ]; then delay=17; cmd="$1"
  elif [ "$#" -eq 2 ]; then delay="$1"; cmd="$2"
  else echo "Usage: timeout [seconds] <command>" >&2; return 1; fi

  (
    eval "$cmd" &
    local cmd_pid=$!
    (
      sleep "$delay"
      if kill -0 "$cmd_pid" 2>/dev/null; then
        kill -9 "$cmd_pid" 2>/dev/null
      fi
    ) &
    wait "$cmd_pid"
  )
}
```

How it works:

1. Outer subshell `( ... )` isolates everything
2. The actual command runs in the background (`eval "$cmd" &`)
3. A watchdog runs in a nested background subshell — sleeps, then kills the command if still running
4. `wait "$cmd_pid"` blocks until the command finishes (or is killed)
5. `kill -0` checks if the process is still alive (signal 0 = no-op, just checks existence)

---

## Subshells

A subshell is a child copy of the current shell. It inherits variables and environment but changes inside it don't affect the parent.

### Creating Subshells

```bash
# Explicit subshell with parentheses
(
  cd /tmp
  echo "I'm in /tmp"
)
# Parent shell is still in the original directory

# Command substitution creates a subshell
result=$(echo "hello")

# Pipe segments run in subshells
echo "hello" | while read line; do
  var="modified"  # This change is lost after the pipe ends
done
echo "$var"  # Still the old value (or empty)
```

### Subshell Gotcha: Variable Scope

```bash
# WRONG — variable set inside pipe subshell is lost
count=0
cat file.txt | while read line; do
  ((count++))
done
echo "$count"  # Still 0!

# FIX — use process substitution or redirect
count=0
while read line; do
  ((count++))
done < file.txt
echo "$count"  # Correct count
```

### Subshell for Isolation

This repo uses subshells to isolate background tasks so they don't affect the parent:

```bash
# From install.sh — install extensions in background without blocking
(
  grep '"' .devcontainer/devcontainer.json \
    | sed -n '/"extensions"/,/]/p' \
    | grep -v 'extensions' \
    | sed 's/[",]//g' \
    | tr -d ' ' \
    | while IFS= read -r ext; do
      [ -n "$ext" ] && code --install-extension "$ext"
    done
) &
```

### Why SH Scripts Use Separate Heredocs

In this repo, each `.sh` script gets its own `bash <<'DELIM'` heredoc rather than being concatenated into one. This is because non-interactive bash exits when the foreground completes, orphaning background jobs in that script without blocking the next script from starting.

---

## Pipes & Process Substitution

### Basic Pipes

```bash
# stdout of left → stdin of right
command1 | command2

# Chain multiple
command1 | command2 | command3
```

### The `node | bash` Pipeline (Core Architecture)

This repo's execution model pipes Node.js output into bash:

```bash
cat software/index.js | node | bash
```

1. `node` reads `index.js`, which prints bash commands to stdout
2. `bash` receives and executes those commands
3. Human-readable output goes to stderr (fd 2), not stdout

The full pipeline in `run.sh` is more complex, adding logging:

```bash
cat software/index.js \
  | node \
  | tee >(sed 's/\x1b\[[0-9;]*m//g' >> "$BASHRC_TEMP_DIR/run.sh") \
  | bash 2>&1 \
  | tee >(sed 's/\x1b\[[0-9;]*m//g' >> "$BASHRC_TEMP_DIR/run.log") 2>&1
```

- `tee` duplicates the stream — one copy goes to the pipe, the other to a file
- `>(...)` is process substitution — creates a virtual file descriptor that feeds into a command
- `sed 's/\x1b\[[0-9;]*m//g'` strips ANSI color codes before logging

### Process Substitution: `<(...)` and `>(...)`

These create temporary file descriptors that act like files but are backed by commands.

```bash
# <(...) — use command output as if it were a file (input)
diff <(sort file1.txt) <(sort file2.txt)

# Compare two sorted lists (from doctor.sh)
_begin_only=$(comm -23 <(echo "$_begin_keys") <(echo "$_end_keys") 2> /dev/null)

# >(...) — use a command as if it were a file (output)
command | tee >(grep "error" >> errors.log)
```

### `xargs` — Building Commands from stdin

```bash
# Delete old backup files (keep only the N most recent)
ls -1t "$BACKUP_DIR"/bash_history_* 2> /dev/null \
  | tail -n +$((MAX + 1)) \
  | xargs rm -f 2> /dev/null
```

---

## Heredocs & Here-Strings

A heredoc (short for "here document") feeds a block of text as stdin to a command, inline in your script. A here-string is the single-line version.

### Heredocs

```bash
# Basic heredoc — variables ARE expanded
cat <<EOF
Hello $USER, you are in $PWD
Today is $(date)
EOF

# Quoted delimiter — variables are NOT expanded (literal)
cat <<'EOF'
This $variable is not expanded
Backticks `like this` are also literal
$(this command substitution) stays as text
EOF

# Indented heredoc with <<- (strips leading TABS only, not spaces)
if true; then
	cat <<-EOF
	This is indented with tabs
	Tabs are stripped from the output
	EOF
fi
```

### When to Quote the Delimiter

| Syntax    | Variable Expansion | Command Substitution | Use Case                                         |
| --------- | ------------------ | -------------------- | ------------------------------------------------ |
| `<<EOF`   | Yes                | Yes                  | Templating — embed current shell values          |
| `<<'EOF'` | No                 | No                   | Literal text — pass to another shell or language |
| `<<"EOF"` | No                 | No                   | Same as single quotes                            |

**This repo uses quoted heredocs** (`<<'DELIM'`) for script bundling. Each `.sh` script runs inside `bash <<'DELIM' ... DELIM` so the parent shell doesn't expand `$variables` meant for the child bash process.

### Writing to Files with Heredocs

```bash
# Overwrite a file
cat <<'EOF' > /tmp/config.sh
export PATH="$HOME/.local/bin:$PATH"
export EDITOR=vim
EOF

# Append to a file
cat <<'EOF' >> /tmp/config.sh
alias ll='ls -la'
EOF
```

### Heredocs Inside Functions

```bash
function generate_config() {
  local name="$1"
  # Unquoted EOF — $name is expanded by the current shell
  cat <<EOF
[user]
  name = $name
  editor = vim
EOF
}
```

### Feeding Heredocs to Commands Other Than `cat`

Any command that reads stdin works with heredocs:

```bash
# Run a multi-line SQL query
psql <<'EOF'
SELECT *
FROM users
WHERE active = true;
EOF

# Run a multi-line bash script in a subshell
bash <<'EOF'
echo "Running in a child bash process"
echo "PID: $$"
EOF

# Pass JSON to a command
curl -X POST https://example.com/api -d @- <<'EOF'
{"key": "value", "count": 42}
EOF
```

### Here-Strings (`<<<`)

A here-string feeds a single string as stdin to a command — like a one-line heredoc.

```bash
# Instead of: echo "hello" | command
command <<< "hello"

# Split a path into components
IFS='/' read -r -a parts <<< "$current_path"

# Read lines from a variable
while IFS= read -r line; do
  echo "$line"
done <<< "$multi_line_var"

# Quick grep on a variable (no echo pipe needed)
grep "pattern" <<< "$some_text"
```

### Heredoc Gotchas

1. **The closing delimiter must be on its own line, with no leading/trailing whitespace** (unless using `<<-` with tabs)
2. **`<<-` only strips tabs, not spaces** — mixing tabs/spaces is a common source of "unexpected EOF" errors
3. **Inside a heredoc, `\` is NOT an escape character** (in quoted heredocs). The text is fully literal
4. **Nested heredocs don't work directly** — use process substitution or temp files instead

---

## Functions

### Declaring Functions

This repo requires the `function` keyword:

```bash
# This repo's style (required):
function my_func() {
  echo "hello"
}

# Also valid bash but NOT used in this repo:
my_func() {
  echo "hello"
}
```

### Parameters: `$1`, `$2`, `$@`, `$#`

Functions receive arguments just like scripts — through positional parameters.

```bash
function greet() {
  local name="$1"       # First argument
  local title="$2"      # Second argument
  echo "Hello, $title $name"
}

greet "Alice" "Dr."
# Output: Hello, Dr. Alice
```

| Variable      | Meaning                                      |
| ------------- | -------------------------------------------- |
| `$1`          | First argument                               |
| `$2`          | Second argument (and so on: `$3`, `$4`, ...) |
| `$@`          | All arguments as separate words              |
| `$*`          | All arguments as a single word               |
| `$#`          | Number of arguments                          |
| `${@: -1}`    | Last argument                                |
| `${@:1:$#-1}` | All arguments except the last                |

### Local Variables and Defaults

Always use `local` to avoid leaking variables into the caller's scope. Combine with parameter expansion for defaults:

```bash
# From run.sh — local with defaults
function is_path_stale() {
  local target="$1"
  local max_age="${2:-1209600}"   # Default to 2 weeks if $2 not given
  # ...
}

# From run.sh — empty default (optional parameter)
function safe_source() {
  local src="$1"
  local dest="${2:-}"             # Empty string if $2 not given
  # ...
}

# From profile — current directory default
function tree() {
  local dir="${1:-.}"             # Default to "." if $1 not given
  # ...
}

# Required parameter with error message
function cpsync() {
  local src="${1:?Usage: cpsync <src> <dest>}"   # Exit with error if $1 missing
  local dest="${2:?Usage: cpsync <src> <dest>}"
  # ...
}
```

**`${var:-default}` vs `${var-default}`** (subtle difference):

```bash
${var:-default}   # Use default if var is UNSET or EMPTY ("")
${var-default}    # Use default only if var is UNSET (empty "" is kept)

# Example:
name=""
echo "${name:-fallback}"   # "fallback" (empty triggers default)
echo "${name-fallback}"    # "" (empty is kept, only unset triggers)
```

### `shift` — Consuming Arguments

`shift` removes `$1` and shifts all remaining arguments down by one. Useful for parsing flags before processing the rest.

```bash
# From run.sh — parse optional -R flag, then process remaining args
function safe_chown() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift               # Now $1 is what was $2, $2 is what was $3, etc.
  fi
  for f in "$@"; do     # $@ no longer includes "-R"
    [ -e "$f" ] && sudo chown $flags "$USER" "$f"
  done
}

# From run.sh — shift to separate first arg from rest
function curl_bash_install() {
  local url="$1"
  shift                  # Remove URL from $@
  curl -fsSL "$url" | bash -s -- "$@" > /dev/null
  # $@ now contains only the extra args (not the URL)
}
```

### Parsing Named Flags with `case`

```bash
# From mac/_full-setup.sh — parse --cask, --app=, --force before the package name
function installBrewPackage() {
  local pkg_name="${@: -1}"           # Last argument is always the package name
  local is_cask=""
  local install_flags=""
  local app_name=""
  for arg in "${@:1:$#-1}"; do       # Loop all args except the last
    case "$arg" in
    --cask)
      is_cask="1"
      install_flags="$install_flags $arg --force"
      ;;
    --app=*) app_name="${arg#--app=}" ;;   # Strip --app= prefix to get the value
    *) install_flags="$install_flags $arg" ;;
    esac
  done
  # Now use $pkg_name, $is_cask, $install_flags, $app_name...
}

# Usage:
installBrewPackage --cask --app="Visual Studio Code.app" visual-studio-code
```

### Return Values

Bash functions don't return data — they return exit codes (0-255). Use `echo` + command substitution to "return" data.

```bash
# Return an exit code (0 = success/true, non-zero = failure/false)
function is_path_stale() {
  [ -e "$1" ] || return 0    # Missing = stale (true)
  return 1                   # Exists = not stale (false)
}

# Use in conditionals
if is_path_stale "/some/path"; then
  echo "Path is stale or missing"
fi

# "Return" a string value via echo + command substitution
function get_extension() {
  local file="$1"
  echo "${file##*.}"         # Print to stdout
}
result=$(get_extension "photo.jpg")   # Capture stdout
echo "$result"  # "jpg"
```

### Exporting Functions

Functions are local to the current shell by default. To make them available in subshells:

```bash
# export -f makes a function available to child processes
export -f my_func

# declare -f prints the function's source code (from run.sh)
# Useful for writing functions into a config file that gets sourced later
declare -f safe_source >> "$BASH_SYLE_COMMON_PATH"
declare -f curl_bash_install >> "$BASH_SYLE_COMMON_PATH"
```

---

## The Double Dash `--` Convention

`--` (double dash) is a universal convention in Unix commands that means **"end of options, everything after this is a positional argument."** It prevents arguments that start with `-` from being interpreted as flags.

### Why `--` Exists

```bash
# Problem: you want to delete a file named "-rf"
rm -rf          # WRONG — rm interprets -rf as flags (recursive + force)
rm -- -rf       # CORRECT — rm treats "-rf" as a filename

# Problem: grep a pattern that starts with a dash
grep -v file    # WRONG — grep thinks -v is a flag (invert match)
grep -- -v file # CORRECT — grep searches for literal "-v"

# Problem: git checkout a file that matches a branch name
git checkout main          # Switches to branch "main"
git checkout -- main       # Restores the file named "main"
```

### `--` with `bash -s`

When piping a script to bash via stdin, you can't pass arguments normally (there's no script filename). `bash -s` tells bash to read from stdin, and `--` separates bash's own flags from the script's arguments:

```bash
# bash -s: read script from stdin
# --: end of bash's flags
# --skip-shell: this becomes $1 inside the piped script
curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
```

Without `--`, bash might interpret `--skip-shell` as its own flag. The `--` ensures everything after it lands in `$1`, `$2`, etc. inside the piped script.

From this repo:

```bash
# run.sh — curl_bash_install passes extra args through to the piped script
function curl_bash_install() {
  local url="$1"
  shift
  curl -fsSL "$url" | bash -s -- "$@" > /dev/null
  # "$@" = all remaining args, forwarded as $1, $2... to the downloaded script
}

# Usage:
curl_bash_install "https://fnm.vercel.app/install" --skip-shell
# Equivalent to: curl -fsSL "..." | bash -s -- --skip-shell
```

### Common Uses of `--`

```bash
# git — disambiguate branches vs files
git checkout -- file.txt       # Restore file, don't switch branch
git diff -- path/to/file      # Diff a specific file

# rm — safely delete files with special names
rm -- -weird-filename
rm -- --also-weird

# ssh — pass arguments to the remote command
ssh host -- ls -la /tmp

# docker — pass arguments to the container's entrypoint
docker run myimage -- --config /etc/app.conf

# find + xargs — mark end of find's arguments
find . -name "*.log" -print0 | xargs -0 rm --

# Forwarding arguments through wrapper functions
function my_wrapper() {
  local first_arg="$1"
  shift
  some_command "$first_arg" -- "$@"
}
```

### `--` in This Repo's Argument Flow

```bash
# User runs:
bash run.sh --files="git.js" --force-refresh

# run.sh pre-scans $@ for --verbose/--no-color via case statement
for arg in "$@"; do
  case "$arg" in
  --verbose | -verbose | -V) set -x ;;
  --no-color | -no-color) export NO_COLOR=1 ;;
  esac
done

# Then encodes ALL args (including --files, --force-refresh) as JSON
# into BASHRC_RAW_ARGS for node's parseRawArgs() to handle
```

### Quick Summary

| Pattern                     | Meaning                                    |
| --------------------------- | ------------------------------------------ |
| `command -- arg`            | `arg` is positional, not a flag            |
| `bash -s -- args`           | Pass `args` to a stdin-piped script        |
| `curl ... \| bash -s -- -x` | `-x` becomes `$1` in the downloaded script |
| `git checkout -- file`      | Restore file, don't switch branches        |
| `rm -- -f`                  | Delete file named `-f`                     |

---

## Conditionals & Short-Circuit Evaluation

### `&&` and `||` Chaining

```bash
# AND — run second command only if first succeeds (exit code 0)
command1 && command2

# OR — run second command only if first fails (non-zero exit code)
command1 || command2

# Combined — poor man's ternary (but be careful with this)
condition && echo "true" || echo "false"
```

### One-Liner Guard Pattern (Preferred in This Repo)

```bash
# Instead of if/then/fi for simple guards:
type -P zoxide &>/dev/null && eval "$(zoxide init bash --cmd cd)"
type -P fnm &>/dev/null && eval "$(fnm env --use-on-cd --shell bash)"
```

### OS Detection Pattern (from this repo)

```bash
# Chained conditionals with brace grouping
is_os_mac=0 && { [[ "$OSTYPE" == "darwin"* ]] || [ -d /Applications ]; } && is_os_mac=1
is_os_ubuntu=0 && command grep -Eiq "ID(_LIKE)?=(ubuntu|debian|mint)" /etc/os-release 2> /dev/null && is_os_ubuntu=1
```

How this works: `is_os_mac=0` always succeeds → brace group runs the actual check → if the check passes, `is_os_mac=1` runs.

### Arithmetic Conditionals

```bash
# (( )) for arithmetic — returns 0 (true) if non-zero, 1 (false) if zero
((IS_CI)) && echo "Running in CI"
! ((IS_CI)) && echo "Not in CI"

# Numeric comparison
[ $(($(date +%s) - mtime)) -gt "$max_age" ] && return 0
```

### Test Brackets: `[ ]` vs `[[ ]]`

```bash
# [ ] — POSIX compatible, works everywhere
[ -f "$file" ]       # file exists and is a regular file
[ -d "$dir" ]        # directory exists
[ -z "$var" ]        # variable is empty
[ -n "$var" ]        # variable is non-empty
[ "$a" = "$b" ]     # string equality

# [[ ]] — bash-specific, more features
[[ "$OSTYPE" == darwin* ]]   # glob matching (no quotes on pattern!)
[[ "$var" =~ ^[0-9]+$ ]]    # regex matching
[[ -f "$file" && -r "$file" ]]  # logical AND inside brackets
```

---

## Variable Expansion

### Parameter Expansion

```bash
# Default value if unset or empty
${var:-default}       # Use default, don't set var
${var:=default}       # Use default AND set var

# Alternative value if set
${var:+alternative}   # Use alternative if var is set, empty otherwise

# Error if unset
${var:?error message} # Print error and exit if var is unset

# String length
${#var}

# Substring
${var:offset:length}

# Pattern removal
${var#pattern}        # Remove shortest match from start
${var##pattern}       # Remove longest match from start (greedy)
${var%pattern}        # Remove shortest match from end
${var%%pattern}       # Remove longest match from end (greedy)

# Example from this repo:
remote_name="${remote%%/*}"   # "origin/main" → "origin"

# Substitution
${var/pattern/replacement}    # Replace first match
${var//pattern/replacement}   # Replace all matches
```

### Indirect Variable References

```bash
# ${!var} — use the value of var as a variable name
name="HOME"
echo "${!name}"    # prints the value of $HOME

# From this repo — exporting dynamically named variables:
for var in $(compgen -v | grep '^is_os_'); do
  export $var=${!var}
done
```

### Arrays

```bash
# Declare
arr=("one" "two" "three")

# Access
echo "${arr[0]}"       # First element
echo "${arr[@]}"       # All elements
echo "${#arr[@]}"      # Length

# Iterate
for item in "${arr[@]}"; do
  echo "$item"
done

# Build a string from array (from this repo)
cmd_string=$(printf ":%s" "${ignored_commands[@]}")
```

---

## Pattern Matching & Regex

### Glob Patterns

```bash
*           # Match any string
?           # Match any single character
[abc]       # Match any character in the set
[!abc]      # Match any character NOT in the set
**          # Recursive glob (requires shopt -s globstar)
```

### Regex with `=~`

```bash
# Match a git hash
hash_re='^[0-9a-f]{7,40}$'
if [[ "$1" =~ $hash_re ]]; then
  echo "Looks like a commit hash"
fi

# Match only numbers and spaces
if [[ "$1" =~ ^[0-9[:space:]]+$ ]]; then
  echo "Numeric input"
fi
```

**Note on grep compatibility:** This repo may alias `grep` to `rg` (ripgrep). Avoid `grep -E` (rg interprets `-E` as encoding). Use basic regex: `[0-9][0-9]*` instead of `[0-9]+`.

---

## Traps & Signal Handling

```bash
# Run cleanup on exit (any exit — normal, error, signal)
trap "rm -f /tmp/mylock" EXIT

# Restore cursor on Ctrl+C (from this repo)
trap "tput cnorm; exit" SIGINT

# Ignore a signal
trap '' SIGINT

# Reset to default behavior
trap - SIGINT

# Common signals:
# SIGINT  (2)  — Ctrl+C
# SIGTERM (15) — kill command (default)
# SIGKILL (9)  — kill -9 (cannot be trapped)
# EXIT        — pseudo-signal, fires on any exit
# ERR         — fires on any command failure (with set -e)
```

---

## Shell Options

### `set` Options

```bash
set -e          # Exit immediately on error (non-zero exit code)
set -u          # Treat unset variables as errors
set -o pipefail # Pipe fails if ANY command in the pipeline fails
set -x          # Print each command before executing (debug tracing)

# Combine them
set -euo pipefail   # The "strict mode" combo

# Check if a set option is active (from this repo)
if [[ $- == *x* ]]; then
  echo "Verbose mode is on"
fi

# Turn off an option
set +x          # Stop debug tracing
```

### `shopt` Options (Bash-Specific)

```bash
# From this repo's profile:
shopt -s histappend               # Append to history instead of overwrite
shopt -s cmdhist                  # Save multi-line commands as one entry
shopt -s cdspell                  # Auto-correct directory typos in cd
shopt -s autocd                   # Type a directory name to cd into it
shopt -s globstar                 # Enable ** recursive glob
shopt -s nullglob                 # Globs that match nothing expand to nothing (not the literal pattern)
shopt -s nocaseglob               # Case-insensitive globbing

# Temporarily enable/disable
shopt -s nullglob nocaseglob
# ... do glob operations ...
shopt -u nullglob nocaseglob
```

---

## Useful Idioms from This Repo

### Check if a Binary Exists

```bash
# Preferred — type -P finds the binary in PATH
type -P node > /dev/null 2>&1 && echo "node found"

# For shell functions, use type (without -P)
type my_function &> /dev/null && echo "function exists"

# Avoid: which, command -v (less portable in this repo's context)
```

### Safe Source (Validate Before Sourcing)

```bash
# Always validate syntax before sourcing — prevents broken scripts from corrupting your shell
bash -n "$script" 2> /dev/null && . "$script"
```

### `curl | bash` with Arguments

```bash
# Pass arguments to the downloaded script with -s --
curl -fsSL https://example.com/install.sh | bash -s -- --skip-shell

# This repo always uses -fsSL for curl:
#   -f  fail silently on HTTP errors
#   -s  silent (no progress bar)
#   -S  show errors even in silent mode
#   -L  follow redirects
```

### IFS Tricks

```bash
# Split comma-separated string
local IFS=','
for item in $comma_list; do
  echo "$item"
done

# Read a file line by line, preserving whitespace
while IFS= read -r line; do
  echo "$line"
done < file.txt
```

### `declare -f` — Export Function Definitions

```bash
# Write a function's source code to a file (so it can be sourced later)
declare -f safe_source >> "$CONFIG_PATH"
declare -f curl_bash_install >> "$CONFIG_PATH"
```

### Deduplicate While Preserving Order

```bash
# awk '!seen[$0]++' — classic one-liner
echo "$list" | awk '!seen[$0]++' | head -n 50
```

### Stateless `touch` (Don't Update mtime)

```bash
# Only create the file if it doesn't exist — avoids resetting staleness checks
function touch() {
  for f in "$@"; do
    [ -e "$f" ] || command touch "$f"
  done
}
```

### `command` — Bypass Aliases and Functions

```bash
# When grep is aliased to rg, use command to get the real grep
command grep "pattern" file.txt

# Same for any aliased/wrapped command
command cd "$dir"
command cat "$file"
```

### Reading from `/dev/tty` for User Input

When stdin is occupied (e.g., inside a pipe or heredoc), read from `/dev/tty` to get keyboard input:

```bash
echo "Enter your git email:"
read -r git_email < /dev/tty
```

---

## Quick Reference: Redirection Cheat Sheet

```
command > file          # stdout → file (overwrite)
command >> file         # stdout → file (append)
command 2> file         # stderr → file (overwrite)
command 2>> file        # stderr → file (append)
command &> file         # stdout+stderr → file (overwrite)
command &>> file        # stdout+stderr → file (append)
command > /dev/null     # discard stdout
command 2> /dev/null    # discard stderr
command &> /dev/null    # discard both
command < file          # stdin ← file
command < /dev/null     # stdin ← nothing (immediate EOF)
command <<'EOF'         # stdin ← heredoc (no expansion)
...
EOF
command <<< "string"    # stdin ← string
command 2>&1            # stderr → same place as stdout
command >&2             # stdout → same place as stderr
>(cmd)                  # process substitution (output)
<(cmd)                  # process substitution (input)
command1 | command2     # stdout of 1 → stdin of 2
```

### Common Combos in This Repo

```bash
# Silent install, keep errors visible, detach stdin (safe in heredocs)
command < /dev/null &>> logfile.log

# Check if binary exists (fully silent)
type -P binary &> /dev/null

# Install with visible errors only
curl -fsSL url | bash > /dev/null

# Install fully silent (inside conditionals)
curl -fsSL url | bash &> /dev/null
```
