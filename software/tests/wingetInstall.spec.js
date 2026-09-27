/** Behavior tests for the Windows winget installer shell script. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INSTALLER = path.join(ROOT_DIR, "software/scripts/windows/_winget-install.sh");
const RUN_SH = path.join(ROOT_DIR, "run.sh");

/** Host tools used directly by the installer or test stubs. */
const REQUIRED_TOOLS = ["awk", "date", "grep", "id", "mkdir", "stat", "tail", "tr", "touch"];

let sandbox = "";

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/winget_install_");
  fs.mkdirSync(path.join(sandbox, "bin"));
  fs.mkdirSync(path.join(sandbox, "home"));
  fs.mkdirSync(path.join(sandbox, "tmp"));
  for (const tool of REQUIRED_TOOLS) {
    const source = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"].map((folder) => path.join(folder, tool)).find(fs.existsSync);
    if (source) fs.symlinkSync(source, path.join(sandbox, "bin", tool));
  }
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Runs the real installer with Windows commands stubbed in a hermetic sandbox.
 * @param {{ listOutput?: string, listStatus?: number, installStatus?: number, installOutput?: string, searchStatus?: number, refresh?: boolean }} [options]
 * @returns {{ status: number | null, output: string, installs: string[], stampExists: boolean }}
 */
function runInstaller({
  listOutput = "Name Id Version\nPython Python.Python.3.120 3.120\n",
  listStatus = 0,
  installStatus = 0,
  installOutput = "",
  searchStatus = 0,
  refresh = false,
} = {}) {
  const bin = path.join(sandbox, "bin");
  const calls = path.join(sandbox, "installs");
  const winget = path.join(bin, "winget.exe");
  fs.writeFileSync(
    winget,
    `#!/bin/bash
case "$1" in
  list) printf '%s' "$WINGET_LIST_OUTPUT"; exit "$WINGET_LIST_STATUS" ;;
  install)
    while [ "$#" -gt 0 ]; do
      if [ "$1" = "--id" ]; then printf '%s\\n' "$2" >> "$WINGET_CALLS"; break; fi
      shift
    done
    printf '%s' "$WINGET_INSTALL_OUTPUT"
    exit "$WINGET_INSTALL_STATUS"
    ;;
  search) exit "$WINGET_SEARCH_STATUS" ;;
  source|upgrade) exit 0 ;;
esac
`,
    { mode: 0o755 },
  );
  fs.writeFileSync(path.join(bin, "powershell.exe"), "#!/bin/bash\nprintf 'yes\\n'\n", { mode: 0o755 });

  const runner = path.join(sandbox, "runner.sh");
  fs.writeFileSync(
    runner,
    `#!/bin/bash
PATH=${JSON.stringify(bin)}
HOME=${JSON.stringify(path.join(sandbox, "home"))}
BASHRC_TEMP_DIR=${JSON.stringify(path.join(sandbox, "tmp"))}
BASH_SYLE_PATH="$HOME/.bash_syle"
IS_SETUP=1
IS_REFRESH_MODE=${refresh ? 1 : 0}
is_os_windows=1
function has_persistent_binary() { type -P "$1"; }
function is_path_stale() { return 0; }
function safe_touch() { [ -e "$1" ] || command touch "$1"; }
source ${JSON.stringify(INSTALLER)}
`,
    { mode: 0o755 },
  );

  const result = spawnSync("/bin/bash", [runner], {
    encoding: "utf-8",
    env: {
      ...process.env,
      WINGET_CALLS: calls,
      WINGET_INSTALL_STATUS: String(installStatus),
      WINGET_INSTALL_OUTPUT: installOutput,
      WINGET_LIST_OUTPUT: listOutput,
      WINGET_LIST_STATUS: String(listStatus),
      WINGET_SEARCH_STATUS: String(searchStatus),
    },
  });
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    installs: fs.existsSync(calls) ? fs.readFileSync(calls, "utf-8").trim().split("\n") : [],
    stampExists: fs.existsSync(path.join(sandbox, "home/.bash_syle.winget-install")),
  };
}

describe("winget installer", () => {
  it("matches installed package ids exactly", () => {
    const result = runInstaller();
    expect(result.status).toBe(0);
    expect(result.installs).toContain("Python.Python.3.12");
    expect(result.stampExists).toBe(true);
  });

  it("fails closed when installed packages cannot be listed", () => {
    const result = runInstaller({ listStatus: 1 });
    expect(result.status).toBe(1);
    expect(result.output).toContain("refusing to reinstall the full package set");
    expect(result.installs).toEqual([]);
    expect(result.stampExists).toBe(false);
  });

  it("leaves no success stamp when any package install fails", () => {
    const result = runInstaller({ installStatus: 1 });
    expect(result.status).toBe(1);
    expect(result.output).toContain("package(s) failed to install");
    expect(result.stampExists).toBe(false);
  });

  it("reports a package id that winget cannot find and leaves it retryable", () => {
    // Mirrors the prior Windows run: install printed "No package found" for dead
    // or case-mismatched ids. Exact source lookup status, not localized text,
    // classifies the failure.
    const result = runInstaller({
      installStatus: 1,
      installOutput: "No package found matching input criteria.\n",
      searchStatus: 1,
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("exact winget source lookup failed. No package found matching input criteria.");
    expect(result.output).toContain("package id(s) were not found by an exact winget source lookup");
    expect(result.output).toContain("Refresh the winget source or correct/remove these ids before retrying.");
    expect(result.stampExists).toBe(false);
  });

  it("propagates generated shell failures through the run.sh logging pipeline", () => {
    const source = fs.readFileSync(RUN_SH, "utf-8");
    const start = source.indexOf("function run_files() {");
    const end = source.indexOf("\n}\n", start) + 3;
    const functionSource = source
      .slice(start, end)
      .replace(/if \[ -f "software\/index\.js" \]; then[\s\S]*?fi \| node/, "printf 'exit 23\\n' | node_passthrough");
    const runner = path.join(sandbox, "pipeline.sh");
    fs.writeFileSync(
      runner,
      `#!/bin/bash
BASHRC_TEMP_DIR=${JSON.stringify(path.join(sandbox, "tmp"))}
function node_passthrough() { command cat; }
${functionSource}
run_files
`,
      { mode: 0o755 },
    );
    const result = spawnSync("/bin/bash", [runner], { encoding: "utf-8" });
    expect(result.status).toBe(23);
  });
});
