async function doWork() {
  const { maxLineSize, ignoredFolders } = EDITOR_CONFIGS;

  const MAX_DEPTH_CLEANUP = 6;

  // Build ignore list for Ruff
  const ruffExclude = ignoredFolders.join(',');

  // Build find exclude rules for format_cleanup
  const findExcludes = ignoredFolders.map((folder) => `-not -path '*/${folder}/*'`).join(' \\\n    ');

  // Build ignore file content for Prettier
  const prettierIgnoreContent = ignoredFolders.join('\n');

  const formatScriptBlock = `
# === format script ===
function format {
  local verbose=0
  if [ "\$(echo "\$1" | tr '[:upper:]' '[:lower:]')" = "1" ] || [ "\$(echo "\$1" | tr '[:upper:]' '[:lower:]')" = "true" ]; then
    verbose=1
    shift
  fi

  echo "🚀 Running full project format sequence..."

  if [ "\$verbose" -eq 1 ]; then
    timeout 60 format_cleanup || echo "⚠️ format_cleanup failed or skipped."
    timeout 20 format_other_text_based_files || echo "⚠️ format_other_text_based_files failed or skipped."
    timeout 10 format_python || echo "⚠️ format_python failed or skipped."
    timeout 10 format_js || echo "⚠️ format_js failed or skipped."
    echo "✅ All formatting steps complete (some may have warnings)."
  else
    timeout 60 format_cleanup > /dev/null 2>&1 || true
    timeout 20 format_other_text_based_files > /dev/null 2>&1 || true
    timeout 10 format_python > /dev/null 2>&1 || true
    timeout 10 format_js > /dev/null 2>&1 || true
  fi
}

function format_js {
  echo "🎨 Running Prettier on JavaScript/TypeScript files..."

  if ! command -v npx >/dev/null 2>&1; then
    echo "❌ npx not found. Please install Node.js (https://nodejs.org/) first."
    return 1
  fi

  # Create a temporary .prettierignore file based on EDITOR_CONFIGS.ignoredFolders
  local temp_ignore_file=\$(mktemp)
  cat <<'EOF' > "\$temp_ignore_file"
${prettierIgnoreContent}
EOF

  npx prettier --write --ignore-unknown --cache '**/*.{js,jsx,ts,tsx,mjs,cjs,json,html,css,scss,less,md,yml,yaml,graphql,vue,xml}' --ignore-path "\$temp_ignore_file" > /dev/null 2>&1
  local status=\$?
  rm -f "\$temp_ignore_file"

  if [ \$status -eq 0 ]; then
    echo "✅ JS/TS formatting complete."
  else
    echo "⚠️ Prettier encountered some errors."
    return 1
  fi
}

function format_python {
  # Only activate venv if not already active
  if [ -n "\$VIRTUAL_ENV" ]; then
    echo "🐍 Python environment already active: \$VIRTUAL_ENV"
  else
    if [ -f ".venv/bin/activate" ]; then
      echo "🐍 Activating local virtual environment (.venv)..."
      source .venv/bin/activate
    elif [ -f "/home/syle/venv/bin/activate" ]; then
      echo "🐍 Activating fallback environment (/home/syle/venv)..."
      source /home/syle/venv/bin/activate
    else
      echo "⚠️ No virtual environment found. Using global Python."
    fi
  fi

  if ! command -v ruff >/dev/null 2>&1; then
    echo "📦 Installing Ruff..."
    pip install ruff || uv pip install ruff || { echo "❌ Failed to install Ruff."; return 1; }
  fi

  echo "🧹 Running Ruff checks and formatting..."
  ruff format --line-length ${maxLineSize} --exclude "${ruffExclude}" > /dev/null 2>&1 || return 1
  ruff check --fix --line-length ${maxLineSize} --exclude "${ruffExclude}" > /dev/null 2>&1 || return 1
  echo "✅ Python formatting complete."
}

# ----------------------------------------------------
# Aggressive Junk Cleanup (macOS + metadata)
# ----------------------------------------------------
function format_cleanup {

  echo "🧹 Cleaning macOS and metadata junk..."

  local base_dir="\${1:-.}"

  if [ ! -d "\$base_dir" ]; then
    echo "❌ Directory '\$base_dir' not found."
    return 1
  fi

  local count=\$(find "\$base_dir" \\
    \\( \\
      -type f \\( \\
        -name '*.Identifier' -o \\
        -name '._*' -o \\
        -name '.DS_Store' -o \\
        -name '.AppleDouble' -o \\
        -name '.LSOverride' -o \\
        -name 'Icon?' \\
      \\) -o \\
      -type d \\( \\
        -name '.Spotlight-V100' -o \\
        -name '.Trashes' -o \\
        -name '.fseventsd' \\
      \\) \\
    \\) \\
    ${findExcludes} \\
    -print | wc -l)

  if [ "\$count" -gt 0 ]; then
    find "\$base_dir" \\
      \\( \\
        -type f \\( \\
          -name '*.Identifier' -o \\
          -name '._*' -o \\
          -name '.DS_Store' -o \\
          -name '.AppleDouble' -o \\
          -name '.LSOverride' -o \\
          -name 'Icon?' \\
        \\) -o \\
        -type d \\( \\
          -name '.Spotlight-V100' -o \\
          -name '.Trashes' -o \\
          -name '.fseventsd' \\
        \\) \\
      \\) \\
      ${findExcludes} \\
      -exec rm -rf {} +

    echo "✅ Removed \$count junk items."
  else
    echo "✨ No junk found."
  fi
}

# ----------------------------------------------------
# Light Cleanup (depth limited)
# ----------------------------------------------------
function format_cleanup_light {

  local base_dir="\${1:-.}"
  local max_depth=${MAX_DEPTH_CLEANUP}

  if [ ! -d "\$base_dir" ]; then
    return 1
  fi

  find "\$base_dir" \\
    -maxdepth "\$max_depth" \\
    \\( \\
      -type f \\( \\
        -name '*.Identifier' -o \\
        -name '._*' -o \\
        -name '.DS_Store' -o \\
        -name '.AppleDouble' -o \\
        -name '.LSOverride' -o \\
        -name 'Icon?' \\
      \\) -o \\
      -type d \\( \\
        -name '.Spotlight-V100' -o \\
        -name '.Trashes' -o \\
        -name '.fseventsd' \\
      \\) \\
    \\) \\
    ${findExcludes} \\
    -exec rm -rf {} +
}


# ----------------------------------------------------
# Text File Formatting
# ----------------------------------------------------
function format_other_text_based_files {
  echo '>> Formatting text-based files...'

  EXCLUDE_DIRS=(
    ".git"
    "node_modules"
    "dist"
    "build"
    "vendor"
    ".cache"
    ".next"
    "venv"
    ".venv"
    "target"
  )

  EXCLUDE_FILES=(
    "package-lock.json"
    "yarn.lock"
    "pnpm-lock.yaml"
    "*.min.js"
    "*.min.css"
    ".DS_Store"
  )

  dir_args=()
  for i in "\${!EXCLUDE_DIRS[@]}"; do
    dir_args+=("-name" "\${EXCLUDE_DIRS[\$i]}")
    [ \$i -lt \$((\${#EXCLUDE_DIRS[@]} - 1)) ] && dir_args+=("-o")
  done

  file_exclude_args=()
  for i in "\${!EXCLUDE_FILES[@]}"; do
    file_exclude_args+=("-name" "\${EXCLUDE_FILES[\$i]}")
    [ \$i -lt \$((\${#EXCLUDE_FILES[@]} - 1)) ] && file_exclude_args+=("-o")
  done

  find . -type d \\( "\${dir_args[@]}" \\) -prune -o \
    -type f ! \\( "\${file_exclude_args[@]}" \\) -print | \
    while read -r file; do

      if file --mime-type "\$file" | grep -q "text/"; then
        sed -i 's/[ \\t]*\$//' "\$file"
      fi
    done

  echo '>> DONE Formatting All Text-Based Files'
}

# === end format script ===
`;

  registerWithBashSyle('format script', formatScriptBlock);

  writeToBuildFile([['format', formatScriptBlock]]);
}
