/** Subprocess contracts for smart terminal and editor comparisons. */
import { describe, expect, it } from "vitest";
import { spawnSync, execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Checkout root containing the canonical profile sources. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Core helpers used by the comparison dispatcher. */
const CORE = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8");
/** Exact advanced section, including aliases and inherited-alias cleanup. */
const DIFF = readFileSync(path.join(ROOT, "software/bootstrap/profile-advanced.sh"), "utf8")
  .split("# --- Diff (file diff or git hash compare) ---\n")[1]
  .split("# SOURCE | software/scripts/bash-git-helpers.profile.bash")[0];
/** Actual Git executable used only for repository integration cases. */
const GIT = execFileSync("/bin/bash", ["-c", "type -P git"], { encoding: "utf8" }).trim();

/**
 * Execute the shipped section in Bash 3.2 with isolated executable boundaries.
 * @param {string[]} args - Arguments passed as positional parameters, never interpolated.
 * @param {object} [options] - Backend, invocation, reload, and launcher fixture controls.
 * @param {string[]} [options.binaries] - Available recording executables.
 * @param {string} [options.invocation] - Fixed shell invocation after profile loading.
 * @param {string} [options.backend] - Recorder or real Git repository.
 * @param {number} [options.exitStatus] - Recorder's process status.
 * @param {boolean} [options.hashes] - Create a second commit and compare both full hashes.
 * @param {string} [options.setup] - Fixed shell functions installed before invoking diff.
 * @returns {import("child_process").SpawnSyncReturns<string>} Process output and status.
 * @throws {Error} On fixture creation errors; removes owned fixtures in all cases.
 */
function runDiff(
  args,
  { binaries = ["git", "diff"], invocation = `eval 'diff "$@"'`, backend = "recorder", exitStatus = 0, hashes = false, setup = "" } = {},
) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "smart-diff-"));
  let processArgs = args;
  try {
    const source = path.join(sandbox, "profile.bash");
    const aliasSource = path.join(sandbox, "inherited-alias.bash");
    writeFileSync(
      source,
      `${CORE.match(/function is_help_arg\(\) \{[\s\S]*?\n\}/)[0]}\n${CORE.match(/function is_runnable_command\(\) \{[\s\S]*?\n\}/)[0]}\n${DIFF}`,
    );
    writeFileSync(aliasSource, "alias diff='command diff --inherited'\n");
    symlinkSync("/usr/bin/tr", path.join(sandbox, "tr"));
    for (const binary of binaries) {
      writeFileSync(path.join(sandbox, binary), `#!/bin/bash\nprintf '%s\\0' "${binary}" "$@"\nexit ${exitStatus}\n`, { mode: 0o755 });
    }
    writeFileSync(path.join(sandbox, "left file.txt"), "old line\n");
    writeFileSync(path.join(sandbox, "right file.txt"), "new line\n");
    writeFileSync(path.join(sandbox, "-dash.txt"), "new line\n");
    writeFileSync(path.join(sandbox, "quote'\"\\\n\u2603.txt"), "new line\n");
    if (backend === "git") {
      rmSync(path.join(sandbox, "git"));
      symlinkSync(GIT, path.join(sandbox, "git"));
      const git = (args) =>
        execFileSync(GIT, args, {
          cwd: sandbox,
          env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
          stdio: "pipe",
        });
      git(["init", "-q"]);
      git(["add", "left file.txt"]);
      git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Initial"]);
      writeFileSync(path.join(sandbox, "left file.txt"), "changed line\n");
      if (hashes) {
        git(["add", "left file.txt"]);
        git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Changed"]);
        processArgs = [git(["rev-parse", "HEAD~1"]).toString().trim(), git(["rev-parse", "HEAD"]).toString().trim()];
      }
    }
    return spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `. "$ALIAS_SOURCE"\n. "$SOURCE"\n. "$SOURCE"\n${setup}\n${invocation}`,
        "test",
        ...processArgs,
      ],
      {
        cwd: sandbox,
        env: {
          ...process.env,
          PATH: sandbox,
          SOURCE: source,
          ALIAS_SOURCE: aliasSource,
          BASH_ENV: "/dev/null",
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_PAGER: "cat",
          LC_ALL: "C",
        },
        encoding: "utf8",
        timeout: 5000,
      },
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe("smart diff subprocess", () => {
  it.each([
    [[], ["-c", "delta.side-by-side=false", "diff", "--no-index", "--", "left file.txt", "right file.txt"]],
    [["-delta1"], ["-c", "delta.side-by-side=false", "diff", "--no-index", "--", "left file.txt", "right file.txt"]],
    [["-delta2"], ["-c", "delta.side-by-side=true", "diff", "--no-index", "--", "left file.txt", "right file.txt"]],
  ])("selects terminal layout %j and preserves left/right order", (flags, expected) => {
    const result = runDiff([...flags, "left file.txt", "right file.txt"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.split("\0")).toEqual(["git", ...expected, ""]);
  });

  it.each([
    ["-code", "code", "--diff"],
    ["-zed", "zed", "--diff"],
    ["-z", "zed", "--diff"],
    ["-winmerge", "winmergeu.exe", null],
    ["-smerge", "smerge", "mergetool"],
    ["-sublime_merge", "smerge.exe", "mergetool"],
  ])("dispatches %s to the available editor", (flag, binary, option) => {
    const result = runDiff([flag, "left file.txt", "right file.txt"], { binaries: [binary] });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.split("\0").filter(Boolean)).toEqual([binary, ...[option].filter(Boolean), "left file.txt", "right file.txt"]);
  });

  it.each(["-code", "-zed", "-winmerge", "-smerge"])("rejects unavailable %s without launching anything", (flag) => {
    const result = runDiff([flag, "left file.txt", "right file.txt"], { binaries: [] });
    expect(result.status).toBe(127);
    expect(result.stderr).toContain("required command not found:");
    expect(result.stdout).toBe("");
  });

  it.each([[[]], [["left file.txt"]], [["left file.txt", "right file.txt", "extra"]]])(
    "rejects editor arity %j before invocation",
    (args) => {
      const result = runDiff(["-code", ...args], { binaries: ["code"] });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("requires exactly two files");
      expect(result.stdout).toBe("");
    },
  );

  it.each(["-code", "-delta1"])("rejects a missing file in %s", (flag) => {
    const result = runDiff([flag, "left file.txt", "missing"], { binaries: ["code", "git"] });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("File not found: missing");
    expect(result.stdout).toBe("");
  });

  it("accepts a deployed editor shell function without a PATH executable", () => {
    const result = runDiff(["-smerge", "left file.txt", "right file.txt"], {
      binaries: [],
      setup: 'function smerge() { printf "%s\\0" "$@"; }',
    });
    expect(result.status).toBe(0);
    expect(result.stdout.split("\0")).toEqual(["mergetool", "left file.txt", "right file.txt", ""]);
  });

  it("rejects alias-only editors that cannot be dynamically invoked", () => {
    const result = runDiff(["-code", "left file.txt", "right file.txt"], { binaries: [], setup: "alias code='echo unexpected'" });
    expect(result.status).toBe(127);
    expect(result.stdout).toBe("");
  });

  it.each(["diff_delta1", "diff_delta2", "diff_code", "diff_zed", "diff_z", "diff_winmerge", "diff_smerge", "diff_sublime_merge"])(
    "loads %s twice without shadowing the dispatcher",
    (name) => {
      const result = runDiff(["left file.txt", "right file.txt"], {
        invocation: `eval '${name} "$@"'`,
        binaries: ["git", "code", "zed", "winmergeu.exe", "smerge"],
      });
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.split("\0").slice(-3)).toEqual(["left file.txt", "right file.txt", ""]);
    },
  );

  it.each([[["help"]], [["--help"]], [["-delta2", "help"]], [["-code", "--help"]]])(
    "shows help for %j without launching commands",
    (args) => {
      const result = runDiff(args, { binaries: [] });
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stdout).toContain("diff: smart diff for files or git commits");
      expect(result.stdout).toContain("-sublime_merge");
      expect(result.stderr).toBe("");
    },
  );

  it("forwards native flags without injecting options", () => {
    const result = runDiff(["-u", "left file.txt", "right file.txt"]);
    expect(result.status).toBe(0);
    expect(result.stdout.split("\0")).toEqual(["diff", "-u", "left file.txt", "right file.txt", ""]);
  });

  it("forwards explicit Delta Git flags", () => {
    const result = runDiff(["-delta2", "--stat"]);
    expect(result.status).toBe(0);
    expect(result.stdout.split("\0")).toEqual(["git", "-c", "delta.side-by-side=true", "diff", "--stat", ""]);
  });

  it("protects leading-dash and shell-sensitive file operands", () => {
    const result = runDiff(["--", "-dash.txt", "quote'\"\\\n\u2603.txt"]);
    expect(result.status).toBe(0);
    expect(result.stdout.split("\0")).toEqual([
      "git",
      "-c",
      "delta.side-by-side=false",
      "diff",
      "--no-index",
      "--",
      "-dash.txt",
      "quote'\"\\\n\u2603.txt",
      "",
    ]);
  });

  it.each([1, 42])("returns backend exit status %s", (exitStatus) => {
    const result = runDiff(["left file.txt", "right file.txt"], { exitStatus });
    expect(result.status).toBe(exitStatus);
    expect(result.stdout).toContain("--no-index");
  });

  it("compares arbitrary files inside a real repository", () => {
    const result = runDiff(["-delta2", "left file.txt", "right file.txt"], { backend: "git" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("-changed line\n+new line");
    expect(result.stderr).toBe("");
  });

  it.each([[[]], [["left file.txt"]]])("compares tracked working changes with %j", (args) => {
    const result = runDiff(args, { backend: "git" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("-old line\n+changed line");
    expect(result.stderr).toBe("");
  });

  it("compares commit hashes through Git", () => {
    const result = runDiff([], { backend: "git", hashes: true });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("git diff ");
    expect(result.stdout).toContain("-old line\n+changed line");
    expect(result.stderr).toBe("");
  });

  it("compares a single untracked file against empty content", () => {
    const result = runDiff(["right file.txt"], { backend: "git" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("--- /dev/null");
    expect(result.stdout).toContain("+new line");
    expect(result.stderr).toBe("");
  });
});
