/** Tests for the shared MCP server registry helpers in llm-common.js. */
import { describe, it, expect } from "vitest";
import { expandSourceMarkers } from "./setup.js";
import fs from "fs";
import path from "path";
import vm from "vm";

const ROOT = path.resolve(".");
/**
 * llm-common.js with its `// SOURCE` markers inlined (it SOURCEs llm-models.jsonc for
 * OLLAMA_MODELS_BY_VRAM), mirroring the runtime expansion.
 * @type {string}
 */
const LLM_COMMON_SOURCE = expandSourceMarkers(fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/llm-common.js"), "utf-8"));

/**
 * Builds a vm sandbox seeded with the globals `llm-common.js` references
 * (`is_os_mac`, `path`, `log`, plus stubs for `readJson` and
 * `getOllamaHosts`). The `readJson` stub returns whatever the test
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
 * @param {{ remoteIps?: string[], tagsByHost?: Record<string, string[]>, isWorkProfile?: boolean }} [opts] - Discovery stubs.
 * @param {string[]} [opts.remoteIps] - OLLAMA_REMOTE host IPs, default first (`[]` = none tagged).
 * @param {Record<string, string[]>} [opts.tagsByHost] - Model names each host's `/api/tags` reports.
 * @param {boolean} [opts.isWorkProfile] - Whether local-model discovery must be disabled.
 * @returns {Record<string, any>} The populated sandbox.
 */
function loadLlmCommon(registryPayload, opts = {}) {
  /** @type {string} Source with `const`/`let` rewritten so declarations become sandbox properties. */
  const source = LLM_COMMON_SOURCE.replace(/^(const|let) /gm, "var ");
  /** @type {string[]} Tagged remote Ollama server IPs, default first. */
  const remoteIps = opts.remoteIps === undefined ? ["192.0.2.45"] : opts.remoteIps;
  /** @type {Record<string, string[]>} Per-host `/api/tags` model names. */
  const tagsByHost = opts.tagsByHost || {};
  /** @type {string[]} Every host actually probed, in probe order — asserted by the discovery tests. */
  const probedHosts = [];
  /** @type {Record<string, any>} */
  const sandbox = {
    is_os_mac: false,
    is_work_profile: opts.isWorkProfile || false,
    path,
    // llm-common.js derives every legacy folder from this at top level.
    BASE_HOMEDIR_LINUX: "/tmp/sandbox-home",
    // ...and the current LLM home from the personal root.
    SY_ROOT_FOLDER: "/tmp/sandbox-home/sy",
    // LLM_SHARED_ROOT_FOLDER reads LLM_ROOT_FOLDER directly with no default.
    process: { env: { LLM_ROOT_FOLDER: "/tmp/sandbox-home/sy/ai_llm" } },
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
    // Mirrors index.js getOllamaHosts(): tagged remotes (default first), then 127.0.0.1.
    getOllamaHosts: async () => [
      ...remoteIps.map((ip, i) => ({ ip, hostname: `my-desktop-${i + 1}`, tags: ["OLLAMA_REMOTE"], isDefault: i === 0, isLocal: false })),
      { ip: "127.0.0.1", hostname: "local", tags: [], isDefault: remoteIps.length === 0, isLocal: true },
    ],
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

  it("uses argsOnMac in place of args on macOS and strips the key", async () => {
    const sandbox = loadLlmCommon({ mcpServers: { pw: { command: "npx", args: ["pkg", "--headless"], argsOnMac: ["pkg"] } } });
    const result = await sandbox.loadSharedMcpServers(true);
    expect(result).toEqual({ pw: { command: "npx", args: ["pkg"] } });
  });

  it("keeps args and strips argsOnMac off macOS", async () => {
    const sandbox = loadLlmCommon({ mcpServers: { pw: { command: "npx", args: ["pkg", "--headless"], argsOnMac: ["pkg"] } } });
    const result = await sandbox.loadSharedMcpServers(false);
    expect(result).toEqual({ pw: { command: "npx", args: ["pkg", "--headless"] } });
  });

  it("falls back to args on macOS when argsOnMac is not an array", async () => {
    const sandbox = loadLlmCommon({ mcpServers: { pw: { command: "npx", args: ["pkg", "--headless"], argsOnMac: "pkg" } } });
    const result = await sandbox.loadSharedMcpServers(true);
    expect(result).toEqual({ pw: { command: "npx", args: ["pkg", "--headless"] } });
  });
});

describe("_common/mcp-servers.jsonc playwright entry", () => {
  /** Reads the checked-in registry with comments + trailing commas stripped. */
  const readRegistry = () =>
    JSON.parse(
      fs
        .readFileSync(path.join(ROOT, "software/scripts/advanced/llm/_common/mcp-servers.jsonc"), "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/,(\s*[}\]])/g, "$1"),
    );

  it("deploys playwright headed with a persistent profile on macOS", async () => {
    const sandbox = loadLlmCommon(readRegistry());
    const { playwright } = await sandbox.loadSharedMcpServers(true);
    expect(playwright.args).toEqual(["-y", "@playwright/mcp@latest"]);
  });

  it("deploys playwright headless and isolated off macOS", async () => {
    const sandbox = loadLlmCommon(readRegistry());
    const { playwright } = await sandbox.loadSharedMcpServers(false);
    expect(playwright.args).toEqual(["-y", "@playwright/mcp@latest", "--headless", "--isolated"]);
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

// ---- Ollama host discovery: hosts come from ip-address.config tags ----
//
// getOllamaHosts() (index.js) lists OLLAMA_REMOTE hosts (default first) plus 127.0.0.1.
// getReachableOllamaHosts() keeps only hosts whose /api/tags lists a model, so an
// unreachable or empty host — remote or local — is never registered.

describe("getOllamaProviderInputs > tagged host discovery", () => {
  it("registers every reachable remote host (default first), then localhost", async () => {
    const sandbox = loadLlmCommon(null, {
      remoteIps: ["192.0.2.45", "192.0.2.46"],
      tagsByHost: {
        "192.0.2.45": ["glm-4.7-flash:q4_K_M"],
        "192.0.2.46": ["qwen2.5-coder:14b"],
        "127.0.0.1": ["qwen2.5-coder:3b"],
      },
    });
    const providers = await sandbox.getOllamaProviderInputs();
    expect(sandbox.probedHosts).toEqual(["192.0.2.45", "192.0.2.46", "127.0.0.1"]);
    expect(providers.map((p) => p.id)).toEqual(["ollama-my-desktop-1", "ollama-my-desktop-2", "ollama-local"]);
    expect(providers[0].baseURL).toBe("http://192.0.2.45:11434/v1");
  });

  it("skips a tagged remote host that serves no models", async () => {
    const sandbox = loadLlmCommon(null, {
      remoteIps: ["192.0.2.45"],
      tagsByHost: { "127.0.0.1": ["qwen2.5-coder:3b"] },
    });
    const providers = await sandbox.getOllamaProviderInputs();
    expect(providers.map((p) => p.id)).toEqual(["ollama-local"]);
  });

  it("skips localhost when it serves no models", async () => {
    const sandbox = loadLlmCommon(null, {
      remoteIps: ["192.0.2.45"],
      tagsByHost: { "192.0.2.45": ["glm-4.7-flash:q4_K_M"] },
    });
    const providers = await sandbox.getOllamaProviderInputs();
    expect(providers.map((p) => p.id)).toEqual(["ollama-my-desktop-1"]);
  });

  it("probes localhost only when no host is tagged OLLAMA_REMOTE", async () => {
    const sandbox = loadLlmCommon(null, { remoteIps: [], tagsByHost: { "127.0.0.1": ["qwen2.5-coder:3b"] } });
    const providers = await sandbox.getOllamaProviderInputs();
    expect(sandbox.probedHosts).toEqual(["127.0.0.1"]);
    expect(providers.map((p) => p.id)).toEqual(["ollama-local"]);
  });

  it("returns no providers when nothing is reachable", async () => {
    const sandbox = loadLlmCommon(null, { remoteIps: ["192.0.2.45"], tagsByHost: {} });
    expect(await sandbox.getOllamaProviderInputs()).toEqual([]);
  });

  it("returns no providers and probes no endpoints on a work profile", async () => {
    const sandbox = loadLlmCommon(null, {
      isWorkProfile: true,
      tagsByHost: { "192.0.2.45": ["glm-4.7-flash:q4_K_M"], "127.0.0.1": ["qwen2.5-coder:3b"] },
    });
    expect(await sandbox.getOllamaProviderInputs()).toEqual([]);
    expect(sandbox.probedHosts).toEqual([]);
  });
});

describe("getAutocompleteProvider > tagged host discovery", () => {
  it("prefers localhost when it has a preferred model", async () => {
    const sandbox = loadLlmCommon(null, {
      remoteIps: ["192.0.2.45"],
      tagsByHost: { "192.0.2.45": ["qwen2.5-coder:3b-base"], "127.0.0.1": ["qwen2.5-coder:1.5b-base"] },
    });
    expect(await sandbox.getAutocompleteProvider()).toEqual({
      host: "127.0.0.1",
      port: 11434,
      model: "qwen2.5-coder:1.5b-base",
    });
  });

  it("falls back to a remote host when localhost serves nothing", async () => {
    const sandbox = loadLlmCommon(null, {
      remoteIps: ["192.0.2.45"],
      tagsByHost: { "192.0.2.45": ["qwen2.5-coder:1.5b-base"] },
    });
    expect(await sandbox.getAutocompleteProvider()).toEqual({
      host: "192.0.2.45",
      port: 11434,
      model: "qwen2.5-coder:1.5b-base",
    });
  });

  it("returns null when no reachable host has a preferred model", async () => {
    const sandbox = loadLlmCommon(null, { remoteIps: [], tagsByHost: {} });
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
