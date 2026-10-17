/** Verifies OpenCode's generated provider and model picker behavior. */

import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { execFileSync } from "child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { getIndexFunction, loadScriptHelpers } from "./setup.js";

const OPENCODE_INSTALL_SCRIPT = path.resolve("software/scripts/advanced/llm/opencode/install.sh");
const OPENCODE_PROFILE = path.resolve("software/scripts/advanced/llm/opencode/opencode.profile.bash");
const OPENCODE_MIGRATION_SCRIPT = path.resolve("software/scripts/advanced/llm/migrate-opencode-v2.standalone.js");

// TODO: Remove this migration regression test with the standalone migration script.

/**
 * Loads the migration script with real filesystem operations against a temporary home.
 * @param {string} fakeHome - Temporary home root for the migration.
 * @returns {Record<string, any>} Script sandbox containing `doWork`.
 */
function loadOpencodeMigrationSandbox(fakeHome) {
  const source = fs.readFileSync(OPENCODE_MIGRATION_SCRIPT, "utf-8").replace(/^(const|let|var) /gm, "var ");
  const sandbox = {
    BASE_HOMEDIR_LINUX: fakeHome,
    IS_DRY_RUN: false,
    fs,
    path,
    log: () => {},
    mkdir: async (folder) => fs.mkdirSync(folder, { recursive: true }),
  };
  vm.runInNewContext(source, sandbox);
  return sandbox;
}

/**
 * Runs the OpenCode installer with package and binary operations stubbed.
 * @param {boolean} refreshMode - Whether the installer runs as an explicit refresh target.
 * @returns {{ stable: string, npm: string, oldPackageRemoved: boolean }} Stubbed command arguments.
 */
