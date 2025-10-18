async function doWork() {
  // Load your base bash profile
  let bashrcTextContent = readText(BASE_BASH_SYLE);

  // Use your existing external config value
  const { maxLineSize } = EDITOR_CONFIGS;

  // Define the format script block
  const formatScriptBlock = `
# === format script ===
# Adds cleanup, Python, and JS format utilities
# Run all formatters sequentially (cleanup → Python → JS)
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

  npx prettier --write '**/*.{js,jsx,ts,tsx,json,scss,mjs,html,md}' --ignore-path .gitignore

  if [ $? -eq 0 ]; then
    echo "✅ JS/TS formatting complete."
  else
    echo "⚠️ Prettier encountered some errors."
    return 1
  fi
}

format_python() {
  if [ -f ".venv/bin/activate" ]; then
    echo "🐍 Activating local virtual environment (.venv)..."
    source .venv/bin/activate
  elif [ -f "/home/syle/venv/bin/activate" ]; then
    echo "🐍 Activating fallback environment (/home/syle/venv)..."
    source /home/syle/venv/bin/activate
  else
    echo "⚠️ No virtual environment found. Using global Python."
  fi

  if ! command -v ruff >/dev/null 2>&1; then
    echo "📦 Installing Ruff..."
    pip install ruff || { echo "❌ Failed to install Ruff."; return 1; }
  fi

  echo "🧹 Running Ruff checks and formatting..."
  ruff check --fix --line-length ${maxLineSize} --exclude ".git,node_modules,venv,.venv" || return 1
  ruff format --line-length ${maxLineSize} --exclude ".git,node_modules,venv,.venv" || return 1

  echo "✅ Python formatting complete."
}

format_cleanup() {
  echo "🧹 Cleaning up system junk files (.DS_Store, .Identifier, Apple resource forks)..."

  local base_dir="\${1:-.}"

  if [ ! -d "\$base_dir" ]; then
    echo "❌ Directory '\$base_dir' not found."
    return 1
  fi

  find "\$base_dir" \\
    -type f \\( -name '*.Identifier' -o -name '.DS_Store' -o -name '._*' \\) \\
    -not -path '*/.git/*' \\
    -not -path '*/node_modules/*' \\
    -not -path '*/venv/*' \\
    -not -path '*/.venv/*' \\
    -not -path '*/__pycache__/*' \\
    -delete

  echo "✅ Cleanup complete in: \$base_dir"
}
# === end format script ===
`;

  // Insert (or replace) the format script block in the bash profile
  bashrcTextContent = prependTextBlock(bashrcTextContent, 'format script', formatScriptBlock);

  // Write back to disk
  writeText(BASE_BASH_SYLE, bashrcTextContent);
}
