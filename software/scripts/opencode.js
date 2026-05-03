/** Configures opencode to use a local Ollama provider, with models discovered from /api/tags. */

/** @type {string} Host running Ollama. Always localhost — works on native Linux/Mac, WSL2 mirrored networking, and Ollama-in-WSL. */
const OPENCODE_OLLAMA_HOST = "localhost";
/** @type {number} Default Ollama HTTP port (upstream default). */
const OPENCODE_OLLAMA_PORT = 11434;
/** @type {string[]} Fallback model names used when `/api/tags` returns no models (Ollama unreachable, empty install, etc.). */
const OPENCODE_OLLAMA_FALLBACK_MODELS = ["qwen3.6:latest"];

/**
 * Fetches the installed model names from Ollama's `/api/tags`.
 * Returns an empty array on fetch failure or empty list.
 * @returns {Promise<string[]>} Model names (e.g. ["qwen3.6:latest"]).
 */
async function _fetchOpencodeOllamaModels() {
  const url = `http://${OPENCODE_OLLAMA_HOST}:${OPENCODE_OLLAMA_PORT}/api/tags`;
  log(`>> opencode: getting models from ${url} (curl ${url})`);
  try {
    const json = await readJson`${url}`;
    const tags = Array.isArray(json && json.models) ? json.models : [];
    return tags.map((m) => m && m.name).filter((n) => typeof n === "string" && n);
  } catch {
    return [];
  }
}

/**
 * Builds the opencode config object pointing at a local Ollama instance via the
 * `@ai-sdk/openai-compatible` provider.
 * @param {string[]} modelNames - Model names; converted to the `{ [name]: {} }` shape opencode expects.
 * @returns {object} The full opencode.json content.
 */
function _buildOpencodeConfig(modelNames) {
  const baseURL = `http://${OPENCODE_OLLAMA_HOST}:${OPENCODE_OLLAMA_PORT}/v1`;
  return {
    $schema: "https://opencode.ai/config.json",
    provider: {
      ollama: {
        npm: "@ai-sdk/openai-compatible",
        name: `Ollama (local - ${baseURL})`,
        options: {
          baseURL,
        },
        models: Object.fromEntries(modelNames.map((n) => [n, {}])),
      },
    },
  };
}

/**
 * Writes ~/.config/opencode/opencode.json wired to a local Ollama instance.
 * Skips when opencode is not installed.
 */
async function doWork() {
  if (!(await isBinaryFound("opencode"))) {
    log(">> Skipped opencode: not installed");
    return;
  }

  let modelNames = await _fetchOpencodeOllamaModels();
  if (modelNames.length === 0) {
    log(
      `WARN opencode: no models reachable at http://${OPENCODE_OLLAMA_HOST}:${OPENCODE_OLLAMA_PORT}/api/tags — falling back to ${OPENCODE_OLLAMA_FALLBACK_MODELS.join(", ")}`,
    );
    modelNames = OPENCODE_OLLAMA_FALLBACK_MODELS;
  } else {
    log(`>> opencode: discovered ${modelNames.length} model(s): ${modelNames.join(", ")}`);
  }

  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".config/opencode/opencode.json");
  await mkdir(path.dirname(targetPath));
  await backupConfigFile(targetPath);
  await writeJson(targetPath, _buildOpencodeConfig(modelNames));
  log(">> opencode config written:", targetPath);
}
