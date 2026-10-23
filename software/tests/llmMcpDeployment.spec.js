/** Verifies shared MCP deployment through native setup destinations and safe additive writes. */
import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchResponses,
  fileSystem,
  getIndexConstant,
  getIndexFunction,
  loadScriptHelpers,
  mockFsExistence,
  setSandboxGlobal,
} from "./setup.js";

/** Original backup implementation, restored after safety-test spies. */
const ORIGINAL_BACKUP = getIndexFunction("backupConfigFile");

/** Registry fixture with a platform-specific local server and an HTTP server. */
const REGISTRY = {
  mcpServers: {
    browser: { command: "npx", args: ["browser", "--headless"], argsOnMac: ["browser"], env: { MODE: "test" } },
    docs: { type: "http", url: "https://example.com/mcp" },
  },
};

/** Native user destinations; these expectations come from each client's config contract. */
const CLIENTS = [
  { cli: "pi", target: "/mock/home/.pi/agent/mcp.json", key: "mcpServers" },
  { cli: "claude", target: "/mock/home/.claude.json", key: "mcpServers" },
  { cli: "copilot", target: "/mock/home/.copilot/mcp-config.json", key: "mcpServers" },
  { cli: "gemini", target: "/mock/home/.gemini/settings.json", key: "mcpServers" },
  { cli: "opencode", target: "/mock/home/.config/opencode/opencode.json", key: "mcp" },
];

/** Checked-in registry, used to verify requested servers rather than only synthetic fixtures. */
const SHIPPED_REGISTRY = JSON.stringify(
  getIndexFunction("parseJsonWithComments")(readFileSync("software/scripts/advanced/llm/_common/mcp-servers.jsonc", "utf8")),
);

/** Independent native config expectations for the managed MCP launchers. */
const REQUESTED_SERVERS = {
  mcpServers: {
    codegraph: { command: "codegraph", args: ["serve", "--mcp"], env: { CODEGRAPH_TELEMETRY: "0" } },
    context7: {
      command: "npx",
      args: ["-y", "@upstash/context7-mcp@latest"],
      env: { npm_config_ignore_scripts: "true", OTEL_SDK_DISABLED: "true" },
    },
    anydoc: {
      command: "npx",
      args: ["-y", "mcp-server-anydoc@latest"],
      env: { npm_config_ignore_scripts: "true" },
    },
  },
  mcp: {
    codegraph: { type: "local", command: ["codegraph", "serve", "--mcp"], environment: { CODEGRAPH_TELEMETRY: "0" }, enabled: true },
    context7: {
      type: "local",
      command: ["npx", "-y", "@upstash/context7-mcp@latest"],
      environment: { npm_config_ignore_scripts: "true", OTEL_SDK_DISABLED: "true" },
      enabled: true,
    },
    anydoc: {
      type: "local",
      command: ["npx", "-y", "mcp-server-anydoc@latest"],
      environment: { npm_config_ignore_scripts: "true" },
      enabled: true,
    },
  },
};

/** Unrelated deployment seams stubbed so entry-point tests exercise real MCP IO only. */
const OTHER_DEPLOYMENTS = [
  "deploySharedLLMInstructions",
  "deploySharedLLMSkills",
  "deploySharedLLMAgents",
  "_doSettingsWork",
  "_doKeysWork",
  "_doInstructionsWork",
  "_doCopilotSettingsWork",
  "_doCopilotKeysWork",
  "_doCopilotInstructionsWork",
  "_doCopilotTweaksWork",
  "_doCopilotPersonaHookWork",
  "_doGeminiKeysWork",
  "_doGeminiInstructionsWork",
  "_doGeminiPersonaHookWork",
  "_doPiSettingsWork",
  "_doPiModelsWork",
  "_doPiInstructionsWork",
  "_doPiAppendSystemWork",
  "_doPiPersonaExtensionWork",
  "_doPiToolOutputExtensionWork",
  "_ensureOpencodeAuthSymlink",
  "_writeOpencodeTuiConfig",
  "_doOpencodeInstructionsWork",
  "_doOpencodePersonaPluginWork",
  "_syncOpencodeCommandSymlinks",
  "_syncOpencodeSkillCommandSymlinks",
];

/** Loads one real setup entry point while isolating non-MCP side effects.
 * @param {string} cli - Client folder name.
 * @returns {void}
 */
