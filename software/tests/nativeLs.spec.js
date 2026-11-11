/** Subprocess regressions for native listing and sort shortcuts. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Repository root containing both profile sources. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Stable core section containing native detection and the listing function. */
const CORE = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8")
  .split("alias grep='command grep --color=auto'\n")[1]
  .split("if type -P colordiff")[0];
/** Shared production filter loaded independently of fuzzy picker setup. */
const FILTER = readFileSync(path.join(ROOT, "software/scripts/bash-fzf.profile.bash"), "utf8")
  .split("# --- Filter Functions ---\n")[1]
  .split("# --- Fuzzy List All ---")[0];
/** Production help-argument detector used by user-facing profile functions. */
const HELP = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8")
  .split("function is_help_arg() {")[1]
  .split("# --- Last-Run Timestamp Cache ---")[0];
/** Advanced navigation section loaded alongside the listing function. */
const ADVANCED = readFileSync(path.join(ROOT, "software/bootstrap/profile-advanced.sh"), "utf8")
  .split("# --- Aliases: Navigation ---\n")[1]
  .split("# --- find (fd wrapper) ---")[0];

/**
 * Load listing sections with alias expansion and a controlled native executable.
 * @param {string[]} args - Caller arguments passed without shell interpolation.
 * @param {object} [options] - Invocation, reload, and native-boundary controls.
 * @param {string} [options.invocation='ls "$@"'] - Command evaluated after loading both sections.
 * @param {number} [options.loads=1] - Complete profile load count.
 * @param {string} [options.backend="native"] - Real native ls or an argument-recording executable.
 * @param {string} [options.filter="shared"] - Shared production filter, absent filter, or failing filter.
 * @param {string} [options.setup=""] - Trusted shell fixture evaluated before profile loading.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured status and output.
 * @throws {Error} When sandbox setup fails; removes owned temporary files in all cases.
 */
