/** Behavior tests for Markdown rendering and the cross-platform open wrapper. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WRAPPERS = path.join(ROOT, "software/scripts/bash-command-wrappers.profile.bash");
const PROFILE = path.join(ROOT, "software/bootstrap/profile-advanced.sh");

/** Extract a self-contained profile section for execution with stubbed system apps. */
function section(file, start, end) {
  const source = fs.readFileSync(file, "utf8");
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

const renderer = section(WRAPPERS, "# marked: render markdown", "# html: reverse of marked");
const opener = section(PROFILE, "function open() {", "# SOURCE | software/scripts/bash-window-manager.profile.bash");
let sandbox;

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "markdown-open-"));
  fs.mkdirSync(path.join(sandbox, "bin"));
  fs.writeFileSync(path.join(sandbox, "bin", "open"), '#!/bin/sh\nprintf "%s\\n" "$1" > "$OPEN_CAPTURE"\n', { mode: 0o755 });
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/** Execute the real profile functions while recording the chosen system-app target. */
function run(command, input, fail = false) {
  const capture = path.join(sandbox, "opened");
  const script = `
    function is_help_arg() { [ "\${1:-}" = --help ]; }
    function print_action_summary() { :; }
    function npx() {
      [ "$1" = -y ] || return 2
      shift 4
      [ "$1" = -o ] || return 2
      if [ "$NPX_FAIL" = 1 ]; then return 5; fi
      printf '<h1>rendered</h1>\\n' > "$2"
      if [ "$npm_config_loglevel" != error ]; then
        printf 'npm WARN EBADENGINE\\n' >&2
      fi
    }
    is_os_mac=1
    ${renderer}
    ${opener}
    ${command}
  `;
  const result = spawnSync("/bin/bash", ["-c", script, "bash", input], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${sandbox}/bin:${process.env.PATH}`, OPEN_CAPTURE: capture, NPX_FAIL: fail ? "1" : "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { ...result, opened: fs.existsSync(capture) ? fs.readFileSync(capture, "utf8").trim() : "" };
}

describe("Markdown open", () => {
  it("prints only generated HTML path after rendering", () => {
    const input = path.join(sandbox, "file with spaces.md");
    fs.writeFileSync(input, "# Title\n");
    const result = run('marked "$1"', input);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/^\/tmp\/marked-[^\n]+-file with spaces\.md\.html\n$/);
    expect(fs.readFileSync(result.stdout.trim(), "utf8")).toBe("<h1>rendered</h1>\n");
    fs.rmSync(result.stdout.trim());
  });

  it("opens rendered HTML for a local Markdown file", () => {
    const input = path.join(sandbox, "file.md");
    fs.writeFileSync(input, "# Title\n");
    const result = run('open "$1"', input);
    expect(result.status).toBe(0);
    expect(result.opened).toMatch(/^\/tmp\/marked-[^\n]+-file\.md\.html$/);
    expect(fs.readFileSync(result.opened, "utf8")).toBe("<h1>rendered</h1>\n");
    fs.rmSync(result.opened);
  });

  it("does not open a file when rendering fails", () => {
    const input = path.join(sandbox, "file.md");
    fs.writeFileSync(input, "# Title\n");
    const result = run('open "$1"', input, true);
    expect(result.status).toBe(5);
    expect(result.opened).toBe("");
    expect(result.stderr).toContain("marked: npx exited with 5");
  });

  it("passes HTTP links and other file types straight through", () => {
    const url = run('open "$1"', "https://example.com/readme.md");
    expect(url.opened).toBe("https://example.com/readme.md");
    const input = path.join(sandbox, "file.txt");
    fs.writeFileSync(input, "text\n");
    const file = run('open "$1"', input);
    expect(file.opened).toBe(input);
  });
});
