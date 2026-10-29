/** Saved tracked-shell inventories and default scope for optional validators. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/** Resolve real entry points before running in private fixture repositories. */
const root = path.resolve(".");
/** Collector CLI under test, independent of fixture cwd. */
const collector = path.join(root, "software/tools/collect-shell-agnostic-files.js");
/** Validator CLI under test, independent of fixture cwd. */
const validator = path.join(root, "software/tools/validate-shell-agnostic.js");
/** Real analyzers are needed only for successful static-check fixtures. */
const analyzersAvailable = ["shellcheck", "shfmt"].every((binary) => spawnSync(binary, ["--version"], { timeout: 5000 }).status === 0);
/** Each test owns its repository, saved list, and temporary-folder environment. */
let folder;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "shell-agnostic-files-"));
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

/**
 * Run a real CLI without personal startup loading or inherited validator scope.
 * @param {string} binary Executable filename.
 * @param {string[]} args Literal arguments.
 * @param {string} cwd Working folder.
 * @param {object} env Per-case environment overrides.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured process result.
 */
function run(binary, args, cwd = folder, env = {}) {
  return spawnSync(binary, args, {
    cwd,
    env: {
      ...process.env,
      BASH_ENV: "",
      ENV: "",
      HOME: folder,
      ZDOTDIR: folder,
      TMPDIR: folder,
      TMP: folder,
      TEMP: folder,
      SHELL_AGNOSTIC_FILES: "",
      SHELL_AGNOSTIC_RULE: "",
      ...env,
    },
    encoding: "utf8",
    timeout: 15000,
  });
}

/**
 * Write one private fixture, creating its parent folders.
 * @param {string} name Relative filename.
 * @param {string} content Exact file bytes.
 * @returns {string} Absolute filename.
 * @sideEffects Writes only below this test's temporary folder.
 */
function fixture(name, content = "#!/bin/sh\nprintf '%s\\n' \"$@\"\n") {
  const file = path.join(folder, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

it("collects tracked shell sources and excludes non-executable templates", () => {
  expect(run("git", ["init", "-q"]).status).toBe(0);
  fixture("shared.sh");
  fixture("space ; quote'\".bash");
  fixture("line\nbreak.zsh");
  fixture("unicode-\u00e9.sh");
  fixture(".build/generated.sh");
  fixture("dist/generated.bash");
  fixture("coverage/generated.zsh");
  fixture("windows.ps1.bash");
  fixture("assets/fonts/install.sh", "#!/bin/bash\ncd ([Environment]::GetFolderPath('Desktop'))\n");
  fixture("software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash", "{{COMMAND}}\n");
  fixture("notes.txt", "not shell");
  expect(run("git", ["add", "--", "."]).status).toBe(0);
  fixture("untracked.sh");
  const result = run(process.execPath, [collector]);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout.trim()).toBe(path.join(folder, "shell-agnostic-files.txt"));
  expect(JSON.parse(fs.readFileSync(result.stdout.trim(), "utf8"))).toEqual([
    "line\nbreak.zsh",
    "shared.sh",
    "space ; quote'\".bash",
    "unicode-\u00e9.sh",
  ]);
});

it("does not replace a saved list when Git collection fails", () => {
  const saved = fixture("shell-agnostic-files.txt", '["previous.sh"]\n');
  const result = run(process.execPath, [collector]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr).error.code).toBe("COLLECTION_UNAVAILABLE");
  expect(fs.readFileSync(saved, "utf8")).toBe('["previous.sh"]\n');
});

it("refreshes the saved list after tracked files change", () => {
  expect(run("git", ["init", "-q"]).status).toBe(0);
  fixture("first.sh");
  expect(run("git", ["add", "--", "first.sh"]).status).toBe(0);
  expect(run(process.execPath, [collector]).status).toBe(0);
  const saved = path.join(folder, "shell-agnostic-files.txt");
  expect(JSON.parse(fs.readFileSync(saved, "utf8"))).toEqual(["first.sh"]);
  fixture("second.bash");
  expect(run("git", ["add", "--", "second.bash"]).status).toBe(0);
  expect(run(process.execPath, [collector]).status).toBe(0);
  expect(JSON.parse(fs.readFileSync(saved, "utf8"))).toEqual(["first.sh", "second.bash"]);
});

