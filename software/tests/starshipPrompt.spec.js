/** Native Starship integration tests for prompt field boundaries and optional separators. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { stripVTControlCharacters } from "util";

/** Whether the optional native prompt consumer is installed. @type {boolean} */
const hasStarship = spawnSync("starship", ["--version"], { timeout: 10000 }).status === 0;

/**
 * Render the real configuration in an isolated folder, optionally initialized as a Git repository.
 * @param {object} options Fixture settings.
 * @param {boolean} [options.repository=false] Whether to create a repository with a known branch.
 * @param {string} [options.ip="192.0.2.10,198.51.100.20"] Network field supplied by the shell.
 * @returns {{output: string, lines: string[]}} Colored output and trimmed, unstyled prompt lines.
 * @throws {Error} If fixture setup or the native renderer fails.
 * @sideEffects Creates and removes a temporary folder; runs Git and Starship subprocesses.
 */
function renderPrompt({ repository = false, ip = "192.0.2.10,198.51.100.20" } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "starship-prompt-"));
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    HOME: folder,
    USERPROFILE: folder,
    USER: "prompt-user",
    LOGNAME: "prompt-user",
    TERM: "xterm-256color",
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    STARSHIP_CONFIG: path.resolve("software/scripts/advanced/starship-config.toml"),
    STARSHIP_CACHE: folder,
    STARSHIP_LOG: "warn",
    STARSHIP_LOCAL_TIME: "01:44:08PM",
    STARSHIP_UTC_TIME: "08:44:08PM",
    STARSHIP_IP_ADDR: ip,
    STARSHIP_SHORT_PWD: "~/project",
    STARSHIP_BASH_VER: "5.2",
  };
  try {
    if (repository) {
      const init = spawnSync("git", ["init", "--quiet", "--initial-branch=prompt-test", folder], {
        env,
        encoding: "utf8",
        timeout: 10000,
      });
      expect(init.status, init.stderr).toBe(0);
    }
    const result = spawnSync("starship", ["prompt", "--path", folder, "--terminal-width", "200"], {
      env,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    return {
      output: result.stdout,
      lines: stripVTControlCharacters(result.stdout)
        .split("\n")
        .map((line) => line.trimEnd()),
    };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

describe.skipIf(!hasStarship)("Starship prompt rendering (integration; requires starship)", () => {
  it("separates identity, network, and Git fields while preserving the input line", () => {
    const { lines } = renderPrompt({ repository: true });
    expect(lines[0]).toMatch(/^01:44:08PM U=08:44:08PM \ue0b1 [^\ue0b1]+ \ue0b1 [^\ue0b1]+ \ue0b1 192\.0\.2\.10,198\.51\.100\.20$/);
    expect(lines.slice(1)).toEqual(["~/project \ue0b1 [prompt-test]", "5.2>"]);
  });

  it("uses bright-white separators distinct from the colored information fields", () => {
    const { output } = renderPrompt({ repository: true });
    // Starship can retain active bold styling instead of repeating it in each ANSI sequence.
    expect(output.match(/\x1b\[(?:1;)?97m \ue0b1 /g)).toHaveLength(4);
  });

  it("omits the branch separator outside a Git repository", () => {
    const { lines } = renderPrompt();
    expect(lines[1]).toBe("~/project");
  });

  it("omits the network separator when the IP field is empty", () => {
    const { lines } = renderPrompt({ ip: "" });
    expect(lines[0]).toMatch(/^01:44:08PM U=08:44:08PM \ue0b1 [^\ue0b1]+ \ue0b1 [^\ue0b1]+$/);
  });
});
