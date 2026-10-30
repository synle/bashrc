/** Subprocess contracts for smart terminal and editor comparisons. */
import { spawnSync, execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Checkout root containing the canonical profile sources. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Core helpers used by the comparison dispatcher. */
const CORE = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8");
/** Exact advanced section, including aliases and inherited-alias cleanup. */
const DIFF = readFileSync(path.join(ROOT, "software/bootstrap/profile-advanced.sh"), "utf8")
  .split("# --- Diff (file diff or git hash compare) ---\n")[1]
  .split("# SOURCE | software/scripts/bash-git-helpers.profile.bash")[0];
/** Available shell entry points exercise both the platform floor and PATH Bash. */
export const BASH_SHELLS = [...new Set(["/bin/bash", execFileSync("/bin/bash", ["-c", "type -P bash"], { encoding: "utf8" }).trim()])];
/** Actual Git executable used only for repository integration cases. */
const GIT = execFileSync("/bin/bash", ["-c", "type -P git"], { encoding: "utf8" }).trim();

/**
 * Execute the shipped section in the selected Bash with isolated executable boundaries.
 * @param {string[]} args - Arguments passed as positional parameters, never interpolated.
 * @param {object} [options] - Backend, invocation, reload, and launcher fixture controls.
 * @param {string} [options.shell="/bin/bash"] - Bash executable used for the real dispatcher.
 * @param {string[]} [options.binaries] - Available recording executables.
 * @param {string} [options.invocation] - Fixed shell invocation after profile loading.
 * @param {string} [options.backend] - Recorder or real Git repository.
 * @param {number} [options.exitStatus] - Recorder's process status.
 * @param {boolean} [options.hashes] - Create a second commit and compare both full hashes.
 * @param {string} [options.setup] - Fixed shell functions installed before invoking diff.
 * @returns {import("child_process").SpawnSyncReturns<string>} Process output and status.
 * @throws {Error} On fixture creation errors; removes owned fixtures in all cases.
 */
export function runDiff(
  args,
  {
    binaries = ["git", "diff"],
    invocation = `eval 'diff "$@"'`,
    backend = "recorder",
    exitStatus = 0,
    hashes = false,
    setup = "",
    shell = "/bin/bash",
  } = {},
) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "smart-diff-"));
  let processArgs = args;
  try {
    const source = path.join(sandbox, "profile.bash");
    const aliasSource = path.join(sandbox, "inherited-alias.bash");
    writeFileSync(
      source,
      `${CORE.match(/function is_help_arg\(\) \{[\s\S]*?\n\}/)[0]}\n${CORE.match(/function is_runnable_command\(\) \{[\s\S]*?\n\}/)[0]}\n${DIFF}`,
    );
    writeFileSync(aliasSource, "alias diff='command diff --inherited'\n");
    symlinkSync("/usr/bin/tr", path.join(sandbox, "tr"));
    // Repository probes emit Git's plain-text boolean shape; NUL-delimited argv belongs only to command recording.
    for (const binary of binaries) {
      writeFileSync(
        path.join(sandbox, binary),
        `#!/bin/bash\ncase "${binary}:$1" in git:rev-parse) printf '%s\\n' false; exit 0 ;; esac\nprintf '%s\\0' "${binary}" "$@"\nexit ${exitStatus}\n`,
        { mode: 0o755 },
      );
    }
    writeFileSync(path.join(sandbox, "left file.txt"), "old line\n");
    writeFileSync(path.join(sandbox, "right file.txt"), "new line\n");
    writeFileSync(path.join(sandbox, "-dash.txt"), "new line\n");
    writeFileSync(path.join(sandbox, "quote'\"\\\n\u2603.txt"), "new line\n");
    if (backend === "git") {
      rmSync(path.join(sandbox, "git"));
      symlinkSync(GIT, path.join(sandbox, "git"));
      /**
       * Run Git inside the private repository without host configuration.
       * @param {string[]} args - Literal Git arguments.
       * @returns {Buffer} Captured Git output.
       * @throws {Error} If Git exits unsuccessfully.
       */
      const git = (args) =>
        execFileSync(GIT, args, {
          cwd: sandbox,
          env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
          stdio: "pipe",
        });
      git(["init", "-q"]);
      git(["add", "left file.txt"]);
      git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Initial"]);
      writeFileSync(path.join(sandbox, "left file.txt"), "changed line\n");
      if (hashes) {
        git(["add", "left file.txt"]);
        git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Changed"]);
        processArgs = [git(["rev-parse", "HEAD~1"]).toString().trim(), git(["rev-parse", "HEAD"]).toString().trim()];
      }
    }
    return spawnSync(
      shell,
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `. "$ALIAS_SOURCE"\n. "$SOURCE"\n. "$SOURCE"\n${setup}\n${invocation}`,
        "test",
        ...processArgs,
      ],
      {
        cwd: sandbox,
        env: {
          ...process.env,
          PATH: sandbox,
          SOURCE: source,
          ALIAS_SOURCE: aliasSource,
          BASH_ENV: "/dev/null",
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_PAGER: "cat",
          LC_ALL: "C",
        },
        encoding: "utf8",
        timeout: 5000,
      },
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}
