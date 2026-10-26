/** Isolated subprocess contracts for clipboard-to-file comparisons. */
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Checkout root containing the shipped shell profile. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Core predicates needed by the shipped comparison functions. */
const CORE = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8");
/** Full comparison section, including explicit alias registrations. */
const DIFF = readFileSync(path.join(ROOT, "software/bootstrap/profile-advanced.sh"), "utf8")
  .split("# --- Diff (file diff or git hash compare) ---\n")[1]
  .split("# SOURCE | software/scripts/bash-git-helpers.profile.bash")[0];
/** Actual Git executable for semantic integration cases. */
const GIT = execFileSync("/bin/bash", ["-c", "type -P git"], { encoding: "utf8" }).trim();
/** Native tool paths resolved for this host rather than assuming Linux locations. */
const TOOLS = execFileSync("/bin/bash", ["-c", "type -P cat tr mktemp rm diff"], { encoding: "utf8" }).trim().split("\n");

/**
 * Run the shipped functions twice-loaded with an isolated clipboard and tools.
 * @param {string[]} args - User arguments passed without shell interpolation.
 * @param {object} [options] - Clipboard, backend, and invocation controls.
 * @param {string} [options.clipboard] - Exact clipboard fixture bytes as text.
 * @param {string} [options.invocation] - Fixed invocation, including alias expansion.
 * @param {number} [options.pasteStatus] - Capture boundary exit status.
 * @param {number} [options.backendStatus] - Recording backend exit status.
 * @param {boolean} [options.realGit] - Exercise actual no-index comparisons.
 * @param {string} [options.setup] - Fixed shell fault injection before invocation.
 * @returns {object} Process result, capture effects, and retained snapshot bytes/mode.
 * @throws {Error} On fixture errors; always removes owned fixtures and snapshots.
 */
