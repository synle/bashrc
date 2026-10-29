/** Native workspace lifecycle checks on private tmux servers with isolated shell startup. */
import { describe, it, expect, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/** Canonical helper loaded by both the caller and each interactive child. @type {string} */
const helper = path.resolve("software/scripts/bash-tmux-workspace.profile.bash");

/**
 * Create a private native server and shell profile without loading the user's configuration.
 * @returns {{folder: string, create: (config: object) => object, tmux: (args: string[]) => object, exists: () => boolean}} Fixture operations.
 * @throws {Error} When the private server cannot start.
 * @sideEffects Creates temporary files and a server; registers cleanup before starting it.
 */
function fixture() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-lifecycle-"));
  const env = { ...process.env, HOME: folder, TMUX_TMPDIR: folder, TMUX: "", TMUX_PANE: "", BASH_ENV: "", SY_ROOT_FOLDER: folder };
  fs.writeFileSync(
    path.join(folder, ".bashrc"),
    `function is_help_arg() { [ "\${1:-}" = --help ]; }
function is_truthy() { [ "$1" = true ]; }
function prompt_yes_no() { return 1; }
. '${helper}'
`,
  );
  const tmux = (args) => spawnSync("tmux", args, { env, encoding: "utf8", timeout: 5000 });
  onTestFinished(() => {
    tmux(["kill-server"]);
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const started = tmux(["-f", "/dev/null", "new-session", "-d", "-s", "sentinel"]);
  if (started.status !== 0) throw new Error(started.stderr);
  return {
    folder,
    tmux,
    exists: () => tmux(["has-session", "-t", "=test"]).status === 0,
    create(config) {
      const configFile = path.join(folder, "workspace.json");
      fs.writeFileSync(configFile, JSON.stringify({ session: "test", ...config }));
      return spawnSync(
        "/bin/bash",
        ["--noprofile", "--norc", "-c", '. "$HOME/.bashrc"; workspace_create "$1" --detach', "fixture", configFile],
        {
          env,
          encoding: "utf8",
          timeout: 10000,
        },
      );
    },
  };
}

describe("workspace close-on-success (native tmux integration)", () => {
  it("keeps the existing shell-open default after success", async () => {
    const f = fixture();
    const result = f.create({ start_directory: f.folder, windows: [{ name: "default", command: "printf done > default.done" }] });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("left running detached");
    await expect.poll(() => fs.existsSync(path.join(f.folder, "default.done"))).toBe(true);
    expect(fs.readFileSync(path.join(f.folder, "default.done"), "utf8")).toBe("done");
    expect(f.exists()).toBe(true);
  });

  it("closes a successful opted-in window while leaving another window untouched", async () => {
    const f = fixture();
    const result = f.create({
      start_directory: f.folder,
      windows: [
        { name: "sync", command: "printf done > sync.done", close_on_success: true },
        { name: "review", command: "tmux wait-for review-ready; printf ready > review.done" },
      ],
    });
    expect(result.status).toBe(0);
    await expect.poll(() => f.tmux(["list-windows", "-t", "=test", "-F", "#{window_name}"]).stdout.trim()).toBe("review");
    expect(fs.readFileSync(path.join(f.folder, "sync.done"), "utf8")).toBe("done");
    // Window presence is not command completion; hold the retained job until this assertion proves the distinction.
    expect(fs.existsSync(path.join(f.folder, "review.done"))).toBe(false);
    expect(f.tmux(["wait-for", "-S", "review-ready"]).status).toBe(0);
    await expect.poll(() => fs.existsSync(path.join(f.folder, "review.done"))).toBe(true);
    expect(fs.readFileSync(path.join(f.folder, "review.done"), "utf8")).toBe("ready");
  });

  it("keeps a failed command's output and exact exit status", async () => {
    const f = fixture();
    const result = f.create({ windows: [{ name: "failed", command: "printf 'specific failure\\n'; exit 42", close_on_success: true }] });
    expect(result.status).toBe(0);
    await expect.poll(() => f.tmux(["show-options", "-pqv", "-t", "=test:", "@workspace_exit_status"]).stdout.trim()).toBe("42");
    const pane = f.tmux(["capture-pane", "-p", "-t", "=test:"]);
    expect(pane.status).toBe(0);
    expect(pane.stdout).toContain("specific failure");
    expect(pane.stdout).toContain("exit status 42");
    expect(f.exists()).toBe(true);
  });

  it("preserves command failure across sleep_after", async () => {
    const f = fixture();
    const result = f.create({ windows: [{ name: "delayed", command: "false", sleep_after: 1, close_on_success: true }] });
    expect(result.status).toBe(0);
    await expect
      .poll(() => f.tmux(["show-options", "-pqv", "-t", "=test:", "@workspace_exit_status"]).stdout.trim(), { timeout: 4000 })
      .toBe("1");
    expect(f.exists()).toBe(true);
  });

  it("builds every fast-closing window before allowing commands to exit", async () => {
    const f = fixture();
    const result = f.create({
      start_directory: f.folder,
      close_on_success: true,
      windows: [
        { name: "one", command: "printf one > one.done" },
        { name: "two", command: "printf two > two.done" },
        { name: "three", command: "printf three > three.done" },
        { name: "four", command: "printf four > four.done" },
      ],
    });
    expect(result.status).toBe(0);
    await expect.poll(f.exists).toBe(false);
    expect(fs.readFileSync(path.join(f.folder, "one.done"), "utf8")).toBe("one");
    expect(fs.readFileSync(path.join(f.folder, "two.done"), "utf8")).toBe("two");
    expect(fs.readFileSync(path.join(f.folder, "three.done"), "utf8")).toBe("three");
    expect(fs.readFileSync(path.join(f.folder, "four.done"), "utf8")).toBe("four");
    expect(f.tmux(["has-session", "-t", "=sentinel"]).status).toBe(0);
  });

  it("honors a pane's explicit false override and preserves quoted command text", async () => {
    const f = fixture();
    const result = f.create({
      close_on_success: true,
      start_directory: f.folder,
      windows: [
        {
          name: "split",
          layout: "even-horizontal",
          panes: [{ command: "printf '%s' \"it's safe\" > quoted.done" }, { command: "printf kept > kept.done", close_on_success: false }],
        },
      ],
    });
    expect(result.status).toBe(0);
    await expect.poll(() => f.tmux(["list-panes", "-t", "=test:", "-F", "#{pane_id}"]).stdout.trim().split("\n").length).toBe(1);
    expect(fs.readFileSync(path.join(f.folder, "quoted.done"), "utf8")).toBe("it's safe");
    await expect.poll(() => fs.existsSync(path.join(f.folder, "kept.done"))).toBe(true);
    expect(fs.readFileSync(path.join(f.folder, "kept.done"), "utf8")).toBe("kept");
  });

  it.each(["true", 1, null])("rejects non-boolean close_on_success=%s before starting jobs", (value) => {
    const f = fixture();
    const result = f.create({
      close_on_success: value,
      start_directory: f.folder,
      windows: [{ name: "invalid", command: "touch should-not-exist" }],
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("close_on_success must be a boolean");
    expect(f.exists()).toBe(false);
    expect(fs.existsSync(path.join(f.folder, "should-not-exist"))).toBe(false);
  });
});
