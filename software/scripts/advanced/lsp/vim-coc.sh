#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
#
# vim-coc.sh — Writes ~/.vim/coc-settings.json wiring coc.nvim to shared LSP servers.
#
# The coc.nvim plugin itself is installed by vim-plug (see software/scripts/vim-config.js,
# `Plug 'neoclide/coc.nvim', { 'branch': 'release' }`). vim-plug honors the `branch:` option
# natively, so coc.nvim is fetched directly on the prebuilt `release` branch.
# This script only writes the per-language `languageserver` config that coc.nvim reads to
# know which binaries to spawn for which filetypes. Binary install is handled by
# lsp/install.sh (separate PR) — this script is independent and safe to run before that PR
# lands; coc.nvim simply logs a missing-binary warning when a server is absent.

((IS_CI)) && {
  echo ">>> Skipped : CI"
  exit 0
}

echo '> Writing coc-settings.json for coc.nvim'

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

# NOTE: no print_action_summary call here. That helper lives in profile-core.sh, i.e. it
# only exists inside an interactive ~/.bash_syle shell — setup scripts source
# common-functions.bash instead, so calling it here failed with
# "print_action_summary: command not found" on every run.
#
# Options considered:
#   1. Drop the call; the `>> wrote $_coc_settings` line above already shows the path  <-- CHOSEN
#   2. Mirror print_action_summary into common-functions.bash. Rejected: ~60 lines
#      duplicated byte-for-byte across two files (plus a new parity-spec entry to keep them
#      in sync) to prettify one echo in one script.
