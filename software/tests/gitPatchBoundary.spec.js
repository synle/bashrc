/** Integration coverage for readable patch labels and prefix-only boundary pairing. */
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

/** Public creation path with local clipboard storage and no external transports. */
const CREATE_PATCH = `
  function is_help_arg() { return 1; }
  function paste() { printf 'not a patch\\n'; }
  function copy() { command cp "$2" "$PWD/.git/copied.patch"; }
  function _git_patch_temp_file() { printf '%s\\n' "$PWD/.git/export.patch"; }
  function _dropbox_folder() { return 1; }
  function print_action_summary() { :; }
  is_work_profile=1
  export GIT_EDITOR=false
`;

describe("Git patch creation integration", () => {
  it.each(["clean", "unstaged", "staged and unstaged", "declined clipboard"])(
    "exports only committed changes and preserves repository state with %s work",
    (state) => {
      git("update-ref", "refs/remotes/origin/main", "HEAD~1");
      git("config", "branch." + git("branch", "--show-current") + ".remote", "origin");
      git("config", "branch." + git("branch", "--show-current") + ".merge", "refs/heads/main");
      if (state === "staged and unstaged") {
        fs.writeFileSync(path.join(folder, "note.txt"), "base\nfirst\nstaged draft\n");
        git("add", "note.txt");
      }
      if (state !== "clean") {
        fs.writeFileSync(path.join(folder, "note.txt"), "base\nfirst\nunfinished draft\n");
        fs.writeFileSync(path.join(folder, "untracked.txt"), "untracked draft\n");
      }
      const head = git("rev-parse", "HEAD");
      const status = git("status", "--porcelain");
      const staged = git("diff", "--cached", "--binary");
      const unstaged = git("diff", "--binary");
      const stashes = git("stash", "list");
      const clipboard =
        state === "declined clipboard"
          ? "function paste() { git format-patch -1 --stdout; }; function prompt_yes_no() { return 1; }; "
          : "";

      const result = shell(CREATE_PATCH + clipboard + "patch_plain_str");

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("Latest Patch copied to clipboard");
      const exported = fs.readFileSync(path.join(folder, ".git/copied.patch"), "utf8");
      expect(exported).toContain("Subject: [PATCH] First change");
      expect(exported).toContain("+first\n");
      expect(exported).not.toContain("draft");
      const repeated = shell(CREATE_PATCH + clipboard + "patch_plain_str");
      expect(repeated.status, repeated.stderr).toBe(0);
      expect(repeated.stdout).toContain("Latest Patch copied to clipboard");
      expect(fs.readFileSync(path.join(folder, ".git/copied.patch"), "utf8")).toBe(exported);
      if (state !== "clean") {
        expect(fs.readFileSync(path.join(folder, "untracked.txt"), "utf8")).toBe("untracked draft\n");
      }
      expect(git("rev-parse", "HEAD")).toBe(head);
      expect(git("status", "--porcelain")).toBe(status);
      expect(git("diff", "--cached", "--binary")).toBe(staged);
      expect(git("diff", "--binary")).toBe(unstaged);
      expect(git("stash", "list")).toBe(stashes);
      expect(result.stdout).not.toContain("staging tracked changes and committing");
    },
  );
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
    expect(patch.split("\n")[0]).toBe(`# BEGIN SY_GIT_PATCH_BOUNDARY_v1 · acme/widget-store · patch 1 of 1 · ${sha}`);
    expect(patch.trimEnd().split("\n").at(-1)).toBe(`# END SY_GIT_PATCH_BOUNDARY_v1 · acme/widget-store · patch 1 of 1 · ${sha}`);
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
    ["", ""],
    [" · acme/widget-store · 1/1 · abc123", " · other/widget-store · 9/99 · def456"],
    [" · acme/widget-store · patch 1 of 1 · abc123", " · changed label"],
    ["custom 🪨 label", "\tanything goes"],
  ])("applies boundaries with display-only suffixes %s / %s", (begin, end) => {
    const patch = git("format-patch", "-1", "--stdout");
    fs.writeFileSync(
      path.join(folder, "custom.patch"),
      `# BEGIN SY_GIT_PATCH_BOUNDARY_v1${begin}\n${patch}\n# END SY_GIT_PATCH_BOUNDARY_v1${end}\n`,
    );
    git("checkout", "--detach", "HEAD~1");
    const result = shell('_git_patch_apply_file "$PWD/custom.patch"');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("patch applied cleanly");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe("base\nfirst\n");
  });

  it("counts actual sections and prompts in file order without suffix counts", () => {
    const first = git("format-patch", "-1", "--stdout");
    fs.writeFileSync(path.join(folder, "note.txt"), "base\nfirst\nsecond\n");
    git("commit", "-qam", "Second change");
    const second = git("format-patch", "-1", "--stdout");
    fs.writeFileSync(
      path.join(folder, "custom.patch"),
      `# BEGIN SY_GIT_PATCH_BOUNDARY_v1\n${first}\n# END SY_GIT_PATCH_BOUNDARY_v1 old\n# BEGIN SY_GIT_PATCH_BOUNDARY_v1 · patch 99 of 99\n${second}\n# END SY_GIT_PATCH_BOUNDARY_v1\n`,
    );
    git("checkout", "--detach", "HEAD~2");
    const result = shell('function prompt_yes_no() { printf "%s\\n" "$1"; }; _git_patch_apply_file "$PWD/custom.patch"');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Applying patch 1/2: Continue?");
    expect(result.stdout).toContain("Applying patch 2/2: Continue?");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe("base\nfirst\nsecond\n");
  });

  it.each([
    ["missing end", "# BEGIN SY_GIT_PATCH_BOUNDARY_v1\n", ""],
    ["orphan end", "", "# END SY_GIT_PATCH_BOUNDARY_v1\n"],
    ["nested begin", "# BEGIN SY_GIT_PATCH_BOUNDARY_v1\n# BEGIN SY_GIT_PATCH_BOUNDARY_v1\n", "# END SY_GIT_PATCH_BOUNDARY_v1\n"],
    ["extra end", "# BEGIN SY_GIT_PATCH_BOUNDARY_v1\n", "# END SY_GIT_PATCH_BOUNDARY_v1\n# END SY_GIT_PATCH_BOUNDARY_v1\n"],
    ["end before begin", "# END SY_GIT_PATCH_BOUNDARY_v1\n# BEGIN SY_GIT_PATCH_BOUNDARY_v1\n", "# END SY_GIT_PATCH_BOUNDARY_v1\n"],
    ["unclosed later section", "# BEGIN SY_GIT_PATCH_BOUNDARY_v1\n", "# END SY_GIT_PATCH_BOUNDARY_v1\n# BEGIN SY_GIT_PATCH_BOUNDARY_v1\n"],
  ])("rejects %s before applying any hunks", (_label, begin, end) => {
    const patch = git("format-patch", "-1", "--stdout");
    fs.writeFileSync(path.join(folder, "invalid.patch"), `${begin}${patch}\n${end}`);
    git("checkout", "--detach", "HEAD~1");
    const result = shell('_git_patch_apply_file "$PWD/invalid.patch"');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("patch boundary metadata is malformed");
    expect(git("status", "--porcelain", "--untracked-files=no")).toBe("");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe("base\n");
  });
});
