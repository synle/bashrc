/** OS detection tests for run.sh — verifies is_os_* flag isolation across distros. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUN_SH = path.join(ROOT_DIR, "run.sh");

/** All flags emitted by run.sh — matches ALL_OS_FLAGS in common-env.sh. */
const ALL_FLAGS = [
  "is_os_mac",
  "is_os_ubuntu",
  "is_os_chromeos",
  "is_os_mingw64",
  "is_os_android_termux",
  "is_os_arch_linux",
  "is_os_steamos",
  "is_os_redhat",
  "is_os_windows",
  "is_os_wsl",
];

/** Per-test sandbox dir — holds fake os-release / proc-version / stub bins / fake paths. */
let sandbox = "";

/**
 * Tools _detect_os calls internally (via `sed`, `grep`, etc.) — we need them in
 * PATH for the function to work, but we can't include /usr/bin wholesale because
 * that would leak apt-get / dnf / pacman into tests that don't opt in.
 */
const REQUIRED_TOOLS = ["sed", "grep", "awk", "tr", "cut", "head", "cat"];

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_os_detect_test_");
  fs.mkdirSync(path.join(sandbox, "bin"));
  // Symlink required tools from the host into the sandbox bin. This lets the
  // sandbox PATH stay hermetic (no /usr/bin) so package-manager binaries
  // (apt-get/dnf/pacman) are only visible when a test explicitly adds them.
  for (const tool of REQUIRED_TOOLS) {
    for (const dir of ["/usr/bin", "/bin", "/usr/local/bin", "/opt/homebrew/bin"]) {
      const src = path.join(dir, tool);
      if (fs.existsSync(src)) {
        fs.symlinkSync(src, path.join(sandbox, "bin", tool));
        break;
      }
    }
  }
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Drive the OS-detection block of run.sh in a hermetic subshell and return the resulting flags.
 * Substitutes /etc/os-release and /proc/version with sandbox paths so we can fake them.
 *
 * @param {object} opts
 * @param {string} [opts.osRelease] - contents of fake /etc/os-release (omit = empty file)
 * @param {string} [opts.procVersion] - contents of fake /proc/version (omit = empty file)
 * @param {string} [opts.ostype] - value to set OSTYPE to
 * @param {string[]} [opts.bins] - stub binaries to drop into sandbox PATH (e.g. ["pacman", "apt-get"])
 * @param {Record<string, string>} [opts.paths] - extra path substitutions, e.g. { "/Applications": "<sandbox>/applications" }
 * @returns {Record<string, number>}
 */
