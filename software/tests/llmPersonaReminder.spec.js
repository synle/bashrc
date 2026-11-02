import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const ROOT = path.resolve(".");
const HELPER = path.join(ROOT, "software/scripts/advanced/llm/_common/persona-reminder-hook.common.js");
const REMINDER =
  "Reply to the user in Caveman Speak. Progress updates, status reports, task summaries, and task_complete messages are user replies, not external deliverables. Preserve facts and technical details; only prose style changes.";

describe("persona reminder hook output", () => {
  it("loads full Claude rules at session start and inherits persisted mode in subagents", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "persona-hooks-"));
    try {
      fs.copyFileSync(HELPER, path.join(folder, "persona-reminder-hook.js"));
      fs.copyFileSync(
        path.join(ROOT, "software/scripts/advanced/llm/_common/persona-runtime.common.js"),
        path.join(folder, "persona-runtime.js"),
      );
      fs.writeFileSync(
        path.join(folder, "persona-rules.json"),
        JSON.stringify({ caveman: "Full grammatical rules", ultracave: "Full stripped rules" }),
      );
      const helper = path.join(folder, "persona-reminder-hook.js");
      const start = execFileSync(process.execPath, [helper, "claude", REMINDER, "SessionStart"], {
        input: JSON.stringify({ session_id: "one" }),
        encoding: "utf8",
      });
      expect(JSON.parse(start).hookSpecificOutput.additionalContext).toContain("Full grammatical rules");
      execFileSync(process.execPath, [helper, "claude", REMINDER, "UserPromptSubmit"], {
        input: JSON.stringify({ session_id: "one", prompt: "/ultracave" }),
      });
      const child = execFileSync(process.execPath, [helper, "claude", REMINDER, "SubagentStart"], {
        input: JSON.stringify({ session_id: "one" }),
        encoding: "utf8",
      });
      expect(JSON.parse(child).hookSpecificOutput).toEqual({
        hookEventName: "SubagentStart",
        additionalContext: '<sy_persona mode="ultracave">\nFull grammatical rules\n\nFull stripped rules\n</sy_persona>',
      });
      const other = execFileSync(process.execPath, [helper, "claude", REMINDER, "SessionStart"], {
        input: JSON.stringify({ session_id: "two" }),
        encoding: "utf8",
      });
      expect(JSON.parse(other).hookSpecificOutput.additionalContext).toContain('mode="caveman"');
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
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
