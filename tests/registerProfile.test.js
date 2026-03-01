import { describe, it, expect } from "vitest";
import path from "path";
import { fileSystem, fetchResponses, getIndexFunction, getIndexConstant } from "./setup.js";

const registerWithBashSyleProfile = getIndexFunction("registerWithBashSyleProfile");
const registerWithBashSyleAutocompleteWithRawContent = getIndexFunction("registerWithBashSyleAutocompleteWithRawContent");
const registerWithBashSyleAutocompleteWithCompleteSpec = getIndexFunction("registerWithBashSyleAutocompleteWithCompleteSpec");
const TEXT_BLOCK_START_MARKER = getIndexConstant("TEXT_BLOCK_START_MARKER");
const TEXT_BLOCK_END_MARKER = getIndexConstant("TEXT_BLOCK_END_MARKER");

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");
const BASH_SYLE_AUTOCOMPLETE_PATH = getIndexConstant("BASH_SYLE_AUTOCOMPLETE_PATH");
const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");

// ---- tests ----

describe("registerWithBashSyleProfile", () => {
  it("should write a prepended block to BASH_SYLE_PATH when file is empty", () => {
    registerWithBashSyleProfile("Sy Git Config", "export GIT_EDITOR=vim");

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Git Config`);
    expect(written).toContain("export GIT_EDITOR=vim");
    expect(written).toContain(`# ${TEXT_BLOCK_END_MARKER} Sy Git Config`);
  });

  it("should prepend new block before existing content", () => {
    fileSystem[BASH_SYLE_PATH] = "existing profile content";

    registerWithBashSyleProfile("Sy Aliases", "alias ll='ls -la'");

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Aliases`);
    expect(written).toContain("alias ll='ls -la'");
    expect(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} Sy Aliases`)).toBeLessThan(written.indexOf("existing profile content"));
  });

  it("should update an existing block in place", () => {
    fileSystem[BASH_SYLE_PATH] = `top content

# ${TEXT_BLOCK_START_MARKER} Sy Env
OLD_VAR=old
# ${TEXT_BLOCK_END_MARKER} Sy Env

bottom content`;

    registerWithBashSyleProfile("Sy Env", "NEW_VAR=new");

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain("NEW_VAR=new");
    expect(written).not.toContain("OLD_VAR=old");
    expect(written).toContain("top content");
    expect(written).toContain("bottom content");
  });

  it("should register multiple independent blocks", () => {
    registerWithBashSyleProfile("Sy Block A", "content_a");
    registerWithBashSyleProfile("Sy Block B", "content_b");

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Block A`);
    expect(written).toContain("content_a");
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Block B`);
    expect(written).toContain("content_b");
  });
});

describe("registerWithBashSyleAutocompleteWithRawContent", () => {
  it("should write an appended block to BASH_SYLE_AUTOCOMPLETE_PATH when file is empty", () => {
    registerWithBashSyleAutocompleteWithRawContent("git Autocomplete", "complete -o default -F _git git");

    const written = fileSystem[BASH_SYLE_AUTOCOMPLETE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} git Autocomplete`);
    expect(written).toContain("complete -o default -F _git git");
    expect(written).toContain(`# ${TEXT_BLOCK_END_MARKER} git Autocomplete`);
  });

  it("should append new block after existing content", () => {
    fileSystem[BASH_SYLE_AUTOCOMPLETE_PATH] = "existing autocomplete stuff";

    registerWithBashSyleAutocompleteWithRawContent("npm Autocomplete", "complete -F _npm npm");

    const written = fileSystem[BASH_SYLE_AUTOCOMPLETE_PATH];
    expect(written.indexOf("existing autocomplete stuff")).toBeLessThan(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} npm Autocomplete`));
  });

  it("should update an existing autocomplete block in place", () => {
    fileSystem[BASH_SYLE_AUTOCOMPLETE_PATH] = `# ${TEXT_BLOCK_START_MARKER} docker Autocomplete
old docker complete
# ${TEXT_BLOCK_END_MARKER} docker Autocomplete`;

    registerWithBashSyleAutocompleteWithRawContent("docker Autocomplete", "new docker complete");

    const written = fileSystem[BASH_SYLE_AUTOCOMPLETE_PATH];
    expect(written).toContain("new docker complete");
    expect(written).not.toContain("old docker complete");
  });

  it("should register multiple autocomplete blocks without clobbering", () => {
    registerWithBashSyleAutocompleteWithRawContent("git Autocomplete", "git_complete_fn");
    registerWithBashSyleAutocompleteWithRawContent("npm Autocomplete", "npm_complete_fn");

    const written = fileSystem[BASH_SYLE_AUTOCOMPLETE_PATH];
    expect(written).toContain("git_complete_fn");
    expect(written).toContain("npm_complete_fn");
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} git Autocomplete`);
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} npm Autocomplete`);
  });
});

describe("registerWithBashSyleAutocompleteWithCompleteSpec", () => {
  it("should download spec file and write it to the home directory", async () => {
    fetchResponses["https://example.com/docker-spec.txt"] = "docker|build,run,push\ndocker build|--tag,--file";

    await registerWithBashSyleAutocompleteWithCompleteSpec("docker", "https://example.com/docker-spec.txt");

    const specPath = path.join(BASE_HOMEDIR_LINUX, ".bash_syle_complete-spec-docker");
    expect(fileSystem[specPath]).toBe("docker|build,run,push\ndocker build|--tag,--file");
  });

  it("should register an autocomplete block with the generated bash completer", async () => {
    fetchResponses["https://example.com/kubectl-spec.txt"] = "kubectl|get,apply,delete";

    await registerWithBashSyleAutocompleteWithCompleteSpec("kubectl", "https://example.com/kubectl-spec.txt");

    const written = fileSystem[BASH_SYLE_AUTOCOMPLETE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} kubectl Autocomplete`);
    expect(written).toContain(`# ${TEXT_BLOCK_END_MARKER} kubectl Autocomplete`);
    expect(written).toContain("__spec_complete_kubectl()");
    expect(written).toContain("complete -F __spec_complete_kubectl kubectl");
    expect(written).toContain(".bash_syle_complete-spec-kubectl");
  });

  it("should include the correct spec file path in the completer function", async () => {
    fetchResponses["https://example.com/git-spec.txt"] = "git|add,commit,push";

    await registerWithBashSyleAutocompleteWithCompleteSpec("git", "https://example.com/git-spec.txt");

    const written = fileSystem[BASH_SYLE_AUTOCOMPLETE_PATH];
    const expectedSpecPath = path.join(BASE_HOMEDIR_LINUX, ".bash_syle_complete-spec-git");
    expect(written).toContain(`local spec_file="${expectedSpecPath}"`);
  });

  it("should update existing spec autocomplete when called again", async () => {
    fetchResponses["https://example.com/docker-spec-v1.txt"] = "docker|build,run";
    await registerWithBashSyleAutocompleteWithCompleteSpec("docker", "https://example.com/docker-spec-v1.txt");

    fetchResponses["https://example.com/docker-spec-v2.txt"] = "docker|build,run,push,pull";
    await registerWithBashSyleAutocompleteWithCompleteSpec("docker", "https://example.com/docker-spec-v2.txt");

    const specPath = path.join(BASE_HOMEDIR_LINUX, ".bash_syle_complete-spec-docker");
    expect(fileSystem[specPath]).toBe("docker|build,run,push,pull");

    const written = fileSystem[BASH_SYLE_AUTOCOMPLETE_PATH];
    const startCount = (written.match(/BEGIN_CONTENT docker Autocomplete/g) || []).length;
    expect(startCount).toBe(1);
  });
});
