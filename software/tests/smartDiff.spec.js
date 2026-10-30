/** Subprocess contracts for smart terminal and editor comparisons. */
import { describe, expect, it } from "vitest";
import { BASH_SHELLS, runDiff } from "./smartDiff.helpers.js";

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

  it.each([[[]], [["left file.txt"]], [["left file.txt", "right file.txt", "extra", "too-many"]]])(
    "rejects editor arity %j before invocation",
    (args) => {
      const result = runDiff(["-code", ...args], { binaries: ["code"] });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("expected file1 file2, target_file sha1 [sha2]");
      expect(result.stdout).toBe("");
    },
  );

  it.each(["-code", "-delta1"].flatMap((flag) => BASH_SHELLS.map((shell) => [flag, shell])))(
    "tries revision mode for a nonexistent second path in %s under %s",
    (flag, shell) => {
      const result = runDiff([flag, "left file.txt", "missing"], { binaries: ["code", "git"], shell });
      expect(result.status).toBe(1);
      expect(result.stderr).toBe("diff: revision mode requires a Git-tracked file; current folder is not in a Git working tree.\n");
      expect(result.stdout).toBe("");
    },
  );

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

  it.each([[["help"]], [["--help"]], [["-delta2", "help"]], [["-code", "--help"]], [["-r", "--help"]], [["--reverse", "-code", "--help"]]])(
    "shows help for %j without launching commands",
    (args) => {
      const result = runDiff(args, { binaries: [] });
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stdout).toContain("diff: smart diff for files or git commits");
      expect(result.stdout).toContain("-sublime_merge");
      expect(result.stderr).toBe("");
    },
  );

  it.each([[["-r"]], [["--reverse"]], [["-r", "--reverse"]], [["-delta2", "-r"]], [["--reverse", "-delta2"]]])(
    "reverses file operands exactly once with %j",
    (flags) => {
      const result = runDiff([...flags, "left file.txt", "right file.txt"]);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.split("\0").slice(-3)).toEqual(["right file.txt", "left file.txt", ""]);
    },
  );

  it.each([[["-code", "-r"]], [["--reverse", "-code"]]])("reverses editor inputs with %j", (flags) => {
    const result = runDiff([...flags, "left file.txt", "right file.txt"], { binaries: ["code"] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.split("\0")).toEqual(["code", "--diff", "right file.txt", "left file.txt", ""]);
    expect(result.stderr).toBe("");
  });

  it("reverses native file inputs while preserving flags", () => {
    const result = runDiff(["--reverse", "-u", "left file.txt", "right file.txt"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.split("\0")).toEqual(["diff", "-u", "right file.txt", "left file.txt", ""]);
    expect(result.stderr).toBe("");
  });

  it("reverses a single tracked working diff through Git", () => {
    const result = runDiff(["--reverse", "left file.txt"], { backend: "git" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("-changed line\n+old line");
    expect(result.stderr).toBe("");
  });

  it("reverses whole-repository commit hash comparisons", () => {
    const result = runDiff([], { backend: "git", hashes: true, invocation: `eval 'diff --reverse "$@"'` });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("-changed line\n+old line");
    expect(result.stderr).toBe("");
  });

  it.each([[["-u"]], [["-u", "left file.txt"]], [["-u", "left file.txt", "missing"]]])(
    "rejects reverse with native flags and insufficient file operands %j",
    (args) => {
      const result = runDiff(["--reverse", ...args]);
      expect(result.status).toBe(2);
      expect(result.stderr).toBe("diff: --reverse with native flags requires two existing files at the end.\n");
      expect(result.stdout).toBe("");
    },
  );

  it("reports missing Git before attempting revision snapshots", () => {
    const result = runDiff(["-code", "left file.txt", "HEAD"], { binaries: ["code"] });
    expect(result.status).toBe(127);
    expect(result.stderr).toBe("diff: required command not found: git\n");
    expect(result.stdout).toBe("");
  });

  it("identifies a missing first file when the second path exists", () => {
    const result = runDiff(["missing", "right file.txt"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("diff: file1=missing is not an existing regular file.\n");
    expect(result.stdout).toBe("");
  });

  it.each([
    [[], ["git", "-c", "delta.side-by-side=true", "diff", "-R", ""]],
    [["left file.txt"], ["git", "-c", "delta.side-by-side=true", "diff", "-R", "--", "left file.txt", ""]],
  ])("forwards reverse for working changes with %j", (args, expected) => {
    const result = runDiff(["-delta2", "--reverse", ...args]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.split("\0")).toEqual(expected);
  });

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
