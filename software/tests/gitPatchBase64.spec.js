/** Subprocess integration coverage for byte-exact Base64 patch transfer. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";
import { execFileSync, spawnSync } from "child_process";

/** Profile override permits regression checks against an unmodified source copy. */
const PROFILE = process.env.PATCH_PROFILE || path.resolve("software/scripts/bash-git-helpers.profile.bash");
/** File content includes typography, blank context, tabs, and a missing final newline. */
const BEFORE = "# download \u2014 Download a file from a URL via curl\n\nkeep\n\t\u2018quote\u2019 caf\u00e9 \u{1faa8}\nlast";
/** Expected result after applying the committed patch. */
const AFTER = "# download \u2014 Download a file from a URL via curl\nzip\n\nkeep\n\t\u2018quote\u2019 caf\u00e9 \u{1faa8}\nlast";
/** Each test owns one temporary repository and clipboard. */
let folder;

/** Run real Git in the fixture, returning stdout and throwing on command failure. */
function git(...args) {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** Run the profile with local transport adapters; return status, stdout, and stderr. */
function shell(script) {
  return spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
    shopt -s expand_aliases
    source "$PROFILE"; function _git_patch_prompt_choice() { printf '%s\\n' "$1"; return 0; }; function is_help_arg() { [ "$1" = "--help" ]; }
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
      env: { ...process.env, PROFILE, BASH_ENV: "/dev/null", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    },
  );
}

