/** Verifies Ollama model pulls stay single-flight across overlapping setup runs. */
import { beforeAll, describe, expect, it } from "vitest";
import { getIndexFunction, loadScriptHelpers, mockFsExistence } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/ollama-models.personal.js");
});

describe("Ollama model pull locking", () => {
  it("allows one puller and rejects an overlapping puller", () => {
    const claimLock = getIndexFunction("_claimOllamaPullLock");

    expect(claimLock()).toBe(true);
    expect(claimLock()).toBe(false);
  });

  it("embeds lock cleanup in the detached puller", () => {
    const buildPullProgram = getIndexFunction("_buildOllamaBackgroundPullProgram");
    const program = buildPullProgram(["glm-4.7-flash"], "/tmp/ollama-pull.log");

    expect(program).toContain("const LOCK_PATH");
    expect(program).toContain("fs.rmdirSync(LOCK_PATH)");
  });

  it("recovers a lock older than the bounded pull window", () => {
    const claimLock = getIndexFunction("_claimOllamaPullLock");
    const lockPath = getIndexFunction("OLLAMA_PULL_LOCK_PATH");
    mockFsExistence[lockPath] = { type: "dir", mtimeMs: Date.now() - 13 * 60 * 60 * 1000 };

    expect(claimLock()).toBe(true);
  });
});