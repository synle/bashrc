/** Verifies managed model names never pin context windows or replace user model metadata. */
import { beforeAll, describe, expect, it } from "vitest";
import { fileSystem, getIndexConstant, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/claude/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/gemini/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/copilot/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

describe("Claude managed model selection", () => {
  it("seeds only the model ID without selecting a context variant", async () => {
    await getIndexFunction("_doSettingsWork")("/mock/home/.claude");

    const settings = JSON.parse(fileSystem["/mock/home/.claude/settings.json"]);
    expect(settings.model).toBe("claude-opus-4-7");
    expect(settings).not.toHaveProperty("modelOverrides");
  });

  it("migrates the exact former managed context variant and remains idempotent", async () => {
    fileSystem["/mock/home/.claude/settings.json"] = JSON.stringify({
      model: "claude-opus-4-7[1m]",
      env: { USER_SETTING: "kept" },
    });

    await getIndexFunction("_doSettingsWork")("/mock/home/.claude");

    const firstRun = fileSystem["/mock/home/.claude/settings.json"];
    expect(JSON.parse(firstRun).model).toBe("claude-opus-4-7");
    expect(JSON.parse(firstRun).env).toEqual({ USER_SETTING: "kept" });
    await getIndexFunction("_doSettingsWork")("/mock/home/.claude");
    expect(fileSystem["/mock/home/.claude/settings.json"]).toBe(firstRun);
  });

  it.each(["sonnet", "claude-sonnet-4-6[1m]", "claude-opus-4-7", ""])("preserves an explicit user model %j", async (model) => {
    fileSystem["/mock/home/.claude/settings.json"] = JSON.stringify({ model });

    await getIndexFunction("_doSettingsWork")("/mock/home/.claude");

    expect(JSON.parse(fileSystem["/mock/home/.claude/settings.json"]).model).toBe(model);
  });
});

describe("Other clients retain native or user-owned context metadata", () => {
  it("writes OpenCode Copilot names and fast variants without model limits", () => {
    const registry = getIndexConstant("LLM_COPILOT_MODEL_EXTENSIONS");
    setSandboxGlobal("LLM_COPILOT_MODEL_EXTENSIONS", {
      "catalog-model": {},
      "fast-model": { fast: { options: { speed: "fast" }, headers: { "X-Fast": "enabled" } } },
    });

    try {
      const config = getIndexFunction("_buildOpencodeConfig")([]);
      expect(JSON.parse(JSON.stringify(config.provider["github-copilot"].models))).toMatchInlineSnapshot(`
        {
          "catalog-model": {
            "name": "github-copilot / catalog-model",
          },
          "fast-model": {
            "name": "github-copilot / fast-model",
            "variants": {
              "fast": {
                "headers": {
                  "X-Fast": "enabled",
                },
                "options": {
                  "speed": "fast",
                },
              },
            },
          },
        }
      `);
    } finally {
      setSandboxGlobal("LLM_COPILOT_MODEL_EXTENSIONS", registry);
    }
  });

  it("leaves Gemini model configuration unchanged through settings writes", async () => {
    fileSystem["/mock/home/.gemini/settings.json"] = JSON.stringify({ model: { name: "user-model", maxSessionTurns: 0 } });

    await getIndexFunction("_doGeminiSettingsWork")("/mock/home/.gemini");

    expect(JSON.parse(fileSystem["/mock/home/.gemini/settings.json"]).model).toEqual({ name: "user-model", maxSessionTurns: 0 });
  });

  it("leaves Copilot model selection unchanged through settings writes", async () => {
    fileSystem["/mock/home/.copilot/settings.json"] = JSON.stringify({ model: "user-model" });

    await getIndexFunction("_doCopilotSettingsWork")("/mock/home/.copilot");

    expect(JSON.parse(fileSystem["/mock/home/.copilot/settings.json"]).model).toBe("user-model");
    expect(getIndexConstant("COPILOT_MANAGED_SETTINGS")).not.toHaveProperty("model");
    expect(getIndexConstant("GEMINI_MANAGED_SETTINGS")).not.toHaveProperty("model");
  });
});
