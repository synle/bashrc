/** Tests for the shared MCP server registry helpers in llm-common.js. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";

const ROOT = path.resolve(".");
const LLM_COMMON_SOURCE = fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/llm-common.js"), "utf-8");

/**
 * Builds a vm sandbox seeded with the globals `llm-common.js` references
 * (`is_os_mac`, `path`, `log`, plus stubs for `readJson` and
 * `getSyHPOmenHomeIpAddress`). The `readJson` stub returns whatever the test
 * passes in for `software/scripts/advanced/llm/_common/mcp-servers.jsonc`.
 *
 * Source is run with `const`/`let` rewritten to `var` so every top-level
 * declaration becomes a sandbox property accessible from the test.
 *
 * @param {{ mcpServers?: Record<string, any> } | null} registryPayload - What `readJson` returns for the registry path.
 * @returns {Record<string, any>} The populated sandbox.
 */
function loadLlmCommon(registryPayload) {
  /** @type {string} Source with `const`/`let` rewritten so declarations become sandbox properties. */
  const source = LLM_COMMON_SOURCE.replace(/^(const|let) /gm, "var ");
  /** @type {Record<string, any>} */
  const sandbox = {
    is_os_mac: false,
    path,
    log: () => {},
    readJson: async (strings, ...values) => {
      const target = strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "").trim();
      if (target === "software/scripts/advanced/llm/_common/mcp-servers.jsonc") {
        return registryPayload;
      }
      return {};
    },
    getSyHPOmenHomeIpAddress: async () => "192.168.1.45",
  };
  vm.runInNewContext(source, sandbox);
  return sandbox;
}

describe("loadSharedMcpServers", () => {
  it("returns empty map when the registry has no mcpServers entries", async () => {
    const sandbox = loadLlmCommon({ mcpServers: {} });
    const result = await sandbox.loadSharedMcpServers();
    expect(result).toEqual({});
  });

  it("returns empty map when the registry file is null/missing", async () => {
    const sandbox = loadLlmCommon(null);
    const result = await sandbox.loadSharedMcpServers();
    expect(result).toEqual({});
  });

  it("returns the map verbatim when entries are present", async () => {
    const payload = {
      mcpServers: {
        context7: { command: "npx", args: ["-y", "@upstash/context7-mcp"] },
        remoteThing: { url: "https://example.com/mcp", headers: { Authorization: "Bearer x" } },
      },
    };
    const sandbox = loadLlmCommon(payload);
    const result = await sandbox.loadSharedMcpServers();
    expect(result).toEqual(payload.mcpServers);
  });

  it("ignores a non-object mcpServers value gracefully", async () => {
    const sandbox = loadLlmCommon({ mcpServers: "not-an-object" });
    const result = await sandbox.loadSharedMcpServers();
    expect(result).toEqual({});
  });
});

describe("translateMcpServersForOpencode", () => {
  it("translates a local stdio entry to opencode's `{ type, command, environment, enabled }` shape", async () => {
    const sandbox = loadLlmCommon(null);
    const out = sandbox.translateMcpServersForOpencode({
      myserver: { command: "node", args: ["server.js"], env: { K: "V" } },
    });
    expect(out).toEqual({
      myserver: {
        type: "local",
        command: ["node", "server.js"],
        environment: { K: "V" },
        enabled: true,
      },
    });
  });

  it("translates a local entry with no args / no env to `{ type, command: [command], enabled }`", async () => {
    const sandbox = loadLlmCommon(null);
    const out = sandbox.translateMcpServersForOpencode({ bare: { command: "uvx" } });
    expect(out).toEqual({ bare: { type: "local", command: ["uvx"], enabled: true } });
  });

  it("translates a remote URL entry to opencode's `{ type: 'remote', url, headers, enabled }` shape", async () => {
    const sandbox = loadLlmCommon(null);
    const out = sandbox.translateMcpServersForOpencode({
      remote: { url: "https://example.com/mcp", headers: { Authorization: "Bearer x" } },
    });
    expect(out).toEqual({
      remote: { type: "remote", url: "https://example.com/mcp", headers: { Authorization: "Bearer x" }, enabled: true },
    });
  });

  it("omits `headers` when the remote entry doesn't carry any", async () => {
    const sandbox = loadLlmCommon(null);
    const out = sandbox.translateMcpServersForOpencode({ r: { url: "https://example.com/mcp" } });
    expect(out).toEqual({ r: { type: "remote", url: "https://example.com/mcp", enabled: true } });
  });

  it("passes through an unknown-shape entry verbatim so opencode reports the schema error", async () => {
    const sandbox = loadLlmCommon(null);
    const weird = { weird: { foo: "bar" } };
    const out = sandbox.translateMcpServersForOpencode(weird);
    expect(out).toEqual(weird);
  });

  it("returns an empty object when given an empty / undefined input", async () => {
    const sandbox = loadLlmCommon(null);
    expect(sandbox.translateMcpServersForOpencode({})).toEqual({});
    expect(sandbox.translateMcpServersForOpencode(undefined)).toEqual({});
  });
});

describe("_common/mcp-servers.jsonc (checked-in source-of-truth)", () => {
  it("parses as valid JSONC and exposes an `mcpServers` map", () => {
    const sandbox = loadLlmCommon({});
    const raw = fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/_common/mcp-servers.jsonc"), "utf-8");
    // Strip comments + trailing commas the same way the runtime does — sandbox's parser is JSON.
    // Use the same minimal stripper as `parseJsonWithComments` would: kill `//` lines and `/* */` blocks.
    const cleaned = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,(\s*[}\]])/g, "$1");
    const parsed = JSON.parse(cleaned);
    expect(typeof parsed).toBe("object");
    expect(parsed).toHaveProperty("mcpServers");
    expect(typeof parsed.mcpServers).toBe("object");
  });
});
