import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { execSync } from "child_process";

import fs from "fs";

import path from "path";

import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const PROFILE_CORE = path.join(ROOT_DIR, "software/bootstrap/profile-core.sh");

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

const REQUIRED_TOOLS = ["realpath", "dirname", "stat", "id", "mkdir", "rm", "cat", "ln", "chmod", "tr"];

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

function callSummary({ args, cwd, wslpath }) {
  if (wslpath) stubWslpath(wslpath);
  const home = path.join(sandbox, "home");
  const workdir = cwd ?? home;
  const script = [
    `set -euo pipefail`,
    `unset LINE_BREAK_EQUAL`,
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

function rp(p) {
  return fs.realpathSync(p);
}

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
