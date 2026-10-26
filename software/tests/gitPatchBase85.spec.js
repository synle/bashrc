/** Subprocess integration coverage for byte-exact Base85 patch transfer. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";
import { execFileSync, spawnSync } from "child_process";

const require = createRequire(import.meta.url);
const base85 = require("base85");
const PROFILE = path.resolve("software/scripts/bash-git-helpers.profile.bash");
const BASE85_PROFILE = path.resolve("software/scripts/bash-base85.profile.bash");
const BASE85_MODULE = path.resolve("node_modules/base85");
const BEFORE = "before \u2014 text\n";
const AFTER = "after \u2014 text\n";
let folder;
let home;

/** Run real Git in the isolated repository; throw on command failure. */
function git(...args) {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** Run the real profile with temporary clipboard and shared-folder adapters. */
function shell(script) {
  return spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
        shopt -s expand_aliases
        function is_help_arg() { [ "$1" = "--help" ]; }
        function _snip_require_binary() { type -P "$1" > /dev/null 2>&1; }
        function _snip_run() { command "$@"; }
        function prompt_yes_no() { return 0; }
        function paste() { command cat "$PWD/.git/clipboard"; }
        function copy() {
          if [ "$#" -eq 2 ]; then command cp "$2" "$PWD/.git/clipboard"
          else command cat > "$PWD/.git/clipboard"; fi
        }
        function _git_patch_temp_file() {
          local temp_folder
          temp_folder=$(mktemp -d "$PWD/.git/patch-XXXXXX") || return 1
          printf '%s/%s\\n' "$temp_folder" "$1"
        }
        function _dropbox_folder() { printf '%s\\n' "$PWD/.git/shared"; }
        function print_action_summary() { printf 'SUMMARY: %s\\n' "$*"; }
        source "$BASE85_PROFILE"
        source "$PROFILE"
        function _git_patch_prompt_choice() { printf '%s\\n' "$1"; return 0; }
        is_work_profile=1
        export GIT_EDITOR='sh .git/editor.sh'
        ${script}
      `,
    ],
    {
      cwd: folder,
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...process.env,
        PROFILE,
        BASE85_PROFILE,
        HOME: home,
        BASH_ENV: "/dev/null",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    },
  );
}

/** Decode one generated frame and return its embedded patch bytes. */
function readPayload(frame) {
  const lines = frame.trimEnd().split("\n");
  const payloadLines = lines.slice(3, -2);
  expect(payloadLines.every((line) => line.startsWith("> "))).toBe(true);
  const encoded = payloadLines.map((line) => line.slice(2)).join("");
  const envelope = base85.decode(encoded, "a85");
  const magicEnd = envelope.indexOf(10);
  const digestEnd = envelope.indexOf(10, magicEnd + 1);
  const magic = envelope.subarray(0, magicEnd).toString("latin1");
  const digest = envelope.subarray(magicEnd + 1, digestEnd).toString("latin1");
  const patch = envelope.subarray(digestEnd + 1);

  expect(magic).toBe("SY_GIT_PATCH_85_v1");
  expect(digest).toBe(createHash("sha256").update(patch).digest("hex"));
  return patch;
}

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "patch-85-"));
  home = fs.mkdtempSync(path.join(os.tmpdir(), "patch-85-home-"));
  const moduleFolder = path.join(home, ".local/lib/node_modules");
  fs.mkdirSync(moduleFolder, { recursive: true });
  fs.symlinkSync(BASE85_MODULE, path.join(moduleFolder, "base85"), "dir");

  git("init", "-q");
  git("config", "user.name", "Test Dev");
  git("config", "user.email", "dev@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "maintenance.auto", "false");
  for (const alias of ["aa", "aac", "c", "patch-clean"]) {
    git(
      "config",
      `alias.${alias}`,
      execFileSync("git", ["config", "--file", path.resolve("software/scripts/git.gitconfig"), "--get", `alias.${alias}`], {
        encoding: "utf8",
      }).trim(),
    );
  }
  git("remote", "add", "origin", "https://github.com/acme/widget-store.git");
  fs.writeFileSync(path.join(folder, "note.txt"), BEFORE);
  git("add", "note.txt");
  git("commit", "-qm", "Base");
  fs.writeFileSync(path.join(folder, "note.txt"), AFTER);
  git("commit", "-qam", "Change text");
  fs.writeFileSync(path.join(folder, ".git/clipboard"), "ordinary clipboard text\n");
  fs.mkdirSync(path.join(folder, ".git/shared"));
  fs.writeFileSync(path.join(folder, ".git/editor.sh"), '#!/bin/sh\ncp .git/clipboard "$1"\n');
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

describe("Base85 patch transfer", () => {
  it("makes patch an alias of patch_85", () => {
    const result = shell("alias patch");

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("alias patch='patch_85'");
  });

  it("exports a verified Base85 frame for the patch alias", () => {
    const result = shell("eval 'patch 1'");
    const frame = fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8");
    const lines = frame.trimEnd().split("\n");

    expect(result.status, result.stderr).toBe(0);
    expect(lines[0]).toMatch(/^# BEGIN SY_GIT_PATCH_85_v1 \u00b7 acme\/widget-store \u00b7 patch 1 of 1 \u00b7 /);
    expect(lines[1]).toBe("# Commit: Change text");
    expect(lines[2]).toBe("##################################################");
    expect(lines.at(-2)).toBe("##################################################");
    expect(lines.at(-1)).toMatch(/^# END SY_GIT_PATCH_85_v1 \u00b7 acme\/widget-store \u00b7 patch 1 of 1 \u00b7 /);
    expect(readPayload(frame).toString("utf8")).toContain("+after \u2014 text");
    expect(fs.readdirSync(path.join(folder, ".git/shared"))[0]).toMatch(/\.patch\.b85$/);
    expect(result.stdout).toContain("patch_85");
  });

  it.each([
    ["ordinary prose", "ordinary clipboard text\n"],
    ["URL", "https://example.com/report?v=1"],
    ["Unicode prose", "review \u2014 ready \ud83d\ude80\n"],
    ["empty clipboard", ""],
    ["short noncanonical input", "!"],
    ["short overflowing input", "uuuuu"],
  ])("exports unpushed commits with %s instead of rejecting the clipboard", (_label, clipboard) => {
    fs.writeFileSync(path.join(folder, ".git/clipboard"), clipboard);
    git("update-ref", "refs/remotes/origin/main", "HEAD~1");
    git("branch", "--set-upstream-to=origin/main");
    const head = git("rev-parse", "HEAD");

    const result = shell("eval 'patch'");
    const frame = fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8");

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Latest Patch copied to clipboard");
    expect(result.stderr).not.toContain("invalid or noncanonical Base85 envelope");
    expect(readPayload(frame).toString("utf8")).toContain("+after \u2014 text");
    expect(git("rev-parse", "HEAD")).toBe(head);
    expect(git("status", "--porcelain")).toBe("");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(AFTER);
  });

  it.each(["clipboard", "file"])("round-trips Unicode patch bytes through %s", (source) => {
    expect(shell("patch_85 1").status).toBe(0);
    const encoded = fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8");
    expect(readPayload(encoded).toString("utf8")).toContain("\u2014");
    const input = path.join(folder, ".git/input with spaces.b85");
    fs.writeFileSync(input, encoded);
    git("checkout", "--detach", "HEAD~1");

    const result = shell(source === "clipboard" ? "patch_85 -y" : 'patch_85 "$PWD/.git/input with spaces.b85"');

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Patch Applied");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(AFTER);
    expect(git("log", "-1", "--format=%s")).toBe("Change text");
    expect(git("status", "--porcelain")).toBe("");
  });

  it.each([
    ["long bare payload without magic", "!".repeat(110), "clipboard"],
    ["long overflowing payload", "u".repeat(110), "clipboard"],
    ["malformed framed payload", "# BEGIN SY_GIT_PATCH_85_v1\n# Commit: Invalid\nuuuuu\n# END SY_GIT_PATCH_85_v1\n", "clipboard"],
    ["unrelated explicit file", "ordinary clipboard text\n", "file"],
  ])("rejects %s without applying or exporting", (_label, input, source) => {
    const head = git("rev-parse", "HEAD");
    fs.writeFileSync(path.join(folder, ".git/clipboard"), input);
    fs.writeFileSync(path.join(folder, ".git/input.b85"), input);

    const result = shell(source === "clipboard" ? "patch_85 -y" : 'patch_85 "$PWD/.git/input.b85"');

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Base85|base85/);
    expect(result.stdout).not.toContain("patch copied to clipboard");
    expect(result.stdout).not.toContain("Patch Applied");
    expect(git("rev-parse", "HEAD")).toBe(head);
    expect(git("status", "--porcelain")).toBe("");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(AFTER);
    expect(fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8")).toBe(input);
    expect(fs.readFileSync(path.join(folder, ".git/input.b85"), "utf8")).toBe(input);
    expect(fs.readdirSync(path.join(folder, ".git/shared"))).toEqual([]);
  });

  it("rejects a corrupted clipboard frame without applying or replacing it", () => {
    expect(shell("patch_85 1").status).toBe(0);
    const original = fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8");
    const lines = original.split("\n");
    const encodedLine = lines[3];
    const replacement = encodedLine[2] === "u" ? "!" : "u";
    lines[3] = "> " + replacement + encodedLine.slice(3);
    const corrupted = lines.join("\n");
    fs.writeFileSync(path.join(folder, ".git/clipboard"), corrupted);
    git("checkout", "--detach", "HEAD~1");

    const result = shell("patch_85 -y");

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Base85|SHA-256/);
    expect(result.stdout).not.toContain("Patch Applied");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(BEFORE);
    expect(git("log", "-1", "--format=%s")).toBe("Base");
    expect(fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8")).toBe(corrupted);
  });
});
