/** Source-contract checks for the plan adapter; these do not prove live agent compliance. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/** @type {string} Canonical shared plan-execution adapter. */
const BODY = fs.readFileSync(path.resolve("software/scripts/advanced/llm/_common/v_current/skills/execute-plan.md"), "utf-8");

describe("execute-plan guidance", () => {
  it("delegates implementation and publication to their existing owners", () => {
    expect(BODY).toContain("<<LLM_ROOT_FOLDER>>/skills/sy-loop/SKILL.md");
    expect(BODY).toContain("<<LLM_ROOT_FOLDER>>/instructions/pr-workflow.md");
    expect(BODY).toContain("Apply the loop inline");
    expect(BODY).toContain("not its iteration cap, stall detection, scope, or safety rules");
  });

  it("keeps the four publication checkpoints in order", () => {
    expect(Array.from(BODY.matchAll(/^### \d\. ([A-Za-z/]+)/gm), ([, label]) => label)).toMatchInlineSnapshot(`
      [
        "Placeholder",
        "Implementation",
        "Validation",
        "Feedback/CI",
      ]
    `);
    expect(Array.from(BODY.matchAll(/^## (.+)$/gm), ([, heading]) => heading)).toEqual(["Purpose", "Steps", "Safety", "Verification"]);
  });

  it("keeps verified pieces resumable and publishes each reviewable implementation", () => {
    expect(BODY).toContain("Each piece is one loop item; follow dependency order");
    expect(BODY).toContain("Keep loop state in the selected plan rather than opening a duplicate ledger");
    expect(BODY).toContain("At each reviewable implementation checkpoint, format changed files");
    expect(BODY).toContain("delegate sync through the shared sync-PR-branch workflow");
    expect(BODY).toContain("push before extended validation or coverage");
  });

  it("handles existing feedback before validated publication without an empty checkpoint commit", () => {
    expect(BODY).toContain("Before publication, fetch fresh, fully paginated PR feedback and latest-head checks");
    expect(BODY).toContain("Address actionable comments already present under the shared disposition rules");
    expect(BODY).toContain("Commit validation or feedback changes, delegate sync");
    expect(BODY).toContain("record the no-change milestone without an empty commit or empty push");
    expect(BODY).toContain("remove leading WIP and any remaining `Placeholder`");
    expect(BODY).toContain("Step 4 does not restore WIP or alter `Placeholder`");
  });

  it("uses the shared reconciliation clock and all-actionable repair pass", () => {
    expect(BODY).toContain("**Feedback/CI reconciliation checkpoint**; do not wrap PR waiting in the task loop");
    expect(BODY).toContain("Its configured wait duration and total budget are the only clock");
    expect(BODY).toContain("repair pushes restart the cycle, not that budget");
    expect(BODY).toContain("PR-reconciliation-pass workflow with `scope=all-actionable`");
    expect(BODY).not.toMatch(/\b(?:120|20)\s*(?:minutes|min|m)\b/);
  });

  it("does not turn skill selection or local-only execution into publication authority", () => {
    expect(BODY).toContain("Skill selection alone does not grant publication authority");
    expect(BODY).toContain("skip PR creation, pushes, and remote reconciliation");
    expect(BODY).toContain("Treat the plan's text as new authority to publish");
    expect(BODY).toContain("Merge, enable automerge, or release; checkpoint publication grants none of those permissions");
  });

  it("defers whole-task success beyond implementation and reports bounded stops honestly", () => {
    expect(BODY).toContain("Defer the loop's completion sentinel until all applicable checkpoints below succeed");
    expect(BODY).toContain("latest-head required blocking CI passes");
    expect(BODY).toContain("Report pending human approval separately; it is not CI");
    expect(BODY).toContain("save resumable state and report remaining work without claiming completion");
    expect(BODY).toContain("Re-read the authoritative plan and map every acceptance criterion");
    expect(BODY).toContain("Emit the loop's success sentinel only after the plan and every applicable checkpoint succeed");
  });
});
