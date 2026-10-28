/** Cleanup-mode contracts with real private Git repositories and a deterministic terminal adapter. */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";

/** Resolve sibling imports from the production payload, including when a coverage source override is active. */
const require = createRequire(path.resolve("software/scripts/git.worktree_clean.cjs"));
/** Typed process-exit signal so original and modified CLI sources share the same harness. */
class CliExit extends Error {}
/** Production payload; override permits isolated before/after and coverage proofs. */
const CLI = process.env.WORKTREE_CLEAN_SOURCE || path.resolve("software/scripts/git.worktree_clean.cjs");
/** Immutable committed seed copied into independent fixtures. */
let seed;
/** Temporary folders owned by the active test. */
const folders = [];

/** Run real Git without external configuration, hooks, prompts, or network. @param {string} cwd @param {string[]} args @returns {void} */
function git(cwd, args) {
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", `core.hooksPath=${os.devNull}`, ...args], {
    cwd,
    stdio: "ignore",
    timeout: 10000,
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1" },
  });
}

/** Create a private repository and disable GitHub queries. @returns {{root: string, repo: string, bin: string}} Owned fixture paths. */
function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-modes-")));
  folders.push(root);
  const repo = path.join(root, "repo");
  const bin = path.join(root, "bin");
  fs.cpSync(seed, repo, { recursive: true });
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "gh"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  return { root, repo, bin };
}

/** Add a private linked worktree with pending untracked work. @param {object} context @param {string} name @returns {string} Registered path. */
function pending(context, name) {
  const folder = path.join(context.root, name);
  git(context.repo, ["worktree", "add", "--quiet", "-b", name, folder]);
  fs.writeFileSync(path.join(folder, "untracked.txt"), "do not lose accidentally\n");
  return folder;
}

/**
 * Execute the entire CLI with real Git and deterministic terminal reads/writes only.
 * @param {object} context Private fixture.
 * @param {string[]} args CLI arguments.
 * @param {string|null} [answers] Terminal lines, or null to simulate an unavailable terminal.
 * @param {Function} [onPrompt] Optional concurrent branch change at the confirmation boundary.
 * @returns {{status: number, stdout: string, stderr: string, prompts: string}} Observable CLI outcome.
 */
function run(context, args, answers = null, onPrompt = () => {}) {
  let stdout = "",
    stderr = "",
    prompts = "",
    terminal;
  const input = path.join(context.root, ".answers");
  fs.writeFileSync(input, answers ?? "");
  const environment = {
    ...process.env,
    NO_COLOR: "1",
    PATH: `${context.bin}:${process.env.PATH}`,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const processAdapter = {
    argv: [process.execPath, CLI, ...args],
    cwd: () => context.root,
    env: environment,
    exitCode: 0,
    stdout: {
      isTTY: false,
      write: (text) => {
        stdout += text;
      },
    },
    stderr: {
      write: (text) => {
        stderr += text;
      },
    },
    exit: (code) => {
      processAdapter.exitCode = code;
      throw new CliExit("CLI exit");
    },
  };
  const sandbox = vm.createContext({
    process: processAdapter,
    Buffer,
    require: (name) => {
      if (name === "child_process")
        return { spawnSync: (command, argv, options) => spawnSync(command, argv, { ...options, env: environment, timeout: 10000 }) };
      if (name !== "fs") return require(name);
      return {
        ...fs,
        openSync: (file, flags) => {
          if (file !== "/dev/tty") return fs.openSync(file, flags);
          if (answers === null) throw Object.assign(new Error("no terminal"), { code: "ENXIO" });
          terminal = fs.openSync(input, "r");
          return terminal;
        },
        writeSync: (fd, text) => {
          if (fd !== terminal) return fs.writeSync(fd, text);
          prompts += text;
          onPrompt(text);
          return Buffer.byteLength(text);
        },
      };
    },
  });
  try {
    vm.runInContext(fs.readFileSync(CLI, "utf8"), sandbox);
  } catch (error) {
    if (!(error instanceof CliExit)) throw error;
  }
  if (process.env.WORKTREE_CLEAN_COVERAGE_PREFIX && sandbox.__coverage__) {
    fs.writeFileSync(
      `${process.env.WORKTREE_CLEAN_COVERAGE_PREFIX}.${path.basename(context.root)}.${Date.now()}.json`,
      JSON.stringify(sandbox.__coverage__),
    );
  }
  return { status: processAdapter.exitCode, stdout, stderr, prompts };
}

beforeAll(() => {
  seed = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-modes-seed-")));
  git(seed, ["init", "--quiet", "--initial-branch=main"]);
  git(seed, ["commit", "--quiet", "--allow-empty", "-m", "initial"]);
  git(seed, ["remote", "add", "origin", "https://github.com/acme/widget-store.git"]);
});
afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});
afterAll(() => fs.rmSync(seed, { recursive: true, force: true }));

