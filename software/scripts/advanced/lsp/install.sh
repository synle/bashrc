#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
#
# install.sh — Installs language servers for shared use across vim, sublime, zed, vscode.
#
# Three install modes:
#   1. npm_install_global  — for servers shipped to npm (TS, Python pyright, HTML/CSS/JSON/ESLint, etc.)
#   2. GitHub release curl — for standalone Rust/Java/TOML binaries
#   3. go install          — gopls (no standalone release; needs Go toolchain)
#
# Skipped entirely in CI.

# Skip in CI
((IS_CI)) && {
  echo ">>> Skipped : CI"
  exit 0
}

echo '> Installing language servers'

# --- Section 1: npm-based servers ---
# Each call goes through npm_install_global which handles skip-if-installed,
# installs to $HOME/.local, and on WSL also mirrors to the Windows host.
# vscode-langservers-extracted ships four binaries (html/css/json/eslint); we
# probe the html one — if present, all four are.
echo '>> npm-based servers'
npm_install_global typescript
npm_install_global typescript-language-server
npm_install_global vscode-langservers-extracted vscode-html-language-server
npm_install_global pyright pyright-langserver
npm_install_global bash-language-server
npm_install_global yaml-language-server
npm_install_global dockerfile-language-server-nodejs docker-langserver
npm_install_global vscode-markdown-languageserver vscode-markdown-language-server
npm_install_global "@vue/language-server" vue-language-server
npm_install_global "@tailwindcss/language-server" tailwindcss-language-server
npm_install_global graphql-language-service-cli graphql-lsp
npm_install_global "@prisma/language-server" prisma-language-server
npm_install_global sql-language-server

# --- Section 2: GitHub-release standalone binaries ---
# Detect OS + arch once so each tool can pick its release asset.
_lsp_uname_s="$(uname -s)"
_lsp_uname_m="$(uname -m)"
safe_mkdir "$HOME/.local/bin"
safe_mkdir "$HOME/.local/share"

# --- rust-analyzer ---
# Single-binary gunzip; targets per OS+arch. Skip on WSL native side (devs use rustup on Windows).
echo '>> rust-analyzer'
if ((is_os_windows)); then
  echo '>> rust-analyzer >> Skipped (use rustup on Windows host)'
elif has_persistent_binary rust-analyzer && ! is_force_refresh_stale "$(has_persistent_binary rust-analyzer)"; then
  echo '>> rust-analyzer >> Skipped (already installed)'
else
  _ra_target=""
  case "$_lsp_uname_s" in
  Darwin)
    case "$_lsp_uname_m" in
    arm64) _ra_target="aarch64-apple-darwin" ;;
    x86_64) _ra_target="x86_64-apple-darwin" ;;
    esac
    ;;
  Linux)
    case "$_lsp_uname_m" in
    aarch64 | arm64) _ra_target="aarch64-unknown-linux-gnu" ;;
    x86_64) _ra_target="x86_64-unknown-linux-gnu" ;;
    esac
    ;;
  esac
  if [ -z "$_ra_target" ]; then
    echo ">> rust-analyzer >> Skipped (unsupported OS/arch: $_lsp_uname_s/$_lsp_uname_m)"
  else
    _ra_url="https://github.com/rust-lang/rust-analyzer/releases/latest/download/rust-analyzer-${_ra_target}.gz"
    echo -n ">> rust-analyzer >> Installing from $_ra_url >> "
    if curl -fsSL "$_ra_url" | gunzip > "$HOME/.local/bin/rust-analyzer"; then
      safe_chmod +x "$HOME/.local/bin/rust-analyzer"
      echo 'Success'
    else
      echo 'Error'
    fi
  fi
fi

# --- taplo (TOML LS) ---
# Same gunzip flow as rust-analyzer, different target naming convention.
echo '>> taplo'
if ((is_os_windows)); then
  echo '>> taplo >> Skipped (Windows host)'
elif has_persistent_binary taplo && ! is_force_refresh_stale "$(has_persistent_binary taplo)"; then
  echo '>> taplo >> Skipped (already installed)'
