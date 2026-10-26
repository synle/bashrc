# --- Base85 ---
# The npm package is a module without a CLI; this shared function keeps its
# encoded output byte-exact instead of sending it through snip's output filter.
_BASE85_NPM_PACKAGE="base85@3.2.0"

# _ensure_base85_module: prompt-install the pinned npm module when it is missing.
# Returns 0 when the module is present, 1 when installation is declined or fails,
# and 127 when npm is unavailable.
function _ensure_base85_module() {
  local module_path="$HOME/.local/lib/node_modules/base85"
  [ -f "$module_path/package.json" ] && return 0

  if ! type -P npm > /dev/null 2>&1; then
    echo "base85: npm not found on PATH; cannot install the Base85 module" >&2
    return 127
  fi
  if ! prompt_yes_no "base85 is not installed. Install it via npm?"; then
    echo "base85: installation declined" >&2
    return 1
  fi

  WSLENV="${WSLENV:+$WSLENV:}npm_config_ignore_scripts/w" npm_config_ignore_scripts=true \
    _snip_run npm install -g --prefix "$HOME/.local" --ignore-scripts \
    --no-audit --no-fund --no-update-notifier --prefer-offline "$_BASE85_NPM_PACKAGE"
  local status=$?
  if [ "$status" -ne 0 ]; then
    return "$status"
  fi
  if [ ! -f "$module_path/package.json" ]; then
    echo "base85: npm install completed but the module is missing from '$module_path'" >&2
    return 1
  fi
}

# base85: encode one or more files, or stdin, as unframed ASCII85.
# Returns the Node process status; file-read or encoding failures return 1.
function base85() {
  if is_help_arg "${1:-}"; then
    echo "base85: encode files or stdin as Base85
  Usage: base85 [FILE ...]
  With no files, reads stdin. Use '-' to read stdin in a file list.
  Multiple files are concatenated in order. Output uses the unframed a85 alphabet.
  Examples:
    base85 file1
    cat file1 | base85
    paste | base85"
    return 0
  fi
  if [ "${1:-}" = "--" ]; then
    shift
  fi

  _snip_require_binary node || return 127
  _ensure_base85_module || return $?

  local module_path="$HOME/.local/lib/node_modules/base85" encoder_js
  IFS= read -r -d '' encoder_js << '_BASE85_ENCODER_EOF_' || true
const fs = require('fs');
try {
  const base85 = require(process.env.BASE85_MODULE_PATH);
  const inputs = process.argv.slice(1);
  const sources = inputs.length ? inputs : ['-'];
  const buffers = sources.map(source => source === '-' ? fs.readFileSync(0) : fs.readFileSync(source));
  const encoded = base85.encode(Buffer.concat(buffers), 'a85');
  if (encoded === false) throw new Error('encoding failed');
  process.stdout.write(encoded + '\n');
} catch (error) {
  process.stderr.write('base85: failed to read or encode input\n');
  process.exitCode = 1;
}
_BASE85_ENCODER_EOF_
  BASE85_MODULE_PATH="$module_path" command node -e "$encoder_js" "$@"
}
