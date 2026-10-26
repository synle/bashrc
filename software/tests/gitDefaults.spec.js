/** Real-Git integration contracts for generated layouts, shell defaults, and staging aliases. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { execFileSync, spawnSync } from "child_process";
import { getIndexFunction } from "./setup.js";

/** Each test owns an isolated repository and rendered Git configuration. */
let folder;
/** Wrapper section includes the production function and its shell aliases. */
const WRAPPER = fs
  .readFileSync(process.env.GIT_WRAPPER_PROFILE || "software/bootstrap/profile-advanced.sh", "utf8")
  .split("# --- Aliases: Git ---\n")[1]
  .split("# --- Aliases: Editors ---")[0];

/** Native pager integration needs Delta and Python's Unix PTY support. */
const HAS_DELTA_PTY =
  process.platform !== "win32" && spawnSync("delta", ["--version"]).status === 0 && spawnSync("python3", ["--version"]).status === 0;
/** Capture terminal output without an interactive pager or terminal color query. */
const PAGER_PTY = `
import errno, os, pty, sys
pid, master = pty.fork()
if pid == 0:
    os.execvp("git", ["git", "-c", "core.pager=delta", "-c", "delta.detect-dark-light=never", *sys.argv[1:]])
try:
    while True:
        try:
            data = os.read(master, 65536)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            break
        if not data:
            break
        os.write(1, data)
finally:
    os.close(master)
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
`;

/** Execute real Git in the fixture; return stdout or throw on failure. */
function git(...args) {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, GIT_CONFIG_GLOBAL: path.join(folder, ".git/test.config"), GIT_CONFIG_NOSYSTEM: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** Run the production shell wrapper with literal positional arguments; return process status and output. */
function shell(...args) {
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", WRAPPER + '\ngit "$@"', "test", ...args], {
    cwd: folder,
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, BASH_ENV: "/dev/null", GIT_CONFIG_GLOBAL: path.join(folder, ".git/test.config"), GIT_CONFIG_NOSYSTEM: "1" },
  });
}

