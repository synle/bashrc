/** Subprocess contracts for bounded nearby-folder matching and terminal selection. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { getIndexConstant } from "./setup.js";

/** Production navigation loaded twice to verify repeatable profile initialization. */
const NAVIGATION = readFileSync("software/bootstrap/profile-advanced.sh", "utf8")
  .split("# --- Aliases: Navigation ---\n")[1]
  .split("# --- find (fd wrapper) ---")[0];
/** Production summary and help dependencies, without unrelated startup side effects. */
const CORE = readFileSync("software/bootstrap/profile-core.sh", "utf8");
/** Shared ignore registry consumed by the installed fuzzy picker. */
const PATTERNS = JSON.stringify(getIndexConstant("EDITOR_CONFIGS").ignoredFoldersRegex);
/** Real controlling terminal; reply only after the actual selection prompt appears. */
const TERMINAL = String.raw`
import errno, json, os, pty, select, signal, sys, time
pid, terminal = pty.fork()
if pid == 0:
    os.execv("/bin/bash", ["bash", "--noprofile", "--norc", "-c", sys.argv[1], "test", sys.argv[2]])
output = b""
replied = False
deadline = time.monotonic() + 6
try:
    while True:
        if time.monotonic() >= deadline:
            raise TimeoutError("navigation terminal exceeded 6 seconds")
        if not select.select([terminal], [], [], 0.1)[0]:
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
        if not replied and b"full path" in output:
            os.write(terminal, bytes.fromhex(os.environ["CD_REPLY"]))
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

/**
 * Run public cd against private filesystem fixtures, optionally through a real PTY.
 * @param {string[]} folders Folder names relative to the owned fixture root.
 * @param {string} query Argument supplied literally to cd.
 * @param {object} [options={}] Terminal reply, setup commands, environment, and caller operation.
 * @returns {{status: number, output: string, elapsed: number}} Actual status, normalized output, and duration in milliseconds.
 * @throws {Error} On fixture or terminal-driver failure; always removes the owned fixture.
 */
function navigate(folders, query, options = {}) {
  const folder = mkdtempSync(path.join(os.tmpdir(), "fuzzy-cd-"));
  try {
    folders.forEach((name) => mkdirSync(path.join(folder, name), { recursive: true }));
    writeFileSync(path.join(folder, "regular-file"), "not a folder\n");
    symlinkSync(os.tmpdir(), path.join(folder, "outside-link"));
    writeFileSync(path.join(folder, "blocked.cjs"), 'require("fs").promises.readdir = () => new Promise(() => {});\n');
    const helpers = ["is_help_arg", "to_windows_path", "print_action_summary"]
      .map((name) => CORE.match(new RegExp(`^function ${name}\\(\\) \\{[\\s\\S]*?^\\}`, "m"))[0])
      .join("\n");
    writeFileSync(path.join(folder, "navigation.bash"), `${helpers}\n${NAVIGATION}`);
    const script = `START_FOLDER="$PWD"