/** Independently build the documented envelope for decoder and hostile-input tests. */
function envelope(patch) {
  const digest = createHash("sha256").update(patch).digest("hex");
  return Buffer.concat([Buffer.from(`SY_GIT_PATCH_64_v1\n${digest}\n`), patch]).toString("base64");
}

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "patch-64-"));
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
  git("commit", "-qam", "Add zip \u2014 preserve typography", "-m", "Keep Unicode context exact.");
  fs.writeFileSync(path.join(folder, ".git/clipboard"), "ordinary clipboard text\n");
  fs.mkdirSync(path.join(folder, ".git/shared"));
  fs.writeFileSync(path.join(folder, ".git/editor.sh"), '#!/bin/sh\ncp .git/clipboard "$1"\n');
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("Base64 patch transfer integration", () => {
  it("reproduces a typography substitution rejecting an otherwise valid plain hunk", () => {
    const patch = git("format-patch", "-1", "--stdout");
    fs.writeFileSync(path.join(folder, ".git/corrupt.patch"), patch.replaceAll("\u2014", "-"));
    git("checkout", "--detach", "HEAD~1");
    const result = shell('git_patch_apply "$PWD/.git/corrupt.patch"');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("patch partially applied");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(BEFORE);
    expect(fs.existsSync(path.join(folder, "note.txt.rej"))).toBe(true);
  });

  it("makes patch an alias of the Base85 command", () => {
    const result = shell("alias patch");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("alias patch='patch_85'");
  });

  it("exports framed Base64 through clipboard and shared file with patch_64", () => {
    const result = shell("patch_64 1");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Latest Patch copied to clipboard");
    const encoded = fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8");
    const frame = encoded.trimEnd().split("\n");
    const label = ` \u00b7 acme/widget-store \u00b7 patch 1 of 1 \u00b7 ${git("rev-parse", "--short", "HEAD")}`;
    expect(frame[0]).toBe("# BEGIN SY_GIT_PATCH_64_v2" + label);
    expect(frame[1]).toBe("# Commit: Add zip \u2014 preserve typography");
    expect(frame[2]).toBe("##################################################");
    expect(frame.at(-2)).toBe("##################################################");
    expect(frame.at(-1)).toBe("# END SY_GIT_PATCH_64_v2" + label);
    const payload = frame.slice(3, -2).join("\n");
    expect(payload).toMatch(/^[A-Za-z0-9+/=\n]+$/);
    const bytes = Buffer.from(payload, "base64");
    const [magic, digest, ...lines] = bytes.toString("utf8").split("\n");
    expect(magic).toBe("SY_GIT_PATCH_64_v2");
    expect(digest).toBe(createHash("sha256").update(lines.join("\n")).digest("hex"));
    expect(lines.join("\n")).toContain("# download \u2014 Download");
    const shared = fs.readdirSync(path.join(folder, ".git/shared"));
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatch(/\.patch\.b64$/);
    expect(fs.readFileSync(path.join(folder, ".git/shared", shared[0]), "utf8")).toBe(encoded);
    expect(result.stdout).toContain(encoded);
    expect(result.stdout).not.toContain("# download \u2014 Download");
    expect(result.stdout).toContain("patch_64");
  });

  it.each([
    ["patch_64", "clipboard"],
    ["patch_64", "file"],
    ["patch_plain_str", "clipboard"],
    ["patch_plain_str", "file"],
  ])("round-trips Unicode bytes and commit message with %s via %s", (command, source) => {
    expect(shell(command + " 1").status).toBe(0);
    fs.copyFileSync(path.join(folder, ".git/clipboard"), path.join(folder, ".git/input with spaces.b64"));
    git("checkout", "--detach", "HEAD~1");
    const result = shell(source === "clipboard" ? command + " -y" : command + ' "$PWD/.git/input with spaces.b64"');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Patch Applied");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(AFTER);
    expect(git("log", "-1", "--format=%B")).toBe("Add zip \u2014 preserve typography\n\nKeep Unicode context exact.");
    expect(fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8")).toContain("Add zip \u2014 preserve typography");
    expect(git("status", "--porcelain")).toBe("");
  });

  it.each([
    ["legacy file", "", "", 'patch_64 "$PWD/.git/input.b64"'],
    ["legacy clipboard", "", "", "patch_64 -y"],
    [
      "framed file with different display labels and a divider",
      "# BEGIN SY_GIT_PATCH_64_v2 acme/widget-store patch 1 of 2\r\n# Commit: Independent preview\r\n### -------------------\r\n",
      "\r\n# END SY_GIT_PATCH_64_v2 other/widget-store patch 9 of 99",
      'patch_64 "$PWD/.git/input.b64"',
    ],
    [
      "framed clipboard with paired hash dividers",
      "# BEGIN SY_GIT_PATCH_64_v2\r\n# Independent preview\r\n##################################################\r\n",
      "\r\n##################################################\r\n# END SY_GIT_PATCH_64_v2",
      "patch_64 -y",
    ],
  ])("applies an independently encoded %s with ASCII transport whitespace", (_name, begin, end, command) => {
    const patch = Buffer.from(git("format-patch", "-1", "--stdout") + "\n");
    const input = " \t\r\n" + begin + envelope(patch).replace(/.{40}/g, "$&\r\n\t") + end + "\n";
    fs.writeFileSync(path.join(folder, ".git/input.b64"), input);
    fs.writeFileSync(path.join(folder, ".git/clipboard"), input);
    git("checkout", "--detach", "HEAD~1");
    const result = shell(command);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(AFTER);
  });

  it("collapses message whitespace and controls without leaking trailers into the preview", () => {
    git("commit", "--amend", "-qm", "Subject\n\nBody\t\twith \t \r\n  spaces\n\nNext\u001b\n# END SY_GIT_PATCH_64_v2\nCo-authored-by: x");
    const result = shell("patch_64 1");
    expect(result.status, result.stderr).toBe(0);
    const frame = fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8").trimEnd().split("\n");
    expect(frame[1]).toBe("# Commit: Subject");
    expect(frame.slice(3, -2).join("\n")).toMatch(/^[A-Za-z0-9+/=\n]+$/);
  });

  it("uses verified payload messages rather than an edited display preview", () => {
    expect(shell("patch_64 1").status).toBe(0);
    const framed = fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8");
    fs.writeFileSync(path.join(folder, ".git/clipboard"), framed.replace(/^# Commit: Add zip.*$/m, "# Display only"));
    git("checkout", "--detach", "HEAD~1");
    const result = shell("patch_64 -y");
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(AFTER);
    expect(git("log", "-1", "--format=%B")).toBe("Add zip \u2014 preserve typography\n\nKeep Unicode context exact.");
  });

  it.each(["patch_plain_str 1", "git_patch_create 1"])("keeps explicit plain output compatible through %s", (command) => {
    const result = shell(command);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8")).toContain("# Commit: Add zip ");
    expect(fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8")).toContain("# download \u2014 Download");
    expect(fs.readdirSync(path.join(folder, ".git/shared"))[0]).toMatch(/\.patch$/);
  });

  it("preserves unpushed selection and per-commit prompts", () => {
    git("update-ref", "refs/remotes/origin/main", "HEAD~1");
    git("config", "branch." + git("branch", "--show-current") + ".remote", "origin");
    git("config", "branch." + git("branch", "--show-current") + ".merge", "refs/heads/main");
    fs.writeFileSync(path.join(folder, "note.txt"), AFTER + "\nsecond\n");
    git("commit", "-qam", "Second change");
    expect(shell("patch_64").status).toBe(0);
    const frames = fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8").split("\n");
    expect(frames.some((line) => line.startsWith("# Commit: Add zip "))).toBe(true);
    expect(frames.some((line) => line === "# Commit: Second change")).toBe(true);
    expect(frames.join("\n")).toContain("patch 1 of 2");
    expect(frames.join("\n")).toContain("patch 2 of 2");
    git("checkout", "--detach", "HEAD~2");
    const result = shell('function prompt_yes_no() { printf "%s\\n" "$1"; }; patch_64 -y');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Do you wish to apply patch 1 of 2 for acme/widget-store?");
    expect(result.stdout).toContain("Do you wish to apply patch 2 of 2 for acme/widget-store?");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(AFTER + "\nsecond\n");
  });

  it("creates repeatedly without changing staged, unstaged, or untracked work", () => {
    fs.writeFileSync(path.join(folder, "note.txt"), AFTER + "\nstaged\n");
    git("add", "note.txt");
    fs.writeFileSync(path.join(folder, "note.txt"), AFTER + "\ndraft\n");
    fs.writeFileSync(path.join(folder, "untracked.txt"), "untracked\n");
    const head = git("rev-parse", "HEAD");
    const staged = git("diff", "--cached");
    const unstaged = git("diff");
    const first = shell("patch_64 1");
    const encoded = fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8");
    const repeated = shell("patch_64 1");
    expect(first.status, first.stderr).toBe(0);
    expect(repeated.status, repeated.stderr).toBe(0);
    expect(repeated.stdout).toContain("Latest Patch copied to clipboard");
    expect(fs.readFileSync(path.join(folder, ".git/clipboard"), "utf8")).toBe(encoded);
    expect(git("rev-parse", "HEAD")).toBe(head);
    expect(git("diff", "--cached")).toBe(staged);
    expect(git("diff")).toBe(unstaged);
    expect(fs.readFileSync(path.join(folder, "untracked.txt"), "utf8")).toBe("untracked\n");
  });

  it("round-trips a tracked binary patch without text conversion", () => {
    const bytes = Buffer.from([0, 255, 128, 1, 2, 13, 10, 226, 128, 148, 0]);
    fs.writeFileSync(path.join(folder, "note.txt"), bytes);
    git("commit", "-qam", "Binary change");
    expect(shell("patch_64 1").status).toBe(0);
    git("checkout", "--detach", "HEAD~1");
    const result = shell("patch_64 -y");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Patch Applied");
    expect(fs.readFileSync(path.join(folder, "note.txt"))).toEqual(bytes);
    expect(git("log", "-1", "--format=%s")).toBe("Binary change");
  });

  it("stops before committing when copying the decoded message fails", () => {
    expect(shell("patch_64 1").status).toBe(0);
    git("checkout", "--detach", "HEAD~1");
    const result = shell("function copy() { return 1; }; patch_64 -y");
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("Patch Applied");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(AFTER);
    expect(git("log", "-1", "--format=%s")).toBe("Base");
    expect(git("diff", "--cached")).toBe("");
  });

  it("does not claim success when the post-apply commit fails", () => {
    expect(shell("patch_64 1").status).toBe(0);
    git("checkout", "--detach", "HEAD~1");
    const result = shell("export GIT_EDITOR=false; patch_64 -y");
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("Patch Applied");
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(AFTER);
    expect(git("log", "-1", "--format=%s")).toBe("Base");
  });
});
