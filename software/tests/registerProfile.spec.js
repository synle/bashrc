import { describe, it, expect } from "vitest";
import fs from "fs";

import path from "path";

import { fileSystem, fetchResponses, getIndexFunction, getIndexConstant, setMockExecSyncReturn } from "./setup.js";

const _validateBashSyntax = getIndexFunction("_validateBashSyntax");

const registerProfileBlock = getIndexFunction("registerProfileBlock");

const removeProfileBlock = getIndexFunction("removeProfileBlock");

const removeFromBashSyleProfile = getIndexFunction("removeFromBashSyleProfile");

const removeFromPowershellProfile = getIndexFunction("removeFromPowershellProfile");

const registerWithBashSyleProfile = getIndexFunction("registerWithBashSyleProfile");

const registerWithBashSyleAutocompleteWithRawContent = getIndexFunction("registerWithBashSyleAutocompleteWithRawContent");

const registerWithPowershellProfile = getIndexFunction("registerWithPowershellProfile");

const flushProfileBlocks = getIndexFunction("flushProfileBlocks");

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");

const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");

const POWERSHELL_SYLE_PATH = getIndexConstant("POWERSHELL_SYLE_PATH");

const TEXT_BLOCK_START_MARKER = getIndexConstant("TEXT_BLOCK_START_MARKER");

const TEXT_BLOCK_END_MARKER = getIndexConstant("TEXT_BLOCK_END_MARKER");

describe("_validateBashSyntax", () => {
  it("should return null for valid bash", () => {
    expect(_validateBashSyntax("echo hello", "test")).toBeNull();
  });

  it("should return null for valid if/fi block", () => {
    expect(_validateBashSyntax("if true; then\n  echo ok\nfi", "test")).toBeNull();
  });

  it("should return null for comments only", () => {
    expect(_validateBashSyntax("# just a comment", "test")).toBeNull();
  });

  it("should return null for empty content", () => {
    expect(_validateBashSyntax("", "test")).toBeNull();
  });

  it("should return error for unclosed if", () => {
    const result = _validateBashSyntax("if true; then\n  echo ok", "test");
    expect(result).toBeTruthy();
    expect(result).toContain("syntax error");
  });

  it("should return error for unexpected fi", () => {
    const result = _validateBashSyntax("fi", "test");
    expect(result).toBeTruthy();
  });

  it("should return error for unclosed parenthesis", () => {
    const result = _validateBashSyntax("echo $(echo hello", "test");
    expect(result).toBeTruthy();
  });

  it("should return null for valid function definition", () => {
    expect(_validateBashSyntax('function foo() {\n  echo "bar"\n}', "test")).toBeNull();
  });

  it("should return null for valid autocomplete function", () => {
    const content = `__spec_complete_bat()
{
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=(\$(compgen -W "opts" -- "\$cur"))
}
complete -F __spec_complete_bat bat`;
    expect(_validateBashSyntax(content, "test")).toBeNull();
  });
});

