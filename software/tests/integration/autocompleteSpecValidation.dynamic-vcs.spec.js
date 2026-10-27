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
    // create test file structure - legitimate folders
    fs.mkdirSync(path.join(tmpDir, "subdir"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "another"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "src", "components"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "file1.txt"), "hello");
    fs.writeFileSync(path.join(tmpDir, "file2.js"), "world");
    fs.writeFileSync(path.join(tmpDir, "subdir", "nested.txt"), "nested");
    fs.writeFileSync(path.join(tmpDir, "subdir", "deep.sh"), "deep");
    fs.writeFileSync(path.join(tmpDir, "src", "components", "app.js"), "app");
    // create ignored folders - all should be filtered by filter_unwanted
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
    // .git at root would trigger git fast-path - create nested for filtering tests
    fs.mkdirSync(path.join(tmpDir, "sub", ".git", "hooks"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "sub", ".git", "hooks", "pre-commit"), "hook");
    // files inside ignored dirs should also be filtered
    fs.writeFileSync(path.join(tmpDir, "node_modules", "pkg", "index.js"), "mod");
    fs.writeFileSync(path.join(tmpDir, "__pycache__", "mod.pyc"), "cache");
  });

  afterAll(() => {
    if (tmpDir) execSync(`rm -rf "${tmpDir}"`);
  });

  describe("__git_branches__", () => {
    /** Temp git repo for branch tests. */
    let gitDir;

    beforeAll(() => {
      gitDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
      execSync("git init && git commit --allow-empty -m init && git branch feature-abc && git branch fix-xyz", {
        cwd: gitDir,
        encoding: "utf-8",
        env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" },
      });
    });

    afterAll(() => {
      if (gitDir) execSync(`rm -rf "${gitDir}"`);
    });

    it("should expand to local branch names", () => {
      const script = buildCompletionTestScript("|__git_branches__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: gitDir });
      expect(results).toContain("feature-abc");
      expect(results).toContain("fix-xyz");
    });

    it("should filter by prefix when typing", () => {
      const script = buildCompletionTestScript("|__git_branches__", ["testcmd", "feat"], 1);
      const results = runCompletionScript(script, { cwd: gitDir });
      expect(results).toContain("feature-abc");
      expect(results).not.toContain("fix-xyz");
    });
  });

  describe("__git_remotes__", () => {
    /** Temp git repo for remote tests. */
    let gitDir;

    beforeAll(() => {
      gitDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
      execSync(
        "git init && git remote add origin https://example.com/repo.git && git remote add upstream https://example.com/upstream.git",
        {
          cwd: gitDir,
          encoding: "utf-8",
        },
      );
    });

    afterAll(() => {
      if (gitDir) execSync(`rm -rf "${gitDir}"`);
    });

    it("should expand to remote names", () => {
      const script = buildCompletionTestScript("|__git_remotes__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: gitDir });
      expect(results).toContain("origin");
      expect(results).toContain("upstream");
    });
  });

  describe("__git_files__", () => {
    /** Temp git repo for file tests. */
    let gitDir;

    beforeAll(() => {
      gitDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
      execSync(
        'git init && git commit --allow-empty -m init && echo "changed" > tracked.txt && git add tracked.txt && git commit -m "add" && echo "modified" > tracked.txt && echo "new" > untracked.txt',
        {
          cwd: gitDir,
          encoding: "utf-8",
          env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" },
        },
      );
    });

    afterAll(() => {
      if (gitDir) execSync(`rm -rf "${gitDir}"`);
    });

    it("should expand to modified and untracked files", () => {
      const script = buildCompletionTestScript("|__git_files__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: gitDir });
      expect(results).toContain("tracked.txt");
      expect(results).toContain("untracked.txt");
    });
  });

  describe("__git_head_refs__", () => {
    it("should expand to HEAD and HEAD~N refs", () => {
      const script = buildCompletionTestScript("|__git_head_refs__", ["testcmd", "HEAD"], 1);
      const results = runCompletionScript(script);
      expect(results).toContain("HEAD");
      expect(results).toContain("HEAD~1");
      expect(results).toContain("HEAD~100");
      expect(results).toContain("HEAD^");
    });
  });

  describe("__git_commits__", () => {
    /** Temp git repo for commit hash tests. */
    let gitDir;

    beforeAll(() => {
      gitDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
      execSync("git init && git commit --allow-empty -m first && git commit --allow-empty -m second", {
        cwd: gitDir,
        encoding: "utf-8",
        env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" },
      });
    });

    afterAll(() => {
      if (gitDir) execSync(`rm -rf "${gitDir}"`);
    });

    it("should expand to recent commit short hashes", () => {
      const script = buildCompletionTestScript("|__git_commits__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: gitDir });
      expect(results.length).toBeGreaterThanOrEqual(2);
      // short hashes are 7+ hex chars
      for (const hash of results) {
        expect(hash).toMatch(/^[0-9a-f]+$/);
      }
    });
  });

  describe("__npm_scripts__", () => {
    it("should expand to script names from package.json", () => {
      const setupDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
      fs.writeFileSync(path.join(setupDir, "package.json"), JSON.stringify({ scripts: { build: "tsc", test: "vitest", lint: "eslint" } }));
      try {
        const script = buildCompletionTestScript("|__npm_scripts__", ["testcmd", ""], 1);
        const results = runCompletionScript(script, { cwd: setupDir });
        expect(results).toContain("build");
        expect(results).toContain("test");
        expect(results).toContain("lint");
      } finally {
        execSync(`rm -rf "${setupDir}"`);
      }
    });
  });

  describe("__makefile_targets__", () => {
    it("should expand to target names from Makefile", () => {
      const setupDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
      fs.writeFileSync(path.join(setupDir, "Makefile"), "build:\n\techo build\ntest:\n\techo test\nclean:\n\techo clean\n");
      try {
        const script = buildCompletionTestScript("|__makefile_targets__", ["testcmd", ""], 1);
        const results = runCompletionScript(script, { cwd: setupDir });
        expect(results).toContain("build");
        expect(results).toContain("test");
        expect(results).toContain("clean");
      } finally {
        execSync(`rm -rf "${setupDir}"`);
      }
    });
  });

  describe("__composer_scripts__", () => {
    it("should expand to script names from composer.json", () => {
      const setupDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
      fs.writeFileSync(
        path.join(setupDir, "composer.json"),
        JSON.stringify({ scripts: { "post-install-cmd": "echo hi", test: "phpunit" } }),
      );
      try {
        const script = buildCompletionTestScript("|__composer_scripts__", ["testcmd", ""], 1);
        const results = runCompletionScript(script, { cwd: setupDir });
        expect(results).toContain("post-install-cmd");
        expect(results).toContain("test");
      } finally {
        execSync(`rm -rf "${setupDir}"`);
      }
    });
  });
});
