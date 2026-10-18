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

  describe("template bash syntax", () => {
    it("should produce valid bash when all tokens are used", () => {
      const allTokens = [...VALID_TOKENS].join(",");
      const spec = `|${allTokens}`;
      const funcBody = templateContent
        .split("{{COMMAND}}")
        .join("syntaxtest")
        .split("{{SPEC_CONTENT}}")
        .join(spec)
        .split("{{MAX_NESTED_DEPTH}}")
        .join("3");
      // bash -n checks syntax without executing
      execSync("bash -n", { input: funcBody, encoding: "utf-8", timeout: 5000 });
    });
  });
});
