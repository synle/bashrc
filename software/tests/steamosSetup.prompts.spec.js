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
/** Account preflight and required installation, excluding startup-file edits and optional choices. */
const requiredSource = extractSetupSection(setupSource, "_start_steamos_setup_log || exit 1", "# --- BEGIN - Shell update alias ---");
/** Initial choices, stopping before background installation starts. */
const choicesSource = extractSetupSection(setupSource, "# Steam must be fully closed", "# --- BEGIN - Zed background installation ---");

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
 * Execute early dependencies and startup choices in a private home with inert command boundaries.
 * @param {number} sudoStatus Exit status returned by the sudo boundary.
 * @param {number} [dependencyStatus=0] Exit status returned by required installation.
 * @param {string} [packageCommand="pacman"] Fixture command name; another name simulates missing pacman.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured shell result.
 * @throws {Error} If creating the test-owned workspace fails.
 * @description Creates temporary fixture files; afterEach removes them.
 */
function runChoices(sudoStatus, dependencyStatus = 0, packageCommand = "pacman") {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-prompts-"));
  workspaces.push(folder);
  const binFolder = path.join(folder, "bin");
  fs.mkdirSync(binFolder);
  fs.writeFileSync(path.join(binFolder, "pgrep"), "#!/bin/bash\nexit 1\n", { mode: 0o755 });
  fs.writeFileSync(path.join(binFolder, packageCommand), "#!/bin/bash\nexit 99\n", { mode: 0o755 });
  return spawnSync(
    "/bin/bash",
    [
      "-c",
      `function pgrep() { return 1; }
function _prompt() { printf 'choice:%s\\n' "$1"; [ "$1" = 'Run Flatpak update (flatpak update)?' ] && [ "\${2:-N}" = Y ]; }
function sudo() { printf 'sudo:%s\\n' "$*"; return ${sudoStatus}; }
function mkdir() { echo 'folders created'; }
function _start_steamos_setup_log() { printf '%s\\n' 'account verified'; }
function _run_long_install() { shift; printf 'install:%s\\n' "$*"; return ${dependencyStatus}; }
${requiredSource}
${choicesSource}
printf 'upgrade flags:%s:%s\\n' "$DO_SYSTEM_UPGRADE" "$DO_FLATPAK_UPGRADE"
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
  it("pairs every named setup section with its own end marker", () => {
    const sections = [...setupSource.matchAll(/^# --- BEGIN - (.+) ---\n[\s\S]*?^# --- END - \1 ---$/gm)];
    const markers = [...setupSource.matchAll(/^# --- (?:BEGIN|END) - .+ ---$/gm)];

    expect(sections).toHaveLength(29);
    expect(markers).toHaveLength(58);
    expect(sections.map((section) => section[1])).toMatchInlineSnapshot(`
      [
        "Setup diagnostics",
        "Required system dependencies",
        "Shell update alias",
        "Initial setup choices",
        "Application folders",
        "Legacy AppImage migration",
        "Zed background installation",
        "Brave prerequisite",
        "EmuDeck",
        "SponsorBlock config (vendor-verified export for the YouTube blocker)",
        "Decky Loader + plugins + CSS Loader themes",
        "Steam shortcuts",
        "Ghostty (AppImage)",
        "Moonlight (AppImage)",
        "ProtonUp-Qt (AppImage)",
        "Optional system upgrades",
        "Optional Flatpak updates",
        "Brave and URL shortcuts (Flatpak prerequisite installed at startup)",
        "Browser Extensions + editors (via the synle/bashrc installer)",
        "Remove Kate",
        "Optional AUR upgrades",
        "USB wake-up",
        "Limine bootloader: set menu timeout + quiet boot",
        "Setting up the icons for SteamOS",
        "Backing up the icons for SteamOS",
        "Applications AppImages",
        "KDE favorites and taskbar pins",
        "Switch update files",
        "Done - Final clean up and confirmation",
      ]
    `);
  });

  it("links every yes/no prompt to its named execution section", () => {
    const prompts = setupSource.split("\n").filter((line) => /^\s*(?:if|until)\b.*_prompt\s/.test(line));

    expect(prompts).toHaveLength(7);
    expect(prompts.map((line) => line.match(/# --- prompt - (.+) ---$/)?.[1])).toEqual([
      "Steam shortcuts",
      "Steam shortcuts",
      "Decky Loader + plugins + CSS Loader themes",
      "Optional system upgrades",
      "Optional Flatpak updates",
      "USB wake-up",
      "Done - Final clean up and confirmation",
    ]);
  });

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

  it("installs required tools before optional prompts or application setup", () => {
    const result = runChoices(0);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.split("\n")).toEqual([
      "account verified",
      "sudo:-v",
      ">>> Installing required tools: vim, tmux, fuse2, python-yaml and p7zip",
      "install:sudo pacman -S --needed --noconfirm vim tmux fuse2 python-yaml p7zip",
      "choice:Clear all user-defined non-Steam shortcuts from the active Steam account?",
      "choice:Install Decky Loader, plugins, and CSS Loader themes?",
      "choice:Run system upgrade (sudo pacman -Syu / paru -Syu)?",
      "choice:Run Flatpak update (flatpak update)?",
      "choice:Enable wake-up for all supported USB devices (may cause accidental wake-ups)?",
      "folders created",
      "upgrade flags:0:1",
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
    expect(result.stdout).not.toContain("choice:");
    expect(result.stdout).not.toContain("install:");
  });

  it("stops before prompts when pacman is unavailable", () => {
    const result = runChoices(0, 0, "missing-pacman");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pacman is required to install system tools");
    expect(result.stdout).not.toContain("install:");
    expect(result.stdout).not.toContain("choice:");
    expect(result.stdout).not.toContain("folders created");
  });

  it("stops before prompts or application setup when required installation fails", () => {
    const result = runChoices(0, 17);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("required tool installation failed");
    expect(result.stdout).toContain("install:sudo pacman -S --needed --noconfirm vim tmux fuse2 python-yaml p7zip");
    expect(result.stdout).not.toContain("choice:");
    expect(result.stdout).not.toContain("folders created");
    expect(result.stdout).not.toContain("ready for installation");
  });
});