it("reports a failed saved-list write without claiming collection succeeded", () => {
  expect(run("git", ["init", "-q"]).status).toBe(0);
  fs.mkdirSync(path.join(folder, "shell-agnostic-files.txt"));
  const result = run(process.execPath, [collector]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr).error.message).toMatch(/EISDIR/);
});

it("provides a Make collection target using the same saved-list location", () => {
  const result = run("make", ["-s", "collect_shell_agnostic_files"], root);
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe(path.join(folder, "shell-agnostic-files.txt"));
  const files = JSON.parse(fs.readFileSync(result.stdout.trim(), "utf8"));
  expect(files).toContain("run.sh");
  expect(files).not.toContain("assets/fonts/install.sh");
  expect(files).not.toContain("software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash");
  expect(
    files.filter(
      (file) =>
        file.endsWith(".ps1.bash") ||
        file === "assets/fonts/install.sh" ||
        file === "software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash" ||
        /^(\.build|dist|coverage)\//.test(file),
    ),
  ).toEqual([]);
});

it("reports the collection command when the saved list is missing", () => {
  const result = run(process.execPath, [validator, "printf"]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr).error.message).toContain("make collect_shell_agnostic_files");
  expect(fs.existsSync(path.join(folder, "shell-agnostic-files.txt"))).toBe(false);
});

it.each(["not JSON", "[]", '"shared.sh"', '[""]', "[false]"])("rejects invalid saved scope %s", (content) => {
  fixture("shell-agnostic-files.txt", content);
  const result = run(process.execPath, [validator, "printf"]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr).ok).toBe(false);
});

describe.skipIf(!analyzersAvailable)("saved-list validation", () => {
  it("runs every optional check and continues after printf findings", () => {
    const source = fixture("echo.sh", ["#!/bin/sh", "echo message", ""].join("\n"));
    const result = run("make", ["-s", "validate_shell_agnostic_best_effort", `files=${source}`], root);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"rule": "printf"');
    expect(result.stdout).toContain('"rule": "quoting"');
    expect(result.stdout).toContain('"rule": "options"');
    expect(result.stdout).toContain('"rule": "syntax"');
    expect(result.stdout).toContain("AGNOSTIC_PRINTF");
    expect(result.stdout).toContain("Diagnostics remain above.");
  });

  it.each(["printf", "quoting", "options", "syntax", "all"])("defaults Make's %s check to the saved list", (rule) => {
    const source = fixture("literal ; name.sh");
    fixture("shell-agnostic-files.txt", JSON.stringify([source, source]));
    const target = rule === "all" ? "validate_shell_agnostic" : `validate_shell_agnostic_${rule}`;
    const result = run("make", ["-s", target], root);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, rule, checkedFiles: 1, findings: [] });
  });

  it("round-trips the collector's relative paths through the validator without executing shell source", () => {
    expect(run("git", ["init", "-q"]).status).toBe(0);
    fixture("shared.sh", "#!/bin/sh\nprintf '%s\\n' \"$@\"\ntouch must-not-exist\n");
    expect(run("git", ["add", "--", "shared.sh"]).status).toBe(0);
    expect(run(process.execPath, [collector]).status).toBe(0);
    const result = run(process.execPath, [validator]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, rule: "all", checkedFiles: 1, findings: [] });
    expect(fs.existsSync(path.join(folder, "must-not-exist"))).toBe(false);
  });

  it.each(["literal", "json"])("uses explicit Make files in %s form instead of a malformed saved list", (form) => {
    const source = fixture("explicit ; source.sh");
    fixture("shell-agnostic-files.txt", "not JSON");
    const files = form === "json" ? JSON.stringify([source]) : source;
    const result = run("make", ["-s", "validate_shell_agnostic", `files=${files}`], root);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, rule: "all", checkedFiles: 1, findings: [] });
  });

  it("prioritizes CLI paths over environment scope and the saved list", () => {
    const source = fixture("explicit.sh");
    fixture("shell-agnostic-files.txt", "not JSON");
    const result = run(process.execPath, [validator, "all", source], folder, { SHELL_AGNOSTIC_FILES: "[" });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, rule: "all", checkedFiles: 1, findings: [] });
  });

  it("still rejects sensitive source paths loaded from the saved list", () => {
    fixture("shell-agnostic-files.txt", '["sample.secret.sh"]');
    const result = run(process.execPath, [validator, "printf"]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).error.message).toContain("sensitive paths");
  });
});
