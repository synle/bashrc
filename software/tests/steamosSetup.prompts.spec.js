/** Exercise SteamOS startup prompts without allowing installation side effects. */
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Manual setup source; only pre-installation sections execute in this spec. */
const setupSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/steamos/setup.bash"), "utf8");
/** Test-owned homes and executable folders removed after each subprocess test. */
const workspaces = [];

/**
 * Extract a bounded setup section, rejecting missing or reordered markers before execution.
 * @param {string} source Shell source to inspect.
 * @param {string} startMarker First included marker.
 * @param {string} endMarker First excluded marker.
 * @returns {string} Source strictly between the verified boundaries, including the start marker.
 * @throws {Error} If either marker is missing or the end does not follow the start.
 */
function extractSetupSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end <= start) throw new Error("Invalid SteamOS setup fixture boundaries");
  return source.slice(start, end);
}

/** Prompt definition without account validation or installation side effects. */
const promptSource = extractSetupSection(setupSource, "function _prompt()", "# Validate the invoking account");
/** Initial choices and authentication, stopping before the first installer function. */
const choicesSource = extractSetupSection(setupSource, "# Steam must be fully closed", "function _install_flatpak_brave_prerequisite()");

// Cleanup owns only folders created by this spec, including on assertion failure.
afterEach(() => {
  for (const folder of workspaces.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

/**
 * Exercise the real prompt through a controlling terminal without accessing credentials.
 * @param {string} defaultChoice Default passed to the shell prompt.
 * @param {string} reply Terminal input, without its trailing newline.
 * @returns {{status: number, output: string}} Shell status and captured terminal output.
 * @throws {Error} If the bounded Python terminal driver fails.
 */
function runPrompt(defaultChoice, reply) {
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import errno, json, os, pty, select, signal, sys, time
pid, terminal = pty.fork()
if pid == 0:
    os.execv("/bin/bash", ["bash", "-c", sys.argv[1], "bash", sys.argv[2]])
output = b""
sent = False
deadline = time.monotonic() + 3
try:
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0 or not select.select([terminal], [], [], remaining)[0]:
            os.kill(pid, signal.SIGKILL)
            raise RuntimeError("prompt timed out")
        try:
            chunk = os.read(terminal, 4096)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            break
        if not chunk:
            break
        output += chunk
        if not sent and b"Continue?" in output:
            os.write(terminal, (sys.argv[3] + "\\n").encode())
            sent = True
finally:
    os.close(terminal)
    _, status = os.waitpid(pid, 0)
print(json.dumps({"status": os.waitstatus_to_exitcode(status), "output": output.decode().replace("\\r\\n", "\\n")}))
`,
      `${promptSource}\n_prompt "Continue?" "$1"; status=$?; printf '\\nanswer=%s\\n' "$status"; exit "$status"`,
      defaultChoice,
      reply,
    ],
    { encoding: "utf8", timeout: 5000 },
  );
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

/**
 * Execute startup choices in a private home with a fixture-only PATH and inert sudo.
 * @param {number} sudoStatus Exit status returned by the sudo boundary.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured shell result.
 * @throws {Error} If creating the test-owned workspace fails.
 * @description Creates temporary fixture files; afterEach removes them.
 */
function runChoices(sudoStatus) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-prompts-"));
  workspaces.push(folder);
  const binFolder = path.join(folder, "bin");
  fs.mkdirSync(binFolder);
  fs.writeFileSync(path.join(binFolder, "pgrep"), "#!/bin/bash\nexit 1\n", { mode: 0o755 });
  return spawnSync(
    "/bin/bash",
    [
      "-c",
      `function pgrep() { return 1; }
function _prompt() { printf 'choice:%s\\n' "$1"; return 1; }
function sudo() { printf 'sudo:%s\\n' "$*"; return ${sudoStatus}; }
function mkdir() { echo 'folders created'; }
${choicesSource}
echo 'ready for installation'`,
    ],
    {
      encoding: "utf8",
      timeout: 5000,
      cwd: folder,
      env: { HOME: folder, PATH: binFolder, BASH_ENV: "", ENV: "" },
    },
  );
}

describe("SteamOS setup fixture boundaries", () => {
  it("excludes installer code after the ending marker", () => {
    expect(extractSetupSection("before\nstart\necho safe\nend\ncurl installer", "start", "end")).toBe("start\necho safe\n");
  });

  it.each(["end only", "start only", "end before start", ""])('rejects invalid boundaries in "%s"', (source) => {
    expect(() => extractSetupSection(source, "start", "end")).toThrow("Invalid SteamOS setup fixture boundaries");
  });
});

describe("SteamOS startup prompts (subprocess)", () => {
  it.each([
    ["Y", "", 0, "[\u001b[0;31mY\u001b[0m/n]"],
    ["N", "", 1, "[y/\u001b[0;31mN\u001b[0m]"],
    ["y", "no", 1, "[\u001b[0;31mY\u001b[0m/n]"],
    ["n", "YES", 0, "[y/\u001b[0;31mN\u001b[0m]"],
    ["Y", "invalid", 1, "[\u001b[0;31mY\u001b[0m/n]"],
  ])("highlights only default %s and handles reply %j", (defaultChoice, reply, status, hint) => {
    const result = runPrompt(defaultChoice, reply);

    expect(result.status).toBe(status);
    expect(result.output).toContain(`>>> Continue? ${hint} `);
    expect(result.output).not.toContain("\u001b[0;31m>>> Continue?");
    expect(result.output).toContain(`answer=${status}\n`);
  });

  it("validates sudo after every initial choice and before creating application folders", () => {
    const result = runChoices(0);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.split("\n")).toEqual([
      "choice:Clear all user-defined non-Steam shortcuts from the active Steam account?",
      "choice:Install Decky Loader, plugins, and CSS Loader themes?",
      "choice:Run system upgrade (sudo pacman -Syu / paru -Syu)?",
      "choice:Enable wake-up for all supported USB devices (may cause accidental wake-ups)?",
      "sudo:-v",
      "folders created",
      "ready for installation",
      "",
    ]);
  });

  it("aborts before application setup when sudo authentication fails", () => {
    const result = runChoices(1);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SteamOS setup stopped: sudo authentication failed.");
    expect(result.stdout).toContain("sudo:-v\n");
    expect(result.stdout).not.toContain("folders created");
    expect(result.stdout).not.toContain("ready for installation");
  });
});
