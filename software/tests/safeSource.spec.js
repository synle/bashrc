/** Verify source-once behavior through the public Bash helper. */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** Real bootstrap library; no user configuration is sourced by these fixtures. */
const COMMON = path.resolve("software/bootstrap/common-functions.bash");
/** Each case owns a separate home and script files. */
let home;

beforeEach(() => {
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "safe-source-")));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

/**
 * Run the real helper in a clean system Bash with isolated files.
 * @param {string} command - Caller commands after bootstrap definitions.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and exact output.
 */
function run(command) {
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", `. "$COMMON"\n${command}`], {
    cwd: home,
    env: { ...process.env, HOME: home, COMMON, BASH_ENV: "" },
    encoding: "utf8",
    timeout: 5000,
  });
}

describe("safe_source", () => {
  it("sources a successful script only once", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'loaded\\n'\n");
    const result = run('safe_source "$HOME/script.bash"; safe_source "$HOME/script.bash"');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("loaded\n");
    expect(result.stderr).toBe(`[Warning] safe_source skipped already loaded script: ${home}/script.bash\n`);
  });

  it("deduplicates relative paths and symlink aliases", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'loaded\\n'\n");
    fs.symlinkSync("script.bash", path.join(home, "alias.bash"));
    const result = run('safe_source ./script.bash; safe_source "$HOME/alias.bash"');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("loaded\n");
    expect(result.stderr).toContain("skipped already loaded script:");
  });

  it("preserves source-once state when helper definitions are read again", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'loaded\\n'\n");
    const result = run('safe_source ./script.bash; . "$COMMON"; safe_source ./script.bash');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("loaded\n");
    expect(result.stderr).toContain("skipped already loaded script:");
  });

  it("permits an explicit reload", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'loaded\\n'\n");
    const result = run("safe_source ./script.bash; safe_source --reload ./script.bash");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("loaded\nloaded\n");
    expect(result.stderr).toBe("");
  });

  it("retries runtime failures and preserves their original status", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'attempt\\n'\nreturn 7\n");
    const result = run("safe_source ./script.bash; printf 'status:%s\\n' \"$?\"; safe_source ./script.bash");
    expect(result.status).toBe(7);
    expect(result.stdout).toBe("attempt\nstatus:7\nattempt\n");
    expect(result.stderr).toBe("");
  });

  it("retries after invalid syntax is repaired without printing script contents", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "if then\n");
    const result = run(
      "safe_source ./script.bash; printf 'status:%s\\n' \"$?\"; printf '%s\\n' \"printf 'repaired\\\\n'\" > script.bash; safe_source ./script.bash",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("status:1\nrepaired\n");
    expect(result.stderr).toBe("[Warning] safe_source syntax validation failed\n");
  });

  it("retries a missing file after creation", () => {
    const result = run("safe_source ./later.bash; printf '%s\\n' \"printf 'later\\\\n'\" > later.bash; safe_source ./later.bash");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("later\n");
    expect(result.stderr).toBe("[Warning] safe_source file not found\n");
  });

  it("terminates recursive source cycles and keeps successful outer loads cached", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "safe_source ./script.bash\nprintf 'loaded\\n'\n");
    const result = run("safe_source ./script.bash; safe_source ./script.bash");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("loaded\n");
    expect(result.stderr).toContain("skipped a recursive source");
    expect(result.stderr).toContain("skipped already loaded script:");
  });

  it("does not export source-once state to a fresh Bash process", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'loaded\\n'\n");
    const result = run("safe_source ./script.bash; /bin/bash --noprofile --norc -c '. \"$COMMON\"; safe_source ./script.bash'");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("loaded\nloaded\n");
    expect(result.stderr).toBe("");
  });

  it("supports nounset in a fresh shell and after loading", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'loaded\\n'\n");
    const result = run("set -u; safe_source ./script.bash; safe_source ./script.bash");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("loaded\n");
    expect(result.stderr).toContain("skipped already loaded script:");
    expect(result.stderr).not.toContain("unbound variable");
  });

  it.each(["", "--reload", "one two three"])("rejects invalid arguments %j without executing a script", (args) => {
    const result = run(`safe_source ${args}`);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("[Warning] safe_source expects [--reload] <source> [dest]\n");
  });

  it("prints inline help without reading files", () => {
    const result = run("safe_source --help");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("safe_source: source a syntax-checked script once per Bash process.");
    expect(result.stderr).toBe("");
  });

  it("copies to the optional destination and deduplicates by source", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'copied\\n'\n");
    const result = run("safe_source ./script.bash ./copy.bash; safe_source ./script.bash ./other.bash");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("copied\n");
    expect(fs.readFileSync(path.join(home, "copy.bash"), "utf8")).toBe("printf 'copied\\n'\n");
    expect(fs.existsSync(path.join(home, "other.bash"))).toBe(false);
    expect(result.stderr).toContain("skipped already loaded script:");
  });

  it("does not source a stale destination when copying fails", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'new\\n'\n");
    fs.writeFileSync(path.join(home, "copy.bash"), "printf 'stale\\n'\n");
    fs.mkdirSync(path.join(home, "bin"));
    fs.writeFileSync(path.join(home, "bin/cp"), "#!/bin/bash\nexit 8\n", { mode: 0o755 });
    const result = run('PATH="$HOME/bin:$PATH"; safe_source ./script.bash ./copy.bash');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("[Warning] safe_source copy failed\n");
    expect(fs.readFileSync(path.join(home, "copy.bash"), "utf8")).toBe("printf 'stale\\n'\n");
  });

  it("downloads a URL once and preserves explicit destination support", () => {
    const result = run(
      "function curl() { printf 'download\\n'; printf '%s\\n' \"printf 'remote\\\\n'\" > \"$3\"; }\nsafe_source https://example.com/script.bash ./remote.bash; safe_source https://example.com/script.bash ./remote.bash",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("download\nremote\n");
    expect(result.stderr).toBe("[Warning] safe_source skipped an already loaded URL\n");
    expect(fs.readFileSync(path.join(home, "remote.bash"), "utf8")).toBe("printf 'remote\\n'\n");
  });

  it("does not confuse different URLs sharing the default download destination", () => {
    const result = run(
      'TMPDIR="$HOME"; function curl() { printf \'%s\\n\' "printf \'remote\\\\n\'" > "$3"; }\nsafe_source https://example.com/one; safe_source https://example.com/two',
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("remote\nremote\n");
    expect(result.stderr).toBe("");
  });

  it("retries download failures without caching or exposing the URL", () => {
    const result = run(
      "function curl() { return 9; }\nsafe_source https://example.com/script.bash ./remote.bash; safe_source https://example.com/script.bash ./remote.bash",
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("[Warning] safe_source download failed\n[Warning] safe_source download failed\n");
    expect(fs.existsSync(path.join(home, "remote.bash"))).toBe(false);
  });

  it.each(["./missing.secret.bash", "https://example.com/script.bash ./private.secret.bash"])(
    "rejects protected paths before reading or downloading: %s",
    (args) => {
      const result = run(`function curl() { printf 'unexpected download\\n'; }\nsafe_source ${args}`);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("[Warning] safe_source refused a protected path\n");
    },
  );

  it("rejects an unresolvable optional destination before copying", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'loaded\\n'\n");
    const result = run("safe_source ./script.bash ./absent/copy.bash");
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("[Warning] safe_source cannot resolve an eligible destination\n");
    expect(fs.existsSync(path.join(home, "absent"))).toBe(false);
  });

  it("rejects a protected default download destination before fetching", () => {
    const result = run(
      "TMPDIR=\"$HOME/private.secret.folder\"; function curl() { printf 'unexpected download\\n'; }\nsafe_source https://example.com/script.bash",
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("[Warning] safe_source cannot resolve an eligible download destination\n");
  });

  it("supports using the source itself as the optional destination", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'loaded\\n'\n");
    const result = run("safe_source ./script.bash ./script.bash");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("loaded\n");
    expect(result.stderr).toBe("");
  });

  it("does not grow the registry for explicit reloads of an existing source", () => {
    fs.writeFileSync(path.join(home, "script.bash"), "printf 'loaded\\n'\n");
    const result = run(
      'safe_source ./script.bash; safe_source --reload ./script.bash; printf "keys:%s\\n" "${#_SY_SAFE_SOURCE_LOADED[@]}"',
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("loaded\nloaded\nkeys:1\n");
    expect(result.stderr).toBe("");
  });

  it("allows the existing Python activation caller to reactivate an environment", () => {
    const activation = fs
      .readFileSync("software/scripts/bash-command-wrappers.profile.bash", "utf8")
      .match(/function activate_py\(\) \{[\s\S]*?\n\}/)[0];
    fs.writeFileSync(path.join(home, "activate.bash"), "printf 'active\\n'\nVIRTUAL_ENV=fixture\n");
    const result = run(
      `${activation}\nfunction type() { [ "$2" != python ] && builtin type "$@"; }\nfunction find_path() { printf '%s\\n' "$HOME/activate.bash"; }\nVIRTUAL_ENV=''; activate_py; VIRTUAL_ENV=''; activate_py`,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("active\nactive\n");
    expect(result.stderr).toBe("");
  });

  it("rejects symlink cycles without executing a script", () => {
    fs.symlinkSync("two.bash", path.join(home, "one.bash"));
    fs.symlinkSync("one.bash", path.join(home, "two.bash"));
    const result = run("safe_source ./one.bash");
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("[Warning] safe_source cannot resolve an eligible local file\n");
  });
});
