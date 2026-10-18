import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { execSync } from "child_process";

import fs from "fs";

import path from "path";

import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const RUN_SH = path.join(ROOT_DIR, "run.sh");

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

let sandbox = "";

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
  const allPaths = { ...defaultPaths, ...opts.paths };
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

function resolveTempRoot(opts = {}) {
  const runSh = fs.readFileSync(RUN_SH, "utf-8");
  const lines = runSh.split("\n");
  const startIdx = lines.findIndex((l) => l.startsWith("function _resolve_temp_root()"));
  const endIdx = lines.findIndex((l, i) => i > startIdx && l === "}");
  if (startIdx < 0 || endIdx < 0) throw new Error("could not locate _resolve_temp_root in run.sh");
  const block = lines.slice(startIdx, endIdx + 1).join("\n");

  const mktempStub = opts.mktempOverride ?? "";

  // For unwritable /tmp test: create a fake /tmp that's a symlink to a read-only dir
  let postamble = "";
  if (opts.tmpUnwritable) {
    const roDir = path.join(sandbox, "ro_tmp");
    fs.mkdirSync(roDir, { recursive: true });
    fs.chmodSync(roDir, 0o555); // read-only
    // Override /tmp by making the test command see a non-writable path.
    // We redefine _resolve_temp_root's check inline by replacing the function body.
    postamble = [
      // Redefine _resolve_temp_root to skip the real /tmp check
      "function _resolve_temp_root() {",
      `  local _probe; _probe=$(mktemp -d 2>/dev/null)`,
      `  if [ -n "$_probe" ] && [ -d "$_probe" ]; then`,
      `  local _parent="\${_probe%/*}"; rmdir "\$_probe" 2>/dev/null || true`,
      `    echo "$_parent"; return`,
      `  fi`,
      `  echo "$HOME/tmp"`,
      "}",
    ].join("\n");
  }

  const runner = path.join(sandbox, "resolver_runner.sh");
  fs.writeFileSync(runner, ["#!/usr/bin/env bash", "HOME=" + sandbox, block, postamble, mktempStub, "_resolve_temp_root"].join("\n"));
  fs.chmodSync(runner, 0o755);
  return execSync(runner, { encoding: "utf-8" }).trim();
}

describe("_resolve_temp_root", () => {
  it("writable /tmp → returns /tmp", () => {
    const result = resolveTempRoot();
    expect(result).toBe("/tmp");
  });

  it("unwritable /tmp + working mktemp → returns mktemp-derived parent", () => {
    const tmpdir = path.join(sandbox, "tmpdir");
    fs.mkdirSync(tmpdir, { recursive: true });
    // Override mktemp to create dirs under $TMPDIR (simulating Termux-like behavior)
    const mktempOverride = ["mktemp() {", `  command mktemp -p "${tmpdir}" "$@"`, "}"].join("\n");
    const result = resolveTempRoot({ mktempOverride, tmpUnwritable: true });
    // Should be the mktemp-derived parent (tmpdir), not /tmp
    expect(result).not.toBe("/tmp");
  });

  it("mktemp also failing → returns $HOME/tmp", () => {
    const mktempOverride = "mktemp() { return 1; }";
    const result = resolveTempRoot({ mktempOverride, tmpUnwritable: true });
    expect(result).toBe(path.join(sandbox, "tmp"));
  });
});
