/** Pull the Ollama models for this host's VRAM tier through the daemon's HTTP API, in the background. */

// SOURCE software/scripts/advanced/llm/llm-common.js

/**
 * Ollama daemon base URL. On WSL this reaches the Windows host install (winget
 * Ollama.Ollama, OLLAMA_HOST=0.0.0.0:11434 set by windows/_full-setup.ps1.bash)
 * through the WSL2 bridge, so no Linux `ollama` binary is needed anywhere.
 * @type {string}
 */
const OLLAMA_MODELS_API_URL = `http://127.0.0.1:${OLLAMA_PORT}`;

/**
 * Case-insensitive hostname marker a Mac must carry to auto-pull — local personal
 * Mac bootstrap only; managed Macs never download multi-GB models.
 * @type {string}
 */
const OLLAMA_MODELS_MAC_HOSTNAME_MARKER = ".local";

/**
 * Allowlist for a tag interpolated into the background shell command. Real tags are
 * `name:tag` built from letters, digits, `.`, `_`, `-`, `/` — anything else is rejected
 * rather than quoted.
 * @type {RegExp}
 */
const OLLAMA_MODEL_TAG_PATTERN = /^[A-Za-z0-9._/-]+(:[A-Za-z0-9._-]+)?$/;

/**
 * Default agent model for the default Ollama server: the first `agent` model of the
 * largest tier in OLLAMA_MODELS_BY_VRAM.
 * @returns {string} Model tag.
 * @throws {Error} When the largest tier has no agent model.
 */
function _getOllamaDefaultAgentModel() {
  const agent = OLLAMA_MODELS_BY_VRAM[0].models.find((m) => m.role === "agent");
  if (!agent) throw new Error(`ollama: tier '${OLLAMA_MODELS_BY_VRAM[0].id}' has no agent model`);
  return agent.tag;
}

/**
 * Skips hosts that must not pull: CI, dry runs, Termux, GPU-less boxes, and Macs
 * that are not a personal `.local` host.
 * @throws {ScriptSkipError} When this host should not pull models.
 */
function _exitIfOllamaModelPullUnsupported() {
  if (IS_CI) throw new ScriptSkipError("ollama model pull: CI");
  if (IS_DRY_RUN) throw new ScriptSkipError("ollama model pull: dry run (multi-GB downloads)");
  exitIfUnsupportedOs("is_os_android_termux");
  if (!is_system_gpu) throw new ScriptSkipError("ollama model pull: no GPU detected");

  if (is_os_mac) {
    const hostname = os.hostname().toLowerCase();
    if (!hostname.includes(OLLAMA_MODELS_MAC_HOSTNAME_MARKER)) {
      throw new ScriptSkipError(
        `ollama model pull: only applicable to personal Macs (hostname containing '${OLLAMA_MODELS_MAC_HOSTNAME_MARKER}'); this host is '${hostname}'`,
      );
    }
  }
}

/**
 * Lists the model tags the daemon already has.
 * @returns {Promise<string[]|null>} Installed tags, or null when the daemon is unreachable.
 */
async function _fetchInstalledOllamaModels() {
  try {
    const json = await readJson`${OLLAMA_MODELS_API_URL}/api/tags`;
    if (!json || !Array.isArray(json.models)) return null;
    return json.models.map((m) => m && m.name).filter((n) => typeof n === "string" && n);
  } catch (err) {
    log(">> ollama model pull: /api/tags failed", err);
    return null;
  }
}

/**
 * Builds the detached bash that pulls every tag in parallel. Each tag is its own
 * background `curl` to `/api/pull` with `stream:false` (blocks until done); the outer
 * subshell `wait`s and appends one line per tag to `logPath`. All fds are redirected,
 * so the caller's exec returns immediately and run.sh never blocks on the download.
 * Blobs are content-addressed: a re-run skips finished layers and resumes partials.
 * @param {string[]} tags - Model tags to pull.
 * @param {string} logPath - Absolute log file path.
 * @returns {string} A bash command line.
 * @throws {Error} When a tag fails OLLAMA_MODEL_TAG_PATTERN.
 */
function _buildOllamaBackgroundPullCommand(tags, logPath) {
  const unsafe = tags.filter((tag) => !OLLAMA_MODEL_TAG_PATTERN.test(tag));
  if (unsafe.length > 0) throw new Error(`ollama model pull: refusing unsafe model tag(s): ${unsafe.join(", ")}`);
  const pulls = tags
    .map((tag) => {
      // CLI equivalent: ollama pull <tag>
      const body = JSON.stringify({ model: tag, stream: false });
      return `( if curl -fsS -X POST '${OLLAMA_MODELS_API_URL}/api/pull' -d '${body}' > /dev/null; then echo "$(date '+%H:%M:%S') done: ${tag}"; else echo "$(date '+%H:%M:%S') FAILED: ${tag}"; fi ) &`;
    })
    .join("\n");
  return `(\n${pulls}\nwait\necho "$(date '+%H:%M:%S') all ollama pulls finished"\n) < /dev/null >> "${logPath}" 2>&1 &`;
}

/**
 * Registers the OLLAMA_DEFAULT_MODEL profile block (every host), then
 * resolves this host's VRAM tier from `system_gpu_vram_mib` and starts background
 * pulls for every tier model the daemon does not already have. Side effect: spawns
 * detached curl processes and appends to `$BASHRC_TEMP_DIR/ollama-pull.log`.
 * @returns {Promise<void>}
 * @throws {ScriptSkipError} When the host is gated out or the daemon is unreachable.
 */
async function doWork() {
  // Registered before the pull gates: every host needs the default (claude_local on a
  // laptop still targets the default server), not only hosts that pull models themselves.
  registerWithBashSyleProfile(
    "ollama default model",
    `export OLLAMA_DEFAULT_MODEL="\${OLLAMA_DEFAULT_MODEL:-${_getOllamaDefaultAgentModel()}}"`,
  );

  _exitIfOllamaModelPullUnsupported();

  const tier = getOllamaVramTier(system_gpu_vram_mib);
  const wanted = getOllamaModelsForVram(system_gpu_vram_mib);
  log(`>> ollama model pull: ${system_gpu_vram_mib} MiB VRAM (0 = unknown) → ${tier.id} tier (${tier.description})`);

  const installed = await _fetchInstalledOllamaModels();
  if (installed === null) {
    throw new ScriptSkipError(`ollama model pull: daemon not reachable at ${OLLAMA_MODELS_API_URL}`);
  }

  // Exact tag match, so one quant or size never suppresses another in the same family.
  const missing = wanted.filter((tag) => !installed.includes(tag));
  for (const tag of wanted.filter((t) => installed.includes(t))) {
    log(`>> ollama model pull: ${tag} already present`);
  }
  if (missing.length === 0) return;

  const logPath = path.join(BASHRC_TEMP_DIR, "ollama-pull.log");
  log(`>> ollama model pull: ${missing.length} model(s) in background: ${missing.join(", ")}`);
  log(`>> ollama model pull: progress → tail -f "${logPath}"`);
  await execBash(_buildOllamaBackgroundPullCommand(missing, logPath));
}