else
  _taplo_target=""
  case "$_lsp_uname_s" in
  Darwin)
    case "$_lsp_uname_m" in
    arm64) _taplo_target="darwin-aarch64" ;;
    x86_64) _taplo_target="darwin-x86_64" ;;
    esac
    ;;
  Linux)
    case "$_lsp_uname_m" in
    aarch64 | arm64) _taplo_target="linux-aarch64" ;;
    x86_64) _taplo_target="linux-x86_64" ;;
    esac
    ;;
  esac
  if [ -z "$_taplo_target" ]; then
    echo ">> taplo >> Skipped (unsupported OS/arch: $_lsp_uname_s/$_lsp_uname_m)"
  else
    _taplo_url="https://github.com/tamasfe/taplo/releases/latest/download/taplo-full-${_taplo_target}.gz"
    echo -n ">> taplo >> Installing from $_taplo_url >> "
    if curl -fsSL "$_taplo_url" | gunzip > "$HOME/.local/bin/taplo"; then
      safe_chmod +x "$HOME/.local/bin/taplo"
      echo 'Success'
    else
      echo 'Error'
    fi
  fi
fi

# --- jdtls (Eclipse Java LS) ---
# Tarball, not single binary. Extracted to ~/.local/share/jdtls; thin bash wrapper at
# ~/.local/bin/jdtls invokes java with the right launcher jar + config dir + workspace.
echo '>> jdtls'
_jdtls_root="$HOME/.local/share/jdtls"
if [ -d "$_jdtls_root/plugins" ] && ! is_force_refresh_stale "$_jdtls_root/plugins"; then
  echo '>> jdtls >> Skipped (already installed)'
else
  _jdtls_url="https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz"
  echo -n ">> jdtls >> Installing from $_jdtls_url >> "
  # Clean any prior install so stale plugins don't shadow new ones.
  if [ -d "$_jdtls_root" ]; then
    rm -rf "$_jdtls_root"
  fi
  safe_mkdir "$_jdtls_root"
  if curl -fsSL "$_jdtls_url" | tar -xz -C "$_jdtls_root"; then
    # Write thin launcher to ~/.local/bin/jdtls.
    command cat > "$HOME/.local/bin/jdtls" << 'EOF'
#!/usr/bin/env bash
exec java \
  -Declipse.application=org.eclipse.jdt.ls.core.id1 \
  -Dosgi.bundles.defaultStartLevel=4 \
  -Declipse.product=org.eclipse.jdt.ls.core.product \
  -Dlog.level=ALL \
  -Xms1g -Xmx2G \
  --add-modules=ALL-SYSTEM \
  --add-opens java.base/java.util=ALL-UNNAMED \
  --add-opens java.base/java.lang=ALL-UNNAMED \
  -jar "$HOME/.local/share/jdtls"/plugins/org.eclipse.equinox.launcher_*.jar \
  -configuration "$HOME/.local/share/jdtls/config_$(uname -s | tr '[:upper:]' '[:lower:]')" \
  -data "${1:-$HOME/.cache/jdtls-workspace}" \
  "${@:2}"
EOF
    safe_chmod +x "$HOME/.local/bin/jdtls"
    echo 'Success'
  else
    echo 'Error'
  fi
fi

# --- Section 3: go install fallback for gopls ---
# gopls has no standalone release binary; it ships exclusively via `go install`.
echo '>> gopls (requires Go toolchain)'
if type -P go &> /dev/null; then
  if has_persistent_binary gopls && ! is_force_refresh_stale "$(has_persistent_binary gopls)"; then
    echo '>> gopls >> Skipped (already installed)'
  else
    echo -n '>> gopls >> Installing via go install >> '
    if GOBIN="$HOME/.local/bin" go install golang.org/x/tools/gopls@latest >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo 'Success'
    else
      echo 'Error'
    fi
  fi
else
  echo '>> gopls >> Skipped (no Go toolchain on PATH)'
fi
