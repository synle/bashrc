# _llm_clear_and_reset_all_settings: reset one client's global configuration and instructions after confirmation.
# Arguments: client name. Returns nonzero on cancellation, invalid targets, or IO failure.
# Backs up existing files beside each target; preserves credentials, sessions, skills, and plugins.
function _llm_clear_and_reset_all_settings() {
  local cli="$1"
  shift
  if is_help_arg "${1:-}"; then
    printf '%s\n' "${cli}_clear_and_reset_all_settings: empty global configuration and instructions
Usage: ${cli}_clear_and_reset_all_settings

Resets settings, keybindings, custom models, MCP registrations, and global instructions.
MCP reset includes Captain. Claude's mixed state file retains every key except mcpServers.
Credentials, sessions, shared skills, plugins, and extensions remain.
Existing files receive unique .reset-backup-* copies beside their originals.
Close the client before resetting. Restart afterward; rerun its setup to restore Sy defaults."
    return 0
  fi
  if [ "$#" -ne 0 ]; then
    printf '%s\n' "Unexpected reset arguments; use --help." >&2
    return 1
  fi
  type -P node > /dev/null 2>&1 || {
    printf '%s\n' 'Reset requires Node.js.' >&2
    return 1
  }
  prompt_yes_no "Reset $cli global config and instructions, including all MCP registrations? Backups retained; credentials and sessions preserved." n || return 1
  local js
  IFS= read -r -d '' js << 'JS_EOF' || true
const fs = require("fs");
const path = require("path");
const [client, home] = process.argv.slice(1);
/** Exact home-relative configuration targets; credential stores and session databases are excluded. */
const targets = {
  claude: [".claude/settings.json", ".claude/keybindings.json", ".claude/CLAUDE.md", ".claude.json"],
  copilot: [".copilot/settings.json", ".copilot/mcp-config.json", ".copilot/copilot-instructions.md"],
  gemini: [".gemini/settings.json", ".gemini/keybindings.json", ".gemini/GEMINI.md"],
  opencode: [".config/opencode/opencode.json", ".config/opencode/opencode.jsonc", ".config/opencode/tui.json", ".config/opencode/AGENTS.md"],
  pi: [".pi/agent/settings.json", ".pi/agent/keybindings.json", ".pi/agent/models.json", ".pi/agent/mcp.json", ".pi/agent/AGENTS.md", ".pi/agent/APPEND_SYSTEM.md"],
};
try {
  if (!Object.prototype.hasOwnProperty.call(targets, client)) throw new Error("Unknown reset client");
  const root = fs.realpathSync(home);
  const pending = targets[client].map(relative => {
    const file = path.join(root, relative);
    // Never follow config symlinks into shared guidance or credential stores.
    let ancestor = file;
    while (ancestor !== root) {
      let stat;
      try {
        stat = fs.lstatSync(ancestor);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (stat && stat.isSymbolicLink()) throw new Error("Reset target contains a symlink");
      ancestor = path.dirname(ancestor);
    }
    const exists = fs.existsSync(file);
    if (exists && !fs.statSync(file).isFile()) throw new Error("Reset target must be a regular file");
    const original = exists ? fs.readFileSync(file) : null;
    let content = relative.endsWith(".md") ? "" : "{}\n";
    if (relative === ".claude.json") {
      if (!exists) return null;
      const state = JSON.parse(original.toString("utf8"));
      if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("Claude state must be an object");
      state.mcpServers = {};
      content = JSON.stringify(state, null, 2) + "\n";
    }
    return { file, original, content };
  }).filter(Boolean);
  // Validate every target before the first backup or reset.
  for (const { file, original, content } of pending) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Reject concurrent config changes rather than overwriting state read during preflight.
    if (original !== null && !fs.readFileSync(file).equals(original)) throw new Error("Reset target changed during preflight");
    if (original !== null) {
      const backup = file + ".reset-backup-" + Date.now() + "-" + process.pid;
      fs.writeFileSync(backup, original, { flag: "wx", mode: 0o600 });
    }
    const flags = fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW |
      (original === null ? fs.constants.O_CREAT | fs.constants.O_EXCL : 0);
    const descriptor = fs.openSync(file, flags, 0o600);
    try {
      fs.ftruncateSync(descriptor, 0);
      fs.writeFileSync(descriptor, content);
    } finally {
      fs.closeSync(descriptor);
    }
    process.stdout.write("Reset: " + file + "\n");
  }
} catch (error) {
  // Parser errors can contain credentials; report no raw values or exception text.
  process.stderr.write("Reset failed: invalid target, malformed Claude state, or filesystem error. Prior files have backups if reset started.\n");
  process.exitCode = 1;
}
JS_EOF
  command node -e "$js" "$cli" "$HOME"
}

# Register reset commands from the same supported-client inventory as skill dispatchers.
for _llm_reset_cli in "${_SY_SUPPORTED_LLMS[@]}"; do
  eval "function ${_llm_reset_cli}_clear_and_reset_all_settings() { _llm_clear_and_reset_all_settings '${_llm_reset_cli}' \"\$@\"; }"
done
unset _llm_reset_cli
