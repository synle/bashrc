/** Client exclusions must not leak registry metadata or mutate native user configuration. */
import { beforeEach, describe, expect, it } from "vitest";
import { fetchResponses, fileSystem, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

/** Registry path consumed by the real shared loader. */
const REGISTRY_PATH = "software/scripts/advanced/llm/_common/mcp-servers.jsonc";

beforeEach(() => {
  loadScriptHelpers("software/scripts/advanced/llm/llm-common.js");
  setSandboxGlobal("is_os_mac", false);
});

describe("MCP client selection", () => {
  it("preserves legacy deployment calls that omit client and format arguments", async () => {
    fetchResponses[REGISTRY_PATH] = JSON.stringify({
      mcpServers: { lens: { command: "server", excludeClients: ["pi"] } },
    });
    await getIndexFunction("deploySharedMcpServers")("/mock/mcp.json");
    expect(JSON.parse(fileSystem["/mock/mcp.json"])).toMatchInlineSnapshot(`
      {
        "mcpServers": {
          "lens": {
            "command": "server",
          },
        },
      }
    `);
  });

  it("returns the unfiltered inventory when platform and client arguments are omitted", async () => {
    fetchResponses[REGISTRY_PATH] = JSON.stringify({
      mcpServers: { lens: { command: "server", argsOnMac: ["mac"], args: ["other"], excludeClients: ["pi"] } },
    });
    expect(await getIndexFunction("loadSharedMcpServers")()).toMatchInlineSnapshot(`
      {
        "lens": {
          "args": [
            "other",
          ],
          "command": "server",
        },
      }
    `);
  });

  it.each([
    ["pi", {}],
    ["claude", { lens: { command: "pi-lens-mcp", args: [] } }],
    ["copilot", { lens: { command: "pi-lens-mcp", args: [] } }],
    ["gemini", { lens: { command: "pi-lens-mcp", args: [] } }],
    ["opencode", { lens: { command: "pi-lens-mcp", args: [] } }],
    ["all", { lens: { command: "pi-lens-mcp", args: [] } }],
  ])("resolves eligible servers for %s without metadata", async (client, expected) => {
    fetchResponses[REGISTRY_PATH] = JSON.stringify({
      mcpServers: { lens: { command: "pi-lens-mcp", args: [], excludeClients: ["pi"] } },
    });
    expect(await getIndexFunction("loadSharedMcpServers")(false, client)).toEqual(expected);
  });

  it("combines platform arguments with an empty client exclusion list", async () => {
    fetchResponses[REGISTRY_PATH] = JSON.stringify({
      mcpServers: { lens: { command: "server", args: ["linux"], argsOnMac: ["mac"], excludeClients: [] } },
    });
    expect(await getIndexFunction("loadSharedMcpServers")(true, "pi")).toMatchInlineSnapshot(`
      {
        "lens": {
          "args": [
            "mac",
          ],
          "command": "server",
        },
      }
    `);
  });

  it.each([null, "pi", [""], ["typo"], [0], [null], {}])("rejects invalid exclusions %j before writing", async (excludeClients) => {
    fetchResponses[REGISTRY_PATH] = JSON.stringify({ mcpServers: { lens: { command: "server", excludeClients } } });
    fileSystem["/mock/mcp.json"] = '{"keep":true}';
    await expect(getIndexFunction("deploySharedMcpServers")("/mock/mcp.json", {}, "standard", "pi")).rejects.toThrow(
      "MCP excludeClients must be an array of supported client names",
    );
    expect(fileSystem["/mock/mcp.json"]).toBe('{"keep":true}');
    expect(fileSystem["/mock/mcp.json.bak_original"]).toBeUndefined();
    expect(fileSystem["/mock/mcp.json.bak_latest"]).toBeUndefined();
  });

  it.each(["", "typo", null, 0])("rejects unknown client %j before writing", async (client) => {
    fetchResponses[REGISTRY_PATH] = '{"mcpServers":{}}';
    await expect(getIndexFunction("deploySharedMcpServers")("/mock/mcp.json", {}, "standard", client)).rejects.toThrow(
      "Unknown MCP deployment client",
    );
    expect(fileSystem["/mock/mcp.json"]).toBeUndefined();
  });

  it("preserves a user-created excluded entry and writes other eligible servers", async () => {
    fetchResponses[REGISTRY_PATH] = JSON.stringify({
      mcpServers: { lens: { command: "managed", excludeClients: ["pi"] }, other: { command: "server" } },
    });
    fileSystem["/mock/mcp.json"] = '{"mcpServers":{"lens":{"command":"personal"}}}';
    await getIndexFunction("deploySharedMcpServers")("/mock/mcp.json", {}, "standard", "pi");
    expect(JSON.parse(fileSystem["/mock/mcp.json"])).toMatchInlineSnapshot(`
      {
        "mcpServers": {
          "lens": {
            "command": "personal",
          },
          "other": {
            "command": "server",
          },
        },
      }
    `);
  });

  it("retains malformed entry shapes for native consumer validation", async () => {
    fetchResponses[REGISTRY_PATH] = '{"mcpServers":{"missing":null,"text":"bad"}}';
    expect(await getIndexFunction("loadSharedMcpServers")(false, "pi")).toMatchInlineSnapshot(`
      {
        "missing": null,
        "text": "bad",
      }
    `);
  });
});
