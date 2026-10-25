/** Source integrity checks for the restored guidance; these do not prove agent runtime compliance. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/** @type {string} Canonical active guidance folder. */
const SOURCE_FOLDER = path.resolve("software/scripts/advanced/llm/_common/v_current");
/** @type {string[]} Restored workflows that must not depend on deleted scheduling guidance. */
const WORKFLOWS = ["babysit-pr", "babysit-prs", "review-pr", "review-prs"];

describe("restored guidance integrity", () => {
  it.each(WORKFLOWS)("keeps %s independent of retired skills and named workers", (name) => {
    const body = fs.readFileSync(path.join(SOURCE_FOLDER, "skills", `${name}.md`), "utf-8");
    expect(body).not.toMatch(/sy-pr-loop|sy-execute-plan|sy-agent-pr-/);
    expect(body).toContain("pass=single");
  });

  it("includes the active persona source rather than an archived copy", () => {
    const instructions = fs.readFileSync(path.join(SOURCE_FOLDER, "instructions.md"), "utf-8");
    expect(instructions).toContain("<!-- BEGIN software/scripts/advanced/llm/_common/v_current/instructions-persona.md -->");
    expect(instructions).not.toMatch(/<!-- (?:BEGIN|END) software\/scripts\/advanced\/llm\/_common\/v\d/);
  });
});

describe("fan-out launch safety guidance", () => {
  it.each(["babysit-prs", "review-prs"])("keeps accepted %s workers alive after a partial launch", (name) => {
    const body = fs.readFileSync(path.join(SOURCE_FOLDER, "skills", `${name}.md`), "utf-8");
    expect(body).toContain("never cancel healthy workers merely because peer launches failed");
    expect(body).toContain("Accepted count alone does not prove the concurrency cap");
    expect(body).toContain("k == 0");
    expect(body).not.toContain("cancel and relaunch");
    expect(body).not.toContain("Then set `S = k`");
    expect(body).not.toContain("sequential and must be relaunched");
  });
});
