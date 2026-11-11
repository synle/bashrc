/** Subprocess regressions for native listing and sort shortcuts. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Repository root containing both profile sources. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Native Git executable resolved without loading user shell startup files. */
const GIT_BINARY = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", "type -P git"], {
  encoding: "utf8",
  env: { ...process.env, BASH_ENV: "/dev/null" },
  timeout: 5000,
}).stdout.trim();
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
 * @param {string} [options.git="absent"] - Absent Git, available Git, or an initialized fixture repository.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured status and output.
 * @throws {Error} When sandbox setup fails; removes owned temporary files in all cases.
 */
function runListing(args, { invocation = 'ls "$@"', loads = 1, backend = "native", filter = "shared", setup = "", git = "absent" } = {}) {
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
          ? `${FILTER}\nfunction filter_unwanted() { local line; while IFS= read -r line; do :; done; return 2; }\n`
          : FILTER,
    );
    writeFileSync(advancedFile, ADVANCED);
    symlinkSync("/usr/bin/grep", path.join(sandbox, "grep"));
    symlinkSync("/usr/bin/tr", path.join(sandbox, "tr"));
    if (git !== "absent") symlinkSync(GIT_BINARY, path.join(sandbox, "git"));
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
    writeFileSync(path.join(sandbox, ".gitignore"), "*.scratch\n!keep.scratch\nignored-folder/\n");
    writeFileSync(path.join(sandbox, "noise/ignored.scratch"), "ignored\n");
    writeFileSync(path.join(sandbox, "noise/keep.scratch"), "keep\n");
    writeFileSync(path.join(sandbox, "noise/tracked.scratch"), "tracked\n");
    writeFileSync(path.join(sandbox, "noise/local.txt"), "local\n");
    writeFileSync(path.join(sandbox, "noise/.gitignore"), "local.txt\n");
    mkdirSync(path.join(sandbox, "noise/ignored-folder"));
    mkdirSync(path.join(sandbox, "other"));
    writeFileSync(path.join(sandbox, "other/local.txt"), "keep\n");
    return spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `${git === "repository" ? 'command git init --quiet . && command git add -f noise/tracked.scratch || exit "$?"' : ""}
${setup}
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
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_CONFIG_NOSYSTEM: "1",
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
        ".gitignore",
        ".hidden.txt",
        "README.md",
        "desktop.ini",
        "ignored-folder",
        "ignored.scratch",
        "keep.scratch",
        "local.txt",
        "node_modules",
        "tracked.scratch",
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

  it("hides Git-ignored entries in long listings while preserving negated and tracked files", () => {
    const result = runListing(["noise"], { git: "repository", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("ignored.scratch");
    expect(result.stdout).not.toContain("ignored-folder");
    expect(result.stdout).not.toContain("local.txt");
    expect(result.stdout).toContain("keep.scratch");
    expect(result.stdout).toContain("tracked.scratch");
    expect(result.stdout).toContain("README.md");
  });

  it("filters path lines with ancestor and nested Git rules", () => {
    const result = runListing(
      ["noise/ignored.scratch", "noise/local.txt", "noise/keep.scratch", "noise/tracked.scratch", "noise/.DS_Store", "other/local.txt"],
      {
        git: "repository",
        invocation: 'printf "%s\\n" "$@" | filter_unwanted_and_gitignored',
      },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("noise/keep.scratch\nnoise/tracked.scratch\nother/local.txt\n");
  });

  it("does not add Git rules to the original shared filter", () => {
    const result = runListing(["noise/ignored.scratch", "noise/.DS_Store"], {
      git: "repository",
      invocation: 'printf "%s\\n" "$@" | filter_unwanted',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("noise/ignored.scratch\n");
  });

  it("finds the repository from a nested working folder", () => {
    const result = runListing([], { git: "repository", setup: "builtin cd noise", invocation: "ll" });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("ignored.scratch");
    expect(result.stdout).not.toContain("local.txt");
    expect(result.stdout).toContain("tracked.scratch");
  });

  it("uses each folder header when listing multiple folders", () => {
    const result = runListing(["noise", "other"], { git: "repository", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.match(/local\.txt/g)).toMatchInlineSnapshot(`
      [
        "local.txt",
      ]
    `);
    expect(result.stdout).not.toContain("ignored.scratch");
  });

  it("keeps ordinary shared filtering outside a repository when Git exists", () => {
    const result = runListing(["noise"], { git: "available", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain(".DS_Store");
    expect(result.stdout).toContain("ignored.scratch");
  });

  it("honors repository-local exclude rules", () => {
    const result = runListing(["noise"], {
      git: "repository",
      setup: "printf '%s\\n' 'noise/README.md' >> .git/info/exclude",
      invocation: 'll "$@"',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("README.md");
    expect(result.stdout).toContain("keep.scratch");
  });

  it("honors configured global exclude rules", () => {
    const result = runListing(["noise"], {
      git: "repository",
      setup: "printf '%s\\n' 'README.md' > global-ignore; command git config core.excludesFile \"$PWD/global-ignore\"",
      invocation: 'll "$@"',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("README.md");
    expect(result.stdout).toContain("keep.scratch");
  });

  it("filters Git-ignored filenames with spaces without hiding similar names", () => {
    const result = runListing(["noise"], {
      git: "repository",
      setup:
        "printf '' > 'noise/space name.txt'; printf '' > 'noise/space name.txt.backup'; printf '%s\\n' 'space name.txt' >> noise/.gitignore",
      invocation: 'll "$@"',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toMatch(/ space name\.txt\n/);
    expect(result.stdout).toContain("space name.txt.backup");
  });

  it("filters ignored directory operands in directory-only listings", () => {
    const result = runListing(["-d", "noise/ignored-folder"], { git: "repository", invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("checks colored and hyperlinked paths while retaining original output bytes", () => {
    const result = runListing(
      [
        "\x1b[31mnoise/ignored.scratch\x1b[0m",
        "\x1b]8;;https://example.invalid/ignored\x1b\\noise/ignored.scratch\x1b]8;;\x1b\\",
        "\x1b[32mnoise/keep.scratch\x1b[0m",
        "\x1b]8;;https://example.invalid/keep\x07noise/keep.scratch\x1b]8;;\x07",
      ],
      { git: "repository", invocation: 'printf "%s\\n" "$@" | filter_unwanted_and_gitignored' },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "\x1b[32mnoise/keep.scratch\x1b[0m\n\x1b]8;;https://example.invalid/keep\x07noise/keep.scratch\x1b]8;;\x07\n",
    );
  });

  it("checks colored Git metadata paths from the worktree rather than the metadata folder", () => {
    const result = runListing(["\x1b[34m.git\x1b[0m/", "noise/keep.scratch"], {
      git: "repository",
      invocation: 'printf "%s\\n" "$@" | filter_unwanted_and_gitignored',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("\x1b[34m.git\x1b[0m/\nnoise/keep.scratch\n");
  });

  it("keeps root, nonexistent absolute paths, and an unterminated final line", () => {
    const result = runListing([], {
      git: "repository",
      invocation: "printf '/\\n/nonexistent-ll-fixture/path\\nnoise/keep.scratch' | filter_unwanted_and_gitignored",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("/\n/nonexistent-ll-fixture/path\nnoise/keep.scratch\n");
  });

  it("returns success when Git ignores every input path under pipefail", () => {
    const result = runListing(["noise/ignored.scratch"], {
      git: "repository",
      setup: "set -e -o pipefail",
      invocation: 'printf "%s\\n" "$@" | filter_unwanted_and_gitignored',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("returns success when shared filtering removes every path without Git", () => {
    const result = runListing(["noise/.DS_Store"], {
      setup: "set -e -o pipefail",
      invocation: 'printf "%s\\n" "$@" | filter_unwanted_and_gitignored',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("finds Git metadata referenced by a .git file", () => {
    const result = runListing(["noise"], {
      git: "repository",
      setup: 'command git init --quiet --separate-git-dir="$PWD/metadata" .',
      invocation: 'll "$@"',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("ignored.scratch");
    expect(result.stdout).toContain("tracked.scratch");
  });

  it("propagates Git failures instead of treating them as unignored paths", () => {
    const result = runListing(["noise/keep.scratch"], {
      git: "repository",
      setup: "printf '%s\\n' '[broken' > .git/config",
      invocation: 'printf "%s\\n" "$@" | filter_unwanted_and_gitignored',
    });
    expect(result.status).toBe(128);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("bad config");
  });

  it("rejects unsupported Git-filter arguments without consuming stdin", () => {
    const result = runListing([], { invocation: "filter_unwanted_and_gitignored --unknown" });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("expected no arguments or --listing <folder>");
  });

  it("prints Git-filter help without consuming stdin", () => {
    const result = runListing([], { invocation: "filter_unwanted_and_gitignored --help" });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: filter_unwanted_and_gitignored [--listing <folder>]");
  });

  it("prints ll help without listing the current folder", () => {
    const result = runListing(["--help"], { invocation: 'll "$@"' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("ll: list files with shared clutter and Git-ignored entries hidden");
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
