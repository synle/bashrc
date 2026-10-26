/** Verifies Pi refreshes Ollama providers and Copilot overrides while preserving user configuration. */
import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileSystem, getIndexConstant, getIndexFunction, loadScriptHelpers, mockFsExistence, setSandboxGlobal } from "./setup.js";

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
    expect(result.providers["github-copilot"]).toMatchInlineSnapshot(`
      {
        "customSetting": "kept",
        "headers": {
          "Editor-Version": "vscode/1.107.0",
          "X-User-Header": "kept",
        },
      }
    `);
  });

  it("migrates managed names and model headers to overrides without replacing native metadata", async () => {
    mockFsExistence[PI_MODELS_PATH] = true;
    fileSystem[PI_MODELS_PATH] = JSON.stringify({
      providers: {
        "github-copilot": {
          headers: { "Editor-Version": "vscode/1.107.0", "X-User-Header": "kept" },
          models: [
            { id: "gpt-6.1-sol", name: "GitHub Copilot / gpt-6.1-sol" },
            { id: "claude-opus-4.8", name: "GitHub Copilot / claude-opus-4.8", headers: { "anthropic-beta": "test-beta" } },
          ],
        },
      },
    });

    await getIndexFunction("_doPiModelsWork")([]);

    const copilot = JSON.parse(fileSystem[PI_MODELS_PATH]).providers["github-copilot"];
    expect(copilot).toMatchInlineSnapshot(`
      {
        "headers": {
          "Editor-Version": "vscode/1.107.0",
          "X-User-Header": "kept",
        },
        "modelOverrides": {
          "claude-opus-4.8": {
            "headers": {
              "anthropic-beta": "test-beta",
            },
            "name": "GitHub Copilot / claude-opus-4.8",
          },
          "gpt-6.1-sol": {
            "name": "GitHub Copilot / gpt-6.1-sol",
          },
        },
      }
    `);

    const firstRun = fileSystem[PI_MODELS_PATH];
    await getIndexFunction("_doPiModelsWork")([]);
    expect(fileSystem[PI_MODELS_PATH]).toBe(firstRun);
  });

  it("preserves custom definitions and explicit overrides when migrating legacy entries", async () => {
    mockFsExistence[PI_MODELS_PATH] = true;
    fileSystem[PI_MODELS_PATH] = JSON.stringify({
      providers: {
        "github-copilot": {
          models: [
            { id: "gpt-6.1-sol", name: "GitHub Copilot / gpt-6.1-sol", headers: { "X-Legacy": "kept", "X-Shared": "old" } },
            { id: "custom", name: "User model", contextWindow: 64000 },
            { id: "explicit", name: "GitHub Copilot / explicit", contextWindow: 256000 },
          ],
          modelOverrides: {
            "gpt-6.1-sol": { name: "Personal name", contextWindow: 900000, headers: { "X-Shared": "new" } },
            other: { name: "Other name" },
          },
        },
      },
    });

    await getIndexFunction("_doPiModelsWork")([]);

    expect(JSON.parse(fileSystem[PI_MODELS_PATH]).providers["github-copilot"]).toMatchInlineSnapshot(`
      {
        "headers": {
          "Editor-Version": "vscode/1.107.0",
        },
        "modelOverrides": {
          "gpt-6.1-sol": {
            "contextWindow": 900000,
            "headers": {
              "X-Legacy": "kept",
              "X-Shared": "new",
            },
            "name": "Personal name",
          },
          "other": {
            "name": "Other name",
          },
        },
        "models": [
          {
            "contextWindow": 64000,
            "id": "custom",
            "name": "User model",
          },
          {
            "contextWindow": 256000,
            "id": "explicit",
            "name": "GitHub Copilot / explicit",
          },
        ],
      }
    `);
  });

  it("generates registry names and fast headers as overrides while retaining user model headers", async () => {
    const registry = getIndexConstant("LLM_COPILOT_MODEL_EXTENSIONS");
    setSandboxGlobal("LLM_COPILOT_MODEL_EXTENSIONS", {
      "catalog-model": {},
      "fast-model": { fast: { options: { speed: "fast" }, headers: { "X-Fast": "enabled" } } },
    });
    mockFsExistence[PI_MODELS_PATH] = true;
    fileSystem[PI_MODELS_PATH] = JSON.stringify({
      providers: {
        "github-copilot": {
          modelOverrides: { "fast-model": { contextWindow: 500000, headers: { "X-User": "kept", "X-Fast": "old" } } },
        },
      },
    });

    try {
      await getIndexFunction("_doPiModelsWork")([]);
      expect(JSON.parse(fileSystem[PI_MODELS_PATH]).providers["github-copilot"]).toMatchInlineSnapshot(`
        {
          "headers": {
            "Editor-Version": "vscode/1.107.0",
          },
          "modelOverrides": {
            "catalog-model": {
              "name": "GitHub Copilot / catalog-model",
            },
            "fast-model": {
              "contextWindow": 500000,
              "headers": {
                "X-Fast": "enabled",
                "X-User": "kept",
              },
              "name": "GitHub Copilot / fast-model",
            },
          },
        }
      `);
    } finally {
      setSandboxGlobal("LLM_COPILOT_MODEL_EXTENSIONS", registry);
    }
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

    expect(JSON.parse(fileSystem[PI_MODELS_PATH]).providers).toMatchInlineSnapshot(`
      {
        "custom-local": {
          "models": [
            {
              "id": "manual-model",
            },
          ],
        },
        "github-copilot": {
          "headers": {
            "Editor-Version": "vscode/1.107.0",
          },
        },
      }
    `);
  });

  it("creates the Copilot header config when models.json does not exist", async () => {
    await getIndexFunction("_doPiModelsWork")("/mock/home/.pi/agent", []);

    expect(JSON.parse(fileSystem[PI_MODELS_PATH]).providers["github-copilot"]).toMatchInlineSnapshot(`
      {
        "headers": {
          "Editor-Version": "vscode/1.107.0",
        },
      }
    `);
  });
});
