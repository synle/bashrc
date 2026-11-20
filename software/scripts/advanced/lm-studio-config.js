/** Configures the LM Studio local HTTP server when ~/.lmstudio exists. */
/** @type {number} Port forced on the LM Studio HTTP server. */
const LM_STUDIO_HTTP_SERVER_PORT = 1234;

/** @type {object} Full config written when LM Studio has no HTTP server config yet. */
const LM_STUDIO_HTTP_SERVER_DEFAULTS = json`
  {
    "autoStartOnLaunch": true,
    "port": 1234,
    "cors": true,
    "logSensitiveData": true,
    "logIncomingTokens": false,
    "verbose": true,
    "logLinesLimit": 500,
    "networkInterface": "127.0.0.1",
    "justInTimeModelLoading": true,
    "fileLoggingMode": "succinct"
  }
`;

/**
 * Enables the LM Studio HTTP server config without disturbing unrelated keys.
 * Skips cleanly when ~/.lmstudio is absent. Existing configs keep every field
 * except `port` and `cors`; an unparseable config is left untouched.
 * @returns {Promise<void>}
 */
async function doWork() {
  const lmStudioFolder = path.join(BASE_HOMEDIR_LINUX, ".lmstudio");
  if (!pathExists(lmStudioFolder, undefined, "folder")) {
    throw new ScriptSkipError(`LM Studio config skipped: no folder at ${lmStudioFolder}`);
  }

  const internalFolder = path.join(lmStudioFolder, ".internal");
  if (!pathExists(internalFolder, undefined, "folder")) {
    await mkdir(internalFolder);
  }

  const configPath = path.join(internalFolder, "http-server-config.json");
  if (!pathExists(configPath, undefined, "file")) {
    await writeJson(configPath, LM_STUDIO_HTTP_SERVER_DEFAULTS);
    log(">>> LM Studio HTTP server config created:", configPath);
    return;
  }

  const existingText = (await readText`${configPath}`).trim();
  /** @type {object} Existing config parsed from disk. */
  let existing;
  try {
    existing = JSON.parse(existingText);
  } catch (e) {
    throw new Error(`LM Studio config left unchanged; cannot parse ${configPath}: ${e.message}`);
  }
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    throw new Error(`LM Studio config left unchanged; expected a JSON object at ${configPath}`);
  }

  if (existing.port === LM_STUDIO_HTTP_SERVER_PORT && existing.cors === true) {
    log(">>> LM Studio HTTP server config already correct:", configPath);
    return;
  }

  await backupConfigFile(configPath);
  await writeJson(configPath, { ...existing, port: LM_STUDIO_HTTP_SERVER_PORT, cors: true });
  log(">>> LM Studio HTTP server config updated:", configPath);
}
