# === timeout script ===
# Runs a command with a timeout, killing it if it exceeds the allowed duration.
# Usage: timeout [seconds] <command> (default: 17s)
timeout() {
  local delay cmd
  if [ "$#" -eq 1 ]; then delay=17; cmd="$1"
  elif [ "$#" -eq 2 ]; then delay="$1"; cmd="$2"
  else echo "Usage: timeout [seconds] <command>" >&2; return 1; fi

  echo "Running with ${delay}s timeout: $cmd" >&2
  (
    eval "$cmd" &
    local cmd_pid=$!
    (
      sleep "$delay"
      if kill -0 "$cmd_pid" 2>/dev/null; then
        echo "Timeout after ${delay}s: killing '$cmd'" >&2
        kill -9 "$cmd_pid" 2>/dev/null
      fi
    ) &
    wait "$cmd_pid"
  )
}

# === format script ===
format() {
  local verbose=0
  if [ "$(echo "$1" | tr '[:upper:]' '[:lower:]')" = "1" ] || [ "$(echo "$1" | tr '[:upper:]' '[:lower:]')" = "true" ]; then
    verbose=1
    shift
  fi

  echo "Running full project format sequence..."

  if [ "$verbose" -eq 1 ]; then
    timeout format_cleanup || echo "format_cleanup failed or skipped."
    timeout format_other_text_based_files || echo "format_other_text_based_files failed or skipped."
    timeout format_python || echo "format_python failed or skipped."
    timeout format_js || echo "format_js failed or skipped."
    echo "All formatting steps complete (some may have warnings)."
  else
    timeout format_cleanup > /dev/null 2>&1 || true
    timeout format_other_text_based_files > /dev/null 2>&1 || true
    timeout format_python > /dev/null 2>&1 || true
    timeout format_js > /dev/null 2>&1 || true
  fi
}

format_js() {
  echo "Running Prettier on JavaScript/TypeScript files..."

  if ! command -v npx >/dev/null 2>&1; then
    echo "npx not found. Please install Node.js (https://nodejs.org/) first."
    return 1
  fi

  # Create a temporary .prettierignore file
  local temp_ignore_file=$(mktemp)
  cat <<'EOF' > "$temp_ignore_file"
.cache
.ebextensions
.generated
.git
.gradle
.hg
.idea
.mypy_cache
.next
.pytest_cache
.sass-cache
.svn
.venv
CVS
__pycache*
__pycache__
bower_components
build
coverage
dist
env
node_modules
target
tmp
vendor
venv
webpack-dist
EOF

  npx prettier --write --cache --ignore-unknown --no-error-on-unmatched-pattern --ignore-path "$temp_ignore_file" --print-width 140 . > /dev/null 2>&1
  local status=$?
  rm -f "$temp_ignore_file"

  if [ $status -eq 0 ]; then
    echo "JS/TS formatting complete."
  else
    echo "Prettier encountered some errors."
    return 1
  fi
}

format_python() {
  # Only activate venv if not already active
  if [ -n "$VIRTUAL_ENV" ]; then
    echo "Python environment already active: $VIRTUAL_ENV"
  else
    if [ -f ".venv/bin/activate" ]; then
      echo "Activating local virtual environment (.venv)..."
      source .venv/bin/activate
    elif [ -f "$HOME/venv/bin/activate" ]; then
      echo "Activating fallback environment ($HOME/venv)..."
      source "$HOME/venv/bin/activate"
    else
      echo "No virtual environment found. Using global Python."
    fi
  fi

  if ! command -v ruff >/dev/null 2>&1; then
    echo "Installing Ruff..."
    pip install ruff || uv pip install ruff || { echo "Failed to install Ruff."; return 1; }
  fi

  echo "Running Ruff checks and formatting..."
  ruff format --line-length 140 --exclude ".cache,.ebextensions,.generated,.git,.gradle,.hg,.idea,.mypy_cache,.next,.pytest_cache,.sass-cache,.svn,.venv,CVS,__pycache*,__pycache__,bower_components,build,coverage,dist,env,node_modules,target,tmp,vendor,venv,webpack-dist" > /dev/null 2>&1 || return 1
  ruff check --fix --line-length 140 --exclude ".cache,.ebextensions,.generated,.git,.gradle,.hg,.idea,.mypy_cache,.next,.pytest_cache,.sass-cache,.svn,.venv,CVS,__pycache*,__pycache__,bower_components,build,coverage,dist,env,node_modules,target,tmp,vendor,venv,webpack-dist" > /dev/null 2>&1 || return 1
  echo "Python formatting complete."
}

