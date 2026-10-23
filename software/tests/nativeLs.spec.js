/** Subprocess regressions for native listing, legacy-profile migration, and sort shortcuts. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Repository root containing both profile sources. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Stable core section containing native detection and listing aliases. */
const CORE = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8")
  .split("alias grep='command grep --color=auto'\n")[1]
  .split("if type -P colordiff")[0];
/** Stable advanced section that formerly replaced native listing. */
const ADVANCED = readFileSync(path.join(ROOT, "software/bootstrap/profile-advanced.sh"), "utf8")
  .split("# --- Aliases: Navigation ---\n")[1]
  .split("# --- find (fd wrapper) ---")[0];

/**
 * Load listing sections with alias expansion and a failing retired-backend executable.
 * @param {string[]} args - Caller arguments passed without shell interpolation.
 * @param {object} [options] - Invocation, reload, migration, and native-boundary controls.
 * @param {string} [options.invocation='ls "$@"'] - Command evaluated after loading both sections.
 * @param {number} [options.loads=1] - Complete profile load count.
 * @param {string} [options.initialization=""] - Shell definitions installed before loading.
 * @param {string} [options.backend="native"] - Real native ls or an argument-recording executable.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured status and output.
 * @throws {Error} When sandbox setup fails; removes owned temporary files in all cases.
 */
function runListing(args, { invocation = 'ls "$@"', loads = 1, initialization = "", backend = "native" } = {}) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "native-ls-"));
  try {
    const coreFile = path.join(sandbox, "core.bash");
    const advancedFile = path.join(sandbox, "advanced.bash");
    writeFileSync(coreFile, CORE);
    writeFileSync(advancedFile, ADVANCED);
    symlinkSync("/usr/bin/grep", path.join(sandbox, "grep"));
    if (backend === "recorder") {
      writeFileSync(
        path.join(sandbox, "ls"),
        '#!/bin/bash\nif [ "$1" = "--version" ]; then printf "GNU ls\\n"; else printf "%s\\0" "$@"; fi\n',
        { mode: 0o755 },
      );
    } else {
      symlinkSync("/bin/ls", path.join(sandbox, "ls"));
    }
    writeFileSync(path.join(sandbox, "eza"), '#!/bin/bash\nprintf "retired backend invoked\\n" >&2\nexit 99\n', { mode: 0o755 });
    mkdirSync(path.join(sandbox, "entries"));
    writeFileSync(path.join(sandbox, "entries/alpha.txt"), "1234");
    writeFileSync(path.join(sandbox, "entries/beta.txt"), "1234567890");
    writeFileSync(path.join(sandbox, "entries/gamma.txt"), "1");
    utimesSync(path.join(sandbox, "entries/alpha.txt"), 1700000030, 1700000030);
    utimesSync(path.join(sandbox, "entries/beta.txt"), 1700000010, 1700000010);
    utimesSync(path.join(sandbox, "entries/gamma.txt"), 1700000020, 1700000020);
    writeFileSync(path.join(sandbox, "file with spaces.txt"), "fixture\n");
    writeFileSync(path.join(sandbox, "-dash.txt"), "fixture\n");
    return spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `${initialization}
for ((load = 0; load < ${loads}; load++)); do
  . "$CORE_FILE"
  . "$ADVANCED_FILE"
done
${invocation}`,
        "test",
        ...args,
      ],
      {
        encoding: "utf8",
        cwd: sandbox,
        env: { ...process.env, BASH_ENV: "/dev/null", PATH: sandbox, CORE_FILE: coreFile, ADVANCED_FILE: advancedFile, TERM: "dumb" },
        timeout: 5000,
      },
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe("native ls subprocess", () => {
  it("lists a path even when the retired backend remains installed", () => {
    const result = runListing(["-1", "entries"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("alpha.txt\nbeta.txt\ngamma.txt\n");
  });

  it("forwards explicit options and paths without injecting or duplicating parameters", () => {
    const result = runListing(["-1", "-F", "--color=never", "/tmp/tde", "/tmp/tde"], { backend: "recorder" });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.split("\0").slice(0, -1)).toEqual(["-1", "-F", "--color=never", "/tmp/tde", "/tmp/tde"]);
  });

  it("preserves bare native color flags rather than passing them to the retired parser", () => {
    const result = runListing(["-1", "-F", "--color", "/tmp/tde"], { backend: "recorder" });
    expect(result.status).toBe(0);
    expect(result.stdout.split("\0").slice(0, -1)).toEqual(["-1", "-F", "--color", "/tmp/tde"]);
  });

  it("preserves filenames with spaces and the end-of-options boundary", () => {
    const result = runListing(["-1", "--", "file with spaces.txt", "-dash.txt"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("-dash.txt\nfile with spaces.txt\n");
  });

  it("removes the legacy alias and function when reloading an existing shell", () => {
    const result = runListing(["entries"], {
      loads: 2,
      initialization: 'alias ls="ls -1 -F --color"\nfunction ls() { command eza "$@"; }',
      invocation: 'type -t ls\nls -1 "$@"',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("file\nalpha.txt\nbeta.txt\ngamma.txt\n");
  });

  it("keeps native failure status and diagnostics for missing paths", () => {
    const result = runListing(["missing-file"]);
    expect(result.status).not.toBe(0);
    expect(result.status).not.toBe(99);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("missing-file");
  });

  it("shows a native long listing through ll", () => {
    const result = runListing(["file with spaces.txt"], { invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/^-rw.*file with spaces\.txt\n$/);
  });

  it.each([
    ["ls_newest", ["beta.txt", "gamma.txt", "alpha.txt"]],
    ["ls_newest_first", ["alpha.txt", "gamma.txt", "beta.txt"]],
    ["ls_biggest", ["gamma.txt", "alpha.txt", "beta.txt"]],
    ["ls_biggest_first", ["beta.txt", "alpha.txt", "gamma.txt"]],
  ])("preserves %s sort order after repeated profile loads", (command, expected) => {
    const result = runListing(["entries"], { loads: 2, invocation: `${command} "$@"` });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.match(/(?:alpha|beta|gamma)\.txt/g)).toEqual(expected);
  });
});
