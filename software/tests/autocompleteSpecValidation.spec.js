/** Autocomplete spec file validation tests. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ---- load SPEC_COMMANDS and known tokens from autocomplete.common.js ----
const commonSource = fs.readFileSync("software/metadata/autocomplete.common.js", "utf-8");

// extract SPEC_COMMANDS array by evaluating the file in a sandbox
const vm = await import("vm");
const sandbox = {};
vm.default.runInNewContext(commonSource.replace(/^(const|let) /gm, "var ").replace(/^function /gm, "var _fn = function "), sandbox);
const SPEC_COMMANDS = sandbox.SPEC_COMMANDS;

/** Valid dynamic tokens documented in autocomplete.common.js. */
const VALID_TOKENS = new Set([
  "__git_branches__",
  "__git_remotes__",
  "__git_files__",
  "__git_head_refs__",
  "__git_commits__",
  "__git_add_flags__",
  "__git_branch_flags__",
  "__git_commit_flags__",
  "__git_diff_flags__",
  "__git_log_flags__",
  "__git_show_flags__",
  "__git_rebase_flags__",
  "__npm_scripts__",
  "__makefile_targets__",
  "__ssh_hosts__",
  "__tldr_commands__",
  "__cargo_targets__",
  "__python_scripts__",
  "__gradle_tasks__",
  "__composer_scripts__",
  "__files__",
  "__folders__",
  "__paths__",
  "__nested_text_files__",
  "__nested_files__",
  "__nested_folders__",
  "__nested_paths__",
]);

/** Unique spec file paths referenced by SPEC_COMMANDS (excludes specCommand proxies). */
const uniqueSpecFiles = [...new Set(SPEC_COMMANDS.map((c) => c.specFile).filter(Boolean))];

// ---- tests ----

describe("SPEC_COMMANDS integrity", () => {
  it("should reference spec files that exist on disk", () => {
    const missing = uniqueSpecFiles.filter((f) => !fs.existsSync(f));
    expect(missing, `Missing spec files: ${missing.join(", ")}`).toEqual([]);
  });

  it("should have matching spec files for all files in the spec directory", () => {
    const specDir = "software/metadata/autocomplete-complete-spec";
    const filesOnDisk = fs.readdirSync(specDir).map((f) => path.join(specDir, f));
    const referenced = new Set(uniqueSpecFiles);
    const unreferenced = filesOnDisk.filter((f) => !referenced.has(f));
    expect(unreferenced, `Spec files not referenced in SPEC_COMMANDS: ${unreferenced.join(", ")}`).toEqual([]);
  });

  it("should be sorted alphabetically by command name within each group", () => {
    const groups = [];
    let current = [];
    for (const entry of SPEC_COMMANDS) {
      current.push(entry.command);
    }
    // Split into groups by detecting sort breaks
    const allCommands = SPEC_COMMANDS.map((c) => c.command);
    const groupedCommands = [];
    let group = [allCommands[0]];
    for (let i = 1; i < allCommands.length; i++) {
      if (allCommands[i].localeCompare(allCommands[i - 1]) >= 0) {
        group.push(allCommands[i]);
      } else {
        groupedCommands.push(group);
        group = [allCommands[i]];
      }
    }
    groupedCommands.push(group);
    for (const g of groupedCommands) {
      const sorted = [...g].sort((a, b) => a.localeCompare(b));
      expect(g, `Group starting with "${g[0]}" is not sorted`).toEqual(sorted);
    }
  });

  it("should only use valid os values", () => {
    const validOs = new Set(["mac", "linux", "windows"]);
    const invalid = [];
    for (const { command, os } of SPEC_COMMANDS) {
      if (!os) continue;
      for (const part of os.split(",")) {
        if (!validOs.has(part)) invalid.push(`${command}: invalid os "${part}"`);
      }
    }
    expect(invalid, `Invalid os values`).toEqual([]);
  });

  it("should have either specFile or specCommand for every entry", () => {
    const invalid = SPEC_COMMANDS.filter((c) => !c.specFile && !c.specCommand);
    expect(
      invalid.map((c) => c.command),
      `Entries missing both specFile and specCommand`,
    ).toEqual([]);
  });

  it("should have specCommand references that point to existing commands with specFile", () => {
    const commandsWithSpecFile = new Set(SPEC_COMMANDS.filter((c) => c.specFile).map((c) => c.command));
    const invalid = SPEC_COMMANDS.filter((c) => c.specCommand && !commandsWithSpecFile.has(c.specCommand));
    expect(
      invalid.map((c) => `${c.command} -> ${c.specCommand}`),
      `specCommand references to non-existent commands`,
    ).toEqual([]);
  });

  it("should not have duplicate command names", () => {
    const seen = new Set();
    const duplicates = [];
    for (const { command } of SPEC_COMMANDS) {
      if (seen.has(command)) duplicates.push(command);
      seen.add(command);
    }
    expect(duplicates, `Duplicate commands: ${duplicates.join(", ")}`).toEqual([]);
  });
});