# ----------------------------------------------------
# Aggressive Junk Cleanup (macOS metadata, OS artifacts,
# patch rejects, and other system files)
# ----------------------------------------------------
format_cleanup() {
  echo "Cleaning junk files..."

  local base_dir="${1:-.}"

  if [ ! -d "$base_dir" ]; then
    echo "Directory '$base_dir' not found."
    return 1
  fi

  local deleted
  deleted=$(find "$base_dir" \
    \( \
      -type f \( \
        -name '._*' -o \
        -name '.AppleDouble' -o \
        -name '.DS_Store' -o \
        -name '.LSOverride' -o \
        -name '*.Identifier' -o \
        -name '*.orig' -o \
        -name '*.rej' -o \
        -name 'Desktop.ini' -o \
        -name 'ehthumbs.db' -o \
        -name 'Icon?' -o \
        -name 'Thumbs.db' \
      \) -o \
      -type d \( \
        -name '.Spotlight-V100' -o \
        -name '.Trashes' -o \
        -name '.fseventsd' -o \
        -name '__MACOSX' \
      \) \
    \) \
    -not -path '*/.cache/*' \
    -not -path '*/.ebextensions/*' \
    -not -path '*/.generated/*' \
    -not -path '*/.git/*' \
    -not -path '*/.gradle/*' \
    -not -path '*/.hg/*' \
    -not -path '*/.idea/*' \
    -not -path '*/.mypy_cache/*' \
    -not -path '*/.next/*' \
    -not -path '*/.pytest_cache/*' \
    -not -path '*/.sass-cache/*' \
    -not -path '*/.svn/*' \
    -not -path '*/.venv/*' \
    -not -path '*/CVS/*' \
    -not -path '*/__pycache*/*' \
    -not -path '*/__pycache__/*' \
    -not -path '*/bower_components/*' \
    -not -path '*/build/*' \
    -not -path '*/coverage/*' \
    -not -path '*/dist/*' \
    -not -path '*/env/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/target/*' \
    -not -path '*/tmp/*' \
    -not -path '*/vendor/*' \
    -not -path '*/venv/*' \
    -not -path '*/webpack-dist/*' \
    -print -exec rm -rf {} + 2>/dev/null)

  local count=$(echo "$deleted" | grep -c . 2>/dev/null || echo 0)
  if [ "$count" -gt 0 ]; then
    echo "Removed $count junk items."
  else
    echo "No junk found."
  fi
}

# ----------------------------------------------------
# Light Cleanup (depth limited)
# ----------------------------------------------------
format_cleanup_light() {
  local base_dir="${1:-.}"
  local max_depth=6

  if [ ! -d "$base_dir" ]; then
    return 1
  fi

  find "$base_dir" \
    -maxdepth "$max_depth" \
    \( \
      -type f \( \
        -name '._*' -o \
        -name '.AppleDouble' -o \
        -name '.DS_Store' -o \
        -name '.LSOverride' -o \
        -name '*.Identifier' -o \
        -name '*.orig' -o \
        -name '*.rej' -o \
        -name 'Desktop.ini' -o \
        -name 'ehthumbs.db' -o \
        -name 'Icon?' -o \
        -name 'Thumbs.db' \
      \) -o \
      -type d \( \
        -name '.Spotlight-V100' -o \
        -name '.Trashes' -o \
        -name '.fseventsd' -o \
        -name '__MACOSX' \
      \) \
    \) \
    -not -path '*/.cache/*' \
    -not -path '*/.ebextensions/*' \
    -not -path '*/.generated/*' \
    -not -path '*/.git/*' \
    -not -path '*/.gradle/*' \
    -not -path '*/.hg/*' \
    -not -path '*/.idea/*' \
    -not -path '*/.mypy_cache/*' \
    -not -path '*/.next/*' \
    -not -path '*/.pytest_cache/*' \
    -not -path '*/.sass-cache/*' \
    -not -path '*/.svn/*' \
    -not -path '*/.venv/*' \
    -not -path '*/CVS/*' \
    -not -path '*/__pycache*/*' \
    -not -path '*/__pycache__/*' \
    -not -path '*/bower_components/*' \
    -not -path '*/build/*' \
    -not -path '*/coverage/*' \
    -not -path '*/dist/*' \
    -not -path '*/env/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/target/*' \
    -not -path '*/tmp/*' \
    -not -path '*/vendor/*' \
    -not -path '*/venv/*' \
    -not -path '*/webpack-dist/*' \
    -exec rm -rf {} +
}

# ----------------------------------------------------
# Text File Formatting (trim trailing whitespace)
# ----------------------------------------------------
format_other_text_based_files() {
  echo '>> Formatting text-based files...'

  EXCLUDE_DIRS=(
    ".cache"
    ".ebextensions"
    ".generated"
    ".git"
    ".gradle"
    ".hg"
    ".idea"
    ".mypy_cache"
    ".next"
    ".pytest_cache"
    ".sass-cache"
    ".svn"
    ".venv"
    "CVS"
    "__pycache*"
    "__pycache__"
    "bower_components"
    "build"
    "coverage"
    "dist"
    "env"
    "node_modules"
    "target"
    "tmp"
    "vendor"
    "venv"
    "webpack-dist"
  )

  EXCLUDE_FILES=(
    "*.Identifier"
    "*.min.css"
    "*.min.js"
    "*.orig"
    "*.rej"
    ".DS_Store"
    "package-lock.json"
    "pnpm-lock.yaml"
    "yarn.lock"
  )

  dir_args=()
  for i in "${!EXCLUDE_DIRS[@]}"; do
    dir_args+=("-name" "${EXCLUDE_DIRS[$i]}")
    [ $i -lt $((${#EXCLUDE_DIRS[@]} - 1)) ] && dir_args+=("-o")
  done

  file_exclude_args=()
  for i in "${!EXCLUDE_FILES[@]}"; do
    file_exclude_args+=("-name" "${EXCLUDE_FILES[$i]}")
    [ $i -lt $((${#EXCLUDE_FILES[@]} - 1)) ] && file_exclude_args+=("-o")
  done

  find . -type d \( "${dir_args[@]}" \) -prune -o     -type f ! \( "${file_exclude_args[@]}" \) -print |     while read -r file; do

      if file --mime-type "$file" | grep -q "text/"; then
        sed -i 's/[ \t]*$//' "$file"
      fi
    done

  echo '>> DONE Formatting All Text-Based Files'
}