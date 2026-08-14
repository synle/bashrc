/** Guards the Zed `settings.lsp` block built from LSP_SERVERS in software/scripts/advanced/lsp/lsp-common.js. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";

const LSP_COMMON_PATH = path.resolve("software/scripts/advanced/lsp/lsp-common.js");

/**
 * Evaluates lsp-common.js in a bare sandbox and returns the two things this spec asserts
 * on. The file is a plain script (no imports/exports — helpers are globals at runtime),
 * so a `vm` context is the only way to reach `LSP_SERVERS` / `buildZedLspBlock` without
 * booting the whole engine.
 * @returns {{ servers: Record<string, object>, zedBlock: Record<string, object> }}
 */
function loadLspCommon() {
  const source = fs.readFileSync(LSP_COMMON_PATH, "utf-8");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__out = { servers: LSP_SERVERS, zedBlock: buildZedLspBlock() };`, sandbox);
  return sandbox.__out;
}

describe("lsp-common — Zed language-server ids", () => {
  const { servers, zedBlock } = loadLspCommon();

  it("keys the Zed lsp block on zedId, never on the internal LSP_SERVERS key", () => {
    // Regression: the block was keyed on the internal name (`bash`, `typescript`, ...).
    // Zed resolves settings.lsp.<id> against the id a builtin or extension registers, so
    // every such entry was silently ignored and the globally-installed binaries from
    // lsp/install.sh were never used.
    for (const [internalKey, entry] of Object.entries(servers)) {
      if (!entry.zedId) continue;
      if (entry.zedId === internalKey) continue;
      expect(Object.keys(zedBlock)).not.toContain(internalKey);
      expect(Object.keys(zedBlock)).toContain(entry.zedId);
    }
  });

  it("omits every server that has no verified zedId", () => {
    const withoutId = Object.entries(servers)
      .filter(([, entry]) => !entry.zedId)
      .map(([key]) => key);
    for (const key of withoutId) {
      expect(Object.keys(zedBlock)).not.toContain(key);
    }
    expect(Object.keys(zedBlock)).toHaveLength(Object.keys(servers).length - withoutId.length);
  });

  it("registers bash under the id the basher extension declares", () => {
    // basher's extension.toml declares `[language_servers.bash-language-server]` for the
    // "Shell Script" language. Zed ships no bash LSP of its own, so this id plus the
    // `basher` entry in zed-config.jsonc auto_install_extensions is what makes bash
    // diagnostics work at all.
    expect(servers.bash.zedId).toBe("bash-language-server");
    expect(zedBlock["bash-language-server"]).toEqual({
      binary: { path: "bash-language-server", arguments: ["--stdio"] },
    });
  });

  it("gives every emitted entry a binary path and an arguments array", () => {
    for (const [id, value] of Object.entries(zedBlock)) {
      expect(typeof value.binary.path, `${id} binary.path`).toBe("string");
      expect(value.binary.path.length, `${id} binary.path`).toBeGreaterThan(0);
      expect(Array.isArray(value.binary.arguments), `${id} binary.arguments`).toBe(true);
    }
  });

  it("never emits the same zedId twice", () => {
    const ids = Object.values(servers)
      .map((entry) => entry.zedId)
      .filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
