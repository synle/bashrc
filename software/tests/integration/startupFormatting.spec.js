/** Exercise startup whitespace normalization with real shfmt and isolated shell files. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Real runner finalization, without installer execution. */
const runner = fs.readFileSync("run.sh", "utf8");
/** Full loader definitions provide canonical path resolution without loading profiles. */
const loader = fs.readFileSync("software/bootstrap/safe-source.bash", "utf8");
/** Start of the formatting-only runner section. */
const start = runner.indexOf("# --- Format shell startup files ---");
/** End of the formatting-only runner section. */
const end = runner.indexOf("\n_run_end_epoch=", start);
/** Private home whose paths remain canonical on macOS. */
let home;

beforeEach(() => {
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "startup spacing ")));
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

/**
 * Run only startup formatting against the private home.
 * @param {string[]} [args=[]] Runner arguments used to test dry-run behavior.
 * @returns {import("child_process").SpawnSyncReturns<string>} Actual output and exit status.
 */
function format(args = []) {
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `${loader}\nfunction is_truthy() { [ "$1" = 1 ]; }\n${runner.slice(start, end)}\nexit "$_run_status"`,
      "formatter",
      ...args,
    ],
    {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        BASH_ENV: "",
        HOME: home,
        IS_DRY_RUN: "0",
        _run_status: "0",
        BASH_SYLE_PATH: path.join(home, ".bash_syle"),
        BASH_SYLE_COMMON_PATH: path.join(home, ".bash_syle_common"),
        BASH_SYLE_CACHE_PATH: path.join(home, ".bash_syle_cache"),
      },
    },
  );
}

describe("startup block whitespace", () => {
  it.each([".bashrc", ".bash_profile", ".bash_syle", ".bash_syle_common", ".bash_syle_cache", ".work team.bash", ".work_more.sh"])(
    "separates blocks and trims file boundaries in %s",
    (name) => {
      const target = path.join(home, name);
      fs.writeFileSync(target, "\n\n# BEGIN first\n:\n# END first\n# BEGIN second\n:\n# END second\n\n\n", { mode: 0o640 });
      const result = format();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toBe("");
      expect(fs.readFileSync(target, "utf8")).toBe("# BEGIN first\n:\n# END first\n\n# BEGIN second\n:\n# END second\n");
      expect(fs.statSync(target).mode & 0o777).toBe(0o640);
    },
  );

  it("keeps an existing separator without growing it on repeat formatting", () => {
    const target = path.join(home, ".bashrc");
    fs.writeFileSync(target, "# BEGIN first\n:\n# END first\n\n# BEGIN second\n:\n# END second\n");
    expect(format().status).toBe(0);
    const first = fs.readFileSync(target, "utf8");
    expect(first).toBe("# BEGIN first\n:\n# END first\n\n# BEGIN second\n:\n# END second\n");
    expect(format().status).toBe(0);
    expect(fs.readFileSync(target, "utf8")).toBe(first);
  });

  it.each(["", "\n \n\t\n"])("keeps exactly one final newline for empty script %j", (input) => {
    const target = path.join(home, ".bashrc");
    fs.writeFileSync(target, input);
    const result = format();
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(target, "utf8")).toBe("\n");
  });

  it("separates actual indented comments but leaves inline BEGIN comments attached", () => {
    const target = path.join(home, ".bashrc");
    fs.writeFileSync(target, "function demo() {\n:\n# BEGIN nested\n: # BEGIN inline\n# END nested\n}\n");
    const result = format();
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(target, "utf8")).toBe("function demo() {\n  :\n\n  # BEGIN nested\n  : # BEGIN inline\n  # END nested\n}\n");
  });

  it("preserves marker-looking multiline strings and heredoc data byte for byte", () => {
    const target = path.join(home, ".bashrc");
    const input = "printf '%s\\n' 'literal\n# BEGIN quoted\n\nend'\ncommand cat << 'DATA'\nfirst\n# BEGIN heredoc\n\nlast\nDATA\n";
    fs.writeFileSync(target, input);
    const before = spawnSync("/bin/bash", [target], { encoding: "utf8", env: { ...process.env, BASH_ENV: "" }, timeout: 5000 });
    expect(before.status).toBe(0);
    expect(before.stdout).toBe("literal\n# BEGIN quoted\n\nend\nfirst\n# BEGIN heredoc\n\nlast\n");
    const result = format();
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(target, "utf8")).toBe(input);
    const after = spawnSync("/bin/bash", [target], { encoding: "utf8", env: { ...process.env, BASH_ENV: "" }, timeout: 5000 });
    expect(after.status).toBe(0);
    expect(after.stdout).toBe(before.stdout);
    expect(after.stderr).toBe("");
  });

  it("preserves shebang placement and executable permissions", () => {
    const target = path.join(home, ".work_start.sh");
    fs.writeFileSync(target, "#!/usr/bin/env bash\n# BEGIN executable\n:\n# END executable\n\n", { mode: 0o750 });
    expect(format().status).toBe(0);
    expect(fs.readFileSync(target, "utf8")).toBe("#!/usr/bin/env bash\n\n# BEGIN executable\n:\n# END executable\n");
    expect(fs.statSync(target).mode & 0o777).toBe(0o750);
  });

  it("leaves malformed files unchanged while formatting later valid files", () => {
    fs.writeFileSync(path.join(home, ".bashrc"), "\nif then\n");
    fs.writeFileSync(path.join(home, ".bash_profile"), "\n# BEGIN valid\n:\n# END valid\n\n");
    const result = format();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Failed to format");
    expect(fs.readFileSync(path.join(home, ".bashrc"), "utf8")).toBe("\nif then\n");
    expect(fs.readFileSync(path.join(home, ".bash_profile"), "utf8")).toBe("# BEGIN valid\n:\n# END valid\n");
  });

  it("handles comment-only blocks without leading blank lines", () => {
    const target = path.join(home, ".bashrc");
    fs.writeFileSync(target, "\n# header\n# BEGIN comments\n# END comments\n\n");
    expect(format().status).toBe(0);
    expect(fs.readFileSync(target, "utf8")).toBe("# header\n\n# BEGIN comments\n# END comments\n");
  });

  it("formats eligible symlinks through their canonical target", () => {
    const target = path.join(home, "linked-source.bash");
    fs.writeFileSync(target, "\n# header\n# BEGIN linked\n:\n# END linked\n\n");
    fs.symlinkSync("linked-source.bash", path.join(home, ".work_link.bash"));
    const result = format();
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(target, "utf8")).toBe("# header\n\n# BEGIN linked\n:\n# END linked\n");
    expect(fs.lstatSync(path.join(home, ".work_link.bash")).isSymbolicLink()).toBe(true);
  });

  it("skips protected requested names and protected symlink destinations without changing their metadata", () => {
    const target = path.join(home, ".work_private.secret.bash");
    fs.writeFileSync(target, "\n# BEGIN protected\n:\n# END protected\n\n");
    fs.symlinkSync(".work_private.secret.bash", path.join(home, ".work_alias.bash"));
    const before = fs.statSync(target);
    const result = format();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(fs.statSync(target).size).toBe(before.size);
    expect(fs.statSync(target).mtimeMs).toBe(before.mtimeMs);
  });

  it("does not trim or insert block spacing during a dry run", () => {
    const target = path.join(home, ".bashrc");
    const input = "\n# BEGIN first\n:\n# END first\n# BEGIN second\n:\n# END second\n\n";
    fs.writeFileSync(target, input);
    const result = format(["--dryrun"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(fs.readFileSync(target, "utf8")).toBe(input);
  });
});
