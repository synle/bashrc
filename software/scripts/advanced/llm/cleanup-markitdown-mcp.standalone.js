/** Remove legacy MarkItDown MCP registrations after switching to CLI extraction. */

// TODO: Remove this temporary migration after existing machines have run it.
// Run explicitly: ./run --files=cleanup-markitdown-mcp.standalone.js

/**
 * Remove only uvx-launched markitdown-mcp entries from the four known CLI configs.
 * Backs up changed files, preserves unrelated settings, and verifies each write.
 * Missing files and custom entries are skipped; invalid or concurrently changed
 * configs fail without overwriting them. No config values are logged.
 * @returns {Promise<void>} Resolves after all existing configs have been checked.
 * @throws {Error} If parsing, backup, writing, or readback verification fails.
 */
async function doWork() {
  /** @type {Array<[string, string]>} Home-relative config paths and MCP map keys. */
  const targets = [
    [".claude/settings.json", "mcpServers"],
    [".copilot/mcp-config.json", "mcpServers"],
    [".gemini/settings.json", "mcpServers"],
    [".config/opencode/opencode.json", "mcp"],
  ];
  for (const [relativePath, mapKey] of targets) {
    const targetPath = path.join(BASE_HOMEDIR_LINUX, relativePath);
    if (!fs.existsSync(targetPath)) continue;
    const original = fs.readFileSync(targetPath, "utf8");
    let config;
    try {
      config = JSON.parse(original);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error(`Invalid JSON; cleanup left ${relativePath} unchanged`);
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error(`Expected a config object; cleanup left ${relativePath} unchanged`);
    }
    const servers = config[mapKey];
    if (!servers || typeof servers !== "object" || Array.isArray(servers)) continue;
    const entry = servers.markitdown;
    if (!entry || typeof entry !== "object") continue;
    const command = Array.isArray(entry.command) ? entry.command : [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])];
    const binary = typeof command[0] === "string" ? command[0].split(/[\\/]/).pop() : "";
    if (!["uvx", "uvx.exe"].includes(binary) || !command.includes("markitdown-mcp")) {
      log(`>> Preserved custom MarkItDown entry: ${relativePath}`);
      continue;
    }
    delete servers.markitdown;
    await backupConfigFile(targetPath);
    if (fs.readFileSync(targetPath, "utf8") !== original) {
      throw new Error(`Config changed during cleanup; left ${relativePath} unchanged`);
    }
    await writeJson(targetPath, config);
    if (!IS_DRYRUN && JSON.stringify(JSON.parse(fs.readFileSync(targetPath, "utf8"))) !== JSON.stringify(config)) {
      throw new Error(`Cleanup readback mismatch: ${relativePath}`);
    }
    log(`>> Removed legacy MarkItDown MCP entry: ${relativePath}`);
  }
}
