/** Verifies OpenCode's generated Ollama provider and model picker metadata. */

import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { getIndexFunction, loadScriptHelpers } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

describe("OpenCode Ollama metadata", () => {
  it("bootstraps the Gemma 4 vision model", () => {
    const content = fs.readFileSync(path.resolve("software/scripts/advanced/llm/ollama.sh"), "utf-8");
    expect(content).toContain('_vision_model="gemma4:26b"');
    expect(content).toContain('for _model in "$_agent_model" "$_vision_model" "$_autocomplete_model"; do');
  });

  it("prefers GLM-4.7-Flash q4_K_M for the local coding agent", () => {
    const buildOpencodeConfig = getIndexFunction("_buildOpencodeConfig");
    const config = buildOpencodeConfig([
      {
        id: "ollama-local",
        name: "Ollama - 127.0.0.1:11434",
        baseURL: "http://127.0.0.1:11434/v1",
        models: [{ name: "qwen3-coder:30b-a3b" }, { name: "glm-4.7-flash:q4_K_M" }],
      },
    ]);

    expect(config.agent.local.model).toBe("ol-local/glm-4.7-flash:q4_K_M");
    expect(config.provider["ol-local"].models["glm-4.7-flash:q4_K_M"].limit).toEqual({
      context: 131072,
      output: 8192,
    });
  });

  it("shows the short host name, model, and Ollama address without duplicate labels", () => {
    const buildOpencodeConfig = getIndexFunction("_buildOpencodeConfig");
    const config = buildOpencodeConfig([
      {
        id: "ollama-sy-omen45l",
        name: "Sy-omen45l - 192.168.1.45:11434",
        baseURL: "http://192.168.1.45:11434/v1",
        models: [{ name: "qwen3-coder:30b-a3b" }],
      },
    ]);

    expect(config.provider["ol-sy-omen45l"].name).toBe("ol-sy-omen45l");
    expect(config.provider["ol-sy-omen45l"].models["qwen3-coder:30b-a3b"].name).toBe("qwen3-coder:30b-a3b / 192.168.1.45:11434");
    expect(config.agent.local.model).toBe("ol-sy-omen45l/qwen3-coder:30b-a3b");
    expect(config.provider["ollama-sy-omen45l"]).toBeUndefined();
  });
});
