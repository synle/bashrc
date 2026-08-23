#!/usr/bin/env bash
################################################################################
# --- Snip (CLI output filter) ---
#
# `snip` shrinks verbose command output down to the part worth reading — an
# `ls -la` of 927 rows becomes an extension histogram, a `gh pr view` drops ~99%
# of its bytes. That matters most when the reader is an LLM paying for every
# token, which is why the helpers here exist at all.
#
# _snip_ready         — [internal] Succeed when the snip binary is on PATH
# _snip_tee_folder    — [internal] Resolve the folder snip tees full output into
# _snip_history_shapes — [internal] Rank $HISTFILE by "<binary> <subcommand>"
# sn                  — Run a command through snip when a filter covers it (-f forces)
# snip_coverage       — Report how much of your own history snip can filter
# snip_logs           — List / print the full output snip saved on a failure
#
# --- Why `sn` is opt-in, and where the transparent wrappers live ---
# snip rewrites output even when stdout is a pipe: `snip run -- ls -la /usr/bin`
# returns reordered columns with the permission and owner fields dropped. Any
# script parsing that output would silently read the wrong thing — so `sn` never
# filters a command whose name is already a shell function, and filtering it is a
# deliberate `sn <cmd>` rather than a redefinition of `<cmd>` itself.
#
# The transparent per-command wrappers (`npm`, `docker`, `pytest`, … and their
# `raw_<cmd>` escape hatches) live in bash-snip-command-wrappers.profile.bash,
# which is safe precisely because every wrapper is guarded on `[ -t 1 ]`: it only
# filters at an interactive TTY and passes the raw bytes through for every pipe,
# `$(...)`, and redirect. `git`, `ls`, `grep` and friends are still never wrapped.
################################################################################

# _snip_ready: succeed when the snip binary is installed
function _snip_ready() {
  type -P snip &> /dev/null
}

# _snip_tee_folder: echo the folder snip tees full command output into
function _snip_tee_folder() {
  if [ -n "${SNIP_TEE_DIR:-}" ]; then
    echo "$SNIP_TEE_DIR"
    return 0
  fi

  # snip prints no tee path of its own, but the tee folder sits beside the
  # tracking db it does print — derive it rather than hardcoding the XDG guess.
  local db=""
  if _snip_ready; then
    db="$(snip config 2> /dev/null | awk -F': ' '/^tracking\.db_path:/ { print $2; exit }')"
  fi

  if [ -n "$db" ]; then
    echo "$(dirname "$db")/tee"
  else
    echo "${XDG_DATA_HOME:-$HOME/.local/share}/snip/tee"
  fi
}

# _snip_history_shapes <histfile> <top-n>: emit "<count>\t<binary>\t<subcommand>"
function _snip_history_shapes() {
  local histfile="$1"
  local top="$2"

  # snip keys its filters on the binary plus its subcommand ("git log",
  # "npm install"), so history is bucketed the same way. Everything from the
  # first pipe or operator on is cut so a pipeline does not register as its
  # own shape; leading env assignments and sudo/command prefixes are stepped
  # over; and a second token that is a flag is dropped — "ls -la" is covered
  # by the plain "ls" filter.
  awk '
		/^#/ { next }
		{
		sub(/[|;&<>].*$/, "")
		i = 1
			while (i <= NF && ($i ~ /=/ || $i == "sudo" || $i == "command" || $i == "sn")) i++
			if (i > NF) next
			first = $i
			second = ""
			if (i + 1 <= NF && $(i + 1) !~ /^-/) second = $(i + 1)
			seen[first "\t" second]++
		}
		END { for (key in seen) printf "%d\t%s\n", seen[key], key }
	' "$histfile" | sort -rn | head -n "$top"
}

# sn: run a command through snip's output filter when one covers it
function sn() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "sn: run a command through snip's output filter when one covers it
  Usage: sn [-f] <command> [args...]
  Examples:
    sn ls -la                 # alias 'ls' is resolved first, then filtered
    sn gh pr view 3184 --repo acme/widget-store
    sn -f git log -20         # 'git' is a shell function — -f filters anyway
  Dispatches four ways, and says nothing when it passes through:
    1. a leading alias is resolved the way the shell would resolve it, then
       re-dispatched — bash never expands an alias in argument position, so
       without this 'sn ls' and 'sn make' could never work
    2. snip not installed, or no filter for the command -> run it untouched
    3. the name is a shell function (git, npm, node, python, ...) -> run the
       function untouched, because snip execs the real binary and would skip
       the wrapper. Pass -f to filter anyway, bypassing the wrapper.
    4. a filter exists -> run it through snip
  The exit code is always the command's own. Filtering is opt-in on purpose:
  snip rewrites output even when it is piped, so wrapping a command whose
  output something else parses would corrupt it."
    return 0
  fi

  local force=0
  if [ "${1:-}" = "-f" ] || [ "${1:-}" = "--force" ]; then
    force=1
    shift
  fi

  if [ $# -eq 0 ]; then
    echo "sn: -f needs a command to run" >&2
    return 1
  fi

  if ! _snip_ready; then
    "$@"
    return $?
  fi

  local argv
  argv=("$@")

  # Resolve a leading alias the way the shell would. bash expands an alias in
  # command position only, so `sn ls` would otherwise die with "command not
  # found" — every wrapper function has this problem, snip just makes it
  # visible. Bounded, because `ls='ls -1 -F'` resolves to itself forever.
  local hops=0 body head noglob=0
  case "$-" in
  *f*) noglob=1 ;;
  esac

  while [ "$hops" -lt 5 ] && [ "$(type -t "${argv[0]}" 2> /dev/null)" = "alias" ]; do
    body="$(alias "${argv[0]}" 2> /dev/null)"
    body="${body#*=}"
    body="${body#\'}"
    body="${body%\'}"
    [ -n "$body" ] || break

    set -f
    head=($body)
    [ "$noglob" -eq 1 ] || set +f

    [ -n "${head[0]:-}" ] || break

    # A self-referential alias is fully resolved once its own flags are in —
    # take the expansion and stop, or the loop would never terminate.
    if [ "${head[0]}" = "${argv[0]}" ]; then
      argv=("${head[@]}" "${argv[@]:1}")
      break
    fi

    argv=("${head[@]}" "${argv[@]:1}")
    hops=$((hops + 1))
  done

  # A shell function of the same name is the repo's own wrapper (see
  # bash-command-wrappers.profile.bash and the git prompt-cache wrapper). snip
  # execs a binary, so routing through it would silently drop that behavior —
  # only -f is allowed to make that trade.
  if [ "$force" -eq 0 ] && [ "$(type -t "${argv[0]}" 2> /dev/null)" = "function" ]; then
    "${argv[@]}"
    return $?
  fi

  if snip check -- "${argv[@]}" &> /dev/null; then
    snip run -- command "${argv[@]}"
    return $?
  fi

  "${argv[@]}"
}

