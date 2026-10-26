/** Integration coverage for repository checks and per-patch apply decisions. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";

/** Patch workflow source, loaded without the user's shell profile. */
const PROFILE = process.env.PATCH_PROFILE || path.resolve("software/scripts/bash-git-helpers.profile.bash");
/** Real Base85 helpers used by the default patch alias. */
const BASE85_PROFILE = path.resolve("software/scripts/bash-base85.profile.bash");
/** Installed codec dependency linked into the isolated home. */
const BASE85_MODULE = path.resolve("node_modules/base85");
/** Isolated Git repository and clipboard fixture. */
let folder;

/** Execute Git in the fixture and return trimmed stdout. */
function git(...args) {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    timeout: 10000,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();
}

/** Run a shell script with isolated clipboard/editor adapters; return its process result without throwing. */
function shell(script) {
  return spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
        shopt -s expand_aliases
        source "$BASE85_PROFILE"
        source "$PROFILE"
        function _snip_require_binary() { type -P "$1" > /dev/null 2>&1; }
        function _git_patch_prompt_choice() { printf '%s\\n' "$1"; return 0; }
        function prompt_yes_no() { printf 'REPO:%s\\n' "$1"; return 0; }
        function is_help_arg() { [ "$1" = --help ]; }
        function copy() {
          if [ "$#" -eq 2 ]; then command cp "$2" .git/clipboard
          else command cat > .git/clipboard; fi
        }
        function paste() { command cat .git/clipboard; }
        function _git_patch_temp_file() {
          local temp_folder
          temp_folder=$(mktemp -d "$PWD/.git/patch-XXXXXX") || return 1
          printf '%s/%s\\n' "$temp_folder" "$1"
        }
        function _dropbox_folder() { return 1; }
        function print_action_summary() { :; }
        is_work_profile=1
        export GIT_EDITOR='sh .git/editor.sh'
        ${script}
      `,
    ],
    {
      cwd: folder,
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        PROFILE,
        BASE85_PROFILE,
        HOME: path.join(folder, ".git/home"),
        BASH_ENV: "/dev/null",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    },
  );
}

/** Create a second independent commit so skip and quit decisions stay observable. */
function addSecondCommit() {
  fs.writeFileSync(path.join(folder, "second.txt"), "second\n");
  git("add", "second.txt");
  git("commit", "-qm", "Second change");
}

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "patch-interactive-"));
  git("init", "-q");
  fs.mkdirSync(path.join(folder, ".git/home/.local/lib/node_modules"), { recursive: true });
  fs.symlinkSync(BASE85_MODULE, path.join(folder, ".git/home/.local/lib/node_modules/base85"), "dir");
  git("config", "user.name", "Test Dev");
  git("config", "user.email", "dev@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "maintenance.auto", "false");
  for (const alias of ["aac", "aa", "c", "patch-clean"]) {
    git(
      "config",
      `alias.${alias}`,
      execFileSync("git", ["config", "--file", path.resolve("software/scripts/git.gitconfig"), "--get", `alias.${alias}`], {
        encoding: "utf8",
      }).trim(),
    );
  }
  git("remote", "add", "origin", "https://github.com/acme/widget-store.git");
  fs.writeFileSync(path.join(folder, "note.txt"), "base\n");
  git("add", "note.txt");
  git("commit", "-qm", "Base");
  fs.writeFileSync(path.join(folder, "note.txt"), "base\nfirst\n");
  git("commit", "-qam", "First change");
  fs.writeFileSync(path.join(folder, ".git/clipboard"), "ordinary text\n");
  fs.writeFileSync(path.join(folder, ".git/editor.sh"), '#!/bin/sh\ncp .git/clipboard "$1"\n');
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("Git patch interactive application", () => {
  it.each(["patch_plain_str", "patch_64", "patch_85", "patch"])(
    "reuses clipboard confirmation for a single patch through %s",
    (command) => {
      const exported = shell(`${command} 1`);
      expect(exported.status, exported.stderr).toBe(0);
      git("checkout", "--detach", "HEAD~1");
      const result = shell(`
        function _git_patch_prompt_choice() { printf '%s\\n' "$1"; return 2; }
        ${command}
      `);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("Clipboard holds a patch that has not been applied here");
      expect(result.stdout).not.toContain("Choose [quit/n/Y]");
      expect(result.stdout).toContain("acme/widget-store");
      expect(result.stdout).toContain("Commit: First change");
      expect(git("log", "-1", "--format=%s")).toBe("First change");
      expect(git("show", "HEAD:note.txt")).toBe("base\nfirst");
      expect(git("status", "--porcelain")).toBe("");
    },
  );

  it("keeps per-patch choices for a confirmed multiple-patch clipboard", () => {
    addSecondCommit();
    expect(shell("patch_plain_str 2").status).toBe(0);
    git("checkout", "--detach", "HEAD~2");
    const result = shell("patch_plain_str");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Clipboard holds a patch that has not been applied here");
    expect(result.stdout).toContain("Do you wish to apply patch 1 of 2 for acme/widget-store?");
    expect(result.stdout).toContain("Do you wish to apply patch 2 of 2 for acme/widget-store?");
    expect(git("show", "HEAD:note.txt")).toBe("base\nfirst");
    expect(git("show", "HEAD:second.txt")).toBe("second");
    expect(git("status", "--porcelain")).toBe("");
  });

  it.each(["patch_plain_str -y", 'patch_plain_str "$PWD/.git/input.patch"'])(
    "keeps the single-patch decision without clipboard confirmation for %s",
    (command) => {
      expect(shell("patch_plain_str 1").status).toBe(0);
      fs.copyFileSync(path.join(folder, ".git/clipboard"), path.join(folder, ".git/input.patch"));
      git("checkout", "--detach", "HEAD~1");
      const head = git("rev-parse", "HEAD");
      const result = shell(`
        function _git_patch_prompt_choice() { printf '%s\\n' "$1"; return 1; }
        ${command}
      `);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).not.toContain("Clipboard holds a patch that has not been applied here");
      expect(result.stdout).toContain("Do you wish to apply patch 1 of 1 for acme/widget-store?");
      expect(result.stdout).toContain("No patches applied; no commit created");
      expect(git("rev-parse", "HEAD")).toBe(head);
      expect(git("show", "HEAD:note.txt")).toBe("base");
      expect(git("status", "--porcelain")).toBe("");
    },
  );

  it("keeps repository refusal effective after single-patch clipboard confirmation", () => {
    expect(shell("patch_plain_str 1").status).toBe(0);
    git("checkout", "--detach", "HEAD~1");
    git("remote", "set-url", "origin", "https://github.com/other/repo.git");
    const head = git("rev-parse", "HEAD");
    const result = shell(`
      function prompt_yes_no() {
        printf '%s\\n' "$1"
        case "$1" in Clipboard*) return 0 ;; *) return 1 ;; esac
      }
      patch_plain_str
    `);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("does not match current repository 'other/repo'");
    expect(result.stdout).toContain("No patches applied; no commit created");
    expect(git("rev-parse", "HEAD")).toBe(head);
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe("base\n");
    expect(git("status", "--porcelain")).toBe("");
  });

  it.each([
    ["accepted", 0, "base\nfirst\n", 1],
    ["refused", 1, "base\n", 0],
  ])("asks before applying a patch from another repository when %s", (_decision, answer, expected, count) => {
    expect(shell('_git_patch_write "$PWD/output.patch"').status).toBe(0);
    git("checkout", "--detach", "HEAD~1");
    git("remote", "set-url", "origin", "https://github.com/other/repo.git");
    const result = shell(
      `function prompt_yes_no() { printf 'REPO:%s\\n' "$1"; return ${answer}; }; _git_patch_apply_file "$PWD/output.patch"; printf 'APPLIED:%s\\n' "$_GIT_PATCH_APPLIED_PATCH_COUNT"`,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Patch repository 'acme/widget-store' does not match current repository 'other/repo'. Continue applying this patch?",
    );
    expect(result.stdout).toContain(`APPLIED:${count}`);
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(expected);
  });

  it("skips No, applies the next patch, and commits that patch's message", () => {
    addSecondCommit();
    expect(shell("patch_plain_str 2").status).toBe(0);
    git("checkout", "--detach", "HEAD~2");
    const result = shell(`
      _GIT_PATCH_PROMPT_COUNT=0
      function _git_patch_prompt_choice() {
        _GIT_PATCH_PROMPT_COUNT=$((_GIT_PATCH_PROMPT_COUNT + 1))
        printf '%s\\n' "$1"
        [ "$_GIT_PATCH_PROMPT_COUNT" -eq 1 ] && return 1
        return 0
      }
      patch_plain_str -y
    `);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Do you wish to apply patch 1 of 2 for acme/widget-store?");
    expect(result.stdout).toContain("Commit: First change");
    expect(result.stdout).toContain("Do you wish to apply patch 2 of 2 for acme/widget-store?");
    expect(result.stdout).toContain("Commit: Second change");
    expect(git("log", "-1", "--format=%s")).toBe("Second change");
    expect(git("show", "HEAD:note.txt")).toBe("base");
    expect(git("show", "HEAD:second.txt")).toBe("second");
    expect(git("status", "--porcelain")).toBe("");
  });

  it("does not create a commit when every patch is skipped", () => {
    expect(shell("patch_plain_str 1").status).toBe(0);
    git("checkout", "--detach", "HEAD~1");
    const head = git("rev-parse", "HEAD");
    const result = shell("function _git_patch_prompt_choice() { return 1; }; patch_plain_str -y");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("No patches applied; no commit created");
    expect(result.stdout).not.toContain("Patch Applied");
    expect(git("rev-parse", "HEAD")).toBe(head);
    expect(git("status", "--porcelain")).toBe("");
  });

  it("quits after one applied patch and leaves it uncommitted", () => {
    addSecondCommit();
    expect(shell("patch_plain_str 2").status).toBe(0);
    git("checkout", "--detach", "HEAD~2");
    const result = shell(`
      _GIT_PATCH_PROMPT_COUNT=0
      function _git_patch_prompt_choice() {
        _GIT_PATCH_PROMPT_COUNT=$((_GIT_PATCH_PROMPT_COUNT + 1))
        [ "$_GIT_PATCH_PROMPT_COUNT" -eq 1 ] && return 0
        return 2
      }
      patch_plain_str -y
    `);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("earlier patches remain in the working tree and are not committed");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe("base\nfirst\n");
    expect(fs.existsSync(path.join(folder, "second.txt"))).toBe(false);
    expect(git("log", "-1", "--format=%s")).toBe("Base");
  });
});
