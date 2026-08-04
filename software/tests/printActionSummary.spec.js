/** Tests for print_action_summary + to_windows_path in profile-core.sh. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_CORE = path.join(ROOT_DIR, "software/bootstrap/profile-core.sh");

/**
 * profile-core.sh has top-level statements (exports, debug-tracing setup) that
 * fail without the full bashrc environment. Extract just the two helpers we
 * want to test by line markers so the test stays hermetic.
 */
const HELPER_SOURCE = (() => {
  const text = fs.readFileSync(PROFILE_CORE, "utf-8");
  const lines = text.split("\n");
  const startMarker = lines.findIndex((l) => l.startsWith("function to_windows_path()"));
  const endMarker = lines.findIndex((l, i) => i > startMarker && l.startsWith("function print_action_summary()"));
  if (startMarker === -1 || endMarker === -1) throw new Error("could not locate to_windows_path / print_action_summary in profile-core.sh");
  // Walk forward to find the closing brace of print_action_summary (first `^}` after the function start).
  let close = endMarker + 1;
  while (close < lines.length && lines[close] !== "}") close++;
  if (close === lines.length) throw new Error("could not locate closing brace of print_action_summary");
  return lines.slice(startMarker - 1, close + 1).join("\n"); // include the comment header on the line above
})();

let sandbox = "";

const REQUIRED_TOOLS = ["realpath", "dirname", "stat", "id", "mkdir", "rm", "cat", "ln", "chmod"];

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_print_action_summary_");
  fs.mkdirSync(path.join(sandbox, "bin"));
  fs.mkdirSync(path.join(sandbox, "home"));
  for (const tool of REQUIRED_TOOLS) {
    for (const dir of ["/usr/bin", "/bin", "/usr/local/bin", "/opt/homebrew/bin"]) {
      const src = path.join(dir, tool);
      if (fs.existsSync(src)) {
        fs.symlinkSync(src, path.join(sandbox, "bin", tool));
        break;
      }
    }
  }
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Drop a stub `wslpath` into the sandbox PATH that returns a transformation of its
 * `-m <path>` argument. Used to simulate WSL-style behavior in tests.
 * @param {(p: string) => string} transform
 */
function stubWslpath(transform) {
  const p = path.join(sandbox, "bin", "wslpath");
  // POSIX sh shebang (NOT `#!/usr/bin/env bash` — the sandbox PATH excludes /usr/bin
  // so `env` would fail to locate bash). /bin/sh is always present.
  const stub = `#!/bin/sh
if [ "$1" = "-m" ]; then
  case "$2" in
${Object.entries(transform.cases || {})
  .map(([k, v]) => `    ${JSON.stringify(k)}) echo ${JSON.stringify(v)} ;;`)
  .join("\n")}
    *) echo "$2" ;;
  esac
else
  echo "$2"
fi
`;
  fs.writeFileSync(p, stub);
  fs.chmodSync(p, 0o755);
}

/**
 * Run `print_action_summary <args...>` in a hermetic bash subshell and capture
 * stdout. Optionally seed the sandbox PATH with a wslpath stub.
 *
 * @param {object} opts
 * @param {string[]} opts.args - args passed to print_action_summary
 * @param {string} [opts.cwd] - working directory the subshell starts in (defaults to sandbox/home)
 * @param {{cases: Record<string,string>}} [opts.wslpath] - optional stub mapping
 * @returns {string} stdout
 */
function callSummary({ args, cwd, wslpath }) {
  if (wslpath) stubWslpath(wslpath);
  const home = path.join(sandbox, "home");
  const workdir = cwd ?? home;
  const script = [
    `set -euo pipefail`,
    `HOME=${JSON.stringify(home)}`,
    `PATH=${JSON.stringify(path.join(sandbox, "bin"))}`,
    `cd ${JSON.stringify(workdir)}`,
    HELPER_SOURCE,
    `print_action_summary ${args.map((a) => JSON.stringify(a)).join(" ")}`,
  ].join("\n");
  const scriptPath = path.join(sandbox, "run.sh");
  fs.writeFileSync(scriptPath, script);
  return execSync(`bash ${JSON.stringify(scriptPath)}`, { encoding: "utf-8" });
}

/**
 * macOS resolves /tmp/... → /private/tmp/... via `realpath` (and so does the bash
 * helper inside print_action_summary). Tests must use the realpath'd paths in both
 * case labels and assertions, otherwise the stub's case won't match and the
 * assertion will compare against the wrong value.
 * @param {string} p
 */
function rp(p) {
  return fs.realpathSync(p);
}

