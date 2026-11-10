/** Native log-monitor checks on private tmux servers with isolated shell startup. */
import { describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/** Canonical workspace profile under test. */
const helper = path.resolve("software/scripts/bash-tmux-workspace.profile.bash");
/** Core source supplies the actual fallback alias and plain-output separator configuration. */
const coreProfile = fs.readFileSync("software/bootstrap/profile-core.sh", "utf8");
/** Load the core fallback before the workspace profile, matching assembled startup order. */
const fallbackAlias = coreProfile.match(/^alias tailf=.*$/m)[0];
/** Load the real separator configuration instead of inheriting the caller's environment. */
const separatorConfig = coreProfile.match(/^export LINE_BREAK_COUNT=\d+\n[\s\S]*?^export LINE_BREAK_HASH$/m)[0];
/** Load the real rainbow printer, br, and hr without unrelated profile startup side effects. */
const separatorHelpers = fs
  .readFileSync("software/bootstrap/profile-advanced.sh", "utf8")
  .match(/^_RAINBOW_BLOCK=[\s\S]*?^function hr\(\) \{[\s\S]*?^\}/m)[0];
/** The native hr default prints five ten-character rainbow blocks. */
const terminalSeparator = "#".repeat(50);
/** Plain output uses the shared eighty-character profile divider. */
const plainSeparator = "#".repeat(80);

/**
 * Create a private tmux server and caller with no user profile dependencies.
 * @returns {object} Owned folder, shell invocation, tmux invocation, and pane capture operations.
 * @throws {Error} When the private server cannot start.
 * @sideEffects Creates temporary files and a server; registers cleanup before starting it.
 */
function fixture() {
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "monitor-logs-")));
  const env = {
    ...process.env,
    HOME: folder,
    TMUX_TMPDIR: folder,
    TMUX: "",
    TMUX_PANE: "",
    BASH_ENV: "",
    SY_ROOT_FOLDER: folder,
    TERM: "xterm-256color",
  };
  fs.writeFileSync(
    path.join(folder, ".bashrc"),
    `function is_help_arg() { [ "\${1:-}" = --help ]; }
function is_truthy() { [ "$1" = true ]; }
function prompt_yes_no() { return 1; }
${fallbackAlias}
${separatorConfig}
${separatorHelpers}
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
    run(args, command = 'monitor_logs "$@"') {
      return spawnSync(
        "/bin/bash",
        ["--noprofile", "--norc", "-O", "expand_aliases", "-c", `. "$HOME/.bashrc"\n${command}`, "fixture", ...args],
        {
          cwd: folder,
          env,
          encoding: "utf8",
          timeout: 10000,
        },
      );
    },
    capture(target, color = false) {
      const result = tmux(["capture-pane", "-p", "-J", "-S", "-", ...(color ? ["-e"] : []), "-t", target]);
      if (result.status !== 0) throw new Error(result.stderr);
      return result.stdout.trimEnd();
    },
  };
}

describe("monitor_logs (native tmux integration)", () => {
  it("creates six basename windows with blue headers, rainbow separators, and the last 200 lines", async () => {
    const f = fixture();
    const files = ["sync_backend.abc", "sync_ui.def", "sync_agent.ghi", "sync_proto.jkl", "sync_context.mno", "sync_docs.pqr"];
    for (const name of files) {
      fs.writeFileSync(path.join(f.folder, name), Array.from({ length: 205 }, (_, index) => `line-${index + 1}`).join("\n") + "\n");
    }
    const result = f.run(["--detach", "-session", "logs", ...files]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("'logs' left running detached");
    expect(f.tmux(["list-windows", "-t", "=logs", "-F", "#{window_name}"]).stdout.trim().split("\n")).toMatchInlineSnapshot(`
      [
        "sync_backend.abc",
        "sync_ui.def",
        "sync_agent.ghi",
        "sync_proto.jkl",
        "sync_context.mno",
        "sync_docs.pqr",
      ]
    `);
    const panes = f.tmux(["list-panes", "-s", "-t", "=logs", "-F", "#{pane_id}"]).stdout.trim().split("\n");
    for (const pane of panes) {
      await expect.poll(() => f.capture(pane)).toContain("line-205");
      expect(f.capture(pane)).toMatch(
        /^\/.*\/sync_.*\n#{50}\nShowing the last 200 lines; following new output in the foreground\.\nline-6\n/,
      );
      expect(f.capture(pane)).not.toMatch(/^line-5$/m);
    }
    expect(f.capture(panes[0]).split("\n")[0]).toBe(path.join(f.folder, files[0]));
    expect(f.capture(panes[0], true).split("\n")[0]).toMatch(/\x1b\[[0-9;]*34m/);
    expect(f.capture(panes[0], true)).toMatch(/\x1b\[[0-9;]*91m/);
    expect(f.capture(panes[0], true)).not.toMatch(/\x1b\[(?:[0-9]+;)*(?:4[0-7]|10[0-7])(?:;[0-9]+)*m/);
  });

  it("honors -last and continues displaying appended content", async () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.folder, "app.log"), "old\nsecond\nthird\n");
    const result = f.run(["app.log", "-last", "2", "--session", "custom", "--detach"]);
    expect(result.status).toBe(0);
    await expect
      .poll(() => f.capture("=custom:"))
      .toBe(`${f.folder}/app.log\n${terminalSeparator}\nShowing the last 2 lines; following new output in the foreground.\nsecond\nthird`);
    fs.appendFileSync(path.join(f.folder, "app.log"), "new-content\n");
    await expect
      .poll(() => f.capture("=custom:"), { timeout: 5000 })
      .toBe(
        `${f.folder}/app.log\n${terminalSeparator}\nShowing the last 2 lines; following new output in the foreground.\nsecond\nthird\nnew-content`,
      );
  });

  it("supports tailf, zero initial lines, and the end-of-options marker", async () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.folder, "-dash.log"), "do-not-show\n");
    const result = f.run(["-n", "0", "-session", "zero", "--detach", "--", "-dash.log"], 'tailf "$@"');
    expect(result.status).toBe(0);
    await expect
      .poll(() => f.capture("=zero:"))
      .toBe(`${f.folder}/-dash.log\n${terminalSeparator}\nShowing the last 0 lines; following new output in the foreground.`);
    fs.appendFileSync(path.join(f.folder, "-dash.log"), "only-new\n");
    await expect.poll(() => f.capture("=zero:"), { timeout: 5000 }).toContain("only-new");
    expect(f.capture("=zero:")).not.toContain("do-not-show");
  });

  it("uses stable ordered-file session names and reuses running windows", () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.folder, "one.log"), "one\n");
    fs.writeFileSync(path.join(f.folder, "two.log"), "two\n");
    const first = f.run(["--detach", "one.log", "two.log"]);
    expect(first.status).toBe(0);
    const session = first.stdout.match(/'(tailf_session_[0-9]+)'/)[1];
    const original = f.tmux(["list-panes", "-s", "-t", `=${session}`, "-F", "#{pane_id}"]).stdout;
    const repeated = f.run(["--detach", "--last", "0002", path.join(f.folder, "one.log"), path.join(f.folder, "two.log")]);
    expect(repeated.status).toBe(0);
    expect(repeated.stdout).toContain(`'${session}' left running detached`);
    expect(f.tmux(["list-panes", "-s", "-t", `=${session}`, "-F", "#{pane_id}"]).stdout).toBe(original);
    const reversed = f.run(["--detach", "two.log", "one.log"]);
    expect(reversed.status).toBe(0);
    expect(reversed.stdout.match(/'(tailf_session_[0-9]+)'/)[1]).not.toBe(session);
  });

  it("preserves spaces, quotes, shell metacharacters, backslashes, and Unicode as filename data", async () => {
    const f = fixture();
    const name = "space 'quote';$(touch INJECTED)`touch INJECTED`\\\u96ea.log";
    fs.writeFileSync(path.join(f.folder, name), "safe-content\n");
    const result = f.run(["--detach", "-session", "quoted", name]);
    expect(result.status).toBe(0);
    await expect
      .poll(() => f.capture("=quoted:"))
      .toBe(`${f.folder}/${name}\n${terminalSeparator}\nShowing the last 200 lines; following new output in the foreground.\nsafe-content`);
    // Native tmux doubles backslashes in window names, including without workspace_create.
    expect(f.tmux(["list-windows", "-t", "=quoted", "-F", "#{window_name}"]).stdout.trim()).toBe(
      "space 'quote';$(touch INJECTED)`touch INJECTED`\\\\\u96ea.log",
    );
    expect(fs.existsSync(path.join(f.folder, "INJECTED"))).toBe(false);
  });

  it("prints plain headers when the generated pane command has no terminal", () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.folder, "plain.log"), "plain-content\n");
    const result = f.run(["plain.log"], 'function workspace_create() { command cat; }\nmonitor_logs "$@"');
    expect(result.status).toBe(0);
    const config = JSON.parse(result.stdout);
    const command = config.windows[0].command.replace('command tail -n "$last" -f "$file"', 'command tail -n "$last" "$file"');
    const rendered = f.run([], command);
    expect(rendered.status).toBe(0);
    expect(rendered.stderr).toBe("");
    expect(rendered.stdout).toBe(
      `${f.folder}/plain.log\n${plainSeparator}\nShowing the last 200 lines; following new output in the foreground.\nplain-content\n`,
    );
  });

  it.each([
    [[], "at least one log file"],
    [["-last"], "requires a value"],
    [["-session"], "requires a value"],
    [["-last", "-1", "app.log"], "0-1000000"],
    [["-last", "1000001", "app.log"], "0-1000000"],
    [["-last", "1.5", "app.log"], "0-1000000"],
    [["-last", "", "app.log"], "0-1000000"],
    [["-last", "999999999999999999999999", "app.log"], "0-1000000"],
    [["-session", "bad:name", "app.log"], "session name"],
    [["-session", "bad.name", "app.log"], "session name"],
    [["-session", "", "app.log"], "session name"],
    [["--unknown", "app.log"], "unknown option"],
    [["app.log", "missing.log"], "readable regular file"],
    [["."], "readable regular file"],
    [[""], "readable regular file"],
    [["line\nbreak.log"], "control characters"],
  ])("rejects %j without creating or replacing sessions", (args, diagnostic) => {
    const f = fixture();
    fs.writeFileSync(path.join(f.folder, "app.log"), "unchanged\n");
    const result = f.run(args);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(diagnostic);
    expect(f.tmux(["list-sessions", "-F", "#{session_name}"]).stdout).toBe("sentinel\n");
    expect(fs.readFileSync(path.join(f.folder, "app.log"), "utf8")).toBe("unchanged\n");
  });

  it("accepts the maximum line count and propagates workspace failure", () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.folder, "app.log"), "safe\n");
    const result = f.run(
      ["-last", "1000000", "app.log"],
      'function workspace_create() { command cat >/dev/null; return 42; }\nmonitor_logs "$@"',
    );
    expect(result.status).toBe(42);
    expect(f.tmux(["list-sessions", "-F", "#{session_name}"]).stdout).toBe("sentinel\n");
  });

  it("rebuilds only the explicitly selected session when --force is supplied", async () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.folder, "app.log"), "first\nsecond\n");
    expect(f.run(["--detach", "-session", "rebuild", "app.log"]).status).toBe(0);
    const original = f.tmux(["list-panes", "-t", "=rebuild:", "-F", "#{pane_id}"]).stdout;
    const rebuilt = f.run(["--force", "--detach", "-session", "rebuild", "-last", "1", "app.log"]);
    expect(rebuilt.status).toBe(0);
    expect(rebuilt.stdout).toContain("'rebuild' left running detached");
    expect(f.tmux(["list-panes", "-t", "=rebuild:", "-F", "#{pane_id}"]).stdout).not.toBe(original);
    await expect
      .poll(() => f.capture("=rebuild:"))
      .toBe(`${f.folder}/app.log\n${terminalSeparator}\nShowing the last 1 lines; following new output in the foreground.\nsecond`);
    expect(f.tmux(["has-session", "-t", "=sentinel"]).status).toBe(0);
  });

  it("reports missing dependencies before creating windows", () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.folder, "app.log"), "safe\n");
    const result = f.run(["app.log"], 'PATH=/nonexistent; monitor_logs "$@"');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("workspace: tmux is not installed");
    expect(f.tmux(["list-sessions", "-F", "#{session_name}"]).stdout).toBe("sentinel\n");
  });

  it("prints help without needing files or creating sessions", () => {
    const f = fixture();
    const result = f.run(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: monitor_logs");
    expect(result.stdout).toContain("default: 200");
    expect(result.stdout).toContain("-session");
    expect(f.tmux(["list-sessions", "-F", "#{session_name}"]).stdout).toBe("sentinel\n");
  });
});
