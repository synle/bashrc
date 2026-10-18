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
    // .git at root would trigger git fast-path — create a nested one for filtering tests
    fs.mkdirSync(path.join(tmpDir, "sub", ".git", "objects"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "sub", ".git", "objects", "abc"), "obj");
    fs.writeFileSync(path.join(tmpDir, "__pycache__", "mod.pyc"), "cache");
    fs.writeFileSync(path.join(tmpDir, ".venv", "lib", "site.py"), "venv");
  });

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

function runFzfHelper(script) {
    const full = `#!/usr/bin/env bash\nsource "${COMMON_ENV_PATH}"\nsource "${fzfTemplatePath}"\n${script}`;
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

    it("should resolve root / instead of falling back to current directory", () => {
      const results = runFzfHelper('_fuzzy_list_all "/" folders 1');
      // root should contain system dirs, not tmpDir contents
      const all = results.join(" ");
      expect(all).toContain("usr/");
      expect(all).not.toContain("src/");
      expect(all).not.toContain("docs/");
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
});