function detectFlags(opts = {}) {
  const osReleasePath = path.join(sandbox, "os-release");
  const procVersionPath = path.join(sandbox, "proc-version");
  fs.writeFileSync(osReleasePath, opts.osRelease ?? "");
  fs.writeFileSync(procVersionPath, opts.procVersion ?? "");

  // Stub binaries: empty executable scripts so `type -P <name>` finds them.
  for (const bin of opts.bins ?? []) {
    const p = path.join(sandbox, "bin", bin);
    fs.writeFileSync(p, "#!/bin/sh\nexit 0\n");
    fs.chmodSync(p, 0o755);
  }

  // Read run.sh and pull out the detection block (function + assignments).
  // Line range covers `_detect_os` def through `is_os_wsl` assignment.
  const runSh = fs.readFileSync(RUN_SH, "utf-8");
  const lines = runSh.split("\n");
  // Find `function _detect_os() {` and `is_os_wsl=...` lines dynamically so the
  // test stays robust against future line-number shifts.
  const startIdx = lines.findIndex((l) => l.startsWith("function _detect_os()"));
  const endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith("is_os_wsl="));
  if (startIdx < 0 || endIdx < 0) throw new Error("could not locate detection block in run.sh");
  let block = lines.slice(startIdx, endIdx + 1).join("\n");

  // Redirect file lookups to our sandbox copies.
  block = block.replace(/\/etc\/os-release/g, osReleasePath).replace(/\/proc\/version/g, procVersionPath);

  // Remap path-mode substitutions. By default, every OS-specific path is rewritten
  // to a sandbox stub that does NOT exist, so the test host's real filesystem
  // (e.g. /Applications on macOS, /mnt/c/Windows on WSL) can't leak detections.
  // Callers opt in to a specific OS by overriding the path with a real sandbox dir.
  /** @type {Record<string, string>} */
  const defaultPaths = {
    "/Applications": path.join(sandbox, "no-applications"),
    "/mnt/c/Windows": path.join(sandbox, "no-mnt-c-windows"),
    "/c/Windows": path.join(sandbox, "no-c-windows"),
    "/dev/.cros_milestone": path.join(sandbox, "no-cros-milestone"),
    "/mingw64": path.join(sandbox, "no-mingw64"),
    "/data/data/com.termux": path.join(sandbox, "no-termux"),
  };
  const allPaths = { ...defaultPaths, ...(opts.paths ?? {}) };
  // Sort keys longest-first to avoid shorter prefixes shadowing longer ones
  // (e.g. "/c/Windows" must be applied before any "/c/..." sibling).
  for (const from of Object.keys(allPaths).sort((a, b) => b.length - a.length)) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    block = block.replace(new RegExp(escaped, "g"), allPaths[from]);
  }

  // Build the runner script: set up env, source the patched block, echo each flag value.
  const runner = path.join(sandbox, "runner.sh");
  const echoFlags = ALL_FLAGS.map((f) => `echo ${f}=\${${f}:-MISSING}`).join("\n");
  fs.writeFileSync(
    runner,
    [
      "#!/usr/bin/env bash",
      // Hermetic PATH: only sandbox bin + minimal system bins (so `type` etc. work).
      // Hermetic PATH: only sandbox bin (which has our required-tool symlinks
      // plus any opt-in stub bins). NOT /usr/bin or /bin — those would leak
      // host-installed apt-get/dnf/pacman into tests that didn't opt in.
      `export PATH="${path.join(sandbox, "bin")}"`,
      `export OSTYPE="${opts.ostype ?? ""}"`,
      block,
      echoFlags,
    ].join("\n"),
  );

  const out = execSync(`bash "${runner}"`, { encoding: "utf-8" });
  /** @type {Record<string, number>} */
  const flags = {};
  for (const line of out.trim().split("\n")) {
    const m = line.match(/^(is_os_[a-z0-9_]+)=(\d+)$/);
    if (m) flags[m[1]] = Number(m[2]);
  }
  return flags;
}

