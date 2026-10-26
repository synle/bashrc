/** Integration coverage for patch applications committing newly created files through aac. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";

/** Actual patch workflow source, loaded without the user's shell profile. */
const PROFILE = process.env.PATCH_PROFILE || path.resolve("software/scripts/bash-git-helpers.profile.bash");
const BASE85_PROFILE = path.resolve("software/scripts/bash-base85.profile.bash");
const BASE85_MODULE = path.resolve("node_modules/base85");
/** Each test owns its repository, transport files, and hooks. */
let folder;
let home;

/** Execute real Git in the isolated repository, throwing on failure and returning stdout. */
function git(...args) {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    timeout: 5000,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();
}

/** Run the public patch workflow with local clipboard and editor adapters; return its process result. */
function shell(script) {
  return spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
    shopt -s expand_aliases
    function _snip_require_binary() { type -P "$1" > /dev/null 2>&1; }
    function _snip_run() { command "$@"; }
    source "$BASE85_PROFILE"
    source "$PROFILE"
    function _git_patch_prompt_choice() { printf '%s\\n' "$1"; return 0; }
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
    function prompt_yes_no() { return 0; }
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
        HOME: home,
        BASH_ENV: "/dev/null",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    },
  );
}

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "patch-new-files-"));
  home = fs.mkdtempSync(path.join(os.tmpdir(), "patch-new-files-home-"));
  const moduleFolder = path.join(home, ".local/lib/node_modules");
  fs.mkdirSync(moduleFolder, { recursive: true });
  fs.symlinkSync(BASE85_MODULE, path.join(moduleFolder, "base85"), "dir");
  git("init", "-q");
  git("config", "user.name", "Test Dev");
  git("config", "user.email", "dev@example.invalid");
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
  fs.writeFileSync(path.join(folder, "added file.txt"), "new content\n");
  git("add", "added file.txt");
  git("commit", "-qm", "Add new file");
  fs.writeFileSync(path.join(folder, ".git/clipboard"), "ordinary text\n");
  fs.writeFileSync(path.join(folder, ".git/editor.sh"), '#!/bin/sh\ncp .git/clipboard "$1"\n');
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

describe("Patch add-all commit integration", () => {
  it.each(["patch_plain_str", "patch_64", "patch_85"])("%s commits new and unrelated files through aac while skipping hooks", (command) => {
    const exported = shell(command + " 1");
    expect(exported.status, exported.stderr).toBe(0);
    expect(exported.stdout).toContain("Latest Patch copied to clipboard");
    git("checkout", "--detach", "HEAD~1");
    fs.writeFileSync(path.join(folder, "unrelated.txt"), "also staged by aac\n");
    fs.writeFileSync(path.join(folder, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const result = shell(command + " -y");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Patch Applied");
    expect(git("show", "HEAD:added file.txt")).toBe("new content");
    expect(git("show", "HEAD:unrelated.txt")).toBe("also staged by aac");
    expect(git("log", "-1", "--format=%s")).toBe("Add new file");
    expect(git("status", "--porcelain")).toBe("");
  });
});