describe("registerProfileBlock", () => {
  const TEST_PROFILE = "/mock/home/.test_profile";

  it("should append a block", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "My Block", content: "echo hello" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} My Block`);
    expect(written).toContain("echo hello");
    expect(written).not.toContain("{\necho hello\n}");
    expect(written.indexOf("existing content")).toBeLessThan(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} My Block`));
  });

  it("should prepend when isPrepend is true", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "My Block", content: "echo hello", isPrepend: true });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} My Block`)).toBeLessThan(written.indexOf("existing content"));
  });

  it("should work with any file path", async () => {
    const customPath = "/mock/home/.custom_rc";

    registerProfileBlock({ profilePath: customPath, configKey: "Custom", content: "custom content" });
    await flushProfileBlocks();

    expect(fileSystem[customPath]).toContain("custom content");
    expect(fileSystem[customPath]).toContain(`# ${TEXT_BLOCK_START_MARKER} Custom`);
  });

  it("should update an existing block in place", async () => {
    fileSystem[TEST_PROFILE] = `# ${TEXT_BLOCK_START_MARKER} My Block\nold\n# ${TEXT_BLOCK_END_MARKER} My Block`;

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "My Block", content: "new stuff" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain("new stuff");
    expect(written).not.toContain("\nold\n");
  });

  it("should replace invalid bash syntax with an echo warning", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "Bad Block", content: "if true; then\n  echo ok" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Bad Block`);
    // invalid content replaced with echo warning (valid bash, won't break profile)
    expect(written).toContain("invalid bash syntax detected");
    expect(written).toContain("block skipped");
    expect(written).not.toContain("echo ok");
  });

  it("should accept valid bash content", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "Good Block", content: "if true; then\n  echo ok\nfi" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain("echo ok");
    expect(written).not.toContain("# Invalid Content");
  });

  it("should accept comment-only content with no-op", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "Comment Block", content: "# just a comment\n:" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain("# just a comment");
    expect(written).not.toContain("WARNING");
  });

  it("should accept comment-only content without code folding", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "Comment Block Only", content: "# just a comment" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain("# just a comment");
    expect(written).not.toContain("WARNING");
  });

  it("should skip validation for powershell profiles", async () => {
    const psPath = "/mock/home/.powershell_syle";
    fileSystem[psPath] = "";

    registerProfileBlock({ profilePath: psPath, configKey: "PS Block", content: "if true; then\n  echo ok" });
    await flushProfileBlocks();

    const written = fileSystem[psPath];
    expect(written).toContain("echo ok");
    expect(written).not.toContain("# Invalid Content");
  });
});

describe("registerWithBashSyleProfile", () => {
  it("should write a prepended block to BASH_SYLE_PATH when file is empty", async () => {
    registerWithBashSyleProfile("Sy Git Config", "export GIT_EDITOR=vim");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Git Config`);
    expect(written).toContain("export GIT_EDITOR=vim");
    expect(written).toContain(`# ${TEXT_BLOCK_END_MARKER} Sy Git Config`);
  });

  it("should not wrap content with code folding braces", async () => {
    registerWithBashSyleProfile("Sy NoFolding", "alias foo=bar");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain("alias foo=bar");
    expect(written).not.toContain("{\nalias foo=bar\n}");
  });

  it("should append new block after existing content", async () => {
    fileSystem[BASH_SYLE_PATH] = "existing profile content";

    registerWithBashSyleProfile("Sy Aliases", "alias ll='ls -la'");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Aliases`);
    expect(written).toContain("alias ll='ls -la'");
    expect(written.indexOf("existing profile content")).toBeLessThan(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} Sy Aliases`));
  });

  it("should update an existing block in place", async () => {
    fileSystem[BASH_SYLE_PATH] = `top content

# ${TEXT_BLOCK_START_MARKER} Sy Env
OLD_VAR=old
# ${TEXT_BLOCK_END_MARKER} Sy Env

bottom content`;

    registerWithBashSyleProfile("Sy Env", "NEW_VAR=new");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain("NEW_VAR=new");
    expect(written).not.toContain("OLD_VAR=old");
    expect(written).toContain("top content");
    expect(written).toContain("bottom content");
  });

  it("should register multiple independent blocks", async () => {
    registerWithBashSyleProfile("Sy Block A", "content_a");
    registerWithBashSyleProfile("Sy Block B", "content_b");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Block A`);
    expect(written).toContain("content_a");
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Block B`);
    expect(written).toContain("content_b");
  });
});

describe("registerWithBashSyleAutocompleteWithRawContent", () => {
  it("should write an appended block to BASH_SYLE_PATH when file is empty", async () => {
    registerWithBashSyleAutocompleteWithRawContent("git Autocomplete", "complete -o default -F _git git");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} git Autocomplete`);
    expect(written).toContain("complete -o default -F _git git");
    expect(written).toContain(`# ${TEXT_BLOCK_END_MARKER} git Autocomplete`);
  });

  it("should append new block after existing content", async () => {
    fileSystem[BASH_SYLE_PATH] = "existing autocomplete stuff";

    registerWithBashSyleAutocompleteWithRawContent("npm Autocomplete", "complete -F _npm npm");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written.indexOf("existing autocomplete stuff")).toBeLessThan(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} npm Autocomplete`));
  });

  it("should update an existing autocomplete block in place", async () => {
    fileSystem[BASH_SYLE_PATH] = `# ${TEXT_BLOCK_START_MARKER} docker Autocomplete
old docker complete
# ${TEXT_BLOCK_END_MARKER} docker Autocomplete`;

    registerWithBashSyleAutocompleteWithRawContent("docker Autocomplete", "new docker complete");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain("new docker complete");
    expect(written).not.toContain("old docker complete");
  });

  it("should register multiple autocomplete blocks without clobbering", async () => {
    registerWithBashSyleAutocompleteWithRawContent("git Autocomplete", "git_complete_fn");
    registerWithBashSyleAutocompleteWithRawContent("npm Autocomplete", "npm_complete_fn");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain("git_complete_fn");
    expect(written).toContain("npm_complete_fn");
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} git Autocomplete`);
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} npm Autocomplete`);
  });
});