describe("OS detection flag isolation", () => {
  it("clean Ubuntu (ID=ubuntu, linux OSTYPE) → only is_os_ubuntu=1", () => {
    const flags = detectFlags({
      osRelease: "ID=ubuntu\nID_LIKE=debian\n",
      ostype: "linux-gnu",
      bins: ["apt-get"],
    });
    expect(flags.is_os_ubuntu).toBe(1);
    expect(flags.is_os_arch_linux).toBe(0);
    expect(flags.is_os_redhat).toBe(0);
    expect(flags.is_os_mac).toBe(0);
    expect(flags.is_os_windows).toBe(0);
  });

  it("Arch container on Ubuntu host kernel (regression) → is_os_arch_linux=1, is_os_ubuntu=0", () => {
    // The actual bug: GitHub Actions Arch runner had /proc/version = Ubuntu kernel
    // AND apt-get on PATH (somehow), so both flags fired and both _full-setup.sh ran.
    const flags = detectFlags({
      osRelease: "ID=arch\n",
      // /proc/version on the runner contains "Ubuntu" because the host kernel is Ubuntu.
      procVersion: "Linux version 6.5.0-1025-azure (buildd@lcy02-amd64-058) (Ubuntu 13.2.0-23ubuntu4)\n",
      ostype: "linux-gnu",
      bins: ["pacman", "apt-get"],
    });
    expect(flags.is_os_arch_linux).toBe(1);
    expect(flags.is_os_ubuntu).toBe(0);
    expect(flags.is_os_redhat).toBe(0);
  });

  it("RedHat (ID=fedora) → is_os_redhat=1, is_os_ubuntu=0 even with apt-get on PATH", () => {
    const flags = detectFlags({
      osRelease: "ID=fedora\n",
      ostype: "linux-gnu",
      bins: ["dnf", "apt-get"],
    });
    expect(flags.is_os_redhat).toBe(1);
    expect(flags.is_os_ubuntu).toBe(0);
    expect(flags.is_os_arch_linux).toBe(0);
  });

  it("SteamOS → both is_os_arch_linux=1 AND is_os_steamos=1, is_os_ubuntu=0", () => {
    const flags = detectFlags({
      osRelease: "ID=steamos\nID_LIKE=arch\n",
      ostype: "linux-gnu",
      bins: ["pacman"],
    });
    expect(flags.is_os_steamos).toBe(1);
    expect(flags.is_os_arch_linux).toBe(1);
    expect(flags.is_os_ubuntu).toBe(0);
  });

  it("macOS (OSTYPE=darwin + /Applications exists) → is_os_mac=1 only", () => {
    const apps = path.join(sandbox, "applications");
    fs.mkdirSync(apps);
    const flags = detectFlags({
      ostype: "darwin23",
      paths: { "/Applications": apps },
      bins: ["brew"],
    });
    expect(flags.is_os_mac).toBe(1);
    expect(flags.is_os_ubuntu).toBe(0);
    expect(flags.is_os_arch_linux).toBe(0);
  });

  it("WSL Ubuntu (ID=ubuntu + /mnt/c/Windows exists) → is_os_ubuntu=1 AND is_os_windows=1", () => {
    const winRoot = path.join(sandbox, "mnt-c-windows");
    fs.mkdirSync(winRoot);
    const flags = detectFlags({
      osRelease: "ID=ubuntu\nID_LIKE=debian\n",
      ostype: "linux-gnu",
      bins: ["apt-get"],
      paths: { "/mnt/c/Windows": winRoot },
    });
    // WSL legitimately keeps both flags set.
    expect(flags.is_os_ubuntu).toBe(1);
    expect(flags.is_os_windows).toBe(1);
    expect(flags.is_os_wsl).toBe(1);
    expect(flags.is_os_arch_linux).toBe(0);
  });

  it("ChromeOS (Crostini) → is_os_chromeos=1, is_os_ubuntu=0 even with apt-get", () => {
    const cros = path.join(sandbox, "cros-milestone");
    fs.writeFileSync(cros, "");
    const flags = detectFlags({
      osRelease: "ID=debian\n",
      ostype: "linux-gnu",
      bins: ["apt-get"],
      paths: { "/dev/.cros_milestone": cros },
    });
    expect(flags.is_os_chromeos).toBe(1);
    expect(flags.is_os_ubuntu).toBe(0);
  });

  it("Android Termux (TERMUX_VERSION env) → is_os_android_termux=1, is_os_ubuntu=0", () => {
    const termuxRoot = path.join(sandbox, "termux");
    fs.mkdirSync(termuxRoot);
    const flags = detectFlags({
      osRelease: "ID=debian\n", // Termux pkg is apt-based but should NOT be ubuntu.
      ostype: "linux-android",
      bins: ["apt-get"],
      paths: { "/data/data/com.termux": termuxRoot },
    });
    // TERMUX_VERSION is the env-var trigger — set in run.sh check via _detect_os --env.
    process.env.TERMUX_VERSION = "0.118.0";
    try {
      const flags2 = detectFlags({
        osRelease: "ID=debian\n",
        ostype: "linux-android",
        bins: ["apt-get"],
        paths: { "/data/data/com.termux": termuxRoot },
      });
      expect(flags2.is_os_android_termux).toBe(1);
      expect(flags2.is_os_ubuntu).toBe(0);
    } finally {
      delete process.env.TERMUX_VERSION;
    }
    // Sanity: without TERMUX_VERSION but with the path, the path check still triggers it.
    expect(flags.is_os_android_termux).toBe(1);
  });

  it("Empty/unknown system → all flags 0", () => {
    const flags = detectFlags({});
    for (const f of ALL_FLAGS) {
      expect(flags[f], `${f} should be 0`).toBe(0);
    }
  });
});
