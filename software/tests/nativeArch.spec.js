/**
 * Tests for the CPU-arch helpers shared by common-functions.bash and profile-core.sh:
 * get_native_arch, is_arch_translated, run_native, plus binary_arch_mismatch
 * (scripts-only, lives in common-functions.bash).
 *
 * Why these exist: on Apple Silicon a process started by an Intel binary runs
 * translated under Rosetta 2, `uname -m` then reports x86_64, and every installer
 * downstream picks Intel artifacts — Homebrew bottles, npm optional dependencies,
 * GUI app slices. Bun-compiled CLIs (opencode, claude) installed that way warn
 * "CPU lacks AVX support, strange crashes may occur" on every launch, because
 * Rosetta 2 does not emulate AVX.
 *
 * Strategy (mirrors isHelpArg.spec.js / osDetection.spec.js): extract each function
 * body by line markers so the tests survive line-number drift, then replay it in a
 * hermetic bash subprocess where uname / sysctl / file / arch are shell-function
 * stubs. No real hardware detection is involved, so the suite behaves identically
 * on macOS and Linux CI runners.
 *
 * Only the common-functions.bash copies are exercised — byte-identical parity with
 * the profile-core.sh mirrors is enforced by mirroredFunctionParity.spec.js, so
 * testing one copy covers both.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COMMON_FUNCTIONS = path.join(ROOT_DIR, "software/bootstrap/common-functions.bash");

/**
 * Pull a single function definition out of a shell file by line markers — the
 * surrounding scripts run top-level statements that cannot execute in a hermetic
 * harness.
 * @param {string} file - absolute path to the source file
 * @param {string} name - function name to extract (without the `function` keyword)
 * @returns {string} the function definition block, ready to source in bash
 */
function extractFunction(file, name) {
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  const start = lines.findIndex((l) => l.startsWith(`function ${name}()`));
  if (start === -1) throw new Error(`could not locate 'function ${name}()' in ${file}`);
  let close = start + 1;
  while (close < lines.length && lines[close] !== "}") close++;
  if (close === lines.length) throw new Error(`could not locate closing brace of ${name} in ${file}`);
  return lines.slice(start, close + 1).join("\n");
}

/**
 * Bash stubs for the external commands the helpers shell out to. Shell functions
 * shadow real binaries, so the helpers run unchanged against fake hardware.
 * @param {object} opts - fake machine description
 * @param {string} opts.kernel - `uname -s` output (Darwin, Linux, ...)
 * @param {string} opts.machine - `uname -m` output (what the *process* sees)
 * @param {string} [opts.armHardware] - `sysctl -n hw.optional.arm64` output
 * @param {string} [opts.translated] - `sysctl -n sysctl.proc_translated` output
 * @param {string} [opts.fileOutput] - `file -L` output for binary_arch_mismatch
 * @returns {string} bash source defining the stubs
 */
function stubs({ kernel, machine, armHardware = "", translated = "", fileOutput = "" }) {
  return `
function uname() {
  case "\${1:-}" in
  -s) echo ${JSON.stringify(kernel)} ;;
  -m) echo ${JSON.stringify(machine)} ;;
  esac
}
function sysctl() {
  case "\${2:-}" in
  hw.optional.arm64) [ -n ${JSON.stringify(armHardware)} ] && echo ${JSON.stringify(armHardware)} || return 1 ;;
  sysctl.proc_translated) [ -n ${JSON.stringify(translated)} ] && echo ${JSON.stringify(translated)} || return 1 ;;
  esac
}
function file() { echo ${JSON.stringify(fileOutput)}; }
`;
}

/**
 * Run a bash snippet via stdin and capture stdout.
 * @param {string} script - bash source to execute
 * @returns {string} trimmed stdout
 */
