/** doWork tests for software/scripts/git.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, fetchResponses, runScript, getIndexConstant } from "../setup.js";

const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");
const BUILD_DIR = getIndexConstant("BUILD_DIR");

describe("git.js doWork", () => {
  it("should write .gitconfig with git aliases and settings", async () => {
    fetchResponses["software/scripts/git.gitconfig"] = "[alias]\n\tco = checkout\n[user]\n\temail = placeholder@test.com";

    await runScript("software/scripts/git.js");

    const gitconfig = fileSystem[`${BASE_HOMEDIR_LINUX}/.gitconfig`];
    expect(gitconfig).toBeDefined();
    expect(gitconfig).toContain("[alias]");
  });

  it("should preserve existing email from current .gitconfig", async () => {
    // Seed both the fileSystem (absolute path) and fetchResponses (repo-relative path)
    const configPath = `${BASE_HOMEDIR_LINUX}/.gitconfig`;
    fileSystem[configPath] = "[user]\n\temail = real@example.com";
    fetchResponses["software/scripts/git.gitconfig"] = "[user]\n\temail = placeholder@test.com";
    fetchResponses[configPath] = fileSystem[configPath];

    await runScript("software/scripts/git.js");

    const gitconfig = fileSystem[configPath];
    expect(gitconfig).toContain("email = real@example.com");
  });

  it("should write .gitignore_global with common exclusions", async () => {
    fetchResponses["software/scripts/git.gitconfig"] = "[core]\nautocrlf = input";

    await runScript("software/scripts/git.js");

    const gitignore = fileSystem[`${BASE_HOMEDIR_LINUX}/.gitignore_global`];
    expect(gitignore).toBeDefined();
    expect(gitignore).toContain(".DS_Store");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain("__pycache__/");
    expect(gitignore).toContain(".env");
  });

  it("should include numbered alias snippets in gitconfig", async () => {
    fetchResponses["software/scripts/git.gitconfig"] = "[alias]\n\tco = checkout";

    await runScript("software/scripts/git.js");

    const gitconfig = fileSystem[`${BASE_HOMEDIR_LINUX}/.gitconfig`];
    expect(gitconfig).toContain("r1 =");
    expect(gitconfig).toContain("r10 =");
    expect(gitconfig).toContain("patch-get1 =");
  });
});
