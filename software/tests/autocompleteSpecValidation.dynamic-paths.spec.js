import { describe, it, expect, beforeAll, afterAll } from "vitest";

import fs from "fs";

import path from "path";

import { execSync } from "child_process";

const commonSource = fs.readFileSync("software/metadata/autocomplete.common.js", "utf-8");

const COMMON_ENV_PATH = path.resolve("software/bootstrap/common-env.sh");

const vm = await import("vm");

const sandbox = {};

vm.default.runInNewContext(commonSource.replace(/^(const|let) /gm, "var ").replace(/^function /gm, "var _fn = function "), sandbox);

const SPEC_COMMANDS = sandbox.SPEC_COMMANDS;

const VALID_TOKENS = new Set(sandbox.DYNAMIC_TOKENS);

const uniqueSpecFiles = [...new Set(SPEC_COMMANDS.map((c) => c.specFile).filter(Boolean))];

const commonContent = fs.readFileSync("software/scripts/advanced/bash-autocomplete-complete-spec.common.bash", "utf-8");

const templateContent =
  commonContent + "\n" + fs.readFileSync("software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash", "utf-8");

function buildCompletionTestScript(specContent, compWords, compCword, setupCode = "") {
  const funcBody = templateContent
    .split("{{COMMAND}}")
    .join("testcmd")
    .split("{{SPEC_CONTENT}}")
    .join(specContent)
    .split("{{MAX_NESTED_DEPTH}}")
    .join("3");
  return `#!/usr/bin/env bash
set -uo pipefail
source "${COMMON_ENV_PATH}"
source "${process.cwd()}/software/scripts/bash-fzf.profile.bash"
${setupCode}
${funcBody}
COMP_WORDS=(${compWords.map((w) => `"${w}"`).join(" ")})
COMP_CWORD=${compCword}
__spec_complete_testcmd
for r in "\${COMPREPLY[@]}"; do echo "$r"; done
`;
}

function runCompletionScript(script, options = {}) {
  const result = execSync("bash", { input: script, encoding: "utf-8", timeout: 10000, ...options });
  return result
    .trim()
    .split("\n")
    .filter((l) => l !== "");
}

