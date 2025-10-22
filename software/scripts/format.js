async function doWork() {
  let bashrcTextContent = readText(BASE_BASH_SYLE);

  const { maxLineSize, ignoredFolders } = EDITOR_CONFIGS;

  // Build ignore list for Ruff
  const ruffExclude = ignoredFolders.join(',');

  // Build find exclude rules for format_cleanup
  const findExcludes = ignoredFolders.map((folder) => `-not -path '*/${folder}/*'`).join(' \\\n    ');

  // Build ignore file content for Prettier
  const prettierIgnoreContent = ignoredFolders.join('\n');

  const formatScriptBlock = `
# === format script ===
format() {
  echo "🚀 Running full project format sequence..."
  format_cleanup || echo "⚠️ format_cleanup failed or skipped."
  format_python || echo "⚠️ format_python failed or skipped."
  format_js || echo "⚠️ format_js failed or skipped."
  echo "✅ All formatting steps complete (some may have warnings)."
}

format_js() {
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

  npx prettier --write '**/*.{js,jsx,ts,tsx,json,scss,mjs,html,md}' --ignore-path "\$temp_ignore_file" > /dev/null 2>&1
  local status=\$?
  rm -f "\$temp_ignore_file"

  if [ \$status -eq 0 ]; then
    echo "✅ JS/TS formatting complete."
  else
    echo "⚠️ Prettier encountered some errors."
    return 1
  fi
}

format_python() {
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
    pip install ruff || { echo "❌ Failed to install Ruff."; return 1; }
  fi

  echo "🧹 Running Ruff checks and formatting..."
  ruff format --line-length ${maxLineSize} --exclude "${ruffExclude}" > /dev/null 2>&1 || return 1
  ruff check --fix --line-length ${maxLineSize} --exclude "${ruffExclude}" > /dev/null 2>&1 || return 1
  echo "✅ Python formatting complete."
}

format_cleanup() {
  echo "🧹 Cleaning up junk files (*.Identifier, ._*)..."

  local base_dir="\${1:-.}"

  if [ ! -d "\$base_dir" ]; then
    echo "❌ Directory '\$base_dir' not found."
    return 1
  fi

  local count=\$(find "\$base_dir" \\
    -type f \\( -name '*.Identifier' -o -name '._*' \\) \\
    ${findExcludes} \\
    -print | wc -l)

  if [ "\$count" -gt 0 ]; then
    find "\$base_dir" \\
      -type f \\( -name '*.Identifier' -o -name '._*' \\) \\
      ${findExcludes} \\
      -delete
    echo "✅ Removed \$count junk files in: \$base_dir"
  else
    echo "✨ No junk files found in: \$base_dir"
  fi
}
# === end format script ===
`;

  bashrcTextContent = prependTextBlock(bashrcTextContent, 'format script', formatScriptBlock);
  writeText(BASE_BASH_SYLE, bashrcTextContent);

  writeToBuildFile([['format', formatScriptBlock]]);
}
