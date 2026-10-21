/** Verifies Pi refreshes generated Ollama models while preserving user providers. */
import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileSystem, getIndexFunction, loadScriptHelpers, mockFsExistence } from "./setup.js";

const PI_MODELS_PATH = "/mock/home/.pi/agent/models.json";
const PI_SETUP_SOURCE = fs.readFileSync(path.resolve("software/scripts/advanced/llm/pi/setup.js"), "utf-8");

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/pi/setup.js");
});

describe("Pi setup wiring", () => {
  it("logs the computed pi agent folder instead of an omitted variable", () => {
    expect(PI_SETUP_SOURCE).toContain('log(">> Configuring pi:", piAgentDir);');
    expect(PI_SETUP_SOURCE).not.toContain('log(">> Configuring pi:", PI_AGENT_DIR);');
  });
});

describe("Pi Ollama provider refresh", () => {
  it("adds Copilot's required IDE header while preserving user provider settings", async () => {
    mockFsExistence[PI_MODELS_PATH] = true;
    fileSystem[PI_MODELS_PATH] = JSON.stringify({
      providers: {
        "github-copilot": {
          headers: { "X-User-Header": "kept", "Editor-Version": "user-value" },
          customSetting: "kept",
        },
      },
    });

    await getIndexFunction("_doPiModelsWork")([]);

    const result = JSON.parse(fileSystem[PI_MODELS_PATH]);
    expect(result.providers["github-copilot"]).toEqual({
      headers: { "X-User-Header": "kept", "Editor-Version": "vscode/1.107.0" },
      customSetting: "kept",
    });
  });

  it("removes models no longer reported by Ollama and keeps user-managed providers", async () => {
    mockFsExistence[PI_MODELS_PATH] = true;
    fileSystem[PI_MODELS_PATH] = JSON.stringify({
      providers: {
        "ollama-sy-omen45l": {
          models: [{ id: "gemma4:26b" }, { id: "qwen2.5-coder:3b-base" }, { id: "glm-4.7-flash:q4_K_M" }],
        },
        "custom-local": { models: [{ id: "manual-model" }] },
      },
    });

    await getIndexFunction("_doPiModelsWork")([
      {
        id: "ollama-sy-omen45l",
        name: "Sy-omen45l - 192.168.1.45:11434",
        baseURL: "http://192.168.1.45:11434/v1",
        models: [{ name: "gemma4:26b" }, { name: "qwen2.5-coder:3b-base" }],
      },
    ]);

    const result = JSON.parse(fileSystem[PI_MODELS_PATH]);
    expect(result.providers["ollama-sy-omen45l"].models.map((model) => model.id)).toEqual(["gemma4:26b", "qwen2.5-coder:3b-base"]);
    expect(result.providers["custom-local"].models).toEqual([{ id: "manual-model" }]);
  });

  it("removes generated Ollama providers when no models are currently discovered", async () => {
    mockFsExistence[PI_MODELS_PATH] = true;
    fileSystem[PI_MODELS_PATH] = JSON.stringify({
      providers: {
        "ollama-sy-omen45l": { models: [{ id: "glm-4.7-flash:q4_K_M" }] },
        "custom-local": { models: [{ id: "manual-model" }] },
      },
    });

    await getIndexFunction("_doPiModelsWork")([]);

    expect(JSON.parse(fileSystem[PI_MODELS_PATH]).providers).toEqual({
      "custom-local": { models: [{ id: "manual-model" }] },
      "github-copilot": { headers: { "Editor-Version": "vscode/1.107.0" } },
    });
  });

  it("creates the Copilot header config when models.json does not exist", async () => {
    await getIndexFunction("_doPiModelsWork")("/mock/home/.pi/agent", []);

    expect(JSON.parse(fileSystem[PI_MODELS_PATH]).providers["github-copilot"]).toEqual({
      headers: { "Editor-Version": "vscode/1.107.0" },
    });
  });
});