function runClipboardDiff(
  args,
  {
    clipboard = "clipboard line\n",
    invocation = `eval 'pdiff "$@"'`,
    pasteStatus = 0,
    backendStatus = 0,
    realGit = false,
    setup = "",
  } = {},
) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "clipboard-diff-"));
  try {
    const source = path.join(sandbox, "profile.bash");
    writeFileSync(
      source,
      `${CORE.match(/function is_help_arg\(\) \{[\s\S]*?\n\}/)[0]}\n${CORE.match(/function is_runnable_command\(\) \{[\s\S]*?\n\}/)[0]}\n${DIFF}`,
    );
    writeFileSync(path.join(sandbox, "clipboard"), clipboard);
    writeFileSync(path.join(sandbox, "right file.txt"), "file line\n");
    writeFileSync(path.join(sandbox, "-dash.txt"), "file line\n");
    writeFileSync(path.join(sandbox, "quote'\"\\\n\u2603.txt"), "file line\n");
    for (const binary of TOOLS) {
      symlinkSync(binary, path.join(sandbox, path.basename(binary)));
    }
    for (const binary of ["git", "code", "zed", "winmergeu.exe", "smerge"]) {
      writeFileSync(path.join(sandbox, binary), `#!/bin/bash\nprintf '%s\\0' '${binary}' "$@"\nexit "$BACKEND_STATUS"\n`, { mode: 0o755 });
    }
    if (realGit) {
      rmSync(path.join(sandbox, "git"));
      symlinkSync(GIT, path.join(sandbox, "git"));
    }
    const result = spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `. "$SOURCE"\n. "$SOURCE"\nfunction paste() { : > "$CAPTURE_MARKER"; command cat "$CLIPBOARD"; return "$PASTE_STATUS"; }\n${setup}\n${invocation}`,
        "test",
        ...args,
      ],
      {
        cwd: sandbox,
        env: {
          ...process.env,
          PATH: sandbox,
          SOURCE: source,
          TMPDIR: sandbox,
          CLIPBOARD: path.join(sandbox, "clipboard"),
          CAPTURE_MARKER: path.join(sandbox, "captured"),
          PASTE_STATUS: String(pasteStatus),
          BACKEND_STATUS: String(backendStatus),
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
    const files = readdirSync(sandbox);
    const snapshots = files
      .filter((name) => name.startsWith("pdiff."))
      .map((name) => ({
        path: path.join(sandbox, name),
        content: readFileSync(path.join(sandbox, name), "utf8"),
        mode: statSync(path.join(sandbox, name)).mode & 0o777,
      }));
    return { ...result, captured: files.includes("captured"), snapshots };
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe("clipboard diff subprocess", () => {
  it("compares clipboard on the left and file on the right through real Git", () => {
    const result = runClipboardDiff(["right file.txt"], { realGit: true });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("-clipboard line\n+file line");
    expect(result.captured).toBe(true);
  });

  it("reports equal bytes through real Git", () => {
    const result = runClipboardDiff(["right file.txt"], { realGit: true, clipboard: "file line\n" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it.each([
    ["pdiff", "git", ["-c", "delta.side-by-side=false", "diff", "--no-index", "--"]],
    ["pdiff_delta1", "git", ["-c", "delta.side-by-side=false", "diff", "--no-index", "--"]],
    ["pdiff_delta2", "git", ["-c", "delta.side-by-side=true", "diff", "--no-index", "--"]],
    ["pdiff_code", "code", ["--diff"]],
    ["pdiff_zed", "zed", ["--diff"]],
    ["pdiff_z", "zed", ["--diff"]],
    ["pdiff_winmerge", "winmergeu.exe", []],
    ["pdiff_smerge", "smerge", ["mergetool"]],
    ["pdiff_sublime_merge", "smerge", ["mergetool"]],
  ])("dispatches twice-loaded %s with clipboard first", (name, binary, flags) => {
    const result = runClipboardDiff(["right file.txt"], { invocation: `eval '${name} "$@"'` });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.split("\0")).toEqual([binary, ...flags, result.snapshots[0].path, "right file.txt", ""]);
    expect(result.snapshots[0].content).toBe("clipboard line\n");
  });

  it.each(["", "no trailing newline", "two trailing newlines\n\n", "quote'\"\\\n\u2603\u0000\u202e\n"])(
    "preserves exact clipboard bytes %j in a private retained snapshot",
    (clipboard) => {
      const result = runClipboardDiff(["right file.txt"], { clipboard });
      expect(result.status, result.stderr).toBe(0);
      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0].content).toBe(clipboard);
      expect(result.snapshots[0].mode).toBe(0o600);
    },
  );

  it.each(["-dash.txt", "quote'\"\\\n\u2603.txt"])("protects file operand %j", (file) => {
    const result = runClipboardDiff(["--", file]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.split("\0")).toEqual([
      "git",
      "-c",
      "delta.side-by-side=false",
      "diff",
      "--no-index",
      "--",
      result.snapshots[0].path,
      file,
      "",
    ]);
  });

  it("forwards native diff flags and preserves comparison output", () => {
    const result = runClipboardDiff(["-u", "right file.txt"]);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("-clipboard line\n+file line");
    expect(result.stdout).toContain("@@ -1 +1 @@");
    expect(result.stderr).toBe("");
  });

  it("forwards explicit Delta Git flags", () => {
    const result = runClipboardDiff(["-delta2", "--no-index", "--stat", "--", "right file.txt"], { realGit: true });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("1 insertion(+), 1 deletion(-)");
    expect(result.stderr).toBe("");
  });

  it.each([["help"], ["--help"], ["-code", "--help"], ["-delta2", "help"]])("shows help for %j without capture", (...args) => {
    const result = runClipboardDiff(args);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("pdiff: compare clipboard contents with a file");
    expect(result.stderr).toBe("");
    expect(result.captured).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it.each([
    [[], 2, "pdiff: requires a file; usage: pdiff [diff options] file\n"],
    [["-code"], 1, "File not found: -code\n"],
  ])("rejects missing file %j without capture", (args, status, error) => {
    const result = runClipboardDiff(args);
    expect(result.status).toBe(status);
    expect(result.stderr).toBe(error);
    expect(result.stdout).toBe("");
    expect(result.captured).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("rejects missing files before capture", () => {
    const result = runClipboardDiff(["missing.txt"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("File not found: missing.txt");
    expect(result.stdout).toBe("");
    expect(result.captured).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("cleans partial capture and preserves paste failure without dispatch", () => {
    const result = runClipboardDiff(["right file.txt"], { pasteStatus: 23 });
    expect(result.status).toBe(23);
    expect(result.stdout).toBe("");
    expect(result.captured).toBe(true);
    expect(result.snapshots).toEqual([]);
  });

  it("does not capture or dispatch when mktemp fails", () => {
    const result = runClipboardDiff(["right file.txt"], { setup: "function mktemp() { return 17; }" });
    expect(result.status).toBe(17);
    expect(result.stdout).toBe("");
    expect(result.captured).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it.each([1, 42])("preserves backend status %s", (backendStatus) => {
    const result = runClipboardDiff(["right file.txt"], { backendStatus });
    expect(result.status).toBe(backendStatus);
    expect(result.stdout).toContain("--no-index");
  });
});
