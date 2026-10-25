/** Real Bash subprocess checks for the lifecycle-option seam consumed by personal PR workflow wrappers. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** @type {string} Shared shell partial that owns option validation. */
const PARTIAL = path.resolve("software/scripts/advanced/llm/_common/sy-commands.profile.bash");
/** @type {string} Isolated caller home, recreated for each test. */
let home;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "pr-loop-options-"));
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

/**
 * Execute the real partial and option helper without a user profile, credentials, or CLI invocation.
 * @param {string[]} args - Lifecycle arguments passed as literal argv values.
 * @returns {{status: number|null, stdout: string, stderr: string}} Observed process result.
 */
function parse(args) {
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", 'source "$1"; shift; _sy_pr_loop_options "$@"', "test", PARTIAL, ...args], {
    encoding: "utf8",
    timeout: 5000,
    env: { PATH: process.env.PATH, HOME: home, LLM_ROOT_FOLDER: home, BASH_ENV: "", LC_ALL: "C" },
  });
}

describe("PR lifecycle option transport — Bash subprocess", () => {
  it.each([
    [[], ""],
    [["restart=fresh"], "restart=fresh"],
    [["budget=6h40m"], "budget=6h40m"],
    [["budget=10r", "restart=fresh"], "restart=fresh budget=10r"],
    [["restart=fresh", "budget=2rounds"], "restart=fresh budget=2rounds"],
    [["budget=0h30m"], "budget=0h30m"],
    [["budget=001s"], "budget=001s"],
    [["budget=24h"], "budget=24h"],
  ])("normalizes %j without adding a restart by default", (args, expected) => {
    const result = parse(args);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(expected);
    expect(result.stderr).toBe("");
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it.each([
    ["restart=resume"],
    ["restart="],
    ["restart=fresh", "restart=fresh"],
    ["budget=1m", "budget=2m"],
    ["budget="],
    ["budget=0m"],
    ["budget=0h00m00s"],
    ["budget=-1m"],
    ["budget=1.5h"],
    ["budget=Infinity"],
    ["budget=NaN"],
    ["budget=1e309h"],
    ["budget=60"],
    ["budget=1m garbage"],
    ["budget=1m\nrestart=fresh"],
    ["budget=１m"],
    ["restart=fresh", "unexpected"],
    ["--restart=fresh"],
    ["keepalive=5m"],
    [""],
  ])("rejects malformed or unsupported argv %j without emitting partial options", (...args) => {
    const result = parse(args);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/^PR lifecycle options: /);
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it("accepts the bounded budget limit without integer arithmetic overflow", () => {
    const budget = `budget=${"9".repeat(255)}s`;
    const result = parse([budget]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(budget);
    expect(result.stderr).toBe("");
  });

  it("rejects overlong and non-finite-sized numeric input before output", () => {
    const result = parse(["restart=fresh", `budget=${"9".repeat(309)}h`]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("PR lifecycle options: budget exceeds 256 characters.\n");
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it("treats command substitution and shell punctuation as invalid data", () => {
    const result = parse([`budget=$(touch ${path.join(home, "unexpected")})`, "restart=fresh"]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("PR lifecycle options: invalid budget; expected positive duration or rounds.\n");
    expect(fs.readdirSync(home)).toEqual([]);
  });
});
