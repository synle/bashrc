/** Verifies OpenCode's generated Ollama provider and model picker metadata. */

import { beforeAll, describe, expect, it } from "vitest";
import { getIndexFunction, loadScriptHelpers } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

describe("OpenCode Ollama metadata", () => {
  it("pulls GLM-4.7-Flash, Gemma 4 26B, and the 3B FIM model on a 24 GB card", () => {
    const getOllamaModelsForVram = getIndexFunction("getOllamaModelsForVram");
    expect(getOllamaModelsForVram(24576)).toEqual(["glm-4.7-flash:q4_K_M", "gemma4:26b", "qwen2.5-coder:3b-base"]);
  });

  it("pulls the medium tier on a 16 GB card", () => {
    const getOllamaModelsForVram = getIndexFunction("getOllamaModelsForVram");
    expect(getOllamaModelsForVram(16376)).toEqual(["qwen2.5-coder:14b", "gemma3:12b", "qwen2.5-coder:3b-base"]);
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

  it("prefers GLM-4.7-Flash q4_K_M for the local coding agent", () => {
    const buildOpencodeConfig = getIndexFunction("_buildOpencodeConfig");
    const config = buildOpencodeConfig([
      {
        id: "ollama-local",
        name: "Ollama - 127.0.0.1:11434",
        baseURL: "http://127.0.0.1:11434/v1",
        models: [{ name: "qwen3-coder:30b-a3b-q4_K_M" }, { name: "glm-4.7-flash:q4_K_M" }],
      },
    ]);

    expect(config.agent.local.model).toBe("ol-local/glm-4.7-flash:q4_K_M");
    expect(config.provider["ol-local"].models["glm-4.7-flash:q4_K_M"]).not.toHaveProperty("limit");
  });

  it("shows the short host name, model, and Ollama address without duplicate labels", () => {
    const buildOpencodeConfig = getIndexFunction("_buildOpencodeConfig");
    const config = buildOpencodeConfig([
      {
        id: "ollama-my-desktop",
        name: "My-desktop - 192.168.1.45:11434",
        baseURL: "http://192.168.1.45:11434/v1",
        models: [{ name: "qwen2.5-coder:14b" }],
      },
    ]);

    expect(config.provider["ol-my-desktop"].name).toBe("ol-my-desktop");
    expect(config.provider["ol-my-desktop"].models["qwen2.5-coder:14b"].name).toBe("qwen2.5-coder:14b / 192.168.1.45:11434");
    expect(config.agent.local.model).toBe("ol-my-desktop/qwen2.5-coder:14b");
    expect(config.provider["ollama-my-desktop"]).toBeUndefined();
  });
});