function loadClient(cli) {
  loadScriptHelpers(`software/scripts/advanced/llm/${cli}/setup.js`);
  for (const name of OTHER_DEPLOYMENTS) setSandboxGlobal(name, async () => {});
  setSandboxGlobal("isBinaryFound", async () => true);
  setSandboxGlobal("getOllamaProviderInputs", async () => []);
  setSandboxGlobal("getSharedLLMInstructionFilePaths", () => []);
  mockFsExistence["/mock/home/.claude"] = true;
}

beforeEach(() => {
  setSandboxGlobal("backupConfigFile", ORIGINAL_BACKUP);
  setSandboxGlobal("is_os_mac", false);
  setSandboxGlobal("is_os_wsl", false);
  fetchResponses["software/scripts/advanced/llm/_common/mcp-servers.jsonc"] = JSON.stringify(REGISTRY);
});

describe.each(CLIENTS)("$cli native MCP deployment", ({ cli, target, key }) => {
  it("writes managed servers, preserves user-only entries, and remains stable on rerun", async () => {
    loadClient(cli);
    mockFsExistence[target] = true;
    fileSystem[target] = JSON.stringify({
      customSetting: "kept",
      [key]: { personal: { command: "personal-server" }, browser: { command: "old-server" } },
    });

    await getIndexFunction("doWork")();

    const result = JSON.parse(fileSystem[target]);
    expect(result.customSetting).toBe("kept");
    expect(result[key]).toEqual(
      cli === "opencode"
        ? {
            personal: { command: "personal-server" },
            browser: { type: "local", command: ["npx", "browser", "--headless"], environment: { MODE: "test" }, enabled: true },
            docs: { type: "remote", url: "https://example.com/mcp", enabled: true },
          }
        : {
            personal: { command: "personal-server" },
            browser: { command: "npx", args: ["browser", "--headless"], env: { MODE: "test" } },
            docs: { type: "http", url: "https://example.com/mcp" },
          },
    );
    const first = fileSystem[target];
    await getIndexFunction("doWork")();
    expect(fileSystem[target]).toBe(first);
  });

  it.each([false, true])("deploys shipped CodeGraph, Context7, and AnyDoc servers safely and idempotently (macOS: %s)", async (isMac) => {
    loadClient(cli);
    setSandboxGlobal("is_os_mac", isMac);
    fetchResponses["software/scripts/advanced/llm/_common/mcp-servers.jsonc"] = SHIPPED_REGISTRY;
    mockFsExistence[target] = true;
    fileSystem[target] = JSON.stringify({
      customSetting: "kept",
      [key]: { personal: { command: "personal-server" }, context7: { command: "old-server" } },
    });

    await getIndexFunction("doWork")();

    const result = JSON.parse(fileSystem[target]);
    expect(result.customSetting).toBe("kept");
    expect(Object.keys(result[key]).sort()).toEqual(["anydoc", "codegraph", "context7", "personal", "playwright"]);
    expect(result[key].codegraph).toEqual(REQUESTED_SERVERS[key].codegraph);
    expect(result[key].personal).toEqual({ command: "personal-server" });
    expect(result[key].context7).toEqual(REQUESTED_SERVERS[key].context7);
    expect(result[key].anydoc).toEqual(REQUESTED_SERVERS[key].anydoc);
    const first = fileSystem[target];
    await getIndexFunction("doWork")();
    expect(fileSystem[target]).toBe(first);
  });

  it("rejects malformed native config before any setup writer replaces it", async () => {
    loadClient(cli);
    mockFsExistence[target] = true;
    fileSystem[target] = "{broken";
    await expect(getIndexFunction("doWork")()).rejects.toThrow();
    expect(fileSystem[target]).toBe("{broken");
  });

  it("creates the native config on a first run", async () => {
    loadClient(cli);
    await getIndexFunction("doWork")();
    expect(JSON.parse(fileSystem[target])[key].browser).toEqual(
      cli === "opencode"
        ? { type: "local", command: ["npx", "browser", "--headless"], environment: { MODE: "test" }, enabled: true }
        : { command: "npx", args: ["browser", "--headless"], env: { MODE: "test" } },
    );
  });

  it("preserves user servers when the registry is empty", async () => {
    loadClient(cli);
    fetchResponses["software/scripts/advanced/llm/_common/mcp-servers.jsonc"] = '{"mcpServers":{}}';
    mockFsExistence[target] = true;
    fileSystem[target] = JSON.stringify({ [key]: { personal: { command: "personal-server" } } });
    await getIndexFunction("doWork")();
    expect(JSON.parse(fileSystem[target])[key]).toEqual({ personal: { command: "personal-server" } });
  });
});

