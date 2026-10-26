/** Integration checks and deterministic mutation seeds for untrusted Base64 envelopes. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";
import { execFileSync, spawnSync } from "child_process";

/** Real profile; an override supports before/after regression proofs. */
const PROFILE = process.env.PATCH_PROFILE || path.resolve("software/scripts/bash-git-helpers.profile.bash");
/** Independently specified unified diff, not produced by the shell generator. */
const PATCH = "diff --git a/note.txt b/note.txt\n--- a/note.txt\n+++ b/note.txt\n@@ -1 +1 @@\n-base —\n+changed —\n";
/** Original bytes checked after every rejection. */
const BEFORE = "base —\n";
/** Each test owns its repository, input file, and clipboard. */
let folder;
/** HEAD before a rejected operation must remain unchanged. */
let head;

/** Run Git in the isolated fixture; throw on failure and return stdout. */
function git(...args) {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** Independent producer for the documented envelope, with optional patch payload. */
function envelope(patch = PATCH) {
  return Buffer.from(`SY_GIT_PATCH_64_v1\n${createHash("sha256").update(patch).digest("hex")}\n${patch}`).toString("base64");
}

/** Run file/clipboard rejection through the real command and check all observable effects. */
function reject(input, source = "file") {
  fs.writeFileSync(path.join(folder, ".git/input.b64"), input);
  fs.writeFileSync(path.join(folder, ".git/clipboard"), input);
  const result = spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
    source "$PROFILE"
    function is_help_arg() { return 1; }
    function paste() { command cat .git/clipboard; }
    function copy() { printf 'overwritten' > .git/clipboard; }
    function _git_patch_temp_file() { printf '%s/.git/captured.patch\\n' "$PWD"; }
    function _dropbox_folder() { printf 'unexpected upload' > .git/upload; return 1; }
    function print_action_summary() { :; }
    is_work_profile=1
    export GIT_EDITOR=false
    ${source === "file" ? 'patch_64 "$PWD/.git/input.b64"' : "patch_64 -y"}
  `,
    ],
    {
      cwd: folder,
      encoding: "utf8",
      timeout: 10000,
      env: { ...process.env, PROFILE, BASH_ENV: "/dev/null", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    },
  );
  expect(result.status, result.stderr).toBe(1);
  expect(result.stdout).not.toContain("Patch Applied");
  expect(result.stdout).not.toContain("Latest Patch copied");
  expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(BEFORE);
  expect(git("rev-parse", "HEAD")).toBe(head);
  expect(git("status", "--porcelain")).toBe("");
  expect(fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8")).toBe(input);
  expect(fs.existsSync(path.join(folder, ".git/upload"))).toBe(false);
  return result;
}

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "patch-64-validation-"));
  git("init", "-q");
  git("config", "user.name", "Test Dev");
  git("config", "user.email", "dev@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "maintenance.auto", "false");
  fs.writeFileSync(path.join(folder, "note.txt"), BEFORE);
  git("add", "note.txt");
  git("commit", "-qm", "Base");
  head = git("rev-parse", "HEAD");
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("Base64 patch rejection integration", () => {
  it.each(["file", "clipboard"])("rejects a checksum mismatch from %s before all side effects", (source) => {
    const input = Buffer.from(Buffer.from(envelope(), "base64").toString("utf8").replace("-base —", "-base -")).toString("base64");
    expect(reject(input, source).stderr).toContain("SHA-256 mismatch");
  });

  it.each([
    ["plain", PATCH],
    ["empty", ""],
    ["invalid alphabet", envelope() + "!"],
    ["truncated", envelope().slice(0, -5)],
    ["noncanonical padding", envelope() + "="],
    ["Unicode whitespace", envelope() + "\u00a0"],
    ["no patch payload", envelope("")],
    ["wrong version", Buffer.from(Buffer.from(envelope(), "base64").toString("utf8").replace("_v1", "_v2")).toString("base64")],
    ["malformed digest", Buffer.from("SY_GIT_PATCH_64_v1\ninvalid\n" + PATCH).toString("base64")],
  ])("rejects %s file without touching the repository", (_name, input) => {
    expect(reject(input).stderr).toMatch(/Base64|base64|envelope/);
  });

  it("rejects a plain clipboard diff rather than applying it or replacing it", () => {
    expect(reject(PATCH, "clipboard").stderr).toContain("use patch_plain_str");
  });

  it.each([0, 3, 16, 40, 80, 120, 160, 200])("rejects a single Base64 character mutation at offset %i from clipboard", (offset) => {
    const valid = envelope();
    const input = valid.slice(0, offset) + (valid[offset] === "A" ? "B" : "A") + valid.slice(offset + 1);
    expect(reject(input, "clipboard").stderr).toMatch(/Base64|SHA-256/);
  });
});
