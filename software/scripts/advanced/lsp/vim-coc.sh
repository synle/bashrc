#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
#
# vim-coc.sh — Writes ~/.vim/coc-settings.json wiring coc.nvim to shared LSP servers.
#
# The coc.nvim plugin itself is installed by Vundle (see software/scripts/vim-config.js,
# `Plugin 'neoclide/coc.nvim', { 'branch': 'release' }`). This script only writes the
# per-language `languageserver` config that coc.nvim reads to know which binaries to spawn
# for which filetypes. Binary install is handled by lsp/install.sh (separate PR) — this
# script is independent and safe to run before that PR lands; coc.nvim simply logs a
# missing-binary warning when a server is absent.

((IS_CI)) && {
  echo ">>> Skipped : CI"
  exit 0
}

echo '> Writing coc-settings.json for coc.nvim'

# Force coc.nvim onto the `release` branch. Vundle does NOT honor the `'branch': 'release'`
# option in `Plugin 'neoclide/coc.nvim', { 'branch': 'release' }` (that's a vim-plug feature),
# so Vundle clones the default branch (master), which does NOT ship the prebuilt build/index.js.
# Only the `release` branch carries the compiled artifact. Without this, vim startup errors with
# "[coc.nvim] build/index.js not found, please install dependencies and compile coc.nvim by: npm ci".
_coc_plugin_folder="$HOME/.vim/bundle/coc.nvim"
if [ -d "$_coc_plugin_folder/.git" ]; then
  echo ">> Ensuring coc.nvim is on the release branch ($_coc_plugin_folder)"
  git -C "$_coc_plugin_folder" fetch origin release > /dev/null 2>&1
  git -C "$_coc_plugin_folder" checkout release > /dev/null 2>&1
  git -C "$_coc_plugin_folder" reset --hard origin/release > /dev/null 2>&1
  if [ ! -f "$_coc_plugin_folder/build/index.js" ]; then
    echo ">> WARN: $_coc_plugin_folder/build/index.js still missing after release checkout"
    echo ">>       Try: rm -rf $_coc_plugin_folder && vim -E -s -u ~/.vimrc +PluginInstall +qall"
  fi
else
  echo ">> Skipping coc.nvim branch fix: $_coc_plugin_folder not present yet (run vim-vundle.sh first)"
fi

# Resolve target locations. Vim's coc.nvim reads ~/.vim/coc-settings.json by default.
_coc_folder="$HOME/.vim"
safe_mkdir "$_coc_folder"
_coc_settings="$_coc_folder/coc-settings.json"

# Snapshot prior config before overwriting so the user can diff/restore.
[ -f "$_coc_settings" ] && cp "$_coc_settings" "${_coc_settings}.bak_latest"

command cat > "$_coc_settings" << 'EOF'
{
  "languageserver": {
    "rust": {
      "command": "rust-analyzer",
      "filetypes": ["rust"],
      "rootPatterns": ["Cargo.toml"]
    },
    "go": {
      "command": "gopls",
      "filetypes": ["go"],
      "rootPatterns": ["go.mod"]
    },
    "java": {
      "command": "jdtls",
      "filetypes": ["java"],
      "rootPatterns": ["pom.xml", "build.gradle", ".project"]
    },
    "bash": {
      "command": "bash-language-server",
      "args": ["start"],
      "filetypes": ["sh", "bash"]
    },
    "yaml": {
      "command": "yaml-language-server",
      "args": ["--stdio"],
      "filetypes": ["yaml"]
    },
    "docker": {
      "command": "docker-langserver",
      "args": ["--stdio"],
      "filetypes": ["dockerfile"]
    },
    "graphql": {
      "command": "graphql-lsp",
      "args": ["server", "-m", "stream"],
      "filetypes": ["graphql"]
    },
    "tailwind": {
      "command": "tailwindcss-language-server",
      "args": ["--stdio"],
      "filetypes": ["html", "css", "javascriptreact", "typescriptreact"]
    },
    "taplo": {
      "command": "taplo",
      "args": ["lsp", "stdio"],
      "filetypes": ["toml"]
    }
  }
}
EOF

echo ">> wrote $_coc_settings"

# coc extensions (NOT LSP binary commands) handle: typescript, python, html/css/json,
# eslint, vue, prisma, markdown. coc.nvim installs them on demand via :CocInstall —
# print the recommended one-shot line so the user can copy-paste once after opening vim.
echo '>> Recommended: open vim and run:'
echo '>>   :CocInstall coc-tsserver coc-pyright coc-html coc-css coc-json coc-eslint coc-volar coc-prisma coc-markdownlint'

print_action_summary "$_coc_settings"
