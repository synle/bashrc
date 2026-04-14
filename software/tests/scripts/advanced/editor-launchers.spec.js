/** doWork tests for software/scripts/advanced/editor-launchers.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, runScript, getIndexConstant, setSandboxGlobal } from "../../setup.js";

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");

describe("advanced/editor-launchers.js doWork", () => {
  it("should register Vim launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/editor-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Editor Launchers - Vim");
  });

  it("should register Sublime Text launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/editor-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Editor Launchers - Sublime Text");
    expect(profile).toContain("_SUBL_PATHS");
  });

  it("should register VS Code launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/editor-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Editor Launchers - VS Code");
    expect(profile).toContain("_CODE_PATHS");
  });

  it("should register Zed launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/editor-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Editor Launchers - Zed");
    expect(profile).toContain("_ZED_PATHS");
  });

  it("should register Sublime Merge launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/editor-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Editor Launchers - Sublime Merge");
    expect(profile).toContain("_SMERGE_PATHS");
  });

  it("should define vim() wrapper and reference run_editor_cli in Vim block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/editor-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("vim()");
    expect(profile).toContain("run_editor_cli");
  });
});
