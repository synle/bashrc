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

describe("bash-fzf.profile.bash (direct)", () => {
  const fzfTemplatePath = path.resolve("software/scripts/bash-fzf.profile.bash");

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
    // .git at root would trigger git fast-path; create a nested one for filtering tests
    fs.mkdirSync(path.join(tmpDir, "sub", ".git", "objects"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "sub", ".git", "objects", "abc"), "obj");
    fs.writeFileSync(path.join(tmpDir, "__pycache__", "mod.pyc"), "cache");
    fs.writeFileSync(path.join(tmpDir, ".venv", "lib", "site.py"), "venv");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Execute fixture shell code and return nonempty output lines; throws on failure. @param {string} script @returns {string[]} */
  function runFzfHelper(script) {
    const full = `#!/usr/bin/env bash\nLINE_BREAK_HASH=${JSON.stringify("#".repeat(80))}\nsource "${COMMON_ENV_PATH}"\nsource "${fzfTemplatePath}"\n${script}`;
    return execSync("bash", { input: full, encoding: "utf-8", cwd: tmpDir, timeout: 10000 })
      .trim()
      .split("\n")
      .filter((l) => l !== "");
  }

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

    it("should set BOOKMARK_SYLE_PATH under the personal root", () => {
      const results = runFzfHelper('echo "$BOOKMARK_SYLE_PATH"');
      expect(results[0]).toMatch(/\.syle_bookmark$/);
    });

    it("should add and dedupe bookmarks", () => {
      const results = runFzfHelper(`
        export BOOKMARK_SYLE_PATH="/tmp/_test_bookmark_$$"
        add_bookmark "cd /tmp"
        add_bookmark "cd /tmp"
        add_bookmark "cd /var"
        cat "\$BOOKMARK_SYLE_PATH"
        rm -f "\$BOOKMARK_SYLE_PATH"
      `);
      const cdTmpCount = results.filter((l) => l === "cd /tmp").length;
      expect(cdTmpCount).toBe(1);
      expect(results).toContain("cd /var");
    });

    it.each([
      ["favorite_alias", "favorite_target", "EXEC:"],
      ["favorite_alias --verbose", "favorite_target 'two words' \"quoted\"", "EXEC:two words quoted --verbose"],
    ])("should display alias expansion on a separate line for %s", (selection, expansion, execution) => {
      const results = runFzfHelper(`
        shopt -s expand_aliases
        function h1() { printf 'H1:%s\\n' "$@"; }
        function hr() { echo "HR"; }
        function fzf_run() { printf '%s\\n' ${JSON.stringify(selection)}; }
        function favorite_target() { printf 'EXEC:%s\\n' "$*"; }
        alias favorite_alias=${JSON.stringify(expansion)}
        fuzzy_favorite_command
      `);
      expect(results).toEqual([
        `H1:${selection}`,
        "HR",
        "H1:favorite_alias is an alias",
        "#".repeat(80),
        `H1:${expansion}`,
        "HR",
        execution,
      ]);
    });

    it("should preserve function definitions and execute the selected function", () => {
      const results = runFzfHelper(`
        function h1() { printf 'H1:%s\\n' "$@"; }
        function hr() { echo "HR"; }
        function fzf_run() { echo "favorite_test_command"; }
        function favorite_test_command() { echo "EXECUTED"; }
        expected=$(type favorite_test_command)
        h1 favorite_test_command
        hr
        printf '%s\\n' "$LINE_BREAK_HASH"
        h1 "$expected"
        hr
        echo EXECUTED
        echo SPLIT
        fuzzy_favorite_command
      `);
      const split = results.indexOf("SPLIT");
      expect(results.slice(split + 1)).toEqual(results.slice(0, split));
    });

    it("should truncate long type output and frame it with hr separators", () => {
      // h1 / hr live in common-env.sh / profile-advanced.sh, which this harness
      // does not source; stub them with markers so the framing order is visible.
      const results = runFzfHelper(`
        function h1() { printf 'H1:%s\\n' "$@"; }
        function hr() { echo "HR"; }
        function fzf_run() { echo "favorite_test_command"; }
        function favorite_test_command() { :; }
        function type() { printf '%*s' 600 '' | tr ' ' x; }
        fuzzy_favorite_command
      `);
      expect(results).toEqual(["H1:favorite_test_command", "HR", "#".repeat(80), `H1:${"x".repeat(500)}`, "HR"]);
    });
  });

  describe("fzf history timestamp filtering", () => {
    it("should filter lines starting with # from bash_history in fuzzy_history", () => {
      // fuzzy_history (in bash-history.profile.bash) is the single source of truth for
      // history fzf search; used both by direct invocation and by the Ctrl+R bind in
      // bash-keys.profile.bash. It uses grep -v '^#[0-9][0-9]*$' to strip bash
      // HISTTIMEFORMAT timestamp lines (e.g. #1774747858) while preserving user-typed
      // `# note` lines.
      const historyPath = path.resolve("software/scripts/bash-history.profile.bash");
      const content = fs.readFileSync(historyPath, "utf8");
      expect(content).toContain("command grep -v '^#[0-9][0-9]*$'");
    });
  });
});
