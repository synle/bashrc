/** Unix PTY integration: exercise real node-to-bash transport and the shared terminal prompt. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/** Bounded terminal driver; stdin remains a pipeline while replies enter the controlling PTY. */
const TERMINAL_DRIVER = String.raw`
import errno, json, os, pty, select, signal, subprocess, sys, time
command = ["/bin/bash", "-c", 'set -o pipefail; command cat "$SELECTOR_RUNNER" | "$SELECTOR_NODE" | /bin/bash']
if os.environ.get("SELECTOR_NO_TTY") == "1":
    result = subprocess.run(command, input=b"", stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True, timeout=8)
    print(json.dumps({"status": result.returncode, "output": (result.stdout + result.stderr).decode(errors="replace")}))
    sys.exit(0)
pid, terminal = pty.fork()
if pid == 0:
    os.execvpe(command[0], command, os.environ)
output = b""
replied = False
deadline = time.monotonic() + 8
try:
    while True:
        if time.monotonic() >= deadline:
            raise TimeoutError("terminal interaction exceeded 8 seconds")
        ready, _, _ = select.select([terminal], [], [], 0.1)
        if not ready:
            continue
        try:
            data = os.read(terminal, 65536)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            break
        if not data:
            break
        output += data
        if not replied and b"[Y/n]" in output:
            os.write(terminal, bytes.fromhex(os.environ["SELECTOR_REPLY_HEX"]))
            replied = True
    _, status = os.waitpid(pid, 0)
    pid = None
    print(json.dumps({"status": os.waitstatus_to_exitcode(status), "output": output.decode(errors="replace")}))
finally:
    os.close(terminal)
    if pid is not None:
        os.killpg(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
`;

let folder;
let runner;

beforeAll(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "selector-terminal-"));
  runner = path.join(folder, "runner.cjs");
  const source = fs.readFileSync("software/index.js", "utf8");
  const library = source.slice(0, source.indexOf("\n(async function () {"));
  fs.writeFileSync(
    runner,
    library +
      `
getAllRepoSoftwareFiles = async () => ["software/scripts/alpha.js", "software/scripts/alpine.js", "software/scripts/beta.js"];
readText = async () => fs.readFileSync("software/bootstrap/common-functions.bash", "utf8");
_runScripts = async (files) => {
  for (const file of files) emitBash("printf '%s\\n' " + JSON.stringify("EXECUTED:" + file));
};
_doWorkTestFiles().catch((error) => { log(error.message); process.exitCode = 1; });
`,
  );
});

afterAll(() => {
  if (folder) fs.rmSync(folder, { recursive: true, force: true });
});

/**
 * Run the real confirmation transport in an isolated controlling terminal.
 * @param {string[]} args - Selector arguments.
 * @param {string} reply - Bytes to send after the prompt, including newline or Ctrl-D.
 * @param {object} overrides - Test-specific environment overrides.
 * @returns {{ status: number, output: string }} Actual pipeline exit status and terminal output.
 */
function runTerminal(args, reply = "\n", overrides = {}) {
  const result = spawnSync("python3", ["-c", TERMINAL_DRIVER], {
    encoding: "utf8",
    timeout: 10000,
    env: {
      ...process.env,
      BASH_ENV: "",
      BASHRC_BARE_ARGS: "",
      TEST_SCRIPT_FILES: "",
      NO_COLOR: "0",
      SY_ROOT_FOLDER: folder,
      LLM_ROOT_FOLDER: folder,
      BASHRC_RAW_ARGS: JSON.stringify(args),
      PRESETS_JSON: JSON.stringify({ "pack-alpha": { files: ["alpha.js"] }, "pack-alpine": { files: ["alpine.js"] } }),
      SELECTOR_RUNNER: runner,
      SELECTOR_NODE: process.execPath,
      SELECTOR_REPLY_HEX: Buffer.from(reply).toString("hex"),
      SELECTOR_NO_TTY: "0",
      ...overrides,
    },
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe.skipIf(process.platform === "win32")("selector terminal integration", () => {
  it.each(["alpha", "--file=alpha", "--files=alpha.js", "*pha", "@pack-alpha", "--preset=pack-alpha", "@*alpha"])(
    "runs exact %s without a prompt",
    (arg) => {
      const result = runTerminal([arg]);
      expect(result.status).toBe(0);
      expect(result.output).toContain("EXECUTED:software/scripts/alpha.js");
      expect(result.output).not.toContain("Do you wish to continue");
      expect(result.output).not.toContain("EXECUTED:software/scripts/alpine.js");
    },
  );

  it.each(["al*", "--file=al*", "--files=*l*", "@pack-*", "--preset=*pack*"])("accepts Enter for broad selector %s", (arg) => {
    const result = runTerminal([arg]);
    expect(result.status).toBe(0);
    expect(result.output).toContain("Do you wish to continue");
    expect(result.output).toContain("EXECUTED:software/scripts/alpha.js");
    expect(result.output).toContain("EXECUTED:software/scripts/alpine.js");
    expect(result.output.indexOf("Do you wish to continue")).toBeLessThan(result.output.indexOf("EXECUTED:"));
  });

  it.each(["n\n", "NO\n", "invalid\n", "\x04"])("rejects %j without executing any selected file", (reply) => {
    const result = runTerminal(["--files=al*"], reply);
    expect(result.status).toBe(1);
    expect(result.output).toContain("Selection cancelled: al*");
    expect(result.output).not.toContain("EXECUTED:");
  });

  it("shows bold red file warnings with the complete match list", () => {
    const result = runTerminal(["--files=al*"], "n\n");
    expect(result.output).toContain("\x1b[1;31mWarning: This keyword matches multiple files: al*");
    expect(result.output).toContain("- software/scripts/alpha.js");
    expect(result.output).toContain("- software/scripts/alpine.js");
    expect(result.output).not.toContain("multiple files / presets");
  });

  it("shows preset-specific warnings instead of file warnings", () => {
    const result = runTerminal(["@pack-*"], "n\n");
    expect(result.status).toBe(1);
    expect(result.output).toContain("\x1b[1;31mWarning: This keyword matches multiple presets: pack-*");
    expect(result.output).toContain("- pack-alpha");
    expect(result.output).toContain("- pack-alpine");
    expect(result.output).not.toContain("EXECUTED:");
  });

  it("retains warning text without ANSI when --no-color is present", () => {
    const result = runTerminal(["--no-color", "@pack-*"], "n\n");
    expect(result.status).toBe(1);
    expect(result.output).toContain("Warning: This keyword matches multiple presets");
    expect(result.output).not.toContain("\x1b[");
  });

  it("fails closed without a controlling terminal", () => {
    const result = runTerminal(["@pack-*"], "", { SELECTOR_NO_TTY: "1" });
    expect(result.status).toBe(1);
    expect(result.output).toContain("Selection cancelled");
    expect(result.output).not.toContain("EXECUTED:");
  });

  it.each(["al", "@pack", "#pack-alpha", "--preset=#pack-alpha"])("rejects obsolete or implicit selector %s", (arg) => {
    const result = runTerminal([arg]);
    expect(result.status).toBe(1);
    expect(result.output).not.toContain("EXECUTED:");
  });
});
