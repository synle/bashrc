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
 * passes in for `software/scripts/advanced/llm/_common/mcp-servers.jsonc`, and
 * whatever `opts.tagsByHost` declares for an Ollama `/api/tags` URL.
 *
 * Source is run with `const`/`let` rewritten to `var` so every top-level
 * declaration becomes a sandbox property accessible from the test.
 *
 * `192.0.2.45` is RFC 5737 TEST-NET-1 (reserved for documentation) — a deliberate
 * stand-in so no real LAN address appears in the test suite. The production value
 * lives only in `software/metadata/ip-address.config`.
 *
 * @param {{ mcpServers?: Record<string, any> } | null} registryPayload - What `readJson` returns for the registry path.
 * @param {{ omenIp?: string | null, tagsByHost?: Record<string, string[]> }} [opts] - Discovery stubs.
 * @param {string|null} [opts.omenIp] - What `getSyHPOmenHomeIpAddress()` resolves to (`null` = not in config).
 * @param {Record<string, string[]>} [opts.tagsByHost] - Model names each host's `/api/tags` reports.
 * @returns {Record<string, any>} The populated sandbox.
 */
function loadLlmCommon(registryPayload, opts = {}) {
  /** @type {string} Source with `const`/`let` rewritten so declarations become sandbox properties. */
  const source = LLM_COMMON_SOURCE.replace(/^(const|let) /gm, "var ");
  /** @type {string|null} Resolved sy-omen45l address, or null when the config has no entry. */
  const omenIp = opts.omenIp === undefined ? "192.0.2.45" : opts.omenIp;
  /** @type {Record<string, string[]>} Per-host `/api/tags` model names. */
  const tagsByHost = opts.tagsByHost || {};
  /** @type {string[]} Every host actually probed, in probe order — asserted by the discovery tests. */
  const probedHosts = [];
  /** @type {Record<string, any>} */
  const sandbox = {
    is_os_mac: false,
    path,
    // llm-common.js builds ~/sy_llm_ai/* paths from this at top level.
    BASE_HOMEDIR_LINUX: "/tmp/sandbox-home",
    log: () => {},
    probedHosts,
    readJson: async (strings, ...values) => {
      const target = strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "").trim();
      if (target === "software/scripts/advanced/llm/_common/mcp-servers.jsonc") {
        return registryPayload;
      }
      const tagsMatch = target.match(/^http:\/\/([^/:]+):\d+\/api\/tags$/);
      if (tagsMatch) {
        const host = tagsMatch[1];
        probedHosts.push(host);
        return { models: (tagsByHost[host] || []).map((name) => ({ name })) };
      }
      return {};
    },
    getSyHPOmenHomeIpAddress: async () => omenIp,
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

// ---- Ollama host discovery: no LAN address is hardcoded in llm-common.js ----
//
// Both discoverers resolve sy-omen45l through `getSyHPOmenHomeIpAddress()`, which reads
// `software/metadata/ip-address.config`. When that lookup returns null the remote host
// must be dropped from the probe list entirely — probing a literal fallback address (or,
// worse, `http://null:11434`) is exactly what these tests exist to prevent.

describe("getOllamaProviderInputs > sy-omen45l address resolution", () => {
  it("probes the config-resolved remote host first, then localhost", async () => {
    const sandbox = loadLlmCommon(null, {
      omenIp: "192.0.2.45",
      tagsByHost: { "192.0.2.45": ["qwen3.6:latest"], "127.0.0.1": ["qwen2.5-coder:3b"] },
    });
    const providers = await sandbox.getOllamaProviderInputs();
    expect(sandbox.probedHosts).toEqual(["192.0.2.45", "127.0.0.1"]);
    expect(providers.map((p) => p.id)).toEqual(["ollama-sy-omen45l", "ollama-local"]);
    expect(providers[0].baseURL).toBe("http://192.0.2.45:11434/v1");
  });

  it("skips the remote host entirely when ip-address.config has no sy-omen45l entry", async () => {
    const sandbox = loadLlmCommon(null, {
      omenIp: null,
      tagsByHost: { "127.0.0.1": ["qwen2.5-coder:3b"] },
    });
    const providers = await sandbox.getOllamaProviderInputs();
    expect(sandbox.probedHosts).toEqual(["127.0.0.1"]);
    expect(providers.map((p) => p.id)).toEqual(["ollama-local"]);
  });

  it("never probes a `null` host when the lookup misses", async () => {
    const sandbox = loadLlmCommon(null, { omenIp: null, tagsByHost: {} });
    await sandbox.getOllamaProviderInputs();
    expect(sandbox.probedHosts).not.toContain("null");
    expect(sandbox.probedHosts.every((h) => h && h !== "undefined")).toBe(true);
  });
});

describe("getAutocompleteProvider > sy-omen45l address resolution", () => {
  it("probes localhost first and the config-resolved remote host second", async () => {
    const sandbox = loadLlmCommon(null, {
      omenIp: "192.0.2.45",
      tagsByHost: { "192.0.2.45": ["qwen2.5-coder:1.5b-base"] },
    });
    const picked = await sandbox.getAutocompleteProvider();
    expect(sandbox.probedHosts).toEqual(["127.0.0.1", "192.0.2.45"]);
    expect(picked).toEqual({ host: "192.0.2.45", port: 11434, model: "qwen2.5-coder:1.5b-base" });
  });

  it("probes localhost only when ip-address.config has no sy-omen45l entry", async () => {
    const sandbox = loadLlmCommon(null, {
      omenIp: null,
      tagsByHost: { "127.0.0.1": ["qwen2.5-coder:1.5b-base"] },
    });
    const picked = await sandbox.getAutocompleteProvider();
    expect(sandbox.probedHosts).toEqual(["127.0.0.1"]);
    expect(picked).toEqual({ host: "127.0.0.1", port: 11434, model: "qwen2.5-coder:1.5b-base" });
  });

  it("returns null when the lookup misses and localhost has no preferred model", async () => {
    const sandbox = loadLlmCommon(null, { omenIp: null, tagsByHost: {} });
    expect(await sandbox.getAutocompleteProvider()).toBeNull();
    expect(sandbox.probedHosts).toEqual(["127.0.0.1"]);
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
