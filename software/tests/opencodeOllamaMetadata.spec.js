/** Verifies OpenCode's generated provider and model picker behavior. */

import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { getIndexFunction, loadScriptHelpers } from "./setup.js";

const OPENCODE_INSTALL_SCRIPT = path.resolve("software/scripts/advanced/llm/opencode/install.sh");
const OPENCODE_PROFILE = path.resolve("software/scripts/advanced/llm/opencode/opencode.profile.bash");

/**
 * Runs the OpenCode installer with package and binary operations stubbed.
 * @param {boolean} refreshMode - Whether the installer runs as an explicit refresh target.
 * @returns {{ stable: string, v2: string, npm: string }} Stubbed command arguments.
 */
function runOpencodeInstall(refreshMode) {
  const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-install-"));
  const stableMarkerPath = path.join(tempFolder, "opencode-args");
  const v2Prefix = path.join(tempFolder, "home/.local/opencode-2");
  const v2BinaryPath = path.join(v2Prefix, "bin/opencode");
  const v2MarkerPath = path.join(tempFolder, "opencode-2-args");
  const npmMarkerPath = path.join(tempFolder, "npm-args");
  fs.mkdirSync(path.dirname(v2BinaryPath), { recursive: true });
  fs.writeFileSync(v2BinaryPath, `#!/bin/bash\nprintf '%s' "$*" > ${JSON.stringify(v2MarkerPath)}\n`);
  fs.chmodSync(v2BinaryPath, 0o755);
  const script = [
    `HOME=${JSON.stringify(path.join(tempFolder, "home"))}`,
    `IS_REFRESH_MODE=${refreshMode ? 1 : 0}`,
    `BASHRC_TEMP_DIR=${JSON.stringify(tempFolder)}`,
    `function npm() { printf '%s' "$*" > ${JSON.stringify(npmMarkerPath)}; }`,
    "function npm_install_global() { :; }",
    "function has_persistent_binary() { return 0; }",
    `function opencode() { printf '%s' "$*" > ${JSON.stringify(stableMarkerPath)}; }`,
    `source ${JSON.stringify(OPENCODE_INSTALL_SCRIPT)}`,
  ].join("\n");

  try {
    execFileSync("/bin/bash", ["-c", script]);
    return {
      stable: fs.existsSync(stableMarkerPath) ? fs.readFileSync(stableMarkerPath, "utf-8") : "",
      v2: fs.existsSync(v2MarkerPath) ? fs.readFileSync(v2MarkerPath, "utf-8") : "",
      npm: fs.existsSync(npmMarkerPath) ? fs.readFileSync(npmMarkerPath, "utf-8") : "",
    };
  } finally {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

/**
 * Runs both OpenCode 2 command names against an isolated fixture binary.
 * @returns {string[]} Output from the full and short v2 command names.
 */
function runOpencode2Aliases() {
  const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-2-aliases-"));
  const binaryPath = path.join(tempFolder, ".local/opencode-2/bin/opencode");
  fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
  fs.writeFileSync(binaryPath, "#!/bin/bash\nprintf 'v2:%s\\n' \"$*\"\n");
  fs.chmodSync(binaryPath, 0o755);
  const script = [
    `HOME=${JSON.stringify(tempFolder)}`,
    "function is_help_arg() { return 1; }",
    `source ${JSON.stringify(OPENCODE_PROFILE)}`,
    "opencode_2 --version",
    "eval 'op_2 --version'",
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
    expect(result.v2).toBe("models --refresh");
  });

  it("does not refresh the upstream model catalog during a normal setup run", () => {
    const result = runOpencodeInstall(false);

    expect(result.stable).toBe("upgrade --method npm");
    expect(result.v2).toBe("");
  });

  it("installs OpenCode 2 beta under its isolated prefix", () => {
    const npmArgs = runOpencodeInstall(false).npm;

    expect(npmArgs).toMatch(/^install -g --prefix .*\/home\/\.local\/opencode-2 opencode-ai@beta$/);
  });

  it("routes only opencode_2 and op_2 to the isolated OpenCode 2 binary", () => {
    expect(runOpencode2Aliases()).toEqual(["v2:--version", "v2:--version"]);
  });

  it("leaves GitHub Copilot model discovery to opencode", () => {
    const buildOpencodeConfig = getIndexFunction("_buildOpencodeConfig");
    const config = buildOpencodeConfig([]);

    expect(config.provider["github-copilot"]).not.toHaveProperty("models");
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