describe("dynamic token expansion (bash integration)", () => {
let tmpDir;

beforeAll(() => {
    tmpDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
    // create test file structure — legitimate folders
    fs.mkdirSync(path.join(tmpDir, "subdir"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "another"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "src", "components"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "file1.txt"), "hello");
    fs.writeFileSync(path.join(tmpDir, "file2.js"), "world");
    fs.writeFileSync(path.join(tmpDir, "subdir", "nested.txt"), "nested");
    fs.writeFileSync(path.join(tmpDir, "subdir", "deep.sh"), "deep");
    fs.writeFileSync(path.join(tmpDir, "src", "components", "app.js"), "app");
    // create ignored folders — all should be filtered by filter_unwanted
    const ignoredDirs = [
      ".cache",
      ".DS_Store",
      ".idea",
      ".next",
      ".nuxt",
      ".venv",
      ".yarn",
      ".svn",
      ".gradle",
      ".turbo",
      ".sass-cache",
      ".parcel-cache",
      ".pytest_cache",
      ".mypy_cache",
      "node_modules/pkg",
      "__pycache__",
      "bower_components",
      "vendor",
      "custom_ignored",
    ];
    for (const dir of ignoredDirs) {
      fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
    }
    // paths with spaces in names
    fs.mkdirSync(path.join(tmpDir, "Display DJ.app"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "My Documents"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "a  b"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "my file.txt"), "spaced");
    fs.writeFileSync(path.join(tmpDir, "My Documents", "report.js"), "doc");
    fs.writeFileSync(path.join(tmpDir, "Display DJ.app", "config.json"), "cfg");
    // .git at root would trigger git fast-path — create nested for filtering tests
    fs.mkdirSync(path.join(tmpDir, "sub", ".git", "hooks"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "sub", ".git", "hooks", "pre-commit"), "hook");
    // files inside ignored dirs should also be filtered
    fs.writeFileSync(path.join(tmpDir, "node_modules", "pkg", "index.js"), "mod");
    fs.writeFileSync(path.join(tmpDir, "__pycache__", "mod.pyc"), "cache");
  });

afterAll(() => {
    if (tmpDir) execSync(`rm -rf "${tmpDir}"`);
  });

describe("__ssh_hosts__", () => {
    it("should expand to host names from ssh config", () => {
      const setupDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
      const sshDir = path.join(setupDir, ".ssh");
      fs.mkdirSync(sshDir, { recursive: true });
      fs.writeFileSync(path.join(sshDir, "config"), "Host myserver\n  HostName 1.2.3.4\nHost devbox\n  HostName 5.6.7.8\n");
      try {
        const script = buildCompletionTestScript("|__ssh_hosts__", ["testcmd", ""], 1, `export HOME="${setupDir}"`);
        const results = runCompletionScript(script, { cwd: setupDir });
        expect(results).toContain("myserver");
        expect(results).toContain("devbox");
      } finally {
        execSync(`rm -rf "${setupDir}"`);
      }
    });
  });

describe("__folders__", () => {
    it("should expand to directories in cwd", () => {
      const script = buildCompletionTestScript("|__folders__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("subdir");
      expect(results).toContain("another");
      expect(results).not.toContain("file1.txt");
    });
  });

describe("__nested_folders__", () => {
    it("should expand to nested directories", () => {
      const script = buildCompletionTestScript("|__nested_folders__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      const normalized = results.map((r) => r.replace(/\/$/, ""));
      expect(normalized).toContain("subdir");
      expect(normalized).toContain("another");
    });

    it("should filter out all ignored folders", () => {
      const script = buildCompletionTestScript("|__nested_folders__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      const all = results.join(" ");
      // all ignored folders should be filtered
      const mustBeFiltered = [
        ".git",
        ".cache",
        ".DS_Store",
        ".idea",
        ".next",
        ".nuxt",
        ".venv",
        ".yarn",
        ".svn",
        ".gradle",
        ".turbo",
        ".sass-cache",
        ".parcel-cache",
        ".pytest_cache",
        ".mypy_cache",
        "node_modules",
        "__pycache__",
        "bower_components",
      ];
      for (const name of mustBeFiltered) {
        expect(all, `${name} should be filtered`).not.toContain(name);
      }
      // non-ignored folders should still appear
      expect(all).toContain("subdir");
      expect(all).toContain("another");
      expect(all).toContain("src");
    });

    it("should handle directories with spaces in names", () => {
      const script = buildCompletionTestScript("|__nested_folders__", ["testcmd", "Dis"], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("Display DJ.app/");
    });

    it("should handle prefix matching with spaces", () => {
      const script = buildCompletionTestScript("|__nested_folders__", ["testcmd", "My"], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("My Documents/");
    });

    it("should handle directories with multiple consecutive spaces", () => {
      const script = buildCompletionTestScript("|__nested_folders__", ["testcmd", "a"], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("a  b/");
      expect(results).toContain("another/");
    });
  });

describe("__nested_files__", () => {
    it("should expand to nested files and filter ignored paths", () => {
      const script = buildCompletionTestScript("|__nested_files__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      const all = results.join(" ");
      // legitimate files appear
      expect(results).toContain("file1.txt");
      expect(results).toContain("file2.js");
      const hasNested = results.some((r) => r.includes("nested.txt"));
      expect(hasNested, "should include nested files").toBe(true);
      const hasComponent = results.some((r) => r.includes("app.js"));
      expect(hasComponent, "should include src/components/app.js").toBe(true);
      // files inside ignored dirs should not appear
      expect(all).not.toContain("node_modules");
      expect(all).not.toContain("pre-commit");
      expect(all).not.toContain(".pyc");
    });

    it("should handle files with spaces in names", () => {
      const script = buildCompletionTestScript("|__nested_files__", ["testcmd", "my"], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("my file.txt");
    });

    it("should handle files inside directories with spaces", () => {
      const script = buildCompletionTestScript("|__nested_files__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      const hasReport = results.some((r) => r.includes("My Documents/report.js"));
      expect(hasReport, "should include My Documents/report.js").toBe(true);
    });
  });

describe("__nested_text_files__", () => {
    it("should expand to nested text files and filter ignored paths", () => {
      const script = buildCompletionTestScript("|__nested_text_files__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      const all = results.join(" ");
      expect(results.length).toBeGreaterThan(0);
      // files inside ignored dirs should not appear
      expect(all).not.toContain("node_modules");
      expect(all).not.toContain(".git");
    });

    it("should handle text files with spaces in names", () => {
      const script = buildCompletionTestScript("|__nested_text_files__", ["testcmd", "my"], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("my file.txt");
    });
  });

describe("__nested_paths__", () => {
    it("should expand to both files and directories and filter ignored paths", () => {
      const script = buildCompletionTestScript("|__nested_paths__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      const normalized = results.map((r) => r.replace(/\/$/, ""));
      const all = results.join(" ");
      // legitimate paths appear
      expect(normalized).toContain("subdir");
      expect(normalized).toContain("file1.txt");
      expect(normalized).toContain("src");
      // ignored paths should not appear
      expect(all).not.toContain(".git");
      expect(all).not.toContain("node_modules");
      expect(all).not.toContain("__pycache__");
      expect(all).not.toContain(".venv");
      expect(all).not.toContain("bower_components");
    });

    it("should handle paths with spaces in names", () => {
      const script = buildCompletionTestScript("|__nested_paths__", ["testcmd", "Dis"], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("Display DJ.app/");
    });

    it("should handle files and folders with spaces together", () => {
      const script = buildCompletionTestScript("|__nested_paths__", ["testcmd", "my"], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("my file.txt");
    });
  });

describe("__paths__", () => {
    it("should expand to files and directories in cwd", () => {
      const script = buildCompletionTestScript("|__paths__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("subdir");
      expect(results).toContain("file1.txt");
    });
  });
});
