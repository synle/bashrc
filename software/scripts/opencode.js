/** Configures opencode to use a local Ollama provider, with models discovered from /api/tags. */

/** @type {string} Fallback Ollama host when not running in WSL (or when the WSL gateway lookup fails). */
const OPENCODE_OLLAMA_DEFAULT_HOST = "192.168.1.1";
/** @type {number} Default Ollama HTTP port (upstream default). */
const OPENCODE_OLLAMA_PORT = 11434;
/** @type {string[]} Fallback model names used when `/api/tags` returns no models (Ollama unreachable, empty install, etc.). */
const OPENCODE_OLLAMA_FALLBACK_MODELS = ["qwen3.6:latest"];

/**
 * Resolves the host running Ollama as seen from this machine.
 * - WSL → Windows host IP from `getWindowsHostIp()`.
 * - Anything else (incl. WSL with no detectable gateway) → OPENCODE_OLLAMA_DEFAULT_HOST.
 * @returns {string} Hostname or IPv4 address of the Ollama server.
 */
function _getOpencodeOllamaHost() {
  if (is_os_wsl) {
    const winHost = getWindowsHostIp();
    if (winHost) return winHost;
  }
  return OPENCODE_OLLAMA_DEFAULT_HOST;
}

/**
 * Fetches the installed model names from Ollama's `/api/tags`.
 * Returns an empty array on fetch failure or empty list.
 * @param {string} host - Ollama host.
 * @returns {Promise<string[]>} Model names (e.g. ["qwen3.6:latest"]).
 */
async function _fetchOpencodeOllamaModels(host) {
  const url = `http://${host}:${OPENCODE_OLLAMA_PORT}/api/tags`;
  log(`>> opencode: getting models from ${url} (curl ${url})`);
  const json = await readJson`${url}`;
  const tags = Array.isArray(json && json.models) ? json.models : [];
  return tags.map((m) => m && m.name).filter((n) => typeof n === "string" && n);
}

/**
 * Builds the opencode config object pointing at a local Ollama instance via the
 * `@ai-sdk/openai-compatible` provider.
 * @param {string} host - Ollama host.
 * @param {string[]} modelNames - Model names; converted to the `{ [name]: {} }` shape opencode expects.
 * @returns {object} The full opencode.json content.
 */
function _buildOpencodeConfig(host, modelNames) {
  return {
    $schema: "https://opencode.ai/config.json",
    provider: {
      ollama: {
        npm: "@ai-sdk/openai-compatible",
        name: "Ollama (Windows)",
        options: {
          baseURL: `http://${host}:${OPENCODE_OLLAMA_PORT}/v1`,
        },
        models: Object.fromEntries(modelNames.map((n) => [n, {}])),
      },
    },
  };
}

/**
 * Writes ~/.config/opencode/opencode.json wired to a local Ollama instance.
 * Skips when opencode is not installed or when no models are discovered at the resolved host.
 */
async function doWork() {
  if (!(await isBinaryFound("opencode"))) {
    log(">> Skipped opencode: not installed");
    return;
  }

  const host = _getOpencodeOllamaHost();
  log(">> opencode: using Ollama host", host);

  let modelNames = await _fetchOpencodeOllamaModels(host);
  if (modelNames.length === 0) {
    log(`WARN opencode: no models reachable at http://${host}:${OPENCODE_OLLAMA_PORT}/api/tags — falling back to ${OPENCODE_OLLAMA_FALLBACK_MODELS.join(", ")}`);
    modelNames = OPENCODE_OLLAMA_FALLBACK_MODELS;
  } else {
    log(`>> opencode: discovered ${modelNames.length} model(s): ${modelNames.join(", ")}`);
  }

  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".config/opencode/opencode.json");
  await mkdir(path.dirname(targetPath));
  await backupConfigFile(targetPath);
  await writeJson(targetPath, _buildOpencodeConfig(host, modelNames));
  log(">> opencode config written:", targetPath);

  // WSL points opencode at the Windows host, so the user has to start Ollama
  // on Windows before the model calls work — call that out here.
  if (is_os_wsl) {
    log(">> opencode / windows: launch Ollama on Windows, then run `opencode` in WSL");
  }
}