# snip_coverage: report how much of your own shell history snip can filter
function snip_coverage() {
  if is_help_arg "${1:-}"; then
    echo "snip_coverage: report how much of your own shell history snip can filter
  Usage: snip_coverage [<top-n>]
  Reads \$HISTFILE (default \$HOME/.bash_history), buckets commands by their
  first two tokens — the same '<binary> <subcommand>' shape snip keys filters
  on — and checks each of the <top-n> most-run shapes against snip.
  <top-n> defaults to 25.
  Unlike 'snip discover', which scans agent session transcripts, this reads the
  commands you actually typed. A '-' on a shape you run constantly is the case
  for adding a project-local filter under .snip/filters/."
    return 0
  fi

  if ! _snip_ready; then
    echo "snip_coverage: snip is not installed" >&2
    return 1
  fi

  local top="${1:-25}"
  case "$top" in
  '' | *[!0-9]*)
    echo "snip_coverage: <top-n> must be a positive integer, got: $top" >&2
    return 1
    ;;
  esac

  local histfile="${HISTFILE:-$HOME/.bash_history}"
  if [ ! -f "$histfile" ]; then
    echo "snip_coverage: no history file at $histfile" >&2
    return 1
  fi

  print_action_summary "$histfile"

  local shapes=0 filtered=0 runs=0 filtered_runs=0
  local count first second label result
  while IFS="$(printf '\t')" read -r count first second; do
    [ -n "$first" ] || continue

    if [ -n "$second" ]; then
      label="$first $second"
      result="$(snip check -- "$first" "$second" 2> /dev/null)"
    else
      label="$first"
      result="$(snip check -- "$first" 2> /dev/null)"
    fi

    shapes=$((shapes + 1))
    runs=$((runs + count))

    case "$result" in
    filter:*)
      filtered=$((filtered + 1))
      filtered_runs=$((filtered_runs + count))
      printf '  %6s  %-30s %s\n' "$count" "$label" "${result#filter: }"
      ;;
    *)
      printf '  %6s  %-30s %s\n' "$count" "$label" "-"
      ;;
    esac
  done < <(_snip_history_shapes "$histfile" "$top")

  if [ "$shapes" -eq 0 ]; then
    echo "  > No commands found in $histfile"
    return 0
  fi

  echo "  > Coverage > $filtered/$shapes command shapes > $filtered_runs/$runs runs ($((filtered_runs * 100 / runs))%)"
}

# snip_logs: list, or print, the full output snip saved when a filtered command failed
function snip_logs() {
  if is_help_arg "${1:-}"; then
    echo "snip_logs: list, or print, the full output snip saved when a filtered command failed
  Usage: snip_logs              list every saved log, newest first
         snip_logs <n>          print the nth newest log (1 = newest)
         snip_logs <name>       print the log with that file name
  Some filters tee the unfiltered output to disk so the dropped lines are still
  recoverable after a failure — snip ships no command to read those back, which
  is what this is for. Honors \$SNIP_TEE_DIR, otherwise resolves the folder from
  'snip config'. Set SNIP_TEE=all to tee successful runs too."
    return 0
  fi

  local folder
  folder="$(_snip_tee_folder)"

  if [ ! -d "$folder" ]; then
    echo "snip_logs: no saved logs — $folder does not exist" >&2
    return 1
  fi

  local target="${1:-}"
  local file=""

  if [ -z "$target" ]; then
    print_action_summary "$folder"
    command ls -t "$folder" 2> /dev/null | awk '{ printf "  %3d  %s\n", NR, $0 }'
    return 0
  fi

  case "$target" in
  '' | *[!0-9]*)
    file="$folder/$target"
    ;;
  *)
    file="$folder/$(command ls -t "$folder" 2> /dev/null | sed -n "${target}p")"
    ;;
  esac

  if [ ! -f "$file" ]; then
    echo "snip_logs: no such log: $target (run 'snip_logs' to list them)" >&2
    return 1
  fi

  print_action_summary "$file"
  command cat "$file"
}
