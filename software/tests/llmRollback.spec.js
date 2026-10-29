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

  it.each(["sy-merge", "sy-release", "sy-close-stale-prs", "sy-create-pr", "sy-draft-pr"])(
    "keeps active guidance independent of retired utility %s",
    (name) => {
      const instructions = fs.readdirSync(SOURCE_FOLDER).filter((entry) => entry.startsWith("instructions") && entry.endsWith(".md"));
      const skillsFolder = path.join(SOURCE_FOLDER, "skills");
      const skills = fs.readdirSync(skillsFolder).filter((entry) => entry.endsWith(".md"));
      const files = [
        ...instructions.map((entry) => path.join(SOURCE_FOLDER, entry)),
        ...skills.map((entry) => path.join(skillsFolder, entry)),
      ].filter((file) => !file.includes(".secret.") && fs.lstatSync(file).isFile());
      const references = files.filter((file) => fs.readFileSync(file, "utf8").includes(name));
      expect(references).toEqual([]);
    },
  );

  it("keeps plain-English synchronization routing and release permission boundaries without retired aliases", () => {
    const workflow = fs.readFileSync(path.join(SOURCE_FOLDER, "instructions-pr-workflow.md"), "utf8");
    const babysit = fs.readFileSync(path.join(SOURCE_FOLDER, "skills/babysit-pr.md"), "utf8");
    expect(workflow).toContain("floor/default first");
    expect(workflow).toContain("upstream default branch last");
    expect(workflow).toContain("stopped-for-human");
    expect(workflow).toContain("needs-human");
    expect(workflow).toContain("**Release is never automatic.**");
    expect(babysit).toContain("**Release dispatch is NEVER automatic.**");
  });

  it("owns the three PR lifecycle transitions in shared guidance", () => {
    const workflow = fs.readFileSync(path.join(SOURCE_FOLDER, "instructions-pr-workflow.md"), "utf8");
    const placeholder = workflow.split("\n").find((line) => line.startsWith("- **Placeholder checkpoint**"));
    const implementation = workflow.split("\n").find((line) => line.startsWith("- **Implementation checkpoint**"));
    const validation = workflow.split("\n").find((line) => line.startsWith("- **Validation checkpoint**"));
    expect(placeholder).toBeDefined();
    expect(placeholder).toContain("one empty placeholder commit");
    expect(placeholder).toContain("both `WIP` and `Placeholder`");
    expect(implementation).toContain("remove only `Placeholder`");
    expect(implementation).toContain("retain `WIP`");
    expect(validation).toContain("current actionable PR feedback");
    expect(validation).toContain("remove `WIP` and any remaining `Placeholder`");
  });

  it("routes plan publication directly through the shared placeholder checkpoint", () => {
    const execute = fs.readFileSync(path.join(SOURCE_FOLDER, "skills/execute-plan.md"), "utf8");
    expect(execute).toContain("**Placeholder checkpoint**");
    expect(execute).not.toContain("available draft-PR workflow");
    expect(execute).toContain("remove only `Placeholder`");
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
    expect(body).toContain("A task/tool permission denial is a placement failure, not a PR failure");
    expect(body).toContain("run that slot's assigned PRs inline in the main agent");
    expect(body).toContain("Accepted count alone does not prove the concurrency cap");
    expect(body).toContain("k == 0");
    expect(body).not.toContain("cancel and relaunch");
    expect(body).not.toContain("Then set `S = k`");
    expect(body).not.toContain("sequential and must be relaunched");
  });
});
