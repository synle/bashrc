/** Install immutable upstream skill resources without exposing extra commands or executing downloaded code. */
// SOURCE software/metadata/llm-upstream-skills.common.js

/** @type {string} Shared upstream dependency home, outside native skill discovery roots. */
const LLM_SHARED_UPSTREAM_FOLDER = path.join(LLM_SHARED_ROOT_FOLDER, "upstream");
/** @type {number} Bound concurrent downloads from the public pinned resource list. */
const LLM_UPSTREAM_DOWNLOAD_BATCH_SIZE = 4;
/** @type {number} Maximum accepted individual dependency size. */
const LLM_UPSTREAM_MAX_RESOURCE_BYTES = 8 * 1024 * 1024;

/**
 * Derive a provider's immutable local installation folder.
 * @param {{id: string, revision: string}} source - Validated provider identity.
 * @returns {string} Absolute revision folder; performs no IO.
 */
function getLLMUpstreamSkillFolder(source) {
  return path.join(LLM_SHARED_UPSTREAM_FOLDER, source.id, source.revision);
}

/**
 * Derive adapter path tokens from the single generated provider registry.
 * @returns {Record<string, string>} Provider tokens mapped to revision folders; performs no IO.
 */
function getLLMUpstreamSkillPlaceholders() {
  return Object.fromEntries(
    LLM_UPSTREAM_SKILL_SOURCES.map((source) => [
      `<<UPSTREAM_${source.id.replace(/-/g, "_").toUpperCase()}>>`,
      getLLMUpstreamSkillFolder(source),
    ]),
  );
}

/**
 * Reject malformed provider metadata before any filesystem or network side effect.
 * @param {object[]} sources - Complete provider/resource registry.
 * @returns {void} Validates identities, pinned revisions, safe paths, sizes, hashes, and declared skill bodies.
 * @throws {Error} On an invalid or duplicate provider, resource, or missing skill body.
 */
function validateLLMUpstreamSkillSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) throw new Error("Upstream sources must be a non-empty array");
  /** @type {Set<string>} Provider identities already validated. */
  const identities = new Set();
  for (const source of sources) {
    if (
      !source ||
      typeof source !== "object" ||
      typeof source.id !== "string" ||
      !/^[a-z][a-z0-9-]*$/.test(source.id) ||
      identities.has(source.id)
    ) {
      throw new Error("Upstream provider id must be unique lowercase kebab-case");
    }
    identities.add(source.id);
    if (typeof source.repository !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(source.repository))
      throw new Error(`Invalid upstream repository: ${source.id}`);
    if (typeof source.revision !== "string" || !/^[0-9a-f]{40}$/.test(source.revision))
      throw new Error(`Upstream revision must be a full immutable commit: ${source.id}`);
    if (!Array.isArray(source.skills) || source.skills.length === 0 || !Array.isArray(source.files) || source.files.length === 0)
      throw new Error(`Missing upstream skills or files: ${source.id}`);
    /** @type {Set<string>} Resource paths already validated for this provider. */
    const resources = new Set();
    for (const file of source.files) {
      if (
        !file ||
        typeof file.path !== "string" ||
        file.path.includes(".secret.") ||
        file.path.split("/").some((part) => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part) || part === "credentials") ||
        resources.has(file.path)
      ) {
        throw new Error(`Invalid or duplicate upstream resource path: ${source.id}`);
      }
      if (
        typeof file.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/.test(file.sha256) ||
        !Number.isInteger(file.bytes) ||
        file.bytes < 0 ||
        file.bytes > LLM_UPSTREAM_MAX_RESOURCE_BYTES ||
        typeof file.executable !== "boolean"
      ) {
        throw new Error(`Invalid upstream resource integrity metadata: ${source.id}/${file.path}`);
      }
      resources.add(file.path);
    }
    for (const skill of source.skills) {
      if (
        typeof skill !== "string" ||
        !skill.split("/").every((part) => /^[a-z0-9][a-z0-9-]*$/.test(part)) ||
        !resources.has(`skills/${skill}/SKILL.md`)
      )
        throw new Error(`Missing upstream skill body: ${source.id}/${skill}`);
    }
  }
}

/**
 * Create a managed folder without traversing a symbolic link at that boundary.
 * @param {string} folder - Managed root, provider, or revision folder.
 * @param {"create"|"inspect"} [mode="create"] - Inspect without creating a missing revision.
 * @returns {boolean} Whether a safe folder exists after the operation.
 * @throws {Error} On symbolic links, non-folders, or unexpected filesystem errors.
 */