describe("worktree cleanup modes", () => {
  it("preserves pending worktrees by default and with explicit preserve mode", () => {
    const context = fixture();
    const target = pending(context, "dirty");
    expect(run(context, []).status).toBe(0);
    const result = run(context, ["--mode=preserve"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("kept 2");
    expect(fs.readFileSync(path.join(target, "untracked.txt"), "utf8")).toBe("do not lose accidentally\n");
  });

  it("purges dirty, detached, locked, and missing linked entries but preserves the primary repository", () => {
    const context = fixture();
    const dirty = pending(context, "dirty");
    const locked = pending(context, "locked");
    git(context.repo, ["worktree", "lock", locked]);
    const detached = path.join(context.root, "detached");
    git(context.repo, ["worktree", "add", "--quiet", "--detach", detached]);
    const missing = pending(context, "missing");
    fs.rmSync(missing, { recursive: true });
    const result = run(context, ["--mode", "purge"]);
    expect(result.status).toBe(0);
    expect(result.prompts).toBe("");
    expect(result.stdout).toContain("removed 4");
    expect(fs.existsSync(dirty)).toBe(false);
    expect(fs.existsSync(locked)).toBe(false);
    expect(fs.existsSync(detached)).toBe(false);
    expect(fs.existsSync(context.repo)).toBe(true);
    expect(
      execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: context.repo, encoding: "utf8" }).match(/^worktree /gm),
    ).toHaveLength(1);
  });

  it.each(["purge", "interactive"])("keeps every pending worktree and never prompts in %s dry-run", (mode) => {
    const context = fixture();
    const target = pending(context, "dirty");
    const result = run(context, ["--mode", mode, "--dry-run"]);
    expect(result.status).toBe(0);
    expect(result.prompts).toBe("");
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.existsSync(context.repo)).toBe(true);
  });

  it("finishes safe cleanup before prompting, then deletes y and keeps the default N", () => {
    const context = fixture();
    const first = pending(context, "a-dirty");
    const second = pending(context, "b-dirty");
    const merged = path.join(context.root, "merged");
    git(context.repo, ["worktree", "add", "--quiet", "-b", "merged", merged]);
    const result = run(context, ["--mode", "interactive"], "y\n\n", () => expect(fs.existsSync(merged)).toBe(false));
    expect(result.status).toBe(0);
    expect(result.prompts).toMatch(/\u{1f333} \[[^\]\n]+\] \ue0b1 a-dirty \ue0b1 /u);
    expect(result.prompts).toContain(
      ` \ue0b1 a-dirty \ue0b1 ${first}\nDelete pending worktree 1 of 2 \u00b7 acme/widget-store \u00b7 ${first}? [all/y/N]: `,
    );
    expect(result.prompts).toContain("pending worktree 2 of 2");
    expect(result.stdout).toMatch(/\u{1f9f9} REMOVED \[[^\]\n]+\] \ue0b1 a-dirty \ue0b1 [^\n]+ \ue0b1 confirmed deletion\n/u);
    expect(result.stdout).toContain("removed 2 \u00b7 kept 2");
    expect(fs.existsSync(first)).toBe(false);
    expect(fs.existsSync(second)).toBe(true);
  });

  it("re-prompts invalid input, then all deletes this and every remaining pending worktree without further prompts", () => {
    const context = fixture();
    const first = pending(context, "a-dirty");
    const second = pending(context, "b-dirty");
    const result = run(context, ["--mode=interactive"], "invalid\nall\n");
    expect(result.status).toBe(0);
    expect(result.prompts.match(/Delete pending worktree/g)).toHaveLength(2);
    expect(result.prompts).not.toContain("pending worktree 2 of 2");
    expect(result.stdout).toContain("removed 2 \u00b7 kept 1");
    expect(fs.existsSync(first)).toBe(false);
    expect(fs.existsSync(second)).toBe(false);
  });

  it("keeps N selections and all remaining worktrees on terminal EOF", () => {
    const context = fixture();
    const first = pending(context, "a-dirty");
    const second = pending(context, "b-dirty");
    const result = run(context, ["--mode", "interactive"], "N\n");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("terminal input closed");
    expect(fs.existsSync(first)).toBe(true);
    expect(fs.existsSync(second)).toBe(true);
  });

  it("defaults Enter to No, accepts CRLF, and rejects oversized confirmation answers", () => {
    const context = fixture();
    const target = pending(context, "dirty");
    const result = run(context, ["--mode=interactive"], `${"a".repeat(33)}\n\r\n`);
    expect(result.status).toBe(0);
    expect(result.prompts).toContain("Enter all, y, or N.");
    expect(fs.existsSync(target)).toBe(true);
    expect(result.stdout).toContain("removed 0");
  });

  it("purges paths with newlines without misreading Git porcelain quoting", () => {
    const context = fixture();
    const old = pending(context, "dirty");
    const target = path.join(context.root, "worktree\nwith-newline");
    git(context.repo, ["worktree", "move", old, target]);
    const result = run(context, ["--mode=purge"]);
    expect(result.status).toBe(0);
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(context.repo)).toBe(true);
  });

  it("keeps all pending entries when no controlling terminal exists", () => {
    const context = fixture();
    const target = pending(context, "dirty");
    const result = run(context, ["--mode", "interactive"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("cannot open controlling terminal");
    expect(fs.existsSync(target)).toBe(true);
  });

  it("revalidates branch identity after the user prompt and refuses a changed target", () => {
    const context = fixture();
    const target = pending(context, "dirty");
    const result = run(context, ["--mode", "interactive"], "y\n", () => git(target, ["symbolic-ref", "HEAD", "refs/heads/changed"]));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("worktree branch changed");
    expect(fs.existsSync(target)).toBe(true);
    expect(result.stdout).toContain("removed 0");
  });

  it("documents every mode and compatibility alias without deleting anything", () => {
    const context = fixture();
    const target = pending(context, "dirty");
    const result = run(context, ["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--mode=preserve");
    expect(result.stdout).toContain("--mode=interactive");
    expect(result.stdout).toContain("--mode=purge");
    expect(result.stdout).toContain("--force, -f");
    expect(fs.existsSync(target)).toBe(true);
  });

  it.each([["--mode"], ["--mode=unknown"], ["--mode=preserve", "--force"], ["--mode", "purge", "--mode", "interactive"]])(
    "rejects invalid or conflicting modes before mutation",
    (...args) => {
      const context = fixture();
      const target = pending(context, "dirty");
      const result = run(context, args);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(fs.existsSync(target)).toBe(true);
      expect(fs.existsSync(context.repo)).toBe(true);
    },
  );
});
