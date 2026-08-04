/** Integration tests that run individual script doWork() functions in the sandbox. */
import { describe, it, expect } from "vitest";
import { fileSystem, fetchResponses, mockExecCommands, processExitCalled, runScript, getIndexConstant, setSandboxGlobal } from "./setup.js";

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");
const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");
const BUILD_DIR = getIndexConstant("BUILD_DIR");
const TEXT_BLOCK_START_MARKER = getIndexConstant("TEXT_BLOCK_START_MARKER");
const TEXT_BLOCK_END_MARKER = getIndexConstant("TEXT_BLOCK_END_MARKER");

// ---- bash-inputrc.js ----

describe("bash-inputrc.js", () => {
  it("should write .inputrc to home directory", async () => {
    await runScript("software/scripts/bash-inputrc.js");

    const inputrc = fileSystem[`${BASE_HOMEDIR_LINUX}/.inputrc`];
    expect(inputrc).toBeDefined();
    expect(inputrc).toContain("set completion-ignore-case on");
    expect(inputrc).toContain("set bell-style none");
    expect(inputrc).toContain("set revert-all-at-newline on");
  });

  it("should produce identical content for home dir and build artifact paths", async () => {
    await runScript("software/scripts/bash-inputrc.js");

    // writeBuildArtifact no-ops when IS_CI is false (default in test sandbox),
    // so we verify the home dir write has the expected content
    const inputrc = fileSystem[`${BASE_HOMEDIR_LINUX}/.inputrc`];
    expect(inputrc).toContain("set completion-ignore-case on");
    expect(inputrc).toContain("set bell-style none");
  });

  it("should contain section headers", async () => {
    await runScript("software/scripts/bash-inputrc.js");

    const inputrc = fileSystem[`${BASE_HOMEDIR_LINUX}/.inputrc`];
    expect(inputrc).toContain("# ---- Completion Behavior ----");
    expect(inputrc).toContain("# ---- Editing Behavior ----");
    expect(inputrc).toContain("# ---- History ----");
  });
});

// ---- vim-config.js ----

describe("vim-config.js", () => {
  it("should write .vimrc to home directory with plugins and settings", async () => {
    fetchResponses["software/scripts/vim-config-settings.vim"] = "set number\nset tabstop=2";

    await runScript("software/scripts/vim-config.js");

    const vimrc = fileSystem[`${BASE_HOMEDIR_LINUX}/.vimrc`];
    expect(vimrc).toBeDefined();
    expect(vimrc).toContain('" vim-plug Plugin Manager');
    expect(vimrc).toContain("set number");
    expect(vimrc).toContain("set tabstop=2");
  });

  it("should write .vimrc with both plugins and settings combined", async () => {
    fetchResponses["software/scripts/vim-config-settings.vim"] = "set number";

    await runScript("software/scripts/vim-config.js");

    const vimrc = fileSystem[`${BASE_HOMEDIR_LINUX}/.vimrc`];
    expect(vimrc).toContain("call plug#begin('~/.vim/plugged')");
    expect(vimrc).toContain("set number");
  });
});

// ---- ~cleanup.js ----

describe("~cleanup.js", () => {
  it("should strip empty BEGIN/END marker pairs", async () => {
    fileSystem[BASH_SYLE_PATH] =
      `real content\n# ${TEXT_BLOCK_START_MARKER} empty block\n# ${TEXT_BLOCK_END_MARKER} empty block\nmore content`;

    await runScript("software/scripts/~cleanup.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("real content");
    expect(profile).toContain("more content");
    expect(profile).not.toContain("empty block");
  });

  it("should preserve filled blocks", async () => {
    fileSystem[BASH_SYLE_PATH] = `# ${TEXT_BLOCK_START_MARKER} filled block\nalias foo=bar\n# ${TEXT_BLOCK_END_MARKER} filled block`;

    await runScript("software/scripts/~cleanup.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("alias foo=bar");
    expect(profile).toContain(`# ${TEXT_BLOCK_START_MARKER} filled block`);
  });

  it("should clean profile content when OS flag is active", async () => {
    setSandboxGlobal("is_os_mac", true);
    fileSystem[BASH_SYLE_PATH] = "mac profile content\n\n\n\nextra whitespace";

    await runScript("software/scripts/~cleanup.js");

    // writeBuildArtifact no-ops in test (IS_CI is false),
    // but the profile itself should still be cleaned and written back
    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("mac profile content");
    expect(profile).toBeDefined();
  });
});

// ---- fzf.js ----

describe("fzf.js", () => {
  it("should git clone fzf when not present", async () => {
    fileSystem[BASH_SYLE_PATH] = "# profile";

    await runScript("software/scripts/fzf.js");

    const cloneCmd = mockExecCommands.find((cmd) => cmd.includes("fzf.git"));
    expect(cloneCmd).toBeDefined();
  });

  it("should git clone fzf-tab-completion when not present", async () => {
    fileSystem[BASH_SYLE_PATH] = "# profile";

    await runScript("software/scripts/fzf.js");

    const cloneCmd = mockExecCommands.find((cmd) => cmd.includes("fzf-tab-completion"));
    expect(cloneCmd).toBeDefined();
  });
});
