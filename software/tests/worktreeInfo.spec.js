/** Shared worktree rows: deterministic native-tool boundaries and small real filesystem probes. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import helpers from "../scripts/git.worktree_info.cjs";

/** Public formatter shared by both command payloads. */
const { worktreeInfo } = helpers;
/** Test-owned fixture root, refreshed before every case. */
let root;
/** Native-tool argument capture owned by the active case. */
let capture;

/** Create a deterministic du executable that records literal arguments and simulates failures. @returns {void} */
beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-info-")));
  capture = path.join(root, "du-args.json");
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(root, "tree"));
  fs.writeFileSync(
    path.join(bin, "du"),
    `#!${process.execPath}
const fs = require('fs');
fs.writeFileSync(process.env.DU_CAPTURE, JSON.stringify(process.argv.slice(2)));
const reply = process.env.DU_FLOOD === '1' ? '9'.repeat(128 * 1024) : process.env.DU_REPLY;
setTimeout(() => {
  process.stdout.write(reply);
  process.exitCode = Number(process.env.DU_STATUS);
}, Number(process.env.DU_DELAY));
`,
    { mode: 0o755 },
  );
  vi.stubEnv("PATH", `${bin}:${process.env.PATH}`);
  vi.stubEnv("DU_CAPTURE", capture);
  vi.stubEnv("DU_REPLY", "48828\tfixture\n");
  vi.stubEnv("DU_STATUS", "0");
  vi.stubEnv("DU_DELAY", "0");
  vi.stubEnv("DU_FLOOD", "0");
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("shared worktree info", () => {
  it.each([
    ["0", "0B"],
    ["1", "1KB"],
    ["1000", "1MB"],
    ["48828", "50MB"],
    ["51200", "52.4MB"],
    ["1048576", "1.1GB"],
    ["1073741824", "1.1TB"],
    ["8796093022207", "9007.2TB"],
  ])("formats allocated KiB %s as decimal storage label %s", (kib, size) => {
    vi.stubEnv("DU_REPLY", `${kib}\tfixture\n`);
    expect(worktreeInfo({ path: path.join(root, "tree"), branch: "feature/size" })).toBe(
      `\u{1f333} [${size}] \ue0b1 feature/size \ue0b1 ${root}/tree`,
    );
    expect(JSON.parse(fs.readFileSync(capture, "utf8"))).toEqual(["-skP", path.join(root, "tree")]);
  });

  it("renders a cleanup status with saved size after its folder is gone and escapes its reason", () => {
    const folder = path.join(root, "removed");
    const row = worktreeInfo(
      { path: folder, branch: "task" },
      {
        prefix: "\u{1f9f9} REMOVED",
        size: "50MB",
        reason: "forced\nremoval\t\u001b",
      },
    );
    expect(row).toBe(`\u{1f9f9} REMOVED [50MB] \ue0b1 task \ue0b1 ${folder} \ue0b1 forced\\u000aremoval\\u0009\\u001b`);
    expect(fs.existsSync(capture)).toBe(false);
  });

  it("preserves an explicitly empty reason and a zero-byte saved size", () => {
    expect(worktreeInfo({ path: path.join(root, "tree"), branch: "main" }, { size: "0B", reason: "" })).toBe(
      `\u{1f333} [0B] \ue0b1 main \ue0b1 ${root}/tree \ue0b1 `,
    );
    expect(fs.existsSync(capture)).toBe(false);
  });

  it("preserves branch display names that literally start with refs/heads/", () => {
    expect(worktreeInfo({ path: path.join(root, "tree"), branch: "refs/heads/literal" })).toBe(
      `\u{1f333} [50MB] \ue0b1 refs/heads/literal \ue0b1 ${root}/tree`,
    );
  });

  it.each([
    [null, false, "(detached)"],
    [null, true, "(bare)"],
    ["refs/heads/main", true, "(bare)"],
  ])("retains detached and bare branch labels", (branch, bare, label) => {
    expect(worktreeInfo({ path: path.join(root, "tree"), branch, bare })).toBe(`\u{1f333} [50MB] \ue0b1 ${label} \ue0b1 ${root}/tree`);
  });

  it("passes hostile paths as literal arguments and escapes terminal controls in both fields", () => {
    const folder = `${root}/space $(touch ${root}/injected)\n`;
    const row = worktreeInfo({ path: folder, branch: "feature/size\t\u001b\u0085" });
    expect(row).toBe(`\u{1f333} [50MB] \ue0b1 feature/size\\u0009\\u001b\\u0085 \ue0b1 ${root}/space $(touch ${root}/injected)\\u000a`);
    expect(JSON.parse(fs.readFileSync(capture, "utf8"))).toEqual(["-skP", folder]);
    expect(fs.existsSync(path.join(root, "injected"))).toBe(false);
  });

  it.each(["", "not-a-size\n", "-1\tfixture\n", "1.5\tfixture\n", "9007199254740991\tfixture\n", "9007199254740992\tfixture\n"])(
    "uses unknown rather than inventing a size for malformed or overflowing output %s",
    (reply) => {
      vi.stubEnv("DU_REPLY", reply);
      expect(worktreeInfo({ path: path.join(root, "tree"), branch: "main" })).toBe(`\u{1f333} [unknown] \ue0b1 main \ue0b1 ${root}/tree`);
    },
  );

  it("does not trust partial size output from a failed probe", () => {
    vi.stubEnv("DU_STATUS", "1");
    expect(worktreeInfo({ path: path.join(root, "tree"), branch: "main" })).toBe(`\u{1f333} [unknown] \ue0b1 main \ue0b1 ${root}/tree`);
  });

  it("keeps the row visible when du is unavailable", () => {
    vi.stubEnv("PATH", "");
    expect(worktreeInfo({ path: path.join(root, "tree"), branch: "main" })).toBe(`\u{1f333} [unknown] \ue0b1 main \ue0b1 ${root}/tree`);
    expect(fs.existsSync(capture)).toBe(false);
  });

  it("bounds a blocked disk probe and reports unknown instead of a partial value", () => {
    vi.stubEnv("DU_DELAY", "5000");
    expect(worktreeInfo({ path: path.join(root, "tree"), branch: "main" })).toBe(`\u{1f333} [unknown] \ue0b1 main \ue0b1 ${root}/tree`);
    expect(fs.existsSync(capture)).toBe(true);
  });

  it("bounds native output and rejects oversized results", () => {
    vi.stubEnv("DU_FLOOD", "1");
    expect(worktreeInfo({ path: path.join(root, "tree"), branch: "main" })).toBe(`\u{1f333} [unknown] \ue0b1 main \ue0b1 ${root}/tree`);
    expect(fs.existsSync(capture)).toBe(true);
  });

  it("leaves raw inventory fields unchanged without probing storage", () => {
    const folder = path.join(root, "tree");
    execFileSync("git", ["init", "--quiet", "--initial-branch=main", folder], {
      env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1" },
      stdio: "ignore",
      timeout: 5000,
    });
    const result = spawnSync(process.execPath, [path.resolve("software/scripts/git.worktree_list.cjs"), "--raw"], {
      cwd: folder,
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1" },
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([{ branch_name: "main", org: null, repo: "tree", root_path: folder, worktree_path: folder }]);
    expect(fs.existsSync(capture)).toBe(false);
  });

  it("measures real local storage without following a symlink outside the worktree", () => {
    vi.unstubAllEnvs();
    fs.writeFileSync(path.join(root, "tree", "local.bin"), Buffer.alloc(8192, 1));
    const outside = path.join(root, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "large.bin"), Buffer.alloc(2 * 1024 * 1024, 1));
    fs.symlinkSync(outside, path.join(root, "tree", "linked"), "dir");
    expect(worktreeInfo({ path: path.join(root, "tree"), branch: "main" })).toMatch(/^\u{1f333} \[\d+(?:\.\d+)?KB\] \ue0b1 main \ue0b1 /u);
  });
});
