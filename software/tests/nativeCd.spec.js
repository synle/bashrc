/** Regression tests for retiring zoxide without changing unrelated shell behavior. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { fileSystem, getIndexConstant, getIndexFunction } from "./setup.js";

/** Managed Bash profile used by the real block helpers. */
const PROFILE = getIndexConstant("BASH_SYLE_PATH");
/** Legacy block fixture includes unrelated commands that migration must preserve. */
const LEGACY_PROFILE =
  '# BEGIN zoxide init\nprintf "old-init\\n"\n# END zoxide init\n# BEGIN zoxide Spec Autocomplete\nprintf "old-completion\\n"\n# END zoxide Spec Autocomplete\n: # keep\n';

/**
 * Execute the real migration using production profile-block helpers.
 * @param {string} initial Initial managed profile bytes.
 * @param {boolean} binaryFound Whether the legacy binary remains installed.
 * @returns {Promise<string>} Persisted profile after queued changes are flushed.
 */
async function migrate(initial = LEGACY_PROFILE, binaryFound = true) {
  fileSystem[PROFILE] = initial;
  const context = {
    code: getIndexFunction("code"),
    registerWithBashSyleProfile: getIndexFunction("registerWithBashSyleProfile"),
    removeFromBashSyleProfile: getIndexFunction("removeFromBashSyleProfile"),
    isBinaryFound: async () => binaryFound,
    log: () => {},
  };
  vm.runInNewContext(readFileSync("software/scripts/zoxide.js", "utf8"), context);
  await context.doWork();
  await getIndexFunction("flushProfileBlocks")();
  return fileSystem[PROFILE];
}

/**
 * Source generated cleanup in a Bash subprocess with an owned filesystem fixture.
 * @param {string} profile Generated profile bytes.
 * @param {string} before Shell state left by an old session.
 * @param {string} after Observable navigation or prompt operation.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured output and status.
 * @throws {Error} If fixture setup fails; removes only the owned temporary folder.
 */
function runShell(profile, before, after) {
  const folder = mkdtempSync(path.join(os.tmpdir(), "native-cd-"));
  try {
    mkdirSync(path.join(folder, "folder with spaces"));
    writeFileSync(path.join(folder, "profile.bash"), profile);
    return spawnSync("/bin/bash", ["--noprofile", "--norc", "-O", "expand_aliases"], {
      input: `${before}\n. ./profile.bash\n. ./profile.bash\n${after}\n`,
      cwd: folder,
      env: { ...process.env, BASH_ENV: "/dev/null", PATH: "/usr/bin:/bin", TERM: "dumb" },
      encoding: "utf8",
      timeout: 5000,
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe("native cd migration", () => {
  it("removes legacy initialization and completion without requiring the binary", async () => {
    const profile = await migrate(LEGACY_PROFILE, false);
    expect(profile).not.toContain("old-init");
    expect(profile).not.toContain("old-completion");
    expect(profile).toContain(": # keep");
    expect(profile).not.toContain("zoxide init bash");
  });

  it("writes the same profile when migration runs twice", async () => {
    const first = await migrate();
    const second = await migrate(first);
    expect(second).toBe(first);
  });

  it("restores native cd options, spaced paths, previous folder, and failure status", async () => {
    const result = runShell(
      await migrate(),
      'function __zoxide_z() { printf "wrong\\n"; }; function cd() { __zoxide_z "$@"; }; function cdi() { __zoxide_zi "$@"; }',
      'type -t cd\ncd -- "folder with spaces" && printf "%s\\n" "${PWD##*/}"\ncd - >/dev/null && printf "%s\\n" "${OLDPWD##*/}"\ncd missing 2>/dev/null; printf "status=%s\\n" "$?"\ntype -t cdi || true',
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("builtin\nfolder with spaces\nfolder with spaces\nstatus=1\n");
  });

  it.each([
    ['PROMPT_COMMAND="__zoxide_hook"', ""],
    ['PROMPT_COMMAND="printf first;__zoxide_hook"', "first"],
    ['PROMPT_COMMAND="__zoxide_hook;printf last"', "last"],
    ['PROMPT_COMMAND="printf first; __zoxide_hook ;printf last"', "firstlast"],
    ['PROMPT_COMMAND=("printf first" "__zoxide_hook" "printf last")', "firstlast"],
    ['PROMPT_COMMAND=("__zoxide_hook" "__zoxide_hook")', ""],
    ['PROMPT_COMMAND=""', ""],
    ['PROMPT_COMMAND="__zoxide_hook;__zoxide_hook;printf last"', "last"],
    ["unset PROMPT_COMMAND", ""],
  ])("preserves other prompt commands after %s", async (setup, expected) => {
    const result = runShell(
      await migrate(),
      `function __zoxide_hook() { printf wrong; }; ${setup}`,
      'for hook in "${PROMPT_COMMAND[@]}"; do eval "$hook"; done',
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(expected);
  });

  it("removes zoxide aliases, completions, internal functions, and internal state", async () => {
    const result = runShell(
      await migrate(),
      'function __zoxide_hook() { :; }; function __zoxide_z_complete() { :; }; alias cd="__zoxide_z"; alias cdi="__zoxide_zi"; complete -F __zoxide_z_complete cd; __zoxide_oldpwd=old; __zoxide_z_prefix="z#"',
      "type -t cd\ncompgen -A function __zoxide_\ncompgen -A variable __zoxide_\ncomplete -p cd 2>/dev/null || true",
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("builtin\n");
  });

  it("removes the old managed standalone zoxide completer from an existing shell", async () => {
    const result = runShell(
      await migrate(),
      "function __spec_complete_zoxide() { :; }; complete -F __spec_complete_zoxide zoxide",
      "type -t __spec_complete_zoxide\ncomplete -p zoxide 2>/dev/null || true",
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("preserves user navigation, native completion, prompt hooks, and the Zed alias", async () => {
    const result = runShell(
      await migrate(),
      'function cd() { builtin cd "$@"; }; alias cdi="printf custom"; alias z=zed; function custom_complete() { :; }; complete -F custom_complete cd; PROMPT_COMMAND="printf prompt"; _ZO_DATA_DIR=keep',
      'declare -f cd\nalias cdi z\ncomplete -p cd\nprintf "%s\\n" "$PROMPT_COMMAND" "$_ZO_DATA_DIR"',
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "cd () \n{ \n    builtin cd \"$@\"\n}\nalias cdi='printf custom'\nalias z='zed'\ncomplete -F custom_complete cd\nprintf prompt\nkeep\n",
    );
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

describe("retired zoxide completions", () => {
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

  it.each(["software/scripts/advanced/bash-autocomplete-complete-spec.js", "software/scripts/windows/powershell.js"])(
    "omits zoxide while preserving native cd completion in %s",
    async (file) => {
      const output = await completionOutput(file);
      expect(output).not.toContain("zoxide");
      expect(output).toMatch(/__spec_complete_cd|_Register-SpecCompleter -Command "cd"/);
    },
  );
});
