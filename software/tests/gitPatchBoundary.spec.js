/** Integration coverage for repository-labelled patch boundaries and legacy readers. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync, execFileSync } from "child_process";

/** Shell profile under test, sourced without loading the user's profile. */
const PROFILE = path.resolve("software/scripts/bash-git-helpers.profile.bash");
/** Isolated fixture folder, removed after each test. */
let folder;

/** Run Git in the fixture; return stdout or throw on failure. */
function git(...args) {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    timeout: 10000,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();
}

/** Source the real profile and run a script, returning its exit status and output. */
function shell(script) {
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", 'source "$PROFILE"; ' + script], {
    cwd: folder,
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, PROFILE, BASH_ENV: "/dev/null", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  });
}

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "patch-boundary-"));
  git("init", "-q");
  git("config", "user.name", "Test Dev");
  git("config", "user.email", "dev@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "maintenance.auto", "false");
  git("config", "alias.patch-clean", "!command cat");
  git("remote", "add", "origin", "https://github.com/acme/widget-store.git");
  fs.writeFileSync(path.join(folder, "note.txt"), "base\n");
  git("add", "note.txt");
  git("commit", "-qm", "Base");
  fs.writeFileSync(path.join(folder, "note.txt"), "base\nfirst\n");
  git("commit", "-qam", "First change");
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("Git patch boundary integration", () => {
  it.each([
    "https://github.com/acme/widget-store.git",
    "git@github.com:acme/widget-store.git",
    "ssh://git@github.com/acme/widget-store.git",
  ])("writes repository-first markers from origin %s", (remote) => {
    git("remote", "set-url", "origin", remote);
    const result = shell('_git_patch_write "$PWD/output.patch"');
    expect(result.status, result.stderr).toBe(0);
    const patch = fs.readFileSync(path.join(folder, "output.patch"), "utf8");
    const sha = git("rev-parse", "--short", "HEAD");
    expect(patch.split("\n")[0]).toBe(`# BEGIN SY_GIT_PATCH_BOUNDARY_v1 · acme/widget-store · 1/1 · ${sha}`);
    expect(patch.trimEnd().split("\n").at(-1)).toBe(`# END SY_GIT_PATCH_BOUNDARY_v1 · acme/widget-store · 1/1 · ${sha}`);
  });

  it.each([1, 2])("round-trips %i commits through the real applier", (count) => {
    fs.writeFileSync(path.join(folder, "note.txt"), "base\nfirst\nsecond\n");
    git("commit", "-qam", "Second change");
    const created = shell(`_git_patch_write "$PWD/output.patch" ${count}`);
    expect(created.status, created.stderr).toBe(0);
    git("checkout", "--detach", `HEAD~${count}`);
    const applied = shell('function prompt_yes_no() { return 0; }; _git_patch_apply_file "$PWD/output.patch"');
    expect(applied.status, applied.stderr).toBe(0);
    expect(applied.stdout).toContain("patch applied cleanly");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe("base\nfirst\nsecond\n");
  });

  it("still applies a saved username-labelled boundary", () => {
    const patch = git("format-patch", "-1", "--stdout");
    fs.writeFileSync(
      path.join(folder, "legacy.patch"),
      `# BEGIN SY_GIT_PATCH_BOUNDARY_v1 · 1/1 · abc123 · unknown\n${patch}\n# END SY_GIT_PATCH_BOUNDARY_v1 · 1/1 · abc123 · unknown\n`,
    );
    git("checkout", "--detach", "HEAD~1");
    const result = shell('_git_patch_apply_file "$PWD/legacy.patch"');
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe("base\nfirst\n");
  });

  it.each(["missing", "invalid"])("fails without changing output when origin is %s", (origin) => {
    git("remote", "remove", "origin");
    if (origin === "invalid") git("remote", "add", "origin", "not-a-repository");
    fs.writeFileSync(path.join(folder, "output.patch"), "keep\n");
    const result = shell('_git_patch_write "$PWD/output.patch"');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("could not resolve origin owner/repo");
    expect(fs.readFileSync(path.join(folder, "output.patch"), "utf8")).toBe("keep\n");
  });

  it.each([
    ["acme/widget-store · 1/1 · abc123", "other/widget-store · 1/1 · abc123"],
    ["acme/widget-store · 2/2 · abc123", "acme/widget-store · 2/2 · abc123"],
    ["acme/widget-store · 1/2 · abc123", "acme/widget-store · 1/2 · abc123"],
    ["bad · 1/1 · abc123", "bad · 1/1 · abc123"],
  ])("rejects malformed boundary %s / %s before applying", (begin, end) => {
    const patch = git("format-patch", "-1", "--stdout");
    fs.writeFileSync(
      path.join(folder, "invalid.patch"),
      `# BEGIN SY_GIT_PATCH_BOUNDARY_v1 · ${begin}\n${patch}\n# END SY_GIT_PATCH_BOUNDARY_v1 · ${end}\n`,
    );
    git("checkout", "--detach", "HEAD~1");
    const result = shell('_git_patch_apply_file "$PWD/invalid.patch"');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("patch boundary metadata is malformed");
    expect(git("status", "--porcelain", "--untracked-files=no")).toBe("");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe("base\n");
  });
});
