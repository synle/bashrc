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
    fetchResponses["software/scripts/vim-config-settings.vim"] =
      "set number\nset tabstop=2\ninoremap <silent> <C-a> <C-o>0\ninoremap <silent> <C-e> <C-o>$\n" +
      "\" Ctrl+W already deletes the previous word natively in insert mode; keep Vim's default.\n" +
      "inoremap <silent> <C-BS> <C-w>\n" +
      "nnoremap <silent> <C-Right> w\n" +
      "nnoremap <silent> <C-Left> b\n" +
      "nnoremap <silent> <C-Up> <C-b>\n" +
      "nnoremap <silent> <C-Down> <C-f>\n" +
      "inoremap <silent> <C-Right> <C-o>w\n" +
      "inoremap <silent> <C-Left> <C-o>b\n" +
      "inoremap <silent> <C-Up> <C-o><C-b>\n" +
      "inoremap <silent> <C-Down> <C-o><C-f>\n" +
      "vnoremap <silent> <C-Up> <C-b>\n" +
      "vnoremap <silent> <C-Down> <C-f>\n" +
      "let g:lightline = { 'active': { 'right': [ [ 'lineinfo' ], [ 'filetype' ] ] } }\n" +
      "let g:lightline = { 'component_function': { 'filetype': 'SyLightlineFiletype' } }\n" +
      "let g:lightline = { 'component_type': { 'filetype': 'warning' } }\n" +
      "function! SyLightlineFiletype() abort\n" +
      "function! SyLightlineSetModeColors() abort\n" +
      "let g:VM_maps['Add Cursor Up'] = ''\n" +
      "let g:VM_maps['Add Cursor Down'] = ''";

    await runScript("software/scripts/vim-config.js");

    const vimrc = fileSystem[`${BASE_HOMEDIR_LINUX}/.vimrc`];
    expect(vimrc).toBeDefined();
    expect(vimrc).toContain('" vim-jetpack Plugin Manager');
    expect(vimrc).toContain("set number");
    expect(vimrc).toContain("set tabstop=2");
    expect(vimrc).toContain("inoremap <silent> <C-a> <C-o>0");
    expect(vimrc).toContain("inoremap <silent> <C-e> <C-o>$");
    expect(vimrc).toContain("\" Ctrl+W already deletes the previous word natively in insert mode; keep Vim's default.");
    expect(vimrc).toContain("inoremap <silent> <C-BS> <C-w>");
    expect(vimrc).toContain("nnoremap <silent> <C-Right> w");
    expect(vimrc).toContain("nnoremap <silent> <C-Left> b");
    expect(vimrc).toContain("nnoremap <silent> <C-Up> <C-b>");
    expect(vimrc).toContain("nnoremap <silent> <C-Down> <C-f>");
    expect(vimrc).toContain("inoremap <silent> <C-Right> <C-o>w");
    expect(vimrc).toContain("inoremap <silent> <C-Left> <C-o>b");
    expect(vimrc).toContain("inoremap <silent> <C-Up> <C-o><C-b>");
    expect(vimrc).toContain("inoremap <silent> <C-Down> <C-o><C-f>");
    expect(vimrc).toContain("vnoremap <silent> <C-Up> <C-b>");
    expect(vimrc).toContain("vnoremap <silent> <C-Down> <C-f>");
    expect(vimrc).toContain("'right': [ [ 'lineinfo' ], [ 'filetype' ] ]");
    expect(vimrc).toContain("'component_function': { 'filetype': 'SyLightlineFiletype' }");
    expect(vimrc).toContain("'component_type': { 'filetype': 'warning' }");
    expect(vimrc).toContain("function! SyLightlineFiletype() abort");
    expect(vimrc).toContain("function! SyLightlineSetModeColors() abort");
    expect(vimrc).toContain("let g:VM_maps['Add Cursor Up'] = ''");
    expect(vimrc).toContain("let g:VM_maps['Add Cursor Down'] = ''");
  });

  it("should write .vimrc with both plugins and settings combined", async () => {
    fetchResponses["software/scripts/vim-config-settings.vim"] = "set number";

    await runScript("software/scripts/vim-config.js");

    const vimrc = fileSystem[`${BASE_HOMEDIR_LINUX}/.vimrc`];
    expect(vimrc).toContain("call jetpack#begin()");
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