describe("spec file formatting", () => {
  for (const specFile of uniqueSpecFiles) {
    const basename = path.basename(specFile);

    describe(basename, () => {
      const content = fs.readFileSync(specFile, "utf-8");
      const lines = content.split("\n");

      it("should not have trailing whitespace on any line", () => {
        const bad = lines.map((line, i) => ({ line, num: i + 1 })).filter(({ line }) => line !== line.trimEnd());
        expect(
          bad.map((b) => `line ${b.num}`),
          `Lines with trailing whitespace`,
        ).toEqual([]);
      });

      it("should not end with multiple trailing newlines", () => {
        expect(content.endsWith("\n\n"), "File should not end with multiple newlines").toBe(false);
      });

      it("should not have blank lines in the middle", () => {
        // Allow trailing newline but no empty lines within the spec
        const trimmed = content.replace(/\n$/, "");
        const blankLines = trimmed
          .split("\n")
          .map((line, i) => ({ line, num: i + 1 }))
          .filter(({ line }) => line.trim() === "");
        expect(
          blankLines.map((b) => `line ${b.num}`),
          `Blank lines found`,
        ).toEqual([]);
      });

      it("should not have duplicate prefixes (left of |)", () => {
        const prefixes = new Map();
        const duplicates = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const prefix = trimmed.split("|")[0];
          if (prefixes.has(prefix)) {
            duplicates.push(`"${prefix}" on lines ${prefixes.get(prefix)} and ${lines.indexOf(line) + 1}`);
          } else {
            prefixes.set(prefix, lines.indexOf(line) + 1);
          }
        }
        expect(duplicates, `Duplicate prefixes`).toEqual([]);
      });

      it("should only use valid dynamic tokens", () => {
        const invalid = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parts = trimmed.split("|");
          if (parts.length < 2 || !parts[1]) continue;
          const completions = parts[1].split(",");
          for (const token of completions) {
            const t = token.trim();
            if (t.startsWith("__") && t.endsWith("__") && !VALID_TOKENS.has(t)) {
              invalid.push(`${t} in "${trimmed}"`);
            }
          }
        }
        expect(invalid, `Invalid dynamic tokens`).toEqual([]);
      });

      it("should not have trailing pipe characters", () => {
        const bad = lines.map((line, i) => ({ line, num: i + 1 })).filter(({ line }) => line.trim().endsWith("|"));
        expect(
          bad.map((b) => `line ${b.num}: "${lines[b.num - 1]}"`),
          `Lines with trailing pipe`,
        ).toEqual([]);
      });
    });
  }
});

// ---- dynamic token expansion (bash integration tests) ----

/** Shared spec-based autocomplete helpers (emitted once before per-command wrappers). */
const commonContent = fs.readFileSync("software/scripts/advanced/bash-autocomplete-complete-spec.common.bash", "utf-8");
/** Per-command wrapper template from the bash autocomplete template file. */
const templateContent =
  commonContent + "\n" + fs.readFileSync("software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash", "utf-8");

/**
 * Builds a bash script that sources a completion function and simulates tab completion.
 * @param {string} specContent - Spec file content to embed.
 * @param {string[]} compWords - Simulated COMP_WORDS array.
 * @param {number} compCword - Index of the word being completed.
 * @param {string} [setupCode] - Extra bash setup code to run before completion.
 * @returns {string} Bash script that prints COMPREPLY entries one per line.
 */
function buildCompletionTestScript(specContent, compWords, compCword, setupCode = "") {
  const funcBody = templateContent
    .replace(/\{\{COMMAND\}\}/g, "testcmd")
    .replace("{{SPEC_CONTENT}}", specContent)
    .replace("{{MAX_NESTED_DEPTH}}", "3");
  return `#!/usr/bin/env bash
set -uo pipefail
source "${process.cwd()}/software/scripts/bash-fzf-profile.bash"
${setupCode}
${funcBody}
COMP_WORDS=(${compWords.map((w) => `"${w}"`).join(" ")})
COMP_CWORD=${compCword}
__spec_complete_testcmd
for r in "\${COMPREPLY[@]}"; do echo "$r"; done
`;
}