function runOpencodeInstall(refreshMode) {
  const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-install-"));
  const v2BinaryPath = path.join(tempFolder, "home/.local/bin/opencode");
  const installedPackagePath = path.join(tempFolder, "home/.local/lib/node_modules/opencode-ai");
  const npmMarkerPath = path.join(tempFolder, "npm-args");
  fs.mkdirSync(path.dirname(v2BinaryPath), { recursive: true });
  fs.mkdirSync(installedPackagePath, { recursive: true });
  fs.writeFileSync(path.join(installedPackagePath, "package.json"), '{"name":"opencode-ai","version":"1.19.3"}');
  fs.writeFileSync(v2BinaryPath, "#!/bin/bash\nprintf 'v2:%s\\n' \"$*\"\n");
  fs.chmodSync(v2BinaryPath, 0o755);
  const script = [
    `HOME=${JSON.stringify(path.join(tempFolder, "home"))}`,
    `IS_REFRESH_MODE=${refreshMode ? 1 : 0}`,
    `BASHRC_TEMP_DIR=${JSON.stringify(tempFolder)}`,
    `function npm_install_global() { printf '%s %s' "$*" > ${JSON.stringify(npmMarkerPath)}; }`,
    "function has_persistent_binary() { return 0; }",
    `function opencode() { printf '%s' "$*" > ${JSON.stringify(path.join(tempFolder, "stable-args"))}; }`,
    `source ${JSON.stringify(OPENCODE_INSTALL_SCRIPT)}`,
  ].join("\n");

  try {
    execFileSync("/bin/bash", ["-c", script]);
    return {
      npm: fs.existsSync(npmMarkerPath) ? fs.readFileSync(npmMarkerPath, "utf-8") : "",
      stable: fs.existsSync(path.join(tempFolder, "stable-args")) ? fs.readFileSync(path.join(tempFolder, "stable-args"), "utf-8") : "",
      oldPackageRemoved: !fs.existsSync(installedPackagePath),
    };
  } finally {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

/**
 * Runs the canonical OpenCode command against a fixture v2 binary.
 * @returns {string[]} Output from the canonical command and alias.
 */
function runOpencodeAliases() {
  const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-aliases-"));
  const binaryPath = path.join(tempFolder, ".local/bin/opencode");
  fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
  fs.writeFileSync(binaryPath, "#!/bin/bash\nprintf 'v2:%s\\n' \"$*\"\n");
  fs.chmodSync(binaryPath, 0o755);
  const script = [
    `HOME=${JSON.stringify(tempFolder)}`,
    `PATH=${JSON.stringify(path.join(tempFolder, ".local/bin"))}:$PATH`,
    "function is_help_arg() { return 1; }",
    "function llm_setup_activate() { return 0; }",
    `source ${JSON.stringify(OPENCODE_PROFILE)}`,
    "opencode --version",
    "eval 'op --version'",
  ].join("\n");

  try {
    return execFileSync("/bin/bash", ["-O", "expand_aliases", "-c", script], { encoding: "utf-8" }).trim().split("\n");
  } finally {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

describe("OpenCode Ollama metadata", () => {
  it("refreshes the upstream model catalog during an explicit script refresh", () => {
    const result = runOpencodeInstall(true);

    expect(result.stable).toBe("models --refresh");
  });

  it("does not refresh the upstream model catalog during a normal setup run", () => {
    const result = runOpencodeInstall(false);

    expect(result.stable).toBe("");
  });

  it("installs OpenCode 2 beta as the canonical command", () => {
    const npmArgs = runOpencodeInstall(false).npm;

    expect(npmArgs.trim()).toBe("opencode-ai@beta opencode");
    expect(runOpencodeInstall(false).oldPackageRemoved).toBe(true);
  });

  it("routes opencode and op to the canonical v2 binary", () => {
    expect(runOpencodeAliases()).toEqual(["v2:--version", "v2:--version"]);
  });

  it("migrates the isolated prefix into a backup without touching shared data", async () => {
    const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-migration-"));
    const legacyPrefix = path.join(tempFolder, ".local/opencode-2");
    const canonicalBinary = path.join(tempFolder, ".local/bin/opencode");
    fs.mkdirSync(legacyPrefix, { recursive: true });
    fs.mkdirSync(path.dirname(canonicalBinary), { recursive: true });
    fs.writeFileSync(canonicalBinary, "v2");
    try {
      await loadOpencodeMigrationSandbox(tempFolder).doWork();
      expect(fs.existsSync(legacyPrefix)).toBe(false);
      expect(fs.readdirSync(path.join(tempFolder, ".local/opencode-migrations"))).toHaveLength(1);
      expect(fs.readFileSync(canonicalBinary, "utf-8")).toBe("v2");
    } finally {
      fs.rmSync(tempFolder, { recursive: true, force: true });
    }
  });

  it("leaves GitHub Copilot model discovery native when no extension is verified", () => {
    const buildOpencodeConfig = getIndexFunction("_buildOpencodeConfig");
    const config = buildOpencodeConfig([]);

    expect(config.provider).not.toHaveProperty("github-copilot");
    expect(config.agent.review.model).toBe("github-copilot/claude-opus-4.8");
  });

  it("pulls the requested default models on a 24 GB card", () => {
    const getOllamaModelsForVram = getIndexFunction("getOllamaModelsForVram");
    expect(getOllamaModelsForVram(24576)).toEqual(["glm-4.7-flash", "qwen2.5-coder:32b", "gemma4:26b", "qwen2.5-coder:3b-base"]);
  });

  it("pulls the medium tier on a 16 GB card", () => {
    const getOllamaModelsForVram = getIndexFunction("getOllamaModelsForVram");
    expect(getOllamaModelsForVram(16376)).toEqual(["gpt-oss:20b", "gemma4:12b", "qwen2.5-coder:3b-base"]);
  });

  it("drops a 12 GB card to the small tier", () => {
    const getOllamaModelsForVram = getIndexFunction("getOllamaModelsForVram");
    expect(getOllamaModelsForVram(12288)).toEqual(["qwen2.5-coder:7b", "gemma3:4b", "qwen2.5-coder:1.5b-base"]);
  });

  it("pulls the small tier on an 8 GB card", () => {
    const getOllamaModelsForVram = getIndexFunction("getOllamaModelsForVram");
    expect(getOllamaModelsForVram(8192)).toEqual(["qwen2.5-coder:7b", "gemma3:4b", "qwen2.5-coder:1.5b-base"]);
  });

  it("falls back to the tiny tier when VRAM is unknown", () => {
    const getOllamaModelsForVram = getIndexFunction("getOllamaModelsForVram");
    expect(getOllamaModelsForVram(0)).toEqual(["qwen2.5-coder:3b", "gemma3:4b", "qwen2.5-coder:1.5b-base"]);
  });

  it("falls back to the tiny tier on a 6 GB card", () => {
    const getOllamaModelsForVram = getIndexFunction("getOllamaModelsForVram");
    expect(getOllamaModelsForVram(6144)).toEqual(["qwen2.5-coder:3b", "gemma3:4b", "qwen2.5-coder:1.5b-base"]);
  });

  it("prefers GLM-4.7-Flash for the local coding agent", () => {
    const buildOpencodeConfig = getIndexFunction("_buildOpencodeConfig");
    const config = buildOpencodeConfig([
      {
        id: "ollama-local",
        name: "Ollama - 127.0.0.1:11434",
        baseURL: "http://127.0.0.1:11434/v1",
        models: [{ name: "qwen3-coder:30b-a3b-q4_K_M" }, { name: "glm-4.7-flash" }],
      },
    ]);

    expect(config.agent.local.model).toBe("ol-local/glm-4.7-flash");
    expect(config.provider["ol-local"].models["glm-4.7-flash"]).not.toHaveProperty("limit");
  });

  it("shows the short host name, model, and Ollama address without duplicate labels", () => {
    const buildOpencodeConfig = getIndexFunction("_buildOpencodeConfig");
    const config = buildOpencodeConfig([
      {
        id: "ollama-my-desktop",
        name: "My-desktop - 192.168.1.45:11434",
        baseURL: "http://192.168.1.45:11434/v1",
        models: [{ name: "gpt-oss:20b" }],
      },
    ]);

    expect(config.provider["ol-my-desktop"].name).toBe("ol-my-desktop");
    expect(config.provider["ol-my-desktop"].models["gpt-oss:20b"].name).toBe("gpt-oss:20b / 192.168.1.45:11434");
    expect(config.agent.local.model).toBe("ol-my-desktop/gpt-oss:20b");
    expect(config.provider["ollama-my-desktop"]).toBeUndefined();
  });
});