function runListing(args, { invocation = 'ls "$@"', loads = 1, backend = "native", filter = "shared", setup = "" } = {}) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "native-ls-"));
  try {
    const coreFile = path.join(sandbox, "core.bash");
    const advancedFile = path.join(sandbox, "advanced.bash");
    writeFileSync(coreFile, `function is_help_arg() {${HELP}\n${CORE}`);
    const filterFile = path.join(sandbox, "filter.bash");
    writeFileSync(
      filterFile,
      filter === "absent"
        ? ""
        : filter === "broken"
          ? "function filter_unwanted() { local line; while IFS= read -r line; do :; done; return 2; }\n"
          : FILTER,
    );
    writeFileSync(advancedFile, ADVANCED);
    symlinkSync("/usr/bin/grep", path.join(sandbox, "grep"));
    symlinkSync("/usr/bin/tr", path.join(sandbox, "tr"));
    if (backend === "recorder") {
      writeFileSync(
        path.join(sandbox, "ls"),
        '#!/bin/bash\nif [ "$1" = "--version" ]; then printf "GNU ls\\n"; else printf "%s\\0" "$@"; fi\n',
        { mode: 0o755 },
      );
    } else if (backend === "gnu" || backend === "gnu-links") {
      writeFileSync(
        path.join(sandbox, "ls"),
        `#!/bin/bash
case "$1" in
  --version) printf '%s\\n' 'GNU ls' ;;
  --help) printf '%s\\n' '${backend === "gnu-links" ? "--hyperlink" : "native options"}' ;;
  *) printf '%s\\n' "$@" ;;
esac
`,
        { mode: 0o755 },
      );
    } else {
      symlinkSync("/bin/ls", path.join(sandbox, "ls"));
    }
    mkdirSync(path.join(sandbox, "entries"));
    writeFileSync(path.join(sandbox, "entries/alpha.txt"), "1234");
    writeFileSync(path.join(sandbox, "entries/beta.txt"), "1234567890");
    writeFileSync(path.join(sandbox, "entries/gamma.txt"), "1");
    utimesSync(path.join(sandbox, "entries/alpha.txt"), 1700000030, 1700000030);
    utimesSync(path.join(sandbox, "entries/beta.txt"), 1700000010, 1700000010);
    utimesSync(path.join(sandbox, "entries/gamma.txt"), 1700000020, 1700000020);
    writeFileSync(path.join(sandbox, "file with spaces.txt"), "fixture\n");
    writeFileSync(path.join(sandbox, "-dash.txt"), "fixture\n");
    mkdirSync(path.join(sandbox, "noise"));
    writeFileSync(path.join(sandbox, "noise/.DS_Store"), "metadata\n");
    writeFileSync(path.join(sandbox, "noise/.hidden.txt"), "keep\n");
    writeFileSync(path.join(sandbox, "noise/desktop.ini"), "metadata\n");
    writeFileSync(path.join(sandbox, "noise/README.md"), "keep\n");
    mkdirSync(path.join(sandbox, "noise/node_modules"));
    return spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `${setup}
. "$FILTER_FILE"
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
        env: {
          ...process.env,
          BASH_ENV: "/dev/null",
          PATH: sandbox,
          CORE_FILE: coreFile,
          ADVANCED_FILE: advancedFile,
          FILTER_FILE: filterFile,
          TERM: "dumb",
        },
        timeout: 5000,
      },
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe("native ls subprocess", () => {
  it("lists a path through the native executable", () => {
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

  it("preserves bare native color flags", () => {
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

  it("keeps native failure status and diagnostics for missing paths", () => {
    const result = runListing(["missing-file"]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("missing-file");
  });

  it("shows a native long listing through ll", () => {
    const result = runListing(["file with spaces.txt"], { invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/^-rw.*file with spaces\.txt\n$/);
  });

  it("forwards ll options and filenames with spaces without interpreting them", () => {
    const result = runListing(["-1", "--", "file with spaces.txt", "-dash.txt"], { invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("-dash.txt\nfile with spaces.txt\n");
  });

  it("does not force color when native listing output is piped", () => {
    const result = runListing(["noise"], { setup: "unset CLICOLOR_FORCE; export TERM=xterm-256color", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("README.md");
    expect(result.stdout).not.toContain(".DS_Store");
    expect(result.stdout).not.toContain("\x1b");
  });

  it("keeps GNU options and caller arguments in the native invocation", () => {
    const result = runListing(["-tr", "--", "file with spaces.txt"], { backend: "gnu", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim().split("\n")).toMatchInlineSnapshot(`
      [
        "-lahF",
        "--color=auto",
        "-tr",
        "--",
        "file with spaces.txt",
      ]
    `);
  });

  it("requests GNU hyperlinks only when advertised", () => {
    const result = runListing(["entries"], { backend: "gnu-links", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim().split("\n")).toMatchInlineSnapshot(`
      [
        "-lahF",
        "--color=auto",
        "--hyperlink=auto",
        "entries",
      ]
    `);
  });

  it("defines ll as a function even when replacing a loaded alias", () => {
    const result = runListing([], { setup: "alias ll='command ls -lahFG'", loads: 2, invocation: "type -t ll" });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("function\n");
  });

  it("hides shared unwanted entries while retaining ordinary hidden files", () => {
    const result = runListing(["noise"], { invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain(".DS_Store");
    expect(result.stdout).not.toContain("desktop.ini");
    expect(result.stdout).not.toContain("node_modules");
    expect(result.stdout).toContain(".hidden.txt");
    expect(result.stdout).toContain("README.md");
  });

  it("leaves unwanted entries visible through plain native ls", () => {
    const result = runListing(["-1a", "noise"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim().split("\n").sort()).toMatchInlineSnapshot(`
      [
        ".",
        "..",
        ".DS_Store",
        ".hidden.txt",
        "README.md",
        "desktop.ini",
        "node_modules",
      ]
    `);
  });

  it("succeeds when the filter removes every output line under pipefail", () => {
    const result = runListing(["noise/.DS_Store"], { setup: "set -e -o pipefail", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("preserves native listing failures through the shared filter", () => {
    const result = runListing(["missing-file"], { invocation: 'll "$@"' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("missing-file");
  });

  it("reports filter errors instead of masking them as empty output", () => {
    const result = runListing(["noise/.DS_Store"], { filter: "broken", invocation: 'll "$@"' });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
  });

  it("keeps native output when the advanced filter is unavailable", () => {
    const result = runListing(["noise/.DS_Store"], { filter: "absent", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("noise/.DS_Store");
  });

  it("uses configured shared patterns rather than another ignore list", () => {
    const result = runListing(["noise"], { setup: "_IGNORED_FILE_PATTERNS=('README')", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("README.md");
    expect(result.stdout).toContain(".DS_Store");
  });

  it("prints ll help without listing the current folder", () => {
    const result = runListing(["--help"], { invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("ll: list files with shared unwanted entries hidden");
    expect(result.stdout).toContain("Usage: ll [ls options] [file...]");
    expect(result.stdout).not.toContain("file with spaces.txt");
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