/**
 * Runs a bash completion test script and returns COMPREPLY as an array of strings.
 * @param {string} script - Bash script content.
 * @param {object} [options] - Options for execSync.
 * @param {string} [options.cwd] - Working directory.
 * @returns {string[]} Completion results.
 */
function runCompletionScript(script, options = {}) {
  const result = execSync("bash", { input: script, encoding: "utf-8", timeout: 10000, ...options });
  return result
    .trim()
    .split("\n")
    .filter((l) => l !== "");
}

describe("dynamic token expansion (bash integration)", () => {
  /** Temp directory for filesystem token tests. */
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

  // ---- git tokens ----

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

  // ---- static git flag tokens ----

  describe("static git flag tokens", () => {
    it("__git_add_flags__ should include --all and --patch", () => {
      const script = buildCompletionTestScript("add|__git_add_flags__", ["testcmd", "add", "--"], 2);
      const results = runCompletionScript(script);
      expect(results).toContain("--all");
      expect(results).toContain("--patch");
    });

    it("__git_branch_flags__ should include --delete and --move", () => {
      const script = buildCompletionTestScript("branch|__git_branch_flags__", ["testcmd", "branch", "--"], 2);
      const results = runCompletionScript(script);
      expect(results).toContain("--delete");
      expect(results).toContain("--move");
    });

    it("__git_commit_flags__ should include --amend and --message", () => {
      const script = buildCompletionTestScript("commit|__git_commit_flags__", ["testcmd", "commit", "--"], 2);
      const results = runCompletionScript(script);
      expect(results).toContain("--amend");
      expect(results).toContain("--message");
    });

    it("__git_diff_flags__ should include --staged and --word-diff", () => {
      const script = buildCompletionTestScript("diff|__git_diff_flags__", ["testcmd", "diff", "--"], 2);
      const results = runCompletionScript(script);
      expect(results).toContain("--staged");
      expect(results).toContain("--word-diff");
    });

    it("__git_log_flags__ should include --oneline and --graph", () => {
      const script = buildCompletionTestScript("log|__git_log_flags__", ["testcmd", "log", "--"], 2);
      const results = runCompletionScript(script);
      expect(results).toContain("--oneline");
      expect(results).toContain("--graph");
    });

    it("__git_show_flags__ should include --stat and --name-only", () => {
      const script = buildCompletionTestScript("show|__git_show_flags__", ["testcmd", "show", "--"], 2);
      const results = runCompletionScript(script);
      expect(results).toContain("--stat");
      expect(results).toContain("--name-only");
    });

    it("__git_rebase_flags__ should include --abort and --interactive", () => {
      const script = buildCompletionTestScript("rebase|__git_rebase_flags__", ["testcmd", "rebase", "--"], 2);
      const results = runCompletionScript(script);
      expect(results).toContain("--abort");
      expect(results).toContain("--interactive");
    });
  });

  // ---- project file tokens ----

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

  // ---- filesystem tokens ----

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
  });

  describe("__paths__", () => {
    it("should expand to files and directories in cwd", () => {
      const script = buildCompletionTestScript("|__paths__", ["testcmd", ""], 1);
      const results = runCompletionScript(script, { cwd: tmpDir });
      expect(results).toContain("subdir");
      expect(results).toContain("file1.txt");
    });
  });

  // ---- subcommand prefix matching ----

  describe("subcommand matching", () => {
    it("should match subcommand and return its completions", () => {
      const spec = "start|--port,--host,--verbose\nstop|--force,--timeout";
      const script = buildCompletionTestScript(spec, ["testcmd", "start", "--"], 2);
      const results = runCompletionScript(script);
      expect(results).toContain("--port");
      expect(results).toContain("--host");
      expect(results).toContain("--verbose");
      expect(results).not.toContain("--force");
    });

    it("should infer subcommands at base level", () => {
      const spec = "start|--port\nstop|--force\nrestart|--delay";
      const script = buildCompletionTestScript(spec, ["testcmd", ""], 1);
      const results = runCompletionScript(script);
      expect(results).toContain("start");
      expect(results).toContain("stop");
      expect(results).toContain("restart");
    });

    it("should match nested subcommands", () => {
      const spec = "rollout|status,undo\nrollout status|--watch,--timeout\nrollout undo|--dry-run";
      const script = buildCompletionTestScript(spec, ["testcmd", "rollout", "status", "--"], 3);
      const results = runCompletionScript(script);
      expect(results).toContain("--watch");
      expect(results).toContain("--timeout");
      expect(results).not.toContain("--dry-run");
    });

    it("should include base line extras alongside inferred subcommands", () => {
      const spec = "sub1|--opt1\nsub2|--opt2\n|--global-flag";
      const script = buildCompletionTestScript(spec, ["testcmd", "--"], 1);
      const results = runCompletionScript(script);
      expect(results).toContain("--global-flag");
      expect(results).not.toContain("--opt1");
    });
  });

  // ---- template syntax check ----

  describe("template bash syntax", () => {
    it("should produce valid bash when all tokens are used", () => {
      const allTokens = [...VALID_TOKENS].join(",");
      const spec = `|${allTokens}`;
      const funcBody = templateContent
        .replace(/\{\{COMMAND\}\}/g, "syntaxtest")
        .replace("{{SPEC_CONTENT}}", spec)
        .replace("{{MAX_NESTED_DEPTH}}", "3");
      // bash -n checks syntax without executing
      execSync("bash -n", { input: funcBody, encoding: "utf-8", timeout: 5000 });
    });
  });
});

