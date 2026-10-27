/** Subprocess regressions for native Bash navigation and folder completion. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { getIndexFunction } from "./setup.js";

/** Actual navigation aliases loaded by the advanced profile. */
const NAVIGATION = readFileSync("software/bootstrap/profile-advanced.sh", "utf8")
  .split("# --- Aliases: Navigation ---\n")[1]
  .split("# --- find (fd wrapper) ---")[0];

/**
 * Load navigation aliases twice in an isolated Bash session and run a caller operation.
 * @param {string} invocation Shell operation whose status and output are observed.
 * @param {string[]} [args=[]] Arguments passed without interpolation.
 * @param {string} [before=""] Existing shell customizations loaded before the profile.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured subprocess status and output.
 * @throws {Error} If fixture setup fails; removes only the owned temporary folder.
 */
function runNavigation(invocation, args = [], before = "") {
  const folder = mkdtempSync(path.join(os.tmpdir(), "native-cd-"));
  try {
    mkdirSync(path.join(folder, "folder with spaces/child/grandchild"), { recursive: true });
    mkdirSync(path.join(folder, "-dash"));
    symlinkSync("folder with spaces", path.join(folder, "linked"));
    writeFileSync(path.join(folder, "regular-file"), "fixture\n");
    writeFileSync(path.join(folder, "navigation.bash"), NAVIGATION);
    return spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `START_FOLDER="$PWD"\n${before}\n. ./navigation.bash\n. ./navigation.bash\n${invocation}`,
        "test",
        ...args,
      ],
      {
        cwd: folder,
        env: { ...process.env, BASH_ENV: "/dev/null", HOME: folder, PATH: "/usr/bin:/bin", TERM: "dumb" },
        encoding: "utf8",
        timeout: 5000,
      },
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe("native cd subprocess", () => {
  it("keeps the cd wrapper defined after repeated profile loads", () => {
    const result = runNavigation("type -t cd");
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("function\n");
  });

  it.each(["folder with spaces", "-dash"])("preserves explicit options and the path %s", (folder) => {
    const result = runNavigation('cd -- "$@" && printf "%s\\n" "${PWD##*/}"', [folder]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`${folder}\n`);
  });

  it("returns to the previous folder and updates OLDPWD", () => {
    const result = runNavigation('cd -- "$1" && cd - >/dev/null && printf "%s\\n" "${OLDPWD##*/}"; test "$PWD" = "$START_FOLDER"', [
      "folder with spaces",
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("folder with spaces\n");
  });

  it("uses HOME when called without arguments", () => {
    const result = runNavigation('cd -- "folder with spaces" && cd && test "$PWD" = "$HOME" && printf "home\\n"');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("home\n");
  });

  it.each([
    ["-L", "linked\n"],
    ["-P", "folder with spaces\n"],
  ])("preserves native symlink resolution with %s", (option, expected) => {
    const result = runNavigation('cd "$1" linked && printf "%s\\n" "${PWD##*/}"', [option]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(expected);
  });

  it("keeps parent aliases on native navigation after repeated loads", () => {
    const result = runNavigation(
      'cd "folder with spaces/child/grandchild"\n..\nprintf "%s\\n" "${PWD##*/}"\n...\ntest "$PWD" = "$START_FOLDER"',
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("child\n");
  });

  it.each(["missing-folder", "regular-file"])("preserves failure status and working folder for %s", (target) => {
    const result = runNavigation(
      'if cd -- "$1"; then exit 99; else status=$?; fi\ntest "$PWD" = "$START_FOLDER" && printf "unchanged\\n"\nexit "$status"',
      [target],
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(target);
    expect(result.stdout).toBe("unchanged\n");
  });

  it("preserves existing prompt hooks and folder completion", () => {
    const result = runNavigation(
      'eval "$PROMPT_COMMAND"\ncomplete -p cd',
      [],
      'PROMPT_COMMAND="printf prompt"; function current_complete() { :; }; complete -F current_complete cd',
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("promptcomplete -F current_complete cd\n");
  });
});

/**
 * Generate real completion blocks through either installer with deterministic file reads.
 * @param {string} file Installer path for Bash or PowerShell.
 * @returns {Promise<string>} All emitted completion blocks.
 */
async function completionOutput(file) {
  const blocks = [];
  const context = {
    code: getIndexFunction("code"),
    MAX_NESTED_DEPTH: 3,
    LINE_BREAK_HASH: "#".repeat(80),
    is_os_mac: true,
    is_os_windows: false,
    isBinaryFound: async () => true,
    readText: async (strings, ...values) => readFileSync(getIndexFunction("code")(strings, ...values), "utf8"),
    registerWithBashSyleAutocompleteWithRawContent: (key, content) => blocks.push(content),
    registerWithPowershellProfile: (key, content) => blocks.push(content),
    log: () => {},
  };
  vm.runInNewContext(readFileSync(file, "utf8"), context);
  await context.doWork();
  return blocks.join("\n");
}

describe("native folder completion", () => {
  it("generates Bash completion code that the oldest local Bash can parse", async () => {
    const result = spawnSync("/bin/bash", ["-n"], {
      input: await completionOutput("software/scripts/advanced/bash-autocomplete-complete-spec.js"),
      encoding: "utf8",
      env: { ...process.env, BASH_ENV: "/dev/null" },
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it.each([
    ["software/scripts/advanced/bash-autocomplete-complete-spec.js", "function __spec_complete_cd()"],
    ["software/scripts/windows/powershell.js", '_Register-SpecCompleter -Command "cd"'],
  ])("generates native cd completion in %s", async (file, expected) => {
    expect(await completionOutput(file)).toContain(expected);
  });
});
