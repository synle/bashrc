/** Compact cleanup output contracts against private Git repositories and a deterministic size probe. */
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Production cleanup entry point. */
const CLI = path.resolve("software/scripts/git.worktree_clean.cjs");

/**
 * Run cleanup against one private primary/linked pair; du refuses missing paths to expose post-deletion probes.
 * @param {string[]} args Cleanup mode and optional dry-run arguments.
 * @returns {{status: number|null, stdout: string, stderr: string, primaryExists: boolean, linkedExists: boolean}} Actual observable result.
 * @throws {Error} Setup fails; always removes the owned fixture.
 */
function cleanup(args) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-clean-output-")));
  try {
    const primary = path.join(root, "repo");
    const linked = path.join(root, "task");
    const bin = path.join(root, "bin");
    fs.mkdirSync(primary);
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "du"), '#!/bin/sh\n[ -d "$2" ] || exit 1\nprintf "48828\\t%s\\n" "$2"\n', { mode: 0o755 });
    fs.writeFileSync(path.join(bin, "gh"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      NO_COLOR: "1",
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_NOSYSTEM: "1",
    };
    const git = (...argv) =>
      execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", `core.hooksPath=${os.devNull}`, ...argv], {
        cwd: primary,
        env,
        stdio: "ignore",
        timeout: 10000,
      });
    git("init", "--quiet", "--initial-branch=main");
    git("commit", "--quiet", "--allow-empty", "-m", "initial");
    git("remote", "add", "origin", "https://github.com/acme/widget-store.git");
    git("worktree", "add", "--quiet", "-b", "task", linked);
    fs.writeFileSync(path.join(linked, "untracked.txt"), "pending local work\n");
    const result = spawnSync(process.execPath, [CLI, ...args], {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      status: result.status,
      stdout: result.stdout.replaceAll(root, "<root>"),
      stderr: result.stderr.replaceAll(root, "<root>"),
      primaryExists: fs.existsSync(primary),
      linkedExists: fs.existsSync(linked),
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe("compact worktree cleanup output", () => {
  it("prints one repository header and one line per worktree, preserving measured size after deletion", () => {
    const result = cleanup(["--mode=purge"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("\u{1f4e6} REPO acme/widget-store \ue0b1 <root>/repo \ue0b1 DEFAULT refs/heads/main\n");
    expect(result.stdout).toContain("\u23ed\ufe0f KEEP [50MB] \ue0b1 main \ue0b1 <root>/repo \ue0b1 primary worktree\n");
    expect(result.stdout).toContain("\u{1f9f9} REMOVED [50MB] \ue0b1 task \ue0b1 <root>/task \ue0b1 forced removal (--force)\n");
    expect(result.stdout).not.toContain("   ROOT ");
    expect(result.stdout).not.toContain("BRANCH ");
    expect(result.stdout).not.toMatch(/^[ \t]*[\u2502\u251c]/m);
    expect(result.primaryExists).toBe(true);
    expect(result.linkedExists).toBe(false);
  });

  it("keeps dirty worktrees with their reason on the same row", () => {
    const result = cleanup(["--mode=preserve"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("\u23ed\ufe0f KEEP [50MB] \ue0b1 task \ue0b1 <root>/task \ue0b1 uncommitted changes\n");
    expect(result.linkedExists).toBe(true);
  });

  it("uses the same compact row for dry-run without deleting the worktree", () => {
    const result = cleanup(["--mode=purge", "--dry-run"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("\u{1f9ea} WOULD REMOVE [50MB] \ue0b1 task \ue0b1 <root>/task \ue0b1 forced removal (--force)\n");
    expect(result.linkedExists).toBe(true);
  });
});
