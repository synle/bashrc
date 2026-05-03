/** Configures opencode to use a local Ollama provider, with models discovered from /api/tags. */

/** @type {string} Last-resort host when no candidate responds at `/api/tags`. */
const OPENCODE_OLLAMA_DEFAULT_HOST = "localhost";
/** @type {number} Default Ollama HTTP port (upstream default). */
const OPENCODE_OLLAMA_PORT = 11434;
/** @type {string[]} Fallback model names used when `/api/tags` returns no models (Ollama unreachable, empty install, etc.). */
const OPENCODE_OLLAMA_FALLBACK_MODELS = ["qwen3.6:latest"];

/**
 * Builds the ordered list of host candidates to probe for a reachable Ollama daemon.
 * `localhost` is tried first because it covers the most common cases:
 *   - Native Linux / Mac with Ollama on the same machine.
 *   - WSL2 with mirrored networking (Windows ports reachable via localhost).
 *   - Ollama running inside WSL itself.
 * The WSL→Windows gateway IP is added next for traditional (non-mirrored) WSL2 setups.
 * @returns {string[]} Candidate hosts, in probe order.
 */
function _getOpencodeOllamaHostCandidates() {
  const candidates = ["localhost"];
  if (is_os_wsl) {
    const winHost = getWindowsHostIp();
    if (winHost && !candidates.includes(winHost)) candidates.push(winHost);
  }
  return candidates;
}

/**
 * Probes Ollama's `/api/tags` at `host` and returns the discovered model names.
 * Returns null if the host is unreachable or returns no JSON model list.
 * @param {string} host - Ollama host to probe.
 * @returns {Promise<string[] | null>} Model names on success, null on failure.
 */
async function _probeOpencodeOllamaModels(host) {
  const url = `http://${host}:${OPENCODE_OLLAMA_PORT}/api/tags`;
  log(`>> opencode: probing ${url}`);
  try {
    const json = await readJson`${url}`;
    const tags = Array.isArray(json && json.models) ? json.models : [];
    return tags.map((m) => m && m.name).filter((n) => typeof n === "string" && n);
  } catch {
    return null;
  }
}

/**
 * Iterates candidate hosts and returns the first one that answers `/api/tags`.
 * Falls back to OPENCODE_OLLAMA_DEFAULT_HOST with an empty model list if every
 * candidate fails (caller will then write the OPENCODE_OLLAMA_FALLBACK_MODELS list).
 * @returns {Promise<{host: string, modelNames: string[]}>} Resolved host + discovered models.
 */
async function _resolveOpencodeOllamaHost() {
  for (const host of _getOpencodeOllamaHostCandidates()) {
    const modelNames = await _probeOpencodeOllamaModels(host);
    if (modelNames !== null) return { host, modelNames };
  }
  return { host: OPENCODE_OLLAMA_DEFAULT_HOST, modelNames: [] };
}

/**
 * Builds the opencode config object pointing at a local Ollama instance via the
 * `@ai-sdk/openai-compatible` provider.
 * @param {string} host - Ollama host.
 * @param {string[]} modelNames - Model names; converted to the `{ [name]: {} }` shape opencode expects.
 * @returns {object} The full opencode.json content.
 */
function _buildOpencodeConfig(host, modelNames) {
  const baseURL = `http://${host}:${OPENCODE_OLLAMA_PORT}/v1`;
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
 * Skips when opencode is not installed or when no models are discovered at the resolved host.
 */
async function doWork() {
  if (!(await isBinaryFound("opencode"))) {
    log(">> Skipped opencode: not installed");
    return;
  }

  let { host, modelNames } = await _resolveOpencodeOllamaHost();
  log(">> opencode: using Ollama host", host);

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
