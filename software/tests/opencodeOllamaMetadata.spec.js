/** Verifies OpenCode's generated Ollama provider and model picker metadata. */

import { beforeAll, describe, expect, it } from "vitest";
import { getIndexFunction, loadScriptHelpers } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

describe("OpenCode Ollama metadata", () => {
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