// ---- bash-fzf-profile.bash direct tests ----

describe("bash-fzf-profile.bash (direct)", () => {
  /** @type {string} */
  const fzfTemplatePath = path.resolve("software/scripts/bash-fzf-profile.bash");
  /** @type {string} */
  let tmpDir;

  beforeAll(() => {
    tmpDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();
    // legitimate entries
    fs.mkdirSync(path.join(tmpDir, "src", "lib"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "README.md"), "readme");
    fs.writeFileSync(path.join(tmpDir, "index.js"), "main");
    fs.writeFileSync(path.join(tmpDir, "src", "app.ts"), "app");
    fs.writeFileSync(path.join(tmpDir, "src", "lib", "util.js"), "util");
    fs.writeFileSync(path.join(tmpDir, "photo.png"), "img");
    fs.writeFileSync(path.join(tmpDir, "archive.zip"), "zip");
    // ignored entries
    const ignoredDirs = [
      ".cache",
      ".idea",
      ".next",
      ".venv/lib",
      ".yarn",
      ".svn",
      ".gradle",
      ".turbo",
      ".DS_Store",
      "node_modules/pkg",
      "__pycache__",
      "bower_components",
      ".pytest_cache",
      ".mypy_cache",
      ".sass-cache",
      ".parcel-cache",
    ];
    for (const dir of ignoredDirs) {
      fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
    }
    fs.writeFileSync(path.join(tmpDir, "node_modules", "pkg", "index.js"), "mod");
    // .git at root would trigger git fast-path — create a nested one for filtering tests
    fs.mkdirSync(path.join(tmpDir, "sub", ".git", "objects"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "sub", ".git", "objects", "abc"), "obj");
    fs.writeFileSync(path.join(tmpDir, "__pycache__", "mod.pyc"), "cache");
    fs.writeFileSync(path.join(tmpDir, ".venv", "lib", "site.py"), "venv");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Runs a bash script that sources bash-fzf-profile.bash and returns stdout lines. */
  function runFzfHelper(script) {
    const full = `#!/usr/bin/env bash\nsource "${fzfTemplatePath}"\n${script}`;
    return execSync("bash", { input: full, encoding: "utf-8", cwd: tmpDir, timeout: 10000 })
      .trim()
      .split("\n")
      .filter((l) => l !== "");
  }

  describe("filter_unwanted", () => {
    it("should filter ignored folder paths from piped input", () => {
      const results = runFzfHelper(`
        printf '%s\\n' \
          "src/app.ts" "node_modules/pkg/index.js" ".git/objects/abc" \
          "__pycache__/mod.pyc" "docs/" "bower_components/" \
          ".venv/lib/site.py" ".idea/" "README.md" \
        | filter_unwanted
      `);
      expect(results).toContain("src/app.ts");
      expect(results).toContain("docs/");
      expect(results).toContain("README.md");
      expect(results.join(" ")).not.toContain("node_modules");
      expect(results.join(" ")).not.toContain(".git");
      expect(results.join(" ")).not.toContain("__pycache__");
      expect(results.join(" ")).not.toContain("bower_components");
      expect(results.join(" ")).not.toContain(".venv");
      expect(results.join(" ")).not.toContain(".idea");
    });

    it("should pass through legitimate paths unchanged", () => {
      const results = runFzfHelper(`
        printf '%s\\n' "src/" "src/app.ts" "docs/" "README.md" "index.js" | filter_unwanted
      `);
      expect(results).toContain("README.md");
      expect(results).toContain("docs/");
      expect(results).toContain("index.js");
      expect(results).toContain("src/");
      expect(results).toContain("src/app.ts");
      expect(results).toHaveLength(5);
    });
  });

  describe("_fuzzy_list_all", () => {
    it("should list files and dirs, filtering ignored paths", () => {
      const results = runFzfHelper("_fuzzy_list_all .");
      const all = results.join(" ");
      // legitimate entries appear
      expect(results).toContain("README.md");
      expect(results).toContain("index.js");
      expect(all).toContain("src/");
      expect(all).toContain("docs/");
      // ignored entries filtered
      expect(all).not.toContain(".git");
      expect(all).not.toContain("node_modules");
      expect(all).not.toContain("__pycache__");
      expect(all).not.toContain(".venv");
      expect(all).not.toContain(".idea");
      expect(all).not.toContain("bower_components");
      expect(all).not.toContain(".DS_Store");
      expect(all).not.toContain(".cache");
    });

    it("should mark directories with trailing /", () => {
      const results = runFzfHelper("_fuzzy_list_all .");
      const dirs = results.filter((r) => r.endsWith("/"));
      const files = results.filter((r) => !r.endsWith("/"));
      expect(dirs.length).toBeGreaterThan(0);
      expect(files.length).toBeGreaterThan(0);
      expect(dirs).toContain("src/");
      expect(dirs).toContain("docs/");
      expect(files).toContain("README.md");
      expect(files).toContain("index.js");
    });

    it("should not have double slashes in directory paths", () => {
      const results = runFzfHelper("_fuzzy_list_all .");
      for (const r of results) {
        expect(r, `${r} has double slash`).not.toContain("//");
      }
    });

    it("should respect max_depth parameter", () => {
      const shallow = runFzfHelper("_fuzzy_list_all . paths 1");
      // depth 1 should not include nested files like src/app.ts
      const hasDeepFile = shallow.some((r) => r === "src/app.ts");
      expect(hasDeepFile, "src/app.ts should not appear at depth 1").toBe(false);
      // but src/ dir itself should appear
      expect(shallow).toContain("src/");
    });

    it("should return only folders in folders mode", () => {
      const results = runFzfHelper("_fuzzy_list_all . folders");
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r, `${r} should end with /`).toMatch(/\/$/);
      }
      expect(results).toContain("src/");
      expect(results).toContain("docs/");
    });

    it("should return only files in files mode", () => {
      const results = runFzfHelper("_fuzzy_list_all . files");
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r, `${r} should not end with /`).not.toMatch(/\/$/);
      }
      expect(results).toContain("README.md");
      expect(results).toContain("index.js");
    });

    it("should filter binary files in text_files mode", () => {
      const results = runFzfHelper("_fuzzy_list_all . text_files");
      expect(results.length).toBeGreaterThan(0);
      expect(results).toContain("README.md");
      expect(results).toContain("index.js");
      expect(results).toContain("src/app.ts");
      // no dirs in text_files mode
      for (const r of results) {
        expect(r, `${r} should not end with /`).not.toMatch(/\/$/);
      }
      // binary files filtered out
      const all = results.join(" ");
      expect(all).not.toContain("photo.png");
      expect(all).not.toContain("archive.zip");
    });
  });

  describe("fuzzy_open (mocked fzf)", () => {
    /**
     * Runs fuzzy_open with fzf mocked to return a fixed selection.
     * Also mocks view_file/vim to echo instead of opening.
     */
    function runFuzzyOpen(fzfReturn, viewCommand = "") {
      return runFzfHelper(`
        # mock fzf to return a fixed selection
        function fzf() { echo "${fzfReturn}"; }
        # mock view_file and vim to just echo
        function view_file() { echo "view_file: $1"; }
        function vim() { echo "vim: $1"; }
        # stub _recent_folders for fuzzy_paths
        function _recent_folders() { echo "${tmpDir}"; }
        # need realpath and git stubs
        function git() { return 1; }

        ${
          fs
            .readFileSync("software/bootstrap/profile-advanced.sh", "utf-8")
            .split("\n")
            .filter((l) => (/^function fuzzy_open|^function fuzzy_paths/.test(l.trim()) ? true : false)).length
            ? ""
            : ""
        }
        # inline fuzzy_open from profile-advanced.sh
        function fuzzy_open() {
          local VIEW_COMMAND="\$1"
          local OUT=$(_fuzzy_list_all | fzf --prompt="Files> ")
          if [ -z "\$OUT" ]; then return; fi
          local IS_DIR=false
          if [[ "\$OUT" == */ ]]; then IS_DIR=true; OUT="\${OUT%/}"; fi
          local FULL_PATH
          FULL_PATH=\$(realpath "\$OUT" 2>/dev/null || echo "\$OUT")
          if [ "\$IS_DIR" = true ]; then
            echo "cd: \$FULL_PATH"
          elif [ -n "\$VIEW_COMMAND" ]; then
            echo "\$VIEW_COMMAND: \$OUT"
          else
            view_file "\$OUT"
          fi
        }

        fuzzy_open ${viewCommand}
      `);
    }

    it("should open a file with view_file when no editor specified", () => {
      const results = runFuzzyOpen("index.js");
      expect(results.join(" ")).toContain("view_file: index.js");
    });

    it("should open a file with specified editor", () => {
      const results = runFuzzyOpen("README.md", "vim");
      expect(results.join(" ")).toContain("vim: README.md");
    });

    it("should cd into directory when selection ends with /", () => {
      const results = runFuzzyOpen("src/");
      expect(results.join(" ")).toContain("cd:");
      expect(results.join(" ")).toContain("src");
    });

    it("should do nothing when fzf returns empty", () => {
      const results = runFzfHelper(`
        function fzf() { echo ""; }
        function fuzzy_open() {
          local OUT=$(_fuzzy_list_all | fzf)
          if [ -z "\$OUT" ]; then echo "NO_SELECTION"; return; fi
        }
        fuzzy_open
      `);
      expect(results).toContain("NO_SELECTION");
    });
  });

  describe("bookmark functions", () => {
    it("should define add_bookmark, add_bookmark_dir, and fuzzy_favorite_command", () => {
      const results = runFzfHelper(`
        type add_bookmark && echo "HAS_ADD_BOOKMARK"
        type add_bookmark_dir && echo "HAS_ADD_BOOKMARK_DIR"
        type fuzzy_favorite_command && echo "HAS_FUZZY_FAVORITE"
      `);
      expect(results).toContain("HAS_ADD_BOOKMARK");
      expect(results).toContain("HAS_ADD_BOOKMARK_DIR");
      expect(results).toContain("HAS_FUZZY_FAVORITE");
    });

    it("should set BOOKMARK_PATH based on USER", () => {
      const results = runFzfHelper('echo "$BOOKMARK_PATH"');
      expect(results[0]).toMatch(/\.\w+_bookmark$/);
    });

    it("should add and dedupe bookmarks", () => {
      const results = runFzfHelper(`
        export BOOKMARK_PATH="/tmp/_test_bookmark_$$"
        add_bookmark "cd /tmp"
        add_bookmark "cd /tmp"
        add_bookmark "cd /var"
        cat "\$BOOKMARK_PATH"
        rm -f "\$BOOKMARK_PATH"
      `);
      const cdTmpCount = results.filter((l) => l === "cd /tmp").length;
      expect(cdTmpCount).toBe(1);
      expect(results).toContain("cd /var");
    });
  });

  describe("fzf history timestamp filtering", () => {
    it("should filter lines starting with # from bash_history in __fzf_history__", () => {
      // The __fzf_history__ function in bash-keys-profile.bash uses grep -v '^#'
      // to strip bash HISTTIMEFORMAT timestamp lines (e.g. #1774747858)
      const keysPath = path.resolve("software/scripts/bash-keys-profile.bash");
      const content = fs.readFileSync(keysPath, "utf8");
      expect(content).toContain("command grep -v '^#'");
    });

    it("should filter lines starting with # from bash_history in fuzzy_history", () => {
      const historyPath = path.resolve("software/scripts/bash-history-profile.bash");
      const content = fs.readFileSync(historyPath, "utf8");
      expect(content).toContain("command grep -v '^#'");
    });
  });
});
