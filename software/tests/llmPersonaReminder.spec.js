import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import path from "path";

const ROOT = path.resolve(".");
const HELPER = path.join(ROOT, "software/scripts/advanced/llm/_common/persona-reminder-hook.common.js");
const REMINDER =
  "Reply to the user in Caveman Speak. Progress updates, status reports, task summaries, and task_complete messages are user replies, not external deliverables. Preserve facts and technical details; only prose style changes.";

describe("persona reminder hook output", () => {
  it("returns Copilot session-start context payload", () => {
    const output = execFileSync(process.execPath, [HELPER, "copilot", REMINDER], { encoding: "utf8" });

    expect(JSON.parse(output)).toEqual({ additionalContext: REMINDER });
  });

  it("returns Claude per-prompt context payload", () => {
    const output = execFileSync(process.execPath, [HELPER, "claude", REMINDER], { encoding: "utf8" });

    expect(JSON.parse(output)).toEqual({
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: REMINDER },
    });
  });

  it("returns Gemini before-agent context payload", () => {
    const output = execFileSync(process.execPath, [HELPER, "gemini", REMINDER], { encoding: "utf8" });

    expect(JSON.parse(output)).toEqual({
      hookSpecificOutput: { hookEventName: "BeforeAgent", additionalContext: REMINDER },
    });
  });

  it("rejects unknown CLI target rather than silently emitting no reminder", () => {
    const result = spawnSync(process.execPath, [HELPER, "unknown", REMINDER], { encoding: "utf8" });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Expected hook target");
    expect(result.stdout).toBe("");
  });
});