function runBash(script) {
  return execSync("bash", { input: script, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
}

/**
 * Run a bash snippet via stdin and report whether it exited 0.
 * @param {string} script - bash source to execute
 * @returns {boolean} true when the snippet exited 0
 */
function runBashOk(script) {
  try {
    execSync("bash", { input: script, stdio: ["pipe", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

const BODIES = {
  get_native_arch: extractFunction(COMMON_FUNCTIONS, "get_native_arch"),
  is_arch_translated: extractFunction(COMMON_FUNCTIONS, "is_arch_translated"),
  run_native: extractFunction(COMMON_FUNCTIONS, "run_native"),
  binary_arch_mismatch: extractFunction(COMMON_FUNCTIONS, "binary_arch_mismatch"),
};

/** Every helper together — several of them call each other. */
const ALL_BODIES = Object.values(BODIES).join("\n");

describe("get_native_arch", () => {
  it("reports arm64 on Apple Silicon even when the process is translated to x86_64", () => {
    const script = `${stubs({ kernel: "Darwin", machine: "x86_64", armHardware: "1", translated: "1" })}
${BODIES.get_native_arch}
get_native_arch`;
    expect(runBash(script)).toBe("arm64");
  });

  it("reports x86_64 on an Intel Mac", () => {
    const script = `${stubs({ kernel: "Darwin", machine: "x86_64" })}
${BODIES.get_native_arch}
get_native_arch`;
    expect(runBash(script)).toBe("x86_64");
  });

  it("falls back to uname -m off macOS", () => {
    const script = `${stubs({ kernel: "Linux", machine: "aarch64" })}
${BODIES.get_native_arch}
get_native_arch`;
    expect(runBash(script)).toBe("aarch64");
  });
});

describe("is_arch_translated", () => {
  it("is true for an x86_64 process on Apple Silicon (Rosetta 2)", () => {
    const script = `${stubs({ kernel: "Darwin", machine: "x86_64", armHardware: "1", translated: "1" })}
${BODIES.is_arch_translated}
is_arch_translated`;
    expect(runBashOk(script)).toBe(true);
  });

  it("is false for a native arm64 process", () => {
    const script = `${stubs({ kernel: "Darwin", machine: "arm64", armHardware: "1", translated: "0" })}
${BODIES.is_arch_translated}
is_arch_translated`;
    expect(runBashOk(script)).toBe(false);
  });

  it("is false off macOS, where sysctl does not exist", () => {
    const script = `${stubs({ kernel: "Linux", machine: "x86_64" })}
${BODIES.is_arch_translated}
is_arch_translated`;
    expect(runBashOk(script)).toBe(false);
  });
});

describe("run_native", () => {
  it("re-launches through `arch -<native>` when translated", () => {
    const script = `${stubs({ kernel: "Darwin", machine: "x86_64", armHardware: "1", translated: "1" })}
function arch() { echo "arch called: $*"; }
${ALL_BODIES}
run_native echo hello`;
    expect(runBash(script)).toBe("arch called: -arm64 echo hello");
  });

  it("runs the command unchanged when not translated", () => {
    const script = `${stubs({ kernel: "Darwin", machine: "arm64", armHardware: "1", translated: "0" })}
function arch() { echo "arch called: $*"; }
${ALL_BODIES}
run_native echo hello`;
    expect(runBash(script)).toBe("hello");
  });

  it("runs the command unchanged on Linux", () => {
    const script = `${stubs({ kernel: "Linux", machine: "x86_64" })}
${ALL_BODIES}
run_native echo hello`;
    expect(runBash(script)).toBe("hello");
  });

  it("propagates the wrapped command's exit status", () => {
    const script = `${stubs({ kernel: "Darwin", machine: "x86_64", armHardware: "1", translated: "1" })}
function arch() { shift; "$@"; }
${ALL_BODIES}
run_native false`;
    expect(runBashOk(script)).toBe(false);
  });
});

describe("binary_arch_mismatch", () => {
  /**
   * Build a snippet that checks a fake binary whose `file -L` output is supplied.
   * The probe is a real temp file so the helper's existence guard passes; its
   * contents are irrelevant because `file` is stubbed.
   * @param {object} machine - fake machine description passed through to stubs()
   * @param {string} fileOutput - `file -L` output for the probed path
   * @returns {boolean} true when the helper reports a mismatch
   */
  function checkMismatch(machine, fileOutput) {
    return runBashOk(`${stubs({ ...machine, fileOutput })}
${ALL_BODIES}
_probe=$(command mktemp)
binary_arch_mismatch "$_probe"
_status=$?
command rm -f "$_probe"
exit $_status`);
  }

  const appleSilicon = { kernel: "Darwin", machine: "x86_64", armHardware: "1", translated: "1" };

  it("flags an Intel-only Mach-O binary on Apple Silicon", () => {
    expect(checkMismatch(appleSilicon, "Mach-O 64-bit executable x86_64")).toBe(true);
  });

  it("accepts a native arm64 Mach-O binary", () => {
    expect(checkMismatch(appleSilicon, "Mach-O 64-bit executable arm64")).toBe(false);
  });

  it("accepts a universal binary that carries an arm64 slice", () => {
    expect(checkMismatch(appleSilicon, "Mach-O universal binary with 2 architectures: [x86_64] [arm64]")).toBe(false);
  });

  it("ignores launcher scripts, which are arch-independent", () => {
    expect(checkMismatch(appleSilicon, "a /usr/bin/env node script text executable, ASCII text")).toBe(false);
  });

  it("flags an arm64-only binary on an Intel Mac", () => {
    expect(checkMismatch({ kernel: "Darwin", machine: "x86_64" }, "Mach-O 64-bit executable arm64")).toBe(true);
  });

  it("never fires off macOS, where `file` spells ELF arches differently", () => {
    expect(checkMismatch({ kernel: "Linux", machine: "x86_64" }, "ELF 64-bit LSB pie executable, ARM aarch64")).toBe(false);
  });
});
