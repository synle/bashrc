/// <reference path="../index.js" />

// ============================================================
// Constants — used across all format functions
// ============================================================

/** Max find depth for light cleanup */
const MAX_DEPTH_CLEANUP = 6;

/** Files to skip during text-based formatting (minified, lockfiles, generated) */
const EXCLUDED_FILES = [
  '*.Identifier',
  '*.min.css',
  '*.min.js',
  '*.orig',
  '*.rej',
  '.DS_Store',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

/** * Generates and registers bash functions for code formatting, cleanup, and file formatting using Prettier and Ruff. */
async function doWork() {
  const { maxLineSize, ignoredFolders, junkFiles, junkDirs } = EDITOR_CONFIGS;

  // Merge with EDITOR_CONFIGS.ignoredFolders and deduplicate
  const allIgnoredDirs = [...new Set([
    ...ignoredFolders,
    '.cache',
    '.git',
    '.gradle',
    '.idea',
    '.next',
    '.venv',
    '__pycache__',
    'build',
    'coverage',
    'dist',
    'node_modules',
    'target',
    'vendor',
    'venv',
  ])].sort();

  // Build ignore rules for tools
  const ruffExclude = allIgnoredDirs.join(',');
  const findExcludes = allIgnoredDirs.map((folder) => `-not -path '*/${folder}/*'`).join(' \\\n    ');
  const prettierIgnoreContent = allIgnoredDirs.join('\n');

  // Build bash arrays for find commands
  const junkFileNames = junkFiles.map((f) => `-name '${f}'`).join(' -o \\\n        ');
  const junkDirNames = junkDirs.map((d) => `-name '${d}'`).join(' -o \\\n        ');
  const excludeDirsArray = allIgnoredDirs.map((d) => `    "${d}"`).join('\n');
  const excludeFilesArray = EXCLUDED_FILES.map((f) => `    "${f}"`).join('\n');

  const formatScriptBlock = `
# === format script ===
function format {
  local verbose=0
  if [ "\$(echo "\$1" | tr '[:upper:]' '[:lower:]')" = "1" ] || [ "\$(echo "\$1" | tr '[:upper:]' '[:lower:]')" = "true" ]; then
    verbose=1
    shift
  fi

  echo "Running full project format sequence..."

  if [ "\$verbose" -eq 1 ]; then
    timeout 30 format_cleanup || echo "format_cleanup failed or skipped."
    timeout 20 format_other_text_based_files || echo "format_other_text_based_files failed or skipped."
    timeout 10 format_python || echo "format_python failed or skipped."
    timeout 10 format_js || echo "format_js failed or skipped."
    echo "All formatting steps complete (some may have warnings)."
  else
    timeout 30 format_cleanup > /dev/null 2>&1 || true
    timeout 20 format_other_text_based_files > /dev/null 2>&1 || true
    timeout 10 format_python > /dev/null 2>&1 || true
    timeout 10 format_js > /dev/null 2>&1 || true
  fi
}

function format_js {
  echo "Running Prettier on JavaScript/TypeScript files..."

  if ! command -v npx >/dev/null 2>&1; then
    echo "npx not found. Please install Node.js (https://nodejs.org/) first."
    return 1
  fi

  # Create a temporary .prettierignore file
  local temp_ignore_file=\$(mktemp)
  cat <<'EOF' > "\$temp_ignore_file"
${prettierIgnoreContent}
EOF

  npx prettier --write --cache --ignore-unknown --no-error-on-unmatched-pattern --ignore-path "\$temp_ignore_file" --print-width ${EDITOR_CONFIGS.maxLineSize} . > /dev/null 2>&1
  local status=\$?
  rm -f "\$temp_ignore_file"

  if [ \$status -eq 0 ]; then
    echo "JS/TS formatting complete."
  else
    echo "Prettier encountered some errors."
    return 1
  fi
}

function format_python {
  # Only activate venv if not already active
  if [ -n "\$VIRTUAL_ENV" ]; then
    echo "Python environment already active: \$VIRTUAL_ENV"
  else
    if [ -f ".venv/bin/activate" ]; then
      echo "Activating local virtual environment (.venv)..."
      source .venv/bin/activate
    elif [ -f "/home/syle/venv/bin/activate" ]; then
      echo "Activating fallback environment (/home/syle/venv)..."
      source /home/syle/venv/bin/activate
    else
      echo "No virtual environment found. Using global Python."
    fi
  fi

  if ! command -v ruff >/dev/null 2>&1; then
    echo "Installing Ruff..."
    pip install ruff || uv pip install ruff || { echo "Failed to install Ruff."; return 1; }
  fi

  echo "Running Ruff checks and formatting..."
  ruff format --line-length ${maxLineSize} --exclude "${ruffExclude}" > /dev/null 2>&1 || return 1
  ruff check --fix --line-length ${maxLineSize} --exclude "${ruffExclude}" > /dev/null 2>&1 || return 1
  echo "Python formatting complete."
}

# ----------------------------------------------------
# Aggressive Junk Cleanup (macOS metadata, OS artifacts,
# patch rejects, and other system files)
# ----------------------------------------------------
function format_cleanup {
  echo "Cleaning junk files..."

  local base_dir="\${1:-.}"

  if [ ! -d "\$base_dir" ]; then
    echo "Directory '\$base_dir' not found."
    return 1
  fi

  local count=\$(find "\$base_dir" \\
    \\( \\
      -type f \\( \\
        ${junkFileNames} \\
      \\) -o \\
      -type d \\( \\
        ${junkDirNames} \\
      \\) \\
    \\) \\
    ${findExcludes} \\
    -print | wc -l)

  if [ "\$count" -gt 0 ]; then
    find "\$base_dir" \\
      \\( \\
        -type f \\( \\
          ${junkFileNames} \\
        \\) -o \\
        -type d \\( \\
          ${junkDirNames} \\
        \\) \\
      \\) \\
      ${findExcludes} \\
      -exec rm -rf {} +

    echo "Removed \$count junk items."
  else
    echo "No junk found."
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
        ${junkFileNames} \\
      \\) -o \\
      -type d \\( \\
        ${junkDirNames} \\
      \\) \\
    \\) \\
    ${findExcludes} \\
    -exec rm -rf {} +
}

# ----------------------------------------------------
# Text File Formatting (trim trailing whitespace)
# ----------------------------------------------------
function format_other_text_based_files {
  echo '>> Formatting text-based files...'

  EXCLUDE_DIRS=(
${excludeDirsArray}
  )

  EXCLUDE_FILES=(
${excludeFilesArray}
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

  writeToBuildFile([{ file: 'format', data: formatScriptBlock }]);
}