describe("print_action_summary", () => {
  it("prints PWD + cd <parent> + binary <file> for a file selection with binary", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const file = path.join(dir, "script.js");
    fs.writeFileSync(file, "");

    const out = callSummary({ args: [file, "vim"] });
    expect(out).toBe(
      [
        "====================================",
        `PWD: "${path.join(sandbox, "home")}"`,
        `cd "${rp(dir)}"`,
        `vim "${rp(file)}"`,
        "====================================",
        "",
      ].join("\n"),
    );
  });

  it("prints PWD + cd <self> + binary <self> for a folder selection with binary", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const out = callSummary({ args: [dir, "subl"] });
    expect(out).toBe(
      [
        "====================================",
        `PWD: "${path.join(sandbox, "home")}"`,
        `cd "${rp(dir)}"`,
        `subl "${rp(dir)}"`,
        "====================================",
        "",
      ].join("\n"),
    );
  });

  it("omits the binary line when no binary is passed (folder navigation)", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const out = callSummary({ args: [dir] });
    expect(out).toBe(
      [
        "====================================",
        `PWD: "${path.join(sandbox, "home")}"`,
        `cd "${rp(dir)}"`,
        "====================================",
        "",
      ].join("\n"),
    );
  });

  it("inserts extra args between binary and target", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const out = callSummary({ args: [dir, "subl", "-n", "-w"] });
    expect(out.split("\n")).toContain(`subl -n -w "${rp(dir)}"`);
  });

  it("quotes paths with spaces so the rendered command is shell-safe", () => {
    const dir = path.join(sandbox, "home", "gha workflow");
    fs.mkdirSync(dir);
    const file = path.join(dir, "main.yml");
    fs.writeFileSync(file, "");

    const out = callSummary({ args: [file, "vim"] });
    // Every path is wrapped in literal double quotes; spaces stay intact.
    expect(out).toContain(`cd "${rp(dir)}"`);
    expect(out).toContain(`vim "${rp(file)}"`);
  });

  it("prints a second `cd` line on WSL when the resolved path differs", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const file = path.join(dir, "f.txt");
    fs.writeFileSync(file, "");

    const out = callSummary({
      args: [file, "vim"],
      wslpath: {
        // Case labels must use the realpath'd path — that's what the helper feeds wslpath.
        cases: {
          [rp(dir)]: "C:/proj",
          [rp(file)]: "C:/proj/f.txt",
        },
      },
    });
    expect(out).toBe(
      [
        "====================================",
        `PWD: "${path.join(sandbox, "home")}"`,
        `cd "${rp(dir)}"`,
        `cd "C:/proj"`, // resolved cd is the second hop, immediately after the unix cd
        `vim "${rp(file)}"`, // binary line is the unix path first…
        `vim "C:/proj/f.txt"`, // …then mirrored with the resolved (Windows-style) target
        "====================================",
        "",
      ].join("\n"),
    );
  });

  it("does NOT print the resolved cd line when wslpath returns the same path", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    // No `cases` overrides → default branch echoes the input unchanged.
    const out = callSummary({
      args: [dir],
      wslpath: { cases: {} },
    });
    // Only the PWD + cd block, no duplicate cd line.
    const cdLines = out.split("\n").filter((l) => l.startsWith("cd "));
    expect(cdLines).toHaveLength(1);
  });

  it("does NOT print the resolved cd line off-WSL (no wslpath stub installed)", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const out = callSummary({ args: [dir] });
    const cdLines = out.split("\n").filter((l) => l.startsWith("cd "));
    expect(cdLines).toHaveLength(1);
  });
});

describe("to_windows_path", () => {
  /**
   * Sources the helper into bash and runs `to_windows_path "$1"`, returning stdout.
   * @param {string} input
   * @param {{cases: Record<string,string>}} [wslpath]
   */
  function callConvert(input, wslpath) {
    if (wslpath) stubWslpath(wslpath);
    const script = [
      `set -euo pipefail`,
      `PATH=${JSON.stringify(path.join(sandbox, "bin"))}`,
      HELPER_SOURCE,
      `to_windows_path ${JSON.stringify(input)}`,
    ].join("\n");
    const scriptPath = path.join(sandbox, "run.sh");
    fs.writeFileSync(scriptPath, script);
    return execSync(`bash ${JSON.stringify(scriptPath)}`, { encoding: "utf-8" }).trim();
  }

  it("returns the input unchanged when wslpath is not on PATH (off-WSL)", () => {
    expect(callConvert("/home/user/foo")).toBe("/home/user/foo");
  });

  it("delegates to wslpath -m when available, returning the converted path", () => {
    const out = callConvert("/mnt/c/Users/test", { cases: { "/mnt/c/Users/test": "C:/Users/test" } });
    expect(out).toBe("C:/Users/test");
  });

  it("falls back to the input when wslpath fails (returns its default arm)", () => {
    // No mapping for this path → stub's `*` branch echoes the input unchanged.
    expect(callConvert("/home/user/foo", { cases: {} })).toBe("/home/user/foo");
  });
});
