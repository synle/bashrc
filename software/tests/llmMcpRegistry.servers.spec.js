import { describe, it, expect } from "vitest";

import { expandSourceMarkers } from "./setup.js";

import fs from "fs";

import path from "path";

import vm from "vm";

const ROOT = path.resolve(".");

const LLM_COMMON_SOURCE = expandSourceMarkers(fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/llm-common.js"), "utf-8"));

function loadLlmCommon(registryPayload, opts = {}) {
  /** @type {string} Source with `const`/`let` rewritten so declarations become sandbox properties. */
  const source = LLM_COMMON_SOURCE.replace(/^(const|let) /gm, "var ");
  /** @type {string[]} Tagged remote Ollama server IPs, default first. */
  const remoteIps = opts.remoteIps === undefined ? ["192.0.2.45"] : opts.remoteIps;
  /** @type {Record<string, string[]>} Per-host `/api/tags` model names. */
  const tagsByHost = opts.tagsByHost || {};
  /** @type {string[]} Every host actually probed, in probe order - asserted by the discovery tests. */
  const probedHosts = [];
  /** @type {Record<string, any>} */
  const sandbox = {
    is_os_mac: false,
    is_os_windows: false,
    is_os_wsl: opts.isWsl || false,
    is_work_profile: opts.isWorkProfile || false,
    path,
    // llm-common.js derives every legacy folder from this at top level.
    BASE_HOMEDIR_LINUX: "/tmp/sandbox-home",
    // ...and the current LLM home from the personal root.
    SY_ROOT_FOLDER: "/tmp/sandbox-home/sy",
    getWindowUserBaseDir: () => opts.windowsHome || "/mnt/c/Users/test",
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

describe("getLLMConfigHomes", () => {
  it("returns one home outside WSL", () => {
    const sandbox = loadLlmCommon(null, { isWsl: false });
    expect(sandbox.getLLMConfigHomes()).toEqual(["/tmp/sandbox-home"]);
  });

  it("returns Linux and Windows homes for WSL", () => {
    const sandbox = loadLlmCommon(null, { isWsl: true, windowsHome: "/mnt/c/Users/test" });
    expect(sandbox.getLLMConfigHomes()).toEqual(["/tmp/sandbox-home", "/mnt/c/Users/test"]);
  });
});

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
    expect(result).toMatchInlineSnapshot(`
      {
        "pw": {
          "args": [
            "pkg",
          ],
          "command": "npx",
        },
      }
    `);
  });

  it("keeps args and strips argsOnMac off macOS", async () => {
    const sandbox = loadLlmCommon({ mcpServers: { pw: { command: "npx", args: ["pkg", "--headless"], argsOnMac: ["pkg"] } } });
    const result = await sandbox.loadSharedMcpServers(false);
    expect(result).toMatchInlineSnapshot(`
      {
        "pw": {
          "args": [
            "pkg",
            "--headless",
          ],
          "command": "npx",
        },
      }
    `);
  });

  it("falls back to args on macOS when argsOnMac is not an array", async () => {
    const sandbox = loadLlmCommon({ mcpServers: { pw: { command: "npx", args: ["pkg", "--headless"], argsOnMac: "pkg" } } });
    const result = await sandbox.loadSharedMcpServers(true);
    expect(result).toMatchInlineSnapshot(`
      {
        "pw": {
          "args": [
            "pkg",
            "--headless",
          ],
          "command": "npx",
        },
      }
    `);
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

describe("getOllamaDefaultModel", () => {
  it("chooses a model reported by the default reachable host when preferred models are absent", () => {
    const sandbox = loadLlmCommon(null);
    expect(
      sandbox.getOllamaDefaultModel([
        {
          id: "ollama-my-desktop-1",
          models: [{ name: "llamacpp:96b29057eca088c7d2707398bfb2eadabd7ac1100d2520da41ca9dcdf67a77d7" }, { name: "gemma4:26b" }],
        },
        { id: "ollama-local", models: [{ name: "qwen2.5-coder:3b" }] },
      ]),
    ).toBe("llamacpp:96b29057eca088c7d2707398bfb2eadabd7ac1100d2520da41ca9dcdf67a77d7");
  });

  it("prefers configured agent models only when the default host actually serves them", () => {
    const sandbox = loadLlmCommon(null);
    expect(sandbox.getOllamaDefaultModel([{ id: "ollama-local", models: [{ name: "gemma4:26b" }, { name: "qwen3.8:latest" }] }])).toBe(
      "qwen3.8:latest",
    );
  });

  it("returns null when no Ollama model is currently registered", () => {
    expect(loadLlmCommon(null).getOllamaDefaultModel([])).toBeNull();
  });
});