function ensureLLMUpstreamFolder(folder, mode = "create") {
  try {
    const entry = fs.lstatSync(folder);
    if (entry.isSymbolicLink()) throw new Error(`Upstream folder is a symbolic link: ${folder}`);
    if (!entry.isDirectory()) throw new Error(`Upstream folder is not a folder: ${folder}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (mode === "inspect") return false;
    fs.mkdirSync(folder, { recursive: true });
  }
  return true;
}

/**
 * Verify exact bytes and reject linked or missing resources without modifying them.
 * @param {string} folder - Provider revision or owned staging folder.
 * @param {{files: Array<{path: string, sha256: string, bytes: number}>}} source - Validated provider metadata.
 * @returns {void} Reads only the declared resources.
 * @throws {Error} On integrity mismatch, missing resources, or symbolic-link traversal.
 */
function verifyLLMUpstreamSkillFiles(folder, source) {
  for (const file of source.files) {
    let target = folder;
    try {
      for (const part of file.path.split("/")) {
        target = path.join(target, part);
        if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Upstream resource is a symbolic link: ${file.path}`);
      }
      const entry = fs.statSync(target);
      if (
        !entry.isFile() ||
        entry.size !== file.bytes ||
        crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex") !== file.sha256
      )
        throw new Error(`Upstream integrity mismatch: ${file.path}`);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR")
        throw new Error(`Upstream integrity check found a missing resource: ${file.path}`);
      throw error;
    }
  }
}

/**
 * Install verified pinned resources before any Sy adapter is published.
 * @returns {Promise<Array<{id: string, revision: string, folder: string, status: string}>>} Installed, reused, or dry-run provider records.
 * @throws {Error} On invalid metadata, corrupt existing resources, download failure, or unsafe paths.
 * Writes only owned staging/revision folders and the shared adapter contract; executes no upstream code.
 */
async function deploySharedLLMUpstreamSkills() {
  validateLLMUpstreamSkillSources(LLM_UPSTREAM_SKILL_SOURCES);
  /** @type {Array<{id: string, revision: string, folder: string, status: string}>} Explicit per-provider deployment outcomes. */
  const results = [];
  if (IS_DRY_RUN) {
    for (const source of LLM_UPSTREAM_SKILL_SOURCES)
      results.push({ id: source.id, revision: source.revision, folder: getLLMUpstreamSkillFolder(source), status: "dry-run" });
    log(">> upstream skills: dry-run", results);
    return results;
  }
  ensureLLMUpstreamFolder(LLM_SHARED_UPSTREAM_FOLDER);
  for (const source of LLM_UPSTREAM_SKILL_SOURCES) {
    const parent = path.join(LLM_SHARED_UPSTREAM_FOLDER, source.id);
    const folder = getLLMUpstreamSkillFolder(source);
    ensureLLMUpstreamFolder(parent);
    if (ensureLLMUpstreamFolder(folder, "inspect")) {
      verifyLLMUpstreamSkillFiles(folder, source);
      results.push({ id: source.id, revision: source.revision, folder, status: "verified" });
      continue;
    }
    /** @type {string} Unique run-owned stage; never another invocation's directory. */
    const stage = fs.mkdtempSync(path.join(parent, "staging-"));
    /** @type {Error|undefined} Preserve the original failure if stage cleanup also fails. */
    let failure;
    try {
      for (let offset = 0; offset < source.files.length; offset += LLM_UPSTREAM_DOWNLOAD_BATCH_SIZE) {
        const settled = await Promise.allSettled(
          source.files.slice(offset, offset + LLM_UPSTREAM_DOWNLOAD_BATCH_SIZE).map(async (file) => {
            const destination = path.join(stage, file.path);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            await downloadAsset(`https://raw.githubusercontent.com/${source.repository}/${source.revision}/${file.path}`, destination);
            fs.chmodSync(destination, file.executable ? 0o755 : 0o644);
            return destination;
          }),
        );
        const rejected = settled.find((result) => result.status === "rejected");
        if (rejected) throw rejected.reason;
      }
      verifyLLMUpstreamSkillFiles(stage, source);
      try {
        fs.renameSync(stage, folder);
      } catch (error) {
        if (error.code !== "EEXIST" && error.code !== "ENOTEMPTY") throw error;
        ensureLLMUpstreamFolder(folder);
        verifyLLMUpstreamSkillFiles(folder, source);
      }
      results.push({ id: source.id, revision: source.revision, folder, status: "installed" });
    } catch (error) {
      failure = error;
    }
    try {
      fs.rmSync(stage, { recursive: true, force: true });
    } catch (error) {
      log("WARN upstream stage cleanup failed", stage, error);
      if (!failure) failure = error;
    }
    if (failure) throw failure;
  }
  await writeText(
    path.join(LLM_SHARED_UPSTREAM_FOLDER, "ADAPTERS.md"),
    await readLLMDocSource("software/scripts/advanced/llm/_common/upstream-adapters.common.md"),
  );
  log(">> upstream skills:", results);
  return results;
}