. ./navigation.bash
. ./navigation.bash
${options.before || ""}
${options.invocation || 'if cd "$1"; then status=0; else status=$?; fi\nprintf "RESULT:%s\\n" "${PWD#"$START_FOLDER"}"; exit "$status"'}`;
    const env = {
      ...process.env,
      BASH_ENV: "/dev/null",
      HOME: folder,
      PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
      TERM: "dumb",
      CDPATH: "",
      NODE_OPTIONS: "",
      _IGNORED_FOLDERS_JSON: PATTERNS,
      CD_REPLY: Buffer.from((options.reply || "").replaceAll("<ROOT>", folder)).toString("hex"),
      ...options.env,
    };
    const start = performance.now();
    const result = options.tty
      ? spawnSync("/usr/bin/python3", ["-c", TERMINAL, script, query], { cwd: folder, env, encoding: "utf8", timeout: 8000 })
      : spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", script, "test", query], {
          cwd: folder,
          env,
          encoding: "utf8",
          timeout: 5000,
          input: "PIPE_UNTOUCHED\n",
        });
    const elapsed = performance.now() - start;
    expect(result.error).toBeUndefined();
    if (options.tty) {
      expect(result.status, result.stderr).toBe(0);
      const terminal = JSON.parse(result.stdout);
      return {
        status: terminal.status,
        output: terminal.output.replaceAll(realpathSync(folder), "<ROOT>").replaceAll(folder, "<ROOT>").replaceAll("\r", ""),
        elapsed,
      };
    }
    return {
      status: result.status,
      output: (result.stdout + result.stderr).replaceAll(realpathSync(folder), "<ROOT>").replaceAll(folder, "<ROOT>"),
      elapsed,
    };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe("fuzzy cd subprocess", () => {
  it("keeps an exact path ahead of every partial match without launching Node", () => {
    const result = navigate(["hooks", "hooks-long"], "hooks", { before: 'export NODE_OPTIONS="--require=$PWD/missing.cjs"' });
    expect(result.status).toBe(0);
    expect(result.output).toBe("RESULT:/hooks\n");
  });

  it.each([
    [["git/hooks"], "./git/hook", "/git/hooks"],
    [["projects/repository"], "repos", "/projects/repository"],
    [["a/b/target-folder"], "target", "/a/b/target-folder"],
    [["shallow-target", "a/target"], "target", "/shallow-target"],
    [["git/hooks"], "gi/hoo", "/git/hooks"],
    [["folder with spaces"], "with spaces", "/folder with spaces"],
    [["quote'folder"], "quote'", "/quote'folder"],
    [["literal[folder"], "literal[", "/literal[folder"],
    [["line\nbreak-folder"], "break-folder", "/line\nbreak-folder"],
    [["caf\u00e9-folder"], "caf\u00e9", "/caf\u00e9-folder"],
  ])("enters a unique folder from %j matching %j", (folders, query, expected) => {
    const result = navigate(folders, query);
    expect(result.status).toBe(0);
    expect(result.output).toContain(`RESULT:${expected}\n`);
    expect(result.output).toContain('cd "<ROOT>');
  });

  it.each([
    [["a/b/c/too-deep"], "too-deep"],
    [["node_modules/cache-target"], "cache-target"],
    [[".cache/cache-target"], "cache-target"],
    [["node_modules"], "node_mod"],
    [[".git/hooks"], ".gi/hook"],
    [["regular-file-folder"], "regular-file"],
    [["outside-link-folder"], "outside-link/missing"],
    [["projects"], "projects/../miss"],
    [["projects"], "/missing-absolute"],
  ])("rejects %j matching %j without changing folders", (folders, query) => {
    const result = navigate(folders, query);
    expect(result.status).toBe(1);
    expect(result.output).toContain("RESULT:\n");
    expect(result.output).not.toContain('cd "');
  });

  it("preserves Bash's empty-operand HOME behavior", () => {
    const result = navigate(["target-folder"], "", { invocation: 'cd ""; printf "RESULT:%s\\n" "${PWD#"$START_FOLDER"}"' });
    expect(result.status).toBe(0);
    expect(result.output).toContain("RESULT:\n");
  });

  it("allows an ignored component only when explicitly spelled exactly", () => {
    const result = navigate(["node_modules/package-folder"], "node_modules/pack");
    expect(result.status).toBe(0);
    expect(result.output).toContain("RESULT:/node_modules/package-folder\n");
  });

  it("honors the shared custom exclusion list", () => {
    const result = navigate(["custom-hidden/target"], "target", { env: { _IGNORED_FOLDERS_JSON: '["custom-hidden"]' } });
    expect(result.status).toBe(1);
    expect(result.output).toContain("RESULT:\n");
  });

  it("fails closed when the shared exclusion list is unavailable", () => {
    const result = navigate(["target-folder"], "target", { before: "unset _IGNORED_FOLDERS_JSON" });
    expect(result.status).toBe(1);
    expect(result.output).toContain("RESULT:\n");
  });

  it("preserves CDPATH exact navigation", () => {
    const result = navigate(["external/target", "target-partial"], "target", { before: 'CDPATH="$PWD/external"' });
    expect(result.status).toBe(0);
    expect(result.output).toContain("RESULT:/external/target\n");
  });

  it("does not consume piped input for an ambiguous query", () => {
    const result = navigate(["target-a", "target-b"], "target", {
      invocation: 'if cd "$1"; then exit 99; fi; IFS= read -r line; printf "RESULT:%s:%s\\n" "${PWD#"$START_FOLDER"}" "$line"',
    });
    expect(result.status).toBe(0);
    expect(result.output).toContain("RESULT::PIPE_UNTOUCHED\n");
  });

  it("terminates a blocked asynchronous scan before three seconds without moving", () => {
    const result = navigate(["target-folder"], "target", { before: 'export NODE_OPTIONS="--require=$PWD/blocked.cjs"' });
    expect(result.status).toBe(1);
    expect(result.output).toContain("RESULT:\n");
    expect(result.output).toContain("search timed out");
    expect(result.elapsed).toBeLessThan(3000);
  });
});

describe.skipIf(process.platform === "win32")("fuzzy cd terminal integration", () => {
  it("shows only the top five, ranked exact component then prefix then substring and excess length", () => {
    const result = navigate(["git/hooks", "gita/hooks", "git/hook-long", "git/ahook", "git/bhook", "git/chook", "git/dhook"], "gi/hook", {
      tty: true,
      reply: "1\n",
    });
    expect(result.status).toBe(0);
    expect(result.output).toContain("1 ./git/hooks\n2 ./gita/hooks\n3 ./git/hook-long\n4 ./git/ahook\n5 ./git/bhook\n");
    expect(result.output).not.toContain("6 ./");
    expect(result.output).not.toContain("./git/dhook");
    expect(result.output).toContain("RESULT:/git/hooks\n");
  });

  it.each(["2\n", "./target-b\n"])("accepts displayed number or full relative path %j", (reply) => {
    const result = navigate(["target-a", "target-b"], "target", { tty: true, reply });
    expect(result.status).toBe(0);
    expect(result.output).toContain("RESULT:/target-b\n");
  });

  it("accepts a shell-escaped full path containing spaces", () => {
    const result = navigate(["folder with spaces", "folder with spacezz"], "folder with space", {
      tty: true,
      reply: "./folder\\ with\\ spaces\n",
    });
    expect(result.status).toBe(0);
    expect(result.output).toContain("RESULT:/folder with spaces\n");
  });

  it.each(["\n", "0\n", "6\n", "99\n", "invalid\n", "$(touch injected)\n", "\x04"])("rejects reply %j without moving", (reply) => {
    const result = navigate(["target-a", "target-b"], "target", { tty: true, reply });
    expect(result.status).toBe(1);
    expect(result.output).toContain("RESULT:\n");
    expect(result.output).not.toContain('cd "');
  });
});
