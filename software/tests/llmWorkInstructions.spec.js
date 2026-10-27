/** Shared work instruction discovery and real client writer contracts. */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadInstructionClient, loadWorkInstructions } from "./workInstructions.helpers.js";

/** Private per-test home; no test reads the owner's actual work files. */
let home;
/** Real shared deployment functions evaluated against the private home. */
let llm;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "work-instructions-"));
  llm = loadWorkInstructions(home);
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe("work instruction discovery", () => {
  it("appends a discovered document after existing instructions", () => {
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "work rules\n");
    expect(llm.refreshPathKeyedBlocks("common rules\n", home)).toBe(
      "common rules\n\n<!-- BEGIN Custom Work Prompt | ~/.work_acme_instructions.md -->\nwork rules\n<!-- END Custom Work Prompt | ~/.work_acme_instructions.md -->\n",
    );
  });

  it("starts from an empty target and refreshes without duplicate blocks", () => {
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "first");
    const first = llm.refreshPathKeyedBlocks("", home);
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "updated");
    const updated = llm.refreshPathKeyedBlocks(first, home);
    expect(updated).toBe(
      "<!-- BEGIN Custom Work Prompt | ~/.work_acme_instructions.md -->\nupdated\n<!-- END Custom Work Prompt | ~/.work_acme_instructions.md -->\n",
    );
    expect(llm.refreshPathKeyedBlocks(updated, home)).toBe(updated);
  });

  it("appends newly discovered documents in lexical order", () => {
    fs.writeFileSync(path.join(home, ".work_zeta_instructions.md"), "zeta");
    fs.writeFileSync(path.join(home, ".work_alpha_instructions.md"), "alpha");
    const result = llm.refreshPathKeyedBlocks("common", home);
    expect(result.indexOf("alpha")).toBeLessThan(result.indexOf("zeta"));
    expect(result).toContain("\nzeta\n");
  });

  it.each([
    ".work_acme_instruction.md",
    ".work_instructions.md",
    ".work_acme_instructions.md.bak",
    ".work_pr_reviews.md",
    ".bash_prompt_acme",
  ])("does not discover nonmatching filename %s", (name) => {
    fs.writeFileSync(path.join(home, name), "not an automatic instruction");
    expect(llm.refreshPathKeyedBlocks("common\n", home)).toBe("common\n");
  });

  it("does not duplicate a document already included under another label or path form", () => {
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "new rules");
    const existing =
      "<!-- BEGIN My rules | $HOME/.work_acme_instructions.md -->\nold\n<!-- END My rules | $HOME/.work_acme_instructions.md -->\n";
    expect(llm.refreshPathKeyedBlocks(existing, home)).toBe(
      "<!-- BEGIN My rules | $HOME/.work_acme_instructions.md -->\nnew rules\n<!-- END My rules | $HOME/.work_acme_instructions.md -->\n",
    );
  });

  it("discovers filenames containing spaces without changing their marker identity", () => {
    fs.writeFileSync(path.join(home, ".work_acme team_instructions.md"), "team rules");
    expect(llm.refreshPathKeyedBlocks("", home)).toBe(
      "<!-- BEGIN Custom Work Prompt | ~/.work_acme team_instructions.md -->\nteam rules\n<!-- END Custom Work Prompt | ~/.work_acme team_instructions.md -->\n",
    );
  });

  it("keeps the previous body when a discovered source becomes empty or disappears", () => {
    const source = path.join(home, ".work_acme_instructions.md");
    fs.writeFileSync(source, "kept");
    const first = llm.refreshPathKeyedBlocks("", home);
    expect(first).toContain("\nkept\n");
    fs.writeFileSync(source, " \n");
    expect(llm.refreshPathKeyedBlocks(first, home)).toBe(first);
    fs.unlinkSync(source);
    expect(llm.refreshPathKeyedBlocks(first, home)).toBe(first);
  });

  it("does not append empty documents or folders", () => {
    fs.writeFileSync(path.join(home, ".work_empty_instructions.md"), "  \n");
    fs.mkdirSync(path.join(home, ".work_folder_instructions.md"));
    expect(llm.refreshPathKeyedBlocks("common", home)).toBe("common");
  });
});

describe("all client instruction writers", () => {
  it.each([
    ["claude", "_doInstructionsWork", ".claude", "CLAUDE.md"],
    ["copilot", "_doCopilotInstructionsWork", ".copilot", "copilot-instructions.md"],
    ["gemini", "_doGeminiInstructionsWork", ".gemini", "GEMINI.md"],
    ["opencode", "_doOpencodeInstructionsWork", ".config/opencode", "AGENTS.md"],
    ["pi", "_doPiInstructionsWork", ".pi/agent", "AGENTS.md"],
  ])("%s deploys common instructions followed by refreshed work instructions", async (client, writer, folder, filename) => {
    loadInstructionClient(llm, client);
    llm.getLLMCustomInstructions = async () => "common rules";
    const source = path.join(home, ".work_acme_instructions.md");
    const targetFolder = path.join(home, folder);
    const target = path.join(targetFolder, filename);
    fs.mkdirSync(targetFolder, { recursive: true });
    fs.writeFileSync(source, "first");
    await llm[writer](targetFolder);
    const first = fs.readFileSync(target, "utf8");
    expect(first.indexOf("common rules")).toBeLessThan(first.indexOf("Custom Work Prompt"));
    expect(first).toContain("\nfirst\n");
    fs.writeFileSync(source, "refreshed");
    await llm[writer](targetFolder);
    const updated = fs.readFileSync(target, "utf8");
    expect(updated).toContain("\nrefreshed\n");
    expect(updated).not.toContain("\nfirst\n");
    expect(updated.split("<!-- BEGIN Custom Work Prompt | ").length).toBe(2);
    await llm[writer](targetFolder);
    expect(fs.readFileSync(target, "utf8")).toBe(updated);

    fs.writeFileSync(target, `user prefix\n${updated}\nuser suffix\n`);
    await llm[writer](targetFolder);
    const preserved = fs.readFileSync(target, "utf8");
    expect(preserved).toContain("user prefix");
    expect(preserved).toContain("user suffix");
    expect(preserved.split("<!-- BEGIN Custom Work Prompt | ").length).toBe(2);
  });
});
