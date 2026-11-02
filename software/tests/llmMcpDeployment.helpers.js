/** Shared native MCP client fixtures and isolated setup-loader boundary. */
import { readFileSync } from "fs";
import { getIndexFunction, loadScriptHelpers, mockFsExistence, setSandboxGlobal } from "./setup.js";

/** Registry fixture with a platform-specific local server and an HTTP server. */
export const REGISTRY = {
  mcpServers: {
    browser: { command: "npx", args: ["browser", "--headless"], argsOnMac: ["browser"], env: { MODE: "test" } },
    docs: { type: "http", url: "https://example.com/mcp" },
  },
};

/** Native user destinations; these expectations come from each client's config contract. */
export const CLIENTS = [
  { cli: "pi", target: "/mock/home/.pi/agent/mcp.json", key: "mcpServers" },
  { cli: "claude", target: "/mock/home/.claude.json", key: "mcpServers" },
  { cli: "copilot", target: "/mock/home/.copilot/mcp-config.json", key: "mcpServers" },
  { cli: "gemini", target: "/mock/home/.gemini/settings.json", key: "mcpServers" },
  { cli: "opencode", target: "/mock/home/.config/opencode/opencode.json", key: "mcp" },
];

/** Checked-in registry, used to verify requested servers rather than only synthetic fixtures. */
export const SHIPPED_REGISTRY = JSON.stringify(
  getIndexFunction("parseJsonWithComments")(readFileSync("software/scripts/advanced/llm/_common/mcp-servers.jsonc", "utf8")),
);

/** Independent native config expectations for the managed MCP launchers. */
export const REQUESTED_SERVERS = {
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
export function loadClient(cli) {
  loadScriptHelpers(`software/scripts/advanced/llm/${cli}/setup.js`);
  for (const name of OTHER_DEPLOYMENTS) setSandboxGlobal(name, async () => {});
  setSandboxGlobal("isBinaryFound", async () => true);
  setSandboxGlobal("getOllamaProviderInputs", async () => []);
  setSandboxGlobal("getSharedLLMInstructionFilePaths", () => []);
  mockFsExistence["/mock/home/.claude"] = true;
}
