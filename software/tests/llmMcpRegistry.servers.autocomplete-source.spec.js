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

describe("getAutocompleteProvider > tagged host discovery", () => {
  it("prefers localhost when it has a preferred model", async () => {
    const sandbox = loadLlmCommon(null, {
      remoteIps: ["192.0.2.45"],
      tagsByHost: { "192.0.2.45": ["qwen2.5-coder:3b-base"], "127.0.0.1": ["qwen2.5-coder:1.5b-base"] },
    });
    expect(await sandbox.getAutocompleteProvider()).toMatchInlineSnapshot(`
      {
        "host": "127.0.0.1",
        "model": "qwen2.5-coder:1.5b-base",
        "port": 11434,
      }
    `);
  });

  it("falls back to a remote host when localhost serves nothing", async () => {
    const sandbox = loadLlmCommon(null, {
      remoteIps: ["192.0.2.45"],
      tagsByHost: { "192.0.2.45": ["qwen2.5-coder:1.5b-base"] },
    });
    expect(await sandbox.getAutocompleteProvider()).toMatchInlineSnapshot(`
      {
        "host": "192.0.2.45",
        "model": "qwen2.5-coder:1.5b-base",
        "port": 11434,
      }
    `);
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
    // Strip comments + trailing commas the same way the runtime does - sandbox's parser is JSON.
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
