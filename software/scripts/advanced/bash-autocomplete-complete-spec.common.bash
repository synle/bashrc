# Shared spec-based autocomplete helpers: token expansion, COMPREPLY population, and utility functions.
# convert newline-delimited stdin to a space-separated string for compgen -W
function __to_opts() { tr '\n' ' '; }
# same as __to_opts but deduplicates and sorts first
function __to_opts_sorted() { sort -u | __to_opts; }
# same as __to_opts but escapes spaces for filesystem paths (e.g. "Display DJ.app")
function __to_path_opts() { sed 's/ /\\ /g' | __to_opts; }
# shared tab-completion handler — resolves spec data, expands dynamic tokens
# (git branches, files, npm scripts, etc.), and populates COMPREPLY.
# usage: __spec_complete "$spec_data" "$max_depth"
function __spec_complete() {
  local spec_data="$1"
  local _max_depth="$2"
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local opts=""

  if [ -n "$spec_data" ]; then
    # build the subcommand prefix from COMP_WORDS, skipping the command name (COMP_WORDS[0])
    # try longest prefix first (e.g. "rollout status"), then shorter (e.g. "rollout")
    local i matched=0
    for ((i = COMP_CWORD; i >= 2; i--)); do
      local prefix="${COMP_WORDS[*]:1:i-1}"
      local line
      line=$(command grep -m1 "^$prefix|" <<< "$spec_data")
      if [ -n "$line" ]; then
        opts="$(echo "$line" | cut -d'|' -f2- | tr ',' ' ')"
        matched=1
        break
      fi
    done

    # base command: infer subcommands from all left-of-| values, plus any |... base line for extra completions
    if [ "$matched" = "0" ]; then
      opts=$(cut -d'|' -f1 <<< "$spec_data" | command grep -v '^$' | awk '{print $1}' | __to_opts_sorted)
      local base_line
      base_line=$(command grep -m1 "^|" <<< "$spec_data")
      if [ -n "$base_line" ]; then
        opts="$opts $(echo "$base_line" | cut -d'|' -f2- | tr ',' ' ')"
      fi
    fi
  fi

  # expand dynamic tokens: __git_branches__, __git_files__, __git_remotes__
  if [[ "$opts" == *"__git_branches__"* ]]; then
    local branches=$(git branch --no-color 2> /dev/null | sed 's/^[* ]*//' | __to_opts)
    local remote_branches=$(git branch -r --no-color 2> /dev/null | sed 's/^[* ]*//' | sed 's|origin/||' | command grep -v HEAD | __to_opts)
    opts="${opts//__git_branches__/} $branches $remote_branches"
  fi
  if [[ "$opts" == *"__git_files__"* ]]; then
    local files=$(git diff --name-only 2> /dev/null | __to_path_opts)
    local untracked=$(git ls-files --others --exclude-standard 2> /dev/null | __to_path_opts)
    opts="${opts//__git_files__/} $files $untracked"
  fi
  if [[ "$opts" == *"__git_remotes__"* ]]; then
    local remotes=$(git remote 2> /dev/null | __to_opts)
    opts="${opts//__git_remotes__/} $remotes"
  fi
  # expand git flag tokens (static flag lists)
  if [[ "$opts" == *"__git_head_refs__"* ]]; then
    local head_refs="HEAD"
    local i carets
    for i in $(seq 1 100); do head_refs="$head_refs HEAD~$i"; done
    carets="^"
    for i in $(seq 1 10); do
      head_refs="$head_refs HEAD$carets"
      carets="$carets^"
    done
    opts="${opts//__git_head_refs__/} $head_refs"
  fi
  if [[ "$opts" == *"__git_commits__"* ]]; then
    local commits=$(git log --format='%h' -500 2> /dev/null | __to_opts)
    opts="${opts//__git_commits__/} $commits"
  fi
  if [[ "$opts" == *"__git_add_flags__"* ]]; then
    opts="${opts//__git_add_flags__/} --all -A --patch -p --update -u --force -f --intent-to-add -N --dry-run -n --verbose -v --edit -e"
  fi
  if [[ "$opts" == *"__git_branch_flags__"* ]]; then
    opts="${opts//__git_branch_flags__/} --all -a --delete -d -D --force -f --move -m -M --copy -c --list -l --remotes -r --verbose -v --set-upstream-to -u --unset-upstream --sort --contains --no-contains --merged --no-merged --show-current --track -t --no-track"
  fi
  if [[ "$opts" == *"__git_commit_flags__"* ]]; then
    opts="${opts//__git_commit_flags__/} --all -a --message -m --amend --no-edit --allow-empty --no-verify --fixup --squash --signoff -s --verbose -v --dry-run --patch -p --author --date"
  fi
  if [[ "$opts" == *"__git_diff_flags__"* ]]; then
    opts="${opts//__git_diff_flags__/} --staged --cached --word-diff --stat --name-only --name-status --no-index --color --no-color --ignore-all-space -w --ignore-space-change -b --compact-summary --diff-filter"
  fi
  if [[ "$opts" == *"__git_log_flags__"* ]]; then
    opts="${opts//__git_log_flags__/} --oneline --graph --all --stat --patch -p --follow --author --since --until --grep -n --decorate --abbrev-commit --date --format --no-merges --first-parent --reverse"
  fi
  if [[ "$opts" == *"__git_show_flags__"* ]]; then
    opts="${opts//__git_show_flags__/} --stat --name-only --name-status --format --patch -p --word-diff -w --no-patch --abbrev-commit --color --no-color"
  fi
  if [[ "$opts" == *"__git_rebase_flags__"* ]]; then
    opts="${opts//__git_rebase_flags__/} --abort --continue --skip --interactive -i --onto --reapply-cherry-picks --autosquash --no-autosquash --exec -x --update-refs --keep-base --quit --edit-todo"
  fi
  if [[ "$opts" == *"__npm_scripts__"* ]]; then
    local scripts=$(node -e "try{console.log(Object.keys(require('./package.json').scripts).join(' '))}catch(e){}" 2> /dev/null)
    opts="${opts//__npm_scripts__/} $scripts"
  fi
  if [[ "$opts" == *"__makefile_targets__"* ]]; then
    local targets=$([ -f Makefile ] && command grep -o '^[a-zA-Z0-9_-][a-zA-Z0-9_-]*:' Makefile | sed 's/://' | __to_opts_sorted)
    opts="${opts//__makefile_targets__/} $targets"
  fi
  if [[ "$opts" == *"__cargo_targets__"* ]]; then
    local cargo_targets=""
    if [ -f Cargo.toml ]; then
      cargo_targets=$(command grep -o '^\[\[bin\]\]' Cargo.toml > /dev/null 2>&1 && command grep 'name\s*=' Cargo.toml | sed 's/.*name\s*=\s*"\([^"]*\)".*/\1/' | __to_opts_sorted)
      cargo_targets="$cargo_targets $(command grep -o '^\[package\]' Cargo.toml > /dev/null 2>&1 && command grep 'name\s*=' Cargo.toml | head -1 | sed 's/.*name\s*=\s*"\([^"]*\)".*/\1/')"
    fi
    opts="${opts//__cargo_targets__/} $cargo_targets"
  fi
  if [[ "$opts" == *"__python_scripts__"* ]]; then
    local py_scripts=""
    if [ -f pyproject.toml ]; then
      py_scripts=$(command grep -A50 '^\[project.scripts\]' pyproject.toml 2> /dev/null | tail -n +2 | command grep -o '^[a-zA-Z0-9_-][a-zA-Z0-9_-]*' | __to_opts)
      py_scripts="$py_scripts $(command grep -A50 '^\[tool.poetry.scripts\]' pyproject.toml 2> /dev/null | tail -n +2 | command grep -o '^[a-zA-Z0-9_-][a-zA-Z0-9_-]*' | __to_opts)"
    fi
    opts="${opts//__python_scripts__/} $py_scripts"
  fi
  if [[ "$opts" == *"__gradle_tasks__"* ]]; then
    local gradle_tasks=""
    if [ -f build.gradle ] || [ -f build.gradle.kts ]; then
      if [ -x ./gradlew ]; then
        gradle_tasks=$(./gradlew tasks --all --quiet 2> /dev/null | command grep -o '^[a-zA-Z0-9:_-][a-zA-Z0-9:_-]*' | __to_opts_sorted)
      elif type -P gradle &> /dev/null; then
        gradle_tasks=$(gradle tasks --all --quiet 2> /dev/null | command grep -o '^[a-zA-Z0-9:_-][a-zA-Z0-9:_-]*' | __to_opts_sorted)
      fi
    fi
    opts="${opts//__gradle_tasks__/} $gradle_tasks"
  fi
  if [[ "$opts" == *"__composer_scripts__"* ]]; then
    local composer_scripts=""
    if [ -f composer.json ]; then
      composer_scripts=$(node -e "try{console.log(Object.keys(require('./composer.json').scripts).join(' '))}catch(e){}" 2> /dev/null)
    fi
    opts="${opts//__composer_scripts__/} $composer_scripts"
  fi
  if [[ "$opts" == *"__tldr_commands__"* ]]; then
    local tldr_cmds=$(type -P tldr &> /dev/null && tldr --list 2> /dev/null | __to_opts)
    opts="${opts//__tldr_commands__/} $tldr_cmds"
  fi
  if [[ "$opts" == *"__ssh_hosts__"* ]]; then
    local ssh_hosts=""
    if [ -f "$HOME/.ssh/config" ]; then
      ssh_hosts=$(command grep -i '^Host ' "$HOME/.ssh/config" | awk '{for(i=2;i<=NF;i++) print $i}' | command grep -v '[*?]' | __to_opts_sorted)
    fi
    if [ -d "$HOME/.ssh/config.d" ]; then
      local extra_hosts=$(command grep -i '^Host ' "$HOME/.ssh/config.d"/* 2> /dev/null | awk '{for(i=2;i<=NF;i++) print $i}' | command grep -v '[*?]' | __to_opts_sorted)
      ssh_hosts="$ssh_hosts $extra_hosts"
    fi
    opts="${opts//__ssh_hosts__/} $ssh_hosts"
  fi

  # expand filesystem tokens: __files__, __folders__, __paths__
  if [[ "$opts" == *"__files__"* ]]; then
    local cur_dir="${cur%/*}/"
    [ "$cur_dir" = "$cur/" ] && cur_dir=""
    local file_list=$(compgen -f -- "$cur" 2> /dev/null | command grep -v '/$' | __to_path_opts)
    opts="${opts//__files__/} $file_list"
  fi
  if [[ "$opts" == *"__folders__"* ]]; then
    local folder_list=$(compgen -d -- "$cur" 2> /dev/null | __to_path_opts)
    opts="${opts//__folders__/} $folder_list"
  fi
  # resolve base directory from cur (supports ~/path, ../path, /abs/path)
  # example: cur="bashrc/.build" => _nested_prefix="bashrc/", _nested_dir="bashrc/"
  # _fuzzy_list_all runs from _nested_dir and returns relative paths (e.g. ".build/")
  # results are then prefixed with _nested_prefix (e.g. "bashrc/.build/") so compgen
  # can match against the full cur value. when cur has no slash, prefix is empty (no-op).
  local _nested_dir="" _nested_prefix=""
  if [[ "$cur" == */* ]]; then
    _nested_prefix="${cur%/*}/"
    _nested_dir="$_nested_prefix"
    [[ "$_nested_dir" == \~* ]] && eval _nested_dir="$_nested_dir" 2> /dev/null
  fi
  if [[ "$opts" == *"__nested_"* ]]; then
    local _nested_base="${_nested_dir:-.}"
    local _nested_filter="${cur#"$_nested_prefix"}"
    if [[ "$opts" == *"__nested_text_files__"* ]]; then
      local nested_text_files=$(_fuzzy_list_all "$_nested_base" "text_files" "$_max_depth" "" "$_nested_filter" | command sed "s|^|${_nested_prefix}|" | __to_path_opts)
      opts="${opts//__nested_text_files__/} $nested_text_files"
    fi
    if [[ "$opts" == *"__nested_files__"* ]]; then
      local nested_files=$(_fuzzy_list_all "$_nested_base" "files" "$_max_depth" "" "$_nested_filter" | command sed "s|^|${_nested_prefix}|" | __to_path_opts)
      opts="${opts//__nested_files__/} $nested_files"
    fi
    if [[ "$opts" == *"__nested_folders__"* ]]; then
      local nested_folders=$(_fuzzy_list_all "$_nested_base" "folders" "$_max_depth" "" "$_nested_filter" | command sed "s|^|${_nested_prefix}|" | __to_path_opts)
      opts="${opts//__nested_folders__/} $nested_folders"
    fi
    if [[ "$opts" == *"__nested_paths__"* ]]; then
      local nested_paths=$(_fuzzy_list_all "$_nested_base" "paths" "$_max_depth" "" "$_nested_filter" | command sed "s|^|${_nested_prefix}|" | __to_path_opts)
      opts="${opts//__nested_paths__/} $nested_paths"
    fi
  fi
  if [[ "$opts" == *"__paths__"* ]]; then
    local path_list=$(compgen -f -- "$cur" 2> /dev/null | __to_path_opts)
    opts="${opts//__paths__/} $path_list"
  fi

  # expand tilde in cur so compgen -W can match expanded filesystem paths
  local expanded_cur="$cur"
  if [[ "$cur" == \~* ]]; then
    eval expanded_cur="$cur" 2> /dev/null
  fi

  mapfile -t COMPREPLY < <(compgen -W "$opts" -- "$expanded_cur")

  # restore tilde prefix in results so readline inserts ~/... not /Users/...
  if [[ "$cur" == \~* && "$expanded_cur" != "$cur" ]]; then
    local i
    for i in "${!COMPREPLY[@]}"; do
      COMPREPLY[$i]="${COMPREPLY[$i]/#$HOME/\~}"
    done
  fi

  # reorder: non-options first, then --flags last
  if [ "${#COMPREPLY[@]}" -gt 1 ]; then
    local _non_opts=() _flag_opts=()
    local _item
    for _item in "${COMPREPLY[@]}"; do
      if [[ "$_item" == --* ]]; then
        _flag_opts+=("$_item")
      else
        _non_opts+=("$_item")
      fi
    done
    COMPREPLY=()
    [ ${#_non_opts[@]} -gt 0 ] && COMPREPLY+=("${_non_opts[@]}")
    [ ${#_flag_opts[@]} -gt 0 ] && COMPREPLY+=("${_flag_opts[@]}")
  fi
}
