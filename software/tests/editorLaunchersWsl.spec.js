/** Launch-boundary regressions for VS Code's Windows-only WSL routing. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { HELPER_SOURCE } from "./printActionSummary.helpers.js";

/** Shared launcher source exercised without loading the user's profile. */
const LAUNCHERS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/advanced/editor-launchers-common.profile.bash"),
  "utf8",
);

/** Bounded shell fixture with synthetic WSL paths and a FIFO-backed launch recorder. */
const FIXTURE = `
is_os_windows="$WINDOWS"
is_os_wsl="$WSL"
is_os_mac=0
function find_path() { printf '%s\\n' "$1"; }
function realpath() {
  case "$1" in
    .) printf '%s\\n' "$RESOLVED_FOLDER" ;;
    ./*) printf '%s/%s\\n' "$RESOLVED_FOLDER" "\${1#./}" ;;
    folder) printf '%s/folder\\n' "$RESOLVED_FOLDER" ;;
    *) printf '%s\\n' "$1" ;;
  esac
}
function run_native() { "$@"; }
function nohup() { printf '%s\\0' "$@" > "$CAPTURE"; }
function fixture_editor() {
  local editor_args=("$@")
  run_editor "$EDITOR_NAME" "$TARGET_BINARY"
}
fixture_editor "$@" || exit "$?"
printf 'LAUNCH\\0'
command cat "$CAPTURE"
`;

/** Fake WSL converter installed only in the test-owned executable folder. */
const WSLPATH = `#!/bin/sh
target="$2"
case "$target" in
  .) target="$RESOLVED_FOLDER" ;;
  ./*) target="$RESOLVED_FOLDER/\${target#./}" ;;
esac
case "$target" in
  /mnt/[a-zA-Z]|/mnt/[a-zA-Z]/*)
    drive="\${target#/mnt/}"
    printf '%s:%s\\n' "\${drive%%/*}" "\${drive#?}" ;;
  /[a-zA-Z]|/[a-zA-Z]/*)
    drive="\${target#/}"
    printf '%s:%s\\n' "\${drive%%/*}" "\${drive#?}" ;;
  *) printf '//wsl.localhost/%s%s\\n' "$WSL_DISTRO_NAME" "$target" ;;
esac
`;

/**
 * Capture actual launch arguments and the real action summary in isolated Bash.
 * @param {string[]} args Caller arguments preserved as distinct process arguments.
 * @param {object} [options] Platform, distribution, editor, and resolved-folder controls.
 * @returns {{launch: string[], summary: string}} Launch boundary and visible summary.
 * @throws {Error} On fixture IO errors or subprocess status/output assertion failures.
 * @description Creates and removes only test-owned files; never opens a real editor.
 */
