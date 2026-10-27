/** Behavioral hyperlink contracts for real shell output and installer diagnostics. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import vm from "vm";
import { getIndexFunction } from "./setup.js";

/** Production shell helper, loaded without the rest of the user's profile. */
const COMMON = fs.readFileSync("software/bootstrap/common-functions.bash", "utf8");
/** Production profile includes the same helper for interactive commands. */
const PROFILE = fs.readFileSync("software/bootstrap/profile-core.sh", "utf8");
/** Standalone renderers share output contracts but deploy without the installer library. */
const GIT_RENDERERS = [
  ["git.pr_list.cjs", "formatLink", "\x1b]8;;https://example.com\x1b\\\x1b[34m\x1b[4mhttps://example.com\x1b[0m\x1b]8;;\x1b\\"],
  ["git.pr_merge.cjs", "formatLink", "\x1b]8;;https://example.com\x1b\\\x1b[0;34mhttps://example.com\x1b[0m\x1b]8;;\x1b\\"],
  ["git.worktree_clean.cjs", "linkify", "\x1b]8;;https://example.com\x1b\\\x1b[34mhttps://example.com\x1b[0m\x1b]8;;\x1b\\"],
];

/** Extract one top-level shell function to exercise its deployed public interface. */
function shellFunction(source, name = "format_hyperlink") {
  return source.match(new RegExp(`^function ${name}\\(\\) \\{[\\s\\S]*?^\\}`, "m"))?.[0] || "";
}
/** Python's standard-library PTY driver works without a controlling input terminal. */
const PTY_DRIVER = `
import errno, os, pty, sys
pid, master = pty.fork()
if pid == 0:
    os.execv("/bin/bash", ["bash", "--noprofile", "--norc", "-c", sys.argv[1]])
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
/** PTY coverage requires Python's standard library on Unix hosts. */
const HAS_PTY = process.platform !== "win32" && spawnSync("python3", ["--version"]).status === 0;
/**
 * Run shell output with deterministic terminal settings through a Unix PTY or captured pipes.
 * @param {string} source - Production shell source containing the selected helper.
 * @param {string} command - Shell invocation to execute.
 * @param {object} [options] - Terminal mode, TERM value, and helper name.
 * @returns {{status: number|null, output: string, error: string}} Captured process result.
 */
function render(source, command, { tty = false, term = "xterm-256color", name = "format_hyperlink" } = {}) {
  const help = COMMON.match(/^function is_help_arg\(\) \{[\s\S]*?^\}/m)[0];
  const script = `${help}\n${shellFunction(source, name)}\n${command}`;
  // Make exports NO_COLOR=0; ripgrep disables hyperlinks whenever that variable exists.
  const env = { ...process.env, BASH_ENV: "/dev/null", TERM: term };
  delete env.NO_COLOR;
  const result = tty
    ? spawnSync("python3", ["-c", PTY_DRIVER, script], {
        encoding: "utf8",
        timeout: 5000,
        env,
      })
    : spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", script], {
        encoding: "utf8",
        timeout: 5000,
        env,
      });
  return { status: result.status, output: result.stdout, error: result.stderr };
}

/**
 * Evaluate a standalone renderer without invoking GitHub or worktree mutation commands.
 * @param {string} file - Standalone production filename.
 * @param {string} name - Renderer function name.
 * @param {boolean} tty - Whether the human output stream supports terminal escapes.
 * @param {string} term - Terminal capability setting.
 * @returns {Function} Production renderer bound to isolated terminal settings.
 */
function gitRenderer(file, name, tty, term) {
  const source = fs.readFileSync(`software/scripts/${file}`, "utf8");
  const ansi = source.match(/^const ANSI = \{[\s\S]*?^\};/m)?.[0] || "";
  const colorize = source.match(/^function colorize\([\s\S]*?^\}/m)?.[0] || "";
  const paint = source.match(/^function paint\([\s\S]*?^\}/m)?.[0] || "";
  const renderer = source.match(new RegExp(`^function ${name}\\([\\s\\S]*?^\\}`, "m"))[0];
  const sandbox = { process: { stderr: { isTTY: tty }, env: { TERM: term } } };
  vm.runInNewContext(`${ansi}\n${colorize}\n${paint}\n${renderer}`, sandbox);
  return sandbox[name];
}

describe.each([
  ["installer", COMMON],
  ["profile", PROFILE],
])("%s shell hyperlinks", (_name, source) => {
  it("rejects a missing URL under nounset without output", () => {
    expect(render(source, "set -u; format_hyperlink")).toEqual({ status: 2, output: "", error: "" });
  });
  it("documents blue output through inline help", () => {
    const result = render(source, "format_hyperlink --help");
    expect(result.status).toBe(0);
    expect(result.output).toContain("print a blue HTTP(S)/file URL");
  });
  it("preserves the complete URL in a pipe", () => {
    expect(render(source, 'format_hyperlink "https://example.com/a?b=1&c=2"')).toEqual({
      status: 0,
      output: "https://example.com/a?b=1&c=2",
      error: "",
    });
  });
  it("preserves the existing explicit-label contract in captured output", () => {
    expect(render(source, 'format_hyperlink "https://example.com" "Docs"')).toEqual({
      status: 0,
      output: "Docs",
      error: "",
    });
  });
  it("rejects unsafe protocols without writing terminal controls", () => {
    expect(render(source, 'format_hyperlink "javascript:alert"')).toEqual({ status: 2, output: "", error: "" });
  });
  it("rejects control bytes in URLs without output", () => {
    expect(render(source, "format_hyperlink $'https://example.com/\\033]52;bad'")).toEqual({ status: 2, output: "", error: "" });
  });
  it("rejects control bytes in labels without output", () => {
    expect(render(source, "format_hyperlink 'https://example.com' $'bad\\nlabel'")).toEqual({ status: 2, output: "", error: "" });
  });
  it.skipIf(!HAS_PTY)("emits blue OSC 8 labels without extra text on a PTY", () => {
    const result = render(source, 'format_hyperlink "https://example.com"', { tty: true });
    expect(result.status, result.error).toBe(0);
    expect(result.output).toBe("\x1b]8;;https://example.com\x1b\\\x1b[34mhttps://example.com\x1b[0m\x1b]8;;\x1b\\");
  });
  it.skipIf(!HAS_PTY)("colors custom labels blue without changing the target", () => {
    const result = render(source, 'format_hyperlink "https://example.com" "Docs"', { tty: true });
    expect(result.status, result.error).toBe(0);
    expect(result.output).toBe("\x1b]8;;https://example.com\x1b\\\x1b[34mDocs\x1b[0m\x1b]8;;\x1b\\");
  });
  it.skipIf(!HAS_PTY)("falls back to plain output on a dumb terminal", () => {
    const result = render(source, 'format_hyperlink "https://example.com"', { tty: true, term: "dumb" });
    expect(result.status, result.error).toBe(0);
    expect(result.output).toBe("https://example.com");
  });
  it.skipIf(!HAS_PTY)("does not mistake terminal stderr for captured stdout", () => {
    const result = render(source, 'value=$(format_hyperlink "https://example.com"); printf "%s" "$value"', { tty: true });
    expect(result.status, result.error).toBe(0);
    expect(result.output).toBe("https://example.com");
  });
});

describe("shell helper parity", () => {
  it("keeps interactive and installer output behavior identical", () => {
    expect(shellFunction(PROFILE)).toBe(shellFunction(COMMON));
  });
});

describe("search tool hyperlink shortcuts", () => {
  it.each([
    ["rg_link", "rg"],
    ["fd_link", "fd"],
  ])("%s documents native search behavior without running a search", (name) => {
    const result = render(PROFILE, `${name} --help`, { name });
    expect(result.status, result.error).toBe(0);
    expect(result.output).toContain("Pipes and older binaries stay plain");
  });
  it.skipIf(!HAS_PTY || spawnSync("rg", ["--version"]).status !== 0)("ripgrep emits real file links on a PTY", () => {
    const result = render(PROFILE, "rg_link --files DEV.md", { name: "rg_link", tty: true });
    expect(result.status, result.error).toBe(0);
    expect(result.output).not.toContain("clickable");
    expect(result.output).toContain("\x1b]8;;file://");
    expect(result.output).toContain("/DEV.md\x1b\\");
  });
  it.skipIf(spawnSync("rg", ["--version"]).status !== 0)("ripgrep pipes remain plain", () => {
    expect(render(PROFILE, "rg_link --files DEV.md", { name: "rg_link" })).toEqual({ status: 0, output: "DEV.md\n", error: "" });
  });
  it.skipIf(!HAS_PTY || spawnSync("fd", ["--version"]).status !== 0)("fd emits real file links on a PTY", () => {
    const result = render(PROFILE, "fd_link '^DEV[.]md$' --max-depth 1", { name: "fd_link", tty: true });
    expect(result.status, result.error).toBe(0);
    expect(result.output).not.toContain("clickable");
    expect(result.output).toContain("\x1b]8;;file://");
    expect(result.output).toContain("/DEV.md\x1b\\");
  });
});

describe.each(GIT_RENDERERS)("%s terminal URL rendering", (file, name, expected) => {
  it("prints blue OSC 8 labels with no suffix hint", () => {
    expect(gitRenderer(file, name, true, "xterm")("https://example.com", true)).toBe(expected);
  });
  it.each([
    [false, "xterm"],
    [true, "dumb"],
    [true, ""],
  ])("retains plain URLs with tty=%s and TERM=%s", (tty, term) => {
    expect(gitRenderer(file, name, tty, term)("https://example.com", tty)).toBe("https://example.com");
  });
});

describe("installer diagnostic links", () => {
  it.each([
    ["https://example.com", false, "xterm", "https://example.com"],
    ["https://example.com", true, "dumb", "https://example.com"],
    ["no links", true, "xterm", "no links"],
    ["", true, "xterm", ""],
    ["https://example.com", true, "", "https://example.com"],
    ["(https://example.com)", true, "xterm", "(\x1b]8;;https://example.com\x1b\\\x1b[34mhttps://example.com\x1b[0m\x1b]8;;\x1b\\)"],
    [
      "https://example.com/a_(b)",
      true,
      "xterm",
      "\x1b]8;;https://example.com/a_(b)\x1b\\\x1b[34mhttps://example.com/a_(b)\x1b[0m\x1b]8;;\x1b\\",
    ],
    [
      "See https://example.com, now",
      true,
      "xterm",
      "See \x1b]8;;https://example.com\x1b\\\x1b[34mhttps://example.com\x1b[0m\x1b]8;;\x1b\\, now",
    ],
    ["file:///tmp/a%20b", true, "xterm", "\x1b]8;;file:///tmp/a%20b\x1b\\\x1b[34mfile:///tmp/a%20b\x1b[0m\x1b]8;;\x1b\\"],
    ["\x1b]8;;https://example.com\x1b\\Docs\x1b]8;;\x1b\\", true, "xterm", "\x1b]8;;https://example.com\x1b\\Docs\x1b]8;;\x1b\\"],
  ])("formats %j with tty=%s and TERM=%s", (input, tty, term, expected) => {
    expect(getIndexFunction("formatTerminalLinks")(input, tty, term)).toBe(expected);
  });
  it("keeps diagnostic OSC 8 links but omits ANSI color when NO_COLOR is set", () => {
    const source = fs.readFileSync("software/index.js", "utf8");
    const color = source.match(/^function color\([\s\S]*?^\}/m)[0];
    const renderer = source.match(/^function formatTerminalLinks\([\s\S]*?^\}/m)[0];
    const sandbox = { IS_NO_COLOR: true };
    vm.runInNewContext(`${color}\n${renderer}`, sandbox);
    expect(sandbox.formatTerminalLinks("https://example.com", true, "xterm")).toBe(
      "\x1b]8;;https://example.com\x1b\\https://example.com\x1b]8;;\x1b\\",
    );
  });
  it("links log stderr without contaminating generated stdout", () => {
    const source = fs.readFileSync("software/index.js", "utf8");
    const messages = [];
    const sandbox = {
      _applyAutoColor: (data) => data,
      formatTerminalLinks: (value) => getIndexFunction("formatTerminalLinks")(value, true, "xterm"),
      console: { error: (...args) => messages.push(args) },
    };
    vm.runInNewContext(source.match(/^function log\([\s\S]*?^\}/m)[0], sandbox);
    sandbox.log("See", "https://example.com");
    expect(messages).toEqual([["See", "\x1b]8;;https://example.com\x1b\\\x1b[34mhttps://example.com\x1b[0m\x1b]8;;\x1b\\"]]);
  });
});