describe("shared MCP write safety", () => {
  beforeEach(() => loadClient("pi"));

  it.each(["ENOENT", "EACCES"])("handles file read failure %s without dropping an existing config", async (code) => {
    const read = vi.spyOn(getIndexConstant("fs"), "readFileSync").mockImplementation(() => {
      throw Object.assign(new Error("read failed"), { code });
    });
    const backup = vi.fn();
    setSandboxGlobal("backupConfigFile", backup);
    try {
      if (code === "ENOENT") {
        await getIndexFunction("deploySharedMcpServers")("/mock/mcp.json");
        expect(JSON.parse(fileSystem["/mock/mcp.json"]).mcpServers.browser.command).toBe("npx");
      } else {
        await expect(getIndexFunction("deploySharedMcpServers")("/mock/mcp.json")).rejects.toMatchObject({ code });
        expect(fileSystem["/mock/mcp.json"]).toBeUndefined();
        expect(backup).not.toHaveBeenCalled();
      }
    } finally {
      read.mockRestore();
    }
  });

  it("rejects JavaScript expressions without evaluating them", async () => {
    setSandboxGlobal("mcpExecuted", false);
    fileSystem["/mock/mcp.json"] = '{"mcpServers": (global.mcpExecuted = true, {})}';
    await expect(getIndexFunction("deploySharedMcpServers")("/mock/mcp.json")).rejects.toThrow("valid JSON or JSONC");
    expect(getIndexFunction("mcpExecuted")).toBe(false);
  });

  it("rejects an unsupported format without writing", async () => {
    await expect(getIndexFunction("deploySharedMcpServers")("/mock/mcp.json", {}, "unknown")).rejects.toThrow(
      "Unsupported MCP config format",
    );
    expect(fileSystem["/mock/mcp.json"]).toBeUndefined();
  });

  it("does not write when backup fails", async () => {
    fileSystem["/mock/mcp.json"] = '{"mcpServers":{}}';
    setSandboxGlobal("backupConfigFile", async () => {
      throw new Error("backup failed");
    });
    await expect(getIndexFunction("deploySharedMcpServers")("/mock/mcp.json")).rejects.toThrow("backup failed");
    expect(fileSystem["/mock/mcp.json"]).toBe('{"mcpServers":{}}');
  });

  it.each(["{broken", "null", "[]", '"text"', '{"mcpServers":[]}', '{"mcpServers":null}', '{"mcpServers":false}'])(
    "rejects invalid existing config %s without backups or writes",
    async (content) => {
      mockFsExistence["/mock/mcp.json"] = true;
      fileSystem["/mock/mcp.json"] = content;
      const backup = vi.fn();
      setSandboxGlobal("backupConfigFile", backup);
      await expect(getIndexFunction("deploySharedMcpServers")("/mock/mcp.json")).rejects.toThrow();
      expect(fileSystem["/mock/mcp.json"]).toBe(content);
      expect(backup).not.toHaveBeenCalled();
    },
  );

  it("reads JSONC, backs up before writing, and preserves other config keys", async () => {
    mockFsExistence["/mock/mcp.json"] = true;
    fileSystem["/mock/mcp.json"] =
      '{ // user config\n "autoEnableCodemode": false, "mcpServers": { "personal": { "command": "custom" }, }, }';
    const backup = vi.fn(() => expect(fileSystem["/mock/mcp.json"]).toContain("// user config"));
    setSandboxGlobal("backupConfigFile", backup);
    await getIndexFunction("deploySharedMcpServers")("/mock/mcp.json");
    expect(backup).toHaveBeenCalledWith("/mock/mcp.json");
    expect(JSON.parse(fileSystem["/mock/mcp.json"])).toMatchObject({
      autoEnableCodemode: false,
      mcpServers: { personal: { command: "custom" } },
    });
  });

  it("does not write or back up when no registry entries or managed settings exist", async () => {
    fetchResponses["software/scripts/advanced/llm/_common/mcp-servers.jsonc"] = '{"mcpServers":{}}';
    const backup = vi.fn();
    setSandboxGlobal("backupConfigFile", backup);
    await getIndexFunction("deploySharedMcpServers")("/mock/mcp.json");
    expect(fileSystem["/mock/mcp.json"]).toBeUndefined();
    expect(backup).not.toHaveBeenCalled();
  });
});
