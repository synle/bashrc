/** Tests for the mktemp polyfill defined in run.sh. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUN_SH = path.join(ROOT_DIR, "run.sh");

/** Per-test sandbox dir */
let sandbox = "";

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_mktemp_polyfill_test_");
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Extract the mktemp polyfill from run.sh as a string.
 * @returns {string} the function body
 */
function getPolyfillBlock() {
  const runSh = fs.readFileSync(RUN_SH, "utf-8");
  const lines = runSh.split("\n");
  const startIdx = lines.findIndex((l) => l.startsWith("function mktemp()"));
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    if (depth === 0) {
      endIdx = i;
      break;
    }
  }
  if (startIdx < 0 || endIdx < 0) throw new Error("could not locate mktemp polyfill in run.sh");
  return lines.slice(startIdx, endIdx + 1).join("\n");
}

/**
 * Run the mktemp polyfill in a hermetic bash shell with optional fake binary.
 * @param {object} opts
 * @param {string} [opts.fakeMktempScript] - shell script for a fake `mktemp` binary placed first in PATH
 * @param {string} [opts.args] - arguments to pass to the polyfill (e.g. "-d")
 * @returns {string} stdout from the polyfill call
 */
function runPolyfill(opts = {}) {
  const block = getPolyfillBlock();
  const args = opts.args ?? "";

  // Set up a local bin dir with optional fake mktemp
  const binDir = path.join(sandbox, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  if (opts.fakeMktempScript) {
    const fakeBin = path.join(binDir, "mktemp");
    fs.writeFileSync(fakeBin, opts.fakeMktempScript);
    fs.chmodSync(fakeBin, 0o755);
  }

  const runner = path.join(sandbox, "runner.sh");
  fs.writeFileSync(
    runner,
    ["#!/usr/bin/env bash", `HOME="${sandbox}"`, `export PATH="${binDir}:$PATH"`, block, `mktemp ${args}`].join("\n"),
  );
  fs.chmodSync(runner, 0o755);
  return execSync(runner, { encoding: "utf-8" }).trim();
}

describe("mktemp polyfill", () => {
  it("real mktemp success → path returned verbatim, ~/tmp not created", () => {
    const result = runPolyfill();
    // Path should exist and be under /tmp or $TMPDIR
    expect(fs.existsSync(result)).toBe(true);
    // ~/tmp should NOT have been created
    expect(fs.existsSync(path.join(sandbox, "tmp"))).toBe(false);
  });

  it("forced real-mktemp failure → falls back to ~/tmp via -p", () => {
    // Find the real system mktemp for the fallback call
    let realMktemp = "/usr/bin/mktemp";
    for (const p of ["/usr/bin/mktemp", "/bin/mktemp", "/usr/local/bin/mktemp"]) {
      if (fs.existsSync(p)) {
        realMktemp = p;
        break;
      }
    }
    // Fake mktemp: fail on first call (no -p), succeed on fallback call (with -p) via real mktemp
    const fakeMktempScript = ["#!/bin/sh", `case "$*" in *-p*) exec "${realMktemp}" "$@" ;; *) exit 1 ;; esac`].join("\n");
    const result = runPolyfill({ fakeMktempScript });
    // Should be under ~/tmp (which is sandbox/tmp)
    expect(result).toContain(path.join(sandbox, "tmp"));
    // ~/tmp should have been created
    expect(fs.existsSync(path.join(sandbox, "tmp"))).toBe(true);
  });

  it("mktemp -d delegates (-d honored on fallback)", () => {
    let realMktemp = "/usr/bin/mktemp";
    for (const p of ["/usr/bin/mktemp", "/bin/mktemp", "/usr/local/bin/mktemp"]) {
      if (fs.existsSync(p)) {
        realMktemp = p;
        break;
      }
    }
    const fakeMktempScript = ["#!/bin/sh", `case "$*" in *-p*) exec "${realMktemp}" "$@" ;; *) exit 1 ;; esac`].join("\n");
    const result = runPolyfill({ fakeMktempScript, args: "-d" });
    // Should be a directory under ~/tmp
    expect(result).toContain(path.join(sandbox, "tmp"));
    expect(fs.existsSync(result)).toBe(true);
    expect(fs.statSync(result).isDirectory()).toBe(true);
  });

  it("declare -f mktemp round-trips and parses under bash -n", () => {
    const block = getPolyfillBlock();
    const script = ["#!/usr/bin/env bash", block, "declare -f mktemp"].join("\n");
    const tmpFile = path.join(sandbox, "test_polyfill.sh");
    fs.writeFileSync(tmpFile, script);
    // bash -n should succeed (syntax check)
    expect(() => execSync(`bash -n "${tmpFile}"`, { encoding: "utf-8" })).not.toThrow();
  });
});
