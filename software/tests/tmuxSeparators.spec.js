/** Native tmux integration checks for pane, terminal, and menu separators. */
import { describe, it, expect, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { getIndexConstant, getIndexFunction, loadScriptHelpers } from "./setup.js";

/** Whether the optional native configuration consumer is installed. @type {boolean} */
const hasTmux = spawnSync("tmux", ["-V"], { timeout: 10000 }).status === 0;

/**
 * Resolve the real installer template and load only title/menu definitions on a private tmux server.
 * @returns {{run: (args: string[]) => string, config: string, paneFormat: string, titleFormat: string}} Native fixture handles.
 * @throws {Error} If configuration rendering, tmux parsing, or a native command fails.
 * @sideEffects Creates a private server and temporary files, then registers their cleanup after the test.
 */
function openFixture() {
  loadScriptHelpers("software/scripts/advanced/tmux.js");
  const source = getIndexFunction("resolvePlaceholders")(
    fs.readFileSync("software/scripts/advanced/tmux.config", "utf8"),
    getIndexConstant("TMUX_CONFIG"),
  );
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "tmux-separators-"));
  const project = path.join(folder, "project");
  const socket = path.join(folder, "socket");
  const config = path.join(folder, "tmux.conf");
  const formats = path.join(folder, "formats.conf");
  const env = { ...process.env, HOME: folder, TMUX: "", BASH_ENV: "" };
  fs.mkdirSync(project);
  fs.writeFileSync(config, source);
  fs.writeFileSync(
    formats,
    source
      .split("\n")
      .filter((line) =>
        /^(set -g (pane-border-format|set-titles-string) |bind -n (MouseDown3Border|MouseDown3Pane|M-MouseDown3Pane|C-MouseDown3Pane|MouseDown3Status) )/.test(
          line,
        ),
      )
      .join("\n"),
  );

  /**
   * Execute a bounded command against this fixture's server, asserting successful native results.
   * @param {string[]} args tmux command and arguments.
   * @returns {string} Standard output with only its final newline removed.
   * @sideEffects Executes the requested command only on the private fixture socket.
   */
  function run(args) {
    const result = spawnSync("tmux", ["-u", "-S", socket, "-f", os.devNull, ...args], {
      env,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    return result.stdout.trimEnd();
  }

  onTestFinished(() => {
    try {
      run(["kill-server"]);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
  run(["new-session", "-d", "-s", "fixture", "-n", "logs", "-c", project, "/bin/sh"]);
  run(["source-file", "-n", config]);
  run(["source-file", formats]);
  run(["set", "-w", "-t", "fixture:logs", "automatic-rename", "off"]);
  return {
    run,
    config,
    paneFormat: run(["show-options", "-gqv", "pane-border-format"]),
    titleFormat: run(["show-options", "-gqv", "set-titles-string"]),
  };
}

describe.skipIf(!hasTmux)("tmux separators (native integration; requires tmux)", () => {
  it("parses the complete resolved configuration without running plugins", () => {
    const { run, config } = openFixture();
    expect(run(["source-file", "-nv", config])).toContain("pane-border-format");
  });

  it("separates window name, folder, and command in a single-pane title", () => {
    const { run, paneFormat } = openFixture();
    const title = run(["display-message", "-p", "-t", "fixture:logs", "-F", paneFormat]).replace(/#\[[^\]]*\]/g, "");
    expect(title).toContain("logs \ue0b1 project \ue0b1 ");
  });

  it("keeps the pane index before the separator when the window is split", () => {
    const { run, paneFormat } = openFixture();
    run(["split-window", "-d", "-h", "-t", "fixture:logs", "/bin/sh"]);
    const title = run(["display-message", "-p", "-t", "fixture:logs.0", "-F", paneFormat]).replace(/#\[[^\]]*\]/g, "");
    expect(title).toContain(" 0 \ue0b1 project \ue0b1 ");
  });

  it("separates session and window names in the outer terminal title", () => {
    const { run, titleFormat } = openFixture();
    expect(run(["display-message", "-p", "-t", "fixture:logs", "-F", titleFormat])).toBe("fixture \ue0b1 logs");
  });

  it("keeps separators in the native pane and tab menu headings", () => {
    const { run } = openFixture();
    expect(run(["list-keys", "-T", "root", "MouseDown3Border"])).toContain("#S \ue0b1 T#I \ue0b1 pane #{pane_index}");
    expect(run(["list-keys", "-T", "root", "MouseDown3Status"])).toContain("T#I \ue0b1 #W");
  });
});