beforeEach(async () => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "git-defaults-"));
  git("init", "-q");
  const sandbox = {
    REPO_OWNER: "acme",
    readText: async () => fs.readFileSync("software/scripts/git.gitconfig", "utf8"),
    appendTextBlock: getIndexFunction("appendTextBlock"),
    log: (...args) => {
      throw new Error(args.join(" "));
    },
  };
  vm.runInNewContext(fs.readFileSync(process.env.GIT_CONFIG_SCRIPT || "software/scripts/git.js", "utf8"), sandbox);
  const config = await sandbox._getGitConfig({ email: "email = dev@example.invalid" });
  fs.writeFileSync(path.join(folder, ".git/test.config"), config);
  git("config", "core.fsmonitor", "false");
  git("config", "core.hooksPath", ".git/hooks");
  git("config", "commit.gpgsign", "false");
  git("config", "maintenance.auto", "false");
  fs.writeFileSync(path.join(folder, "note.txt"), "old line\n");
  fs.writeFileSync(path.join(folder, ".gitignore"), "ignored.txt\n");
  git("add", "note.txt", ".gitignore");
  git("commit", "-qm", "Base");
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("Git defaults integration", () => {
  it("stashes tracked and untracked files but leaves ignored files alone", () => {
    fs.writeFileSync(path.join(folder, "note.txt"), "changed\n");
    fs.writeFileSync(path.join(folder, "new file.txt"), "new\n");
    fs.writeFileSync(path.join(folder, "ignored.txt"), "ignored\n");
    const result = shell("stash");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Saved working directory");
    expect(git("status", "--porcelain")).toBe("");
    expect(fs.readFileSync(path.join(folder, "ignored.txt"), "utf8")).toBe("ignored\n");
    expect(git("show", "stash^3:new file.txt")).toBe("new");
    const restored = shell("stash", "pop");
    expect(restored.status, restored.stderr).toBe(0);
    expect(fs.readFileSync(path.join(folder, "new file.txt"), "utf8")).toBe("new\n");
  });

  it("leaves explicit stash push behavior unchanged", () => {
    fs.writeFileSync(path.join(folder, "note.txt"), "changed\n");
    fs.writeFileSync(path.join(folder, "new.txt"), "new\n");
    const result = shell("stash", "push", "-m", "explicit save");
    expect(result.status, result.stderr).toBe(0);
    expect(git("status", "--porcelain")).toBe("?? new.txt");
    expect(git("stash", "list")).toContain("explicit save");
  });

  it.each([[[]], [["--no-pager"]], [["-c", "delta.side-by-side=true"]], [["-C", "."]]])(
    "ignores whitespace through the wrapper with global arguments %j",
    (prefix) => {
      fs.writeFileSync(path.join(folder, "note.txt"), "old    line\n");
      const result = shell(...prefix, "diff", "--exit-code", "--", "note.txt");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe("");
    },
  );

  it("keeps substantive changes and diff exit status", () => {
    fs.writeFileSync(path.join(folder, "note.txt"), "new line\n");
    const result = shell("diff", "--exit-code");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("+new line");
  });

  it.each(["d", "dh", "ds", "dhs", "s"])('ignores whitespace in the generated "%s" alias', (alias) => {
    fs.writeFileSync(path.join(folder, "note.txt"), "old   line\n");
    git("add", "note.txt");
    git("commit", "-qm", "Whitespace");
    expect(git(alias)).not.toContain("note.txt");
  });

  it("renders editor links and portable diff styling in the generated config", () => {
    expect(git("config", "--get-regexp", "^delta\\.").split("\n")).toMatchInlineSnapshot(`
      [
        "delta.navigate true",
        "delta.side-by-side false",
        "delta.line-numbers true",
        "delta.hyperlinks true",
        "delta.hyperlinks-file-link-format vscode://file/{path}:{line}",
        "delta.true-color auto",
        "delta.features decorations",
        "delta.syntax-theme ansi",
        "delta.plus-style syntax auto",
        "delta.minus-style syntax auto",
        "delta.decorations.commit-decoration-style bold yellow box ul",
        "delta.decorations.file-style bold yellow ul",
        "delta.decorations.file-decoration-style none",
        "delta.decorations.hunk-header-decoration-style cyan box ul",
        "delta.line-numbers.line-numbers-left-style cyan",
        "delta.line-numbers.line-numbers-right-style cyan",
        "delta.line-numbers.line-numbers-minus-style red",
        "delta.line-numbers.line-numbers-plus-style green",
      ]
    `);
  });

  it("defaults to one column and preserves explicit one-column compatibility", () => {
    expect(git("config", "--get", "delta.side-by-side")).toBe("false");
    expect(git("config", "--get", "alias.show1")).toContain("delta.side-by-side=false");
  });

  it.each(["d", "dh", "ds", "d1", "dh1", "ds1", "d2", "dh2", "ds2", "d12", "dh12", "ds12"])(
    'feeds unified patch lines to Delta through "%s"',
    (alias) => {
      fs.writeFileSync(path.join(folder, "note.txt"), "committed line\n");
      git("commit", "-qam", "Changed");
      fs.writeFileSync(path.join(folder, "note.txt"), "new line\n");
      git("add", "note.txt");
      fs.writeFileSync(path.join(folder, "note.txt"), "working line\n");
      const output = git(alias);
      expect(output).toMatch(/^-.*line$/m);
      expect(output).toMatch(/^\+.*line$/m);
      expect(output).not.toContain("[-");
      expect(output).not.toContain("{+");
    },
  );

  it.each(["d2", "dh2", "ds2", "show2", "ls2", "l2", "s2", "d12", "show12"])('propagates two-column layout through "%s"', (alias) => {
    fs.writeFileSync(path.join(folder, ".git/layout.sh"), "#!/bin/sh\ngit config --get delta.side-by-side\n", { mode: 0o755 });
    git("config", "diff.external", "./.git/layout.sh");
    git("config", "core.pager", "cat");
    fs.writeFileSync(path.join(folder, "note.txt"), "committed change\n");
    git("commit", "-qam", "Changed");
    fs.writeFileSync(path.join(folder, "note.txt"), "staged change\n");
    git("add", "note.txt");
    fs.writeFileSync(path.join(folder, "note.txt"), "unstaged change\n");
    const result = shell(alias, "-p", "--ext-diff");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("true\n");
    expect(result.stdout).not.toContain("false\n");
  });

  it
    .skipIf(!HAS_DELTA_PTY)
    .each(["diff", "show", "log", "d", "dh", "ds", "d1", "dh1", "ds1", "d2", "dh2", "ds2", "show1", "show2", "ls", "lls", "l", "ll"])(
    'renders "%s" through the real global Delta pager on a terminal',
    (alias) => {
      fs.writeFileSync(path.join(folder, "note.txt"), "committed line\n");
      git("commit", "-qam", "Changed");
      fs.writeFileSync(path.join(folder, "note.txt"), "staged line\n");
      git("add", "note.txt");
      fs.writeFileSync(path.join(folder, "note.txt"), "working line\n");
      const env = {
        ...process.env,
        BASH_ENV: "/dev/null",
        TERM: "xterm-256color",
        DELTA_PAGER: "cat",
        GIT_CONFIG_GLOBAL: path.join(folder, ".git/test.config"),
        GIT_CONFIG_NOSYSTEM: "1",
      };
      delete env.GIT_PAGER;
      const result = spawnSync("python3", ["-c", PAGER_PTY, alias, "-p"], { cwd: folder, env, encoding: "utf8", timeout: 5000 });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("note.txt");
      expect(result.stdout).toContain("\u2502");
      expect(result.stdout).not.toContain("[-");
      expect(result.stdout).not.toContain("{+");
    },
  );

  it("preserves numbered rebase and patch aliases without duplicate keys", () => {
    const names = git("config", "--get-regexp", "^alias\\.")
      .split("\n")
      .map((line) => line.split(" ")[0]);
    expect(new Set(names).size).toBe(names.length);
    expect(git("config", "--get", "alias.r2")).toBe("!git rn 2");
    expect(git("config", "--get", "alias.patch-view2")).toBe("!git patch-view 2");
  });

  it.each([
    ["aac", true],
    ["auc", false],
  ])("%s forwards commit arguments, skips hooks, and stages the intended files", (alias, includesNew) => {
    fs.writeFileSync(path.join(folder, "note.txt"), "changed\n");
    fs.writeFileSync(path.join(folder, "new file.txt"), "new\n");
    fs.writeFileSync(path.join(folder, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const result = shell(alias, "-m", "Message with spaces");
    expect(result.status, result.stderr).toBe(0);
    expect(git("log", "-1", "--format=%s")).toBe("Message with spaces");
    expect(git("ls-tree", "--name-only", "HEAD").includes("new file.txt")).toBe(includesNew);
  });

  it("does not introduce a redundant aau alias", () => {
    const result = shell("config", "--get", "alias.aau");
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });
});
