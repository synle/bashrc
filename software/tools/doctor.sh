#!/usr/bin/env bash
{
  ################################################################################
  # ---- doctor.sh - Diagnostic checks for common issues ----
  #
  # Usage:
  #   bash doctor.sh          # Run all checks
  #   make doctor             # Same via Makefile
  ################################################################################

  _pass=0
  _warn=0
  _fail=0

  function _check_pass() {
    echo "  [PASS] $1"
    _pass=$((_pass + 1))
  }
  function _check_warn() {
    echo "  [WARN] $1"
    _warn=$((_warn + 1))
  }
  function _check_fail() {
    echo "  [FAIL] $1"
    _fail=$((_fail + 1))
  }

  echo "Running diagnostics..."
  echo ""

  ################################################################################
  # ---- Dependencies ----
  ################################################################################
  echo "== Dependencies =="

  # node
  if type -P node > /dev/null 2>&1; then
    _check_pass "node found ($(node -v 2> /dev/null))"
  else
    _check_fail "node not found - run 'make setup_local' or install Node.js"
  fi

  # npm
  if type -P npm > /dev/null 2>&1; then
    _check_pass "npm found ($(command npm -v 2> /dev/null))"
  else
    _check_fail "npm not found - install Node.js"
  fi

  # bash
  if type -P bash > /dev/null 2>&1; then
    _check_pass "bash found ($(bash --version | head -1 | grep -o '[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*' | head -1))"
  else
    _check_fail "bash not found"
  fi

  # git
  if type -P git > /dev/null 2>&1; then
    _check_pass "git found ($(git --version | grep -o '[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*' | head -1))"
  else
    _check_fail "git not found"
  fi

  # prettier (optional)
  if type -P npx > /dev/null 2>&1; then
    _check_pass "npx found (for prettier formatting)"
  else
    _check_warn "npx not found - 'make format' may not work"
  fi

  # shfmt (optional)
  if type -P shfmt > /dev/null 2>&1; then
    _check_pass "shfmt found (for shell formatting)"
  else
    _check_warn "shfmt not found - shell formatting will be skipped in 'make format'"
  fi

  echo ""

  ################################################################################
  # ---- Node modules ----
  ################################################################################
  echo "== Node Modules =="

  if [ -d "node_modules" ]; then
    _check_pass "node_modules/ exists"
  else
    _check_fail "node_modules/ missing - run 'npm install'"
  fi

  if [ -f "package-lock.json" ] && [ -d "node_modules" ]; then
    # check if node_modules is stale relative to package.json
    if [ "package.json" -nt "node_modules" ]; then
      _check_warn "node_modules/ may be stale (package.json is newer) - run 'npm install'"
    else
      _check_pass "node_modules/ is up to date"
    fi
  fi

  echo ""

  ################################################################################
  # ---- Build Artifacts ----
  ################################################################################
  echo "== Build Artifacts =="

  if [ -d ".build" ]; then
    _build_file_count=$(find .build -type f 2> /dev/null | wc -l | tr -d ' ')
    if [ "$_build_file_count" -gt 0 ]; then
      _check_pass ".build/ contains $_build_file_count files"
    else
      _check_warn ".build/ exists but is empty - run 'make build'"
    fi

    # check if build artifacts are stale (older than source files)
    _newest_source=$(find software/scripts -name '*.js' -newer .build 2> /dev/null | head -1)
    if [ -n "$_newest_source" ]; then
      _check_warn ".build/ may be stale (source files are newer) - run 'make build'"
    else
      _check_pass ".build/ appears up to date"
    fi
  else
    _check_warn ".build/ directory missing - run 'make build'"
  fi

  echo ""

  ################################################################################
  # ---- Shell Syntax ----
  ################################################################################
  echo "== Shell Syntax =="

  _syntax_errors=0
  for sh_file in software/bootstrap/*.sh; do
    [ -f "$sh_file" ] || continue
    if bash -n "$sh_file" 2> /dev/null; then
      _check_pass "$sh_file syntax OK"
    else
      _check_fail "$sh_file has syntax errors"
      _syntax_errors=$((_syntax_errors + 1))
    fi
  done

  for sh_file in ./*.sh; do
    [ -f "$sh_file" ] || continue
    if bash -n "$sh_file" 2> /dev/null; then
      _check_pass "$sh_file syntax OK"
    else
      _check_fail "$sh_file has syntax errors"
      _syntax_errors=$((_syntax_errors + 1))
    fi
  done

  echo ""

  ################################################################################
  # ---- Profile & Marker Checks ----
  ################################################################################
  echo "== Profile & Markers =="

  BASH_SYLE_PATH="${HOME}/.bash_syle"

  if [ -f "$BASH_SYLE_PATH" ]; then
    _check_pass "~/.bash_syle exists ($(wc -c < "$BASH_SYLE_PATH" | tr -d ' ') bytes)"

    # check for mismatched BEGIN/END markers
    _begin_keys=$(grep -o '# BEGIN [^-].*' "$BASH_SYLE_PATH" 2> /dev/null | sed 's/# BEGIN //' | sort)
    _end_keys=$(grep -o '# END [^-].*' "$BASH_SYLE_PATH" 2> /dev/null | sed 's/# END //' | sort)

    _begin_only=$(comm -23 <(echo "$_begin_keys") <(echo "$_end_keys") 2> /dev/null)
    _end_only=$(comm -13 <(echo "$_begin_keys") <(echo "$_end_keys") 2> /dev/null)

    if [ -n "$_begin_only" ]; then
      while IFS= read -r key; do
        [ -z "$key" ] && continue
        _check_fail "Orphan BEGIN marker (no END): '$key'"
      done <<< "$_begin_only"
    fi

    if [ -n "$_end_only" ]; then
      while IFS= read -r key; do
        [ -z "$key" ] && continue
        _check_fail "Orphan END marker (no BEGIN): '$key'"
      done <<< "$_end_only"
    fi

    if [ -z "$_begin_only" ] && [ -z "$_end_only" ]; then
      _marker_count=$(echo "$_begin_keys" | grep -c . 2> /dev/null || echo 0)
      _check_pass "All BEGIN/END markers are paired ($_marker_count pairs)"
    fi
  else
    _check_warn "~/.bash_syle not found - run 'make setup_local' to generate"
  fi

  # check source template markers
  for tpl_file in software/bootstrap/profile-core.sh software/bootstrap/profile-advanced.sh; do
    if [ -f "$tpl_file" ]; then
      _short_markers=$(grep -c '# BEGIN/END' "$tpl_file" 2> /dev/null || echo 0)
      _check_pass "$tpl_file has $_short_markers pre-placed markers"
    fi
  done

  echo ""

  ################################################################################
  # ---- build-include Markers ----
  ################################################################################
  echo "== Build-Include Markers =="

  for target_file in run.sh; do
    if [ -f "$target_file" ]; then
      _has_begin=$(grep -c '# BEGIN software/' "$target_file" 2> /dev/null || echo 0)

# END software/' "$target_file" 2> /dev/null || echo 0)
      if [ "$_has_begin" -gt 0 ] && [ "$_has_begin" = "$_has_end" ]; then
        _check_pass "$target_file has $_has_begin build-include marker pair(s)"
      elif [ "$_has_begin" != "$_has_end" ]; then
        _check_fail "$target_file has mismatched build-include markers (BEGIN=$_has_begin, END=$_has_end)"
      fi
    fi
  done

  echo ""

  ################################################################################
  # ---- Common Directories & Files ----
  ################################################################################
  echo "== Common Directories & Files =="

  for _dir in "$HOME/.local/bin" "$HOME/.ssh" "$HOME/.ssh/sockets" "$HOME/.vim/autoload" "$HOME/.vim/plugged"; do
    if [ -d "$_dir" ]; then
      _check_pass "$_dir exists"
    else
      _check_warn "$_dir missing - run 'make setup_local --setup' to create"
    fi
  done

  for _file in "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.gitconfig" "$HOME/.gitmessage" "$HOME/.hushlogin"; do
    if [ -f "$_file" ]; then
      _check_pass "$(basename "$_file") exists"
    else
      _check_warn "$(basename "$_file") missing - run 'make setup_local --setup' to create"
    fi
  done

  echo ""

  ################################################################################
  # ---- Permissions ----
  ################################################################################
  echo "== Permissions =="

  if [ -d "$HOME/.ssh" ]; then
    _ssh_perm=$(stat -f '%Lp' "$HOME/.ssh" 2> /dev/null || stat -c '%a' "$HOME/.ssh" 2> /dev/null)
    if [ "$_ssh_perm" = "700" ]; then
      _check_pass "~/.ssh is 700"
    else
      _check_fail "~/.ssh is $_ssh_perm (expected 700)"
    fi
  fi

  if [ -f "$HOME/.ssh/id_rsa" ]; then
    _key_perm=$(stat -f '%Lp' "$HOME/.ssh/id_rsa" 2> /dev/null || stat -c '%a' "$HOME/.ssh/id_rsa" 2> /dev/null)
    if [ "$_key_perm" = "600" ]; then
      _check_pass "~/.ssh/id_rsa is 600"
    else
      _check_fail "~/.ssh/id_rsa is $_key_perm (expected 600) - SSH will refuse to use this key"
    fi
  else
    _check_warn "~/.ssh/id_rsa not found - no SSH private key"
  fi

  if [ -f "$HOME/.ssh/config" ]; then
    _cfg_perm=$(stat -f '%Lp' "$HOME/.ssh/config" 2> /dev/null || stat -c '%a' "$HOME/.ssh/config" 2> /dev/null)
    if [ "$_cfg_perm" = "600" ]; then
      _check_pass "~/.ssh/config is 600"
    else
      _check_fail "~/.ssh/config is $_cfg_perm (expected 600)"
    fi
  fi

  echo ""

  ################################################################################
  # ---- Git Config ----
  ################################################################################
  echo "== Git Config =="

  _git_email=$(git config --global user.email 2> /dev/null || true)
  if [ -n "$_git_email" ]; then
    _check_pass "git user.email is configured ($_git_email)"
  else
    _check_warn "git user.email not configured - run 'make setup_local --setup' to set"
  fi

  _git_name=$(git config --global user.name 2> /dev/null || true)
  if [ -n "$_git_name" ]; then
    _check_pass "git user.name is configured ($_git_name)"
  else
    _check_warn "git user.name not configured"
  fi

  echo ""

  ################################################################################
  # ---- Rollback ----
  ################################################################################
  echo "== Rollback =="

  if [ -f "${HOME}/.bash_syle.bak" ]; then
    _bak_size=$(wc -c < "${HOME}/.bash_syle.bak" | tr -d ' ')
    _bak_date=$(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "${HOME}/.bash_syle.bak" 2> /dev/null || stat -c '%y' "${HOME}/.bash_syle.bak" 2> /dev/null | cut -d. -f1)
    _check_pass "Rollback backup available (${_bak_size} bytes, ${_bak_date})"
  else
    _check_warn "No rollback backup found (~/.bash_syle.bak) - created on next 'bash run.sh'"
  fi

  echo ""

  ################################################################################
  # ---- Summary ----
  ################################################################################
  echo "================================"
  echo "  PASS: $_pass  WARN: $_warn  FAIL: $_fail"
  echo "================================"

  if [ "$_fail" -gt 0 ]; then
    echo ""
    echo "Some checks failed. See above for details."
    exit 1
  elif [ "$_warn" -gt 0 ]; then
    echo ""
    echo "All checks passed with warnings."
    exit 0
  else
    echo ""
    echo "All checks passed."
    exit 0
  fi
}