function launchEditor(
  args,
  { windows = 1, wsl = 1, distro = "Ubuntu-24.04", editor = "code", resolvedFolder = "/home/test/project" } = {},
) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "editor-wsl-"));
  try {
    const bin = path.join(sandbox, "bin");
    const capture = path.join(sandbox, "capture");
    mkdirSync(bin);
    mkdirSync(path.join(sandbox, "folder"));
    writeFileSync(path.join(bin, "wslpath"), WSLPATH, { mode: 0o755 });
    const fifo = spawnSync("/usr/bin/mkfifo", [capture], { encoding: "utf8", timeout: 1000 });
    expect(fifo.status, fifo.stderr).toBe(0);
    const result = spawnSync("/bin/bash", ["-c", `${HELPER_SOURCE}\n${LAUNCHERS}\n${FIXTURE}`, "fixture", ...args], {
      cwd: sandbox,
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        BASH_ENV: "",
        PATH: `${bin}:/usr/bin:/bin`,
        WINDOWS: String(windows),
        WSL: String(wsl),
        WSL_DISTRO_NAME: distro,
        EDITOR_NAME: editor,
        TARGET_BINARY: "/mnt/c/Program Files/VS Code/Code.exe",
        RESOLVED_FOLDER: resolvedFolder,
        CAPTURE: capture,
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    const [summary, recorded] = result.stdout.split("LAUNCH\0");
    expect(recorded).toBeDefined();
    return { summary, launch: recorded.split("\0").slice(0, -1) };
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe("Windows VS Code WSL routing", () => {
  it("launches code . in the current WSL distribution and prefixes both summary commands", () => {
    const result = launchEditor(["."]);
    expect(result.launch).toEqual(["/mnt/c/Program Files/VS Code/Code.exe", "--remote", "wsl+Ubuntu-24.04", "/home/test/project"]);
    expect(result.summary.split("\n").filter((line) => line.startsWith('"/mnt/c/Program Files/VS Code/Code.exe"'))).toEqual([
      '"/mnt/c/Program Files/VS Code/Code.exe" "--remote" "wsl+Ubuntu-24.04" "/home/test/project"',
      '"/mnt/c/Program Files/VS Code/Code.exe" "--remote" "wsl+Ubuntu-24.04" "//wsl.localhost/Ubuntu-24.04/home/test/project"',
    ]);
  });

  it.each([
    ["/home/test/project", "/home/test/project"],
    ["./folder with spaces", "/home/test/project/folder with spaces"],
    ["folder", "/home/test/project/folder"],
    ["/mnt/cache/project", "/mnt/cache/project"],
    ["/data/project", "/data/project"],
  ])("routes native WSL target %s with a Linux absolute path", (input, target) => {
    expect(launchEditor([input]).launch).toEqual(["/mnt/c/Program Files/VS Code/Code.exe", "--remote", "wsl+Ubuntu-24.04", target]);
  });

  it.each([
    ["/mnt/c/work", "c:/work"],
    ["/mnt/d/work", "d:/work"],
    ["/mnt/z", "z:"],
    ["/c/work", "c:/work"],
    ["/d/work", "d:/work"],
    ["C:/work", "C:/work"],
  ])("keeps Windows-drive target %s local", (input, target) => {
    const result = launchEditor([input]);
    expect(result.launch).toEqual(["/mnt/c/Program Files/VS Code/Code.exe", target]);
    expect(result.summary).not.toContain("--remote");
  });

  it("keeps a relative Windows-drive folder local", () => {
    expect(launchEditor(["."], { resolvedFolder: "/mnt/d/work" }).launch).toEqual(["/mnt/c/Program Files/VS Code/Code.exe", "d:/work"]);
  });

  it("preserves flags and uses Linux paths for mixed remote targets", () => {
    expect(launchEditor(["--new-window", "/mnt/c/work", "/home/test/project"]).launch).toEqual([
      "/mnt/c/Program Files/VS Code/Code.exe",
      "--remote",
      "wsl+Ubuntu-24.04",
      "--new-window",
      "/mnt/c/work",
      "/home/test/project",
    ]);
  });

  it.each(["subl", "smerge", "zed"])("does not add VS Code options to %s", (editor) => {
    expect(launchEditor(["/home/test/project"], { editor }).launch).toEqual([
      "/mnt/c/Program Files/VS Code/Code.exe",
      "//wsl.localhost/Ubuntu-24.04/home/test/project",
    ]);
  });

  it("leaves native Linux launches unchanged", () => {
    expect(launchEditor(["."], { windows: 0, wsl: 0 }).launch).toEqual(["/mnt/c/Program Files/VS Code/Code.exe", "."]);
  });

  it("does not use WSL remote mode on Windows without the WSL flag", () => {
    expect(launchEditor(["/home/test/project"], { wsl: 0 }).launch).toEqual([
      "/mnt/c/Program Files/VS Code/Code.exe",
      "//wsl.localhost/Ubuntu-24.04/home/test/project",
    ]);
  });

  it("does not guess a distribution when its name is empty", () => {
    expect(launchEditor(["/home/test/project"], { distro: "" }).launch).toEqual([
      "/mnt/c/Program Files/VS Code/Code.exe",
      "//wsl.localhost//home/test/project",
    ]);
  });

  it("preserves an explicit remote authority", () => {
    expect(launchEditor(["--remote", "ssh-remote+host", "/home/test/project"]).launch).toEqual([
      "/mnt/c/Program Files/VS Code/Code.exe",
      "--remote",
      "ssh-remote+host",
      "//wsl.localhost/Ubuntu-24.04/home/test/project",
    ]);
  });
});
