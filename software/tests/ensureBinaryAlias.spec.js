/** Tests for ensure_binary_alias in software/bootstrap/common-functions.bash. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COMMON_FUNCTIONS = path.join(ROOT_DIR, "software/bootstrap/common-functions.bash");

/**
 * All is_os_* flags emitted by run.sh — must be pre-initialised to 0 in tests so
 * `((is_os_*))` checks don't trip `set -u` (bash 5.x errors on unbound names in
 * arithmetic context; bash 3.2 on mac silently treats them as 0). Mirrors
 * ALL_OS_FLAGS in run.sh / common-env.sh.
 */
const ALL_OS_FLAGS = [
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

/** Tools the helper (and `safe_mkdir`) shells out to. Symlinked into sandbox PATH for hermeticity. */
const REQUIRED_TOOLS = ["mkdir", "ln", "stat", "id", "chown", "chmod", "dirname", "basename", "cat", "rm"];

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_ensure_binary_alias_");
  fs.mkdirSync(path.join(sandbox, "home"));
  fs.mkdirSync(path.join(sandbox, "bin"));
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
 * Drop an executable stub at <sandbox>/bin/<name> so `type -P <name>` resolves to it.
 * @param {string} name
 */
function stubBin(name) {
  const p = path.join(sandbox, "bin", name);
  fs.writeFileSync(p, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(p, 0o755);
  return p;
}

/**
 * Run `ensure_binary_alias <canonical>` in a hermetic bash subshell.
 *
 * @param {object} opts
 * @param {string} opts.canonical - the canonical name to resolve
 * @param {Record<string, number>} [opts.flags] - is_os_* flags to set (e.g. { is_os_ubuntu: 1 })
 * @param {string[]} [opts.bins] - stub binaries to drop into sandbox PATH
 * @returns {{ stdout: string, link: string, linkTarget: string | null, linkExists: boolean, isSymlink: boolean }}
 */
function run({ canonical, flags = {}, bins = [] }) {
  for (const b of bins) stubBin(b);
  // Pre-init all is_os_* flags to 0, then apply per-test overrides — mirrors
  // production, where common-env.sh exports every flag before any setup script runs.
  const mergedFlags = Object.fromEntries([...ALL_OS_FLAGS.map((f) => [f, 0]), ...Object.entries(flags)]);
  const flagAssignments = Object.entries(mergedFlags)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  const home = path.join(sandbox, "home");
  const script = [
    `set -euo pipefail`,
    `HOME=${JSON.stringify(home)}`,
    `PATH=${JSON.stringify(path.join(sandbox, "bin"))}`,
    flagAssignments,
    `source ${JSON.stringify(COMMON_FUNCTIONS)}`,
    `ensure_binary_alias ${JSON.stringify(canonical)}`,
  ].join("\n");
  const scriptPath = path.join(sandbox, "run.sh");
  fs.writeFileSync(scriptPath, script);
  const stdout = execSync(`bash ${JSON.stringify(scriptPath)}`, { encoding: "utf-8" });
  const link = path.join(home, ".local/bin", canonical);
  const linkExists = fs.existsSync(link) || fs.lstatSync(link, { throwIfNoEntry: false }) != null;
  let isSymlink = false;
  let linkTarget = null;
  try {
    const st = fs.lstatSync(link);
    isSymlink = st.isSymbolicLink();
    if (isSymlink) linkTarget = fs.readlinkSync(link);
  } catch {
    /* not present */
  }
  return { stdout, link, linkTarget, linkExists, isSymlink };
}

describe("ensure_binary_alias", () => {
  it("creates bat -> batcat symlink on Ubuntu when batcat exists and bat does not", () => {
    const { stdout, linkTarget, isSymlink } = run({
      canonical: "bat",
      flags: { is_os_ubuntu: 1 },
      bins: ["batcat"],
    });
    expect(isSymlink).toBe(true);
    expect(linkTarget).toBe(path.join(sandbox, "bin", "batcat"));
    expect(stdout).toMatch(/Linked .*\/bat -> .*\/batcat/);
  });

  it("creates fd -> fdfind symlink on ChromeOS when fdfind exists and fd does not", () => {
    const { stdout, linkTarget, isSymlink } = run({
      canonical: "fd",
      flags: { is_os_chromeos: 1 },
      bins: ["fdfind"],
    });
    expect(isSymlink).toBe(true);
    expect(linkTarget).toBe(path.join(sandbox, "bin", "fdfind"));
    expect(stdout).toMatch(/Linked .*\/fd -> .*\/fdfind/);
  });

  it("is a no-op when canonical binary already exists on PATH", () => {
    const { stdout, linkExists } = run({
      canonical: "bat",
      flags: { is_os_ubuntu: 1 },
      bins: ["bat", "batcat"],
    });
    expect(linkExists).toBe(false);
    expect(stdout).toMatch(/Skipped \(already on PATH\)/);
  });

  it("is a no-op when there is no override for the OS (e.g. mac, redhat, arch)", () => {
    for (const flag of ["is_os_mac", "is_os_redhat", "is_os_arch_linux", "is_os_steamos"]) {
      const { stdout, linkExists } = run({
        canonical: "bat",
        flags: { [flag]: 1 },
        bins: ["batcat"], // present, but should be ignored on these OSes
      });
      expect(linkExists, `no link should be created on ${flag}`).toBe(false);
      // No "Skipped" message printed in this branch — just silent return.
      expect(stdout).not.toMatch(/Linked/);
    }
  });

  it("is a no-op when override binary itself is missing (nothing to link to)", () => {
    const { stdout, linkExists } = run({
      canonical: "fd",
      flags: { is_os_ubuntu: 1 },
      bins: [], // no fdfind installed
    });
    expect(linkExists).toBe(false);
    expect(stdout).toMatch(/Skipped \(no fdfind found\)/);
  });

  it("refuses to overwrite a real (non-symlink) file at the target path", () => {
    // Pre-create a real file where the symlink would go.
    const realFile = path.join(sandbox, "home", ".local/bin/bat");
    fs.mkdirSync(path.dirname(realFile), { recursive: true });
    fs.writeFileSync(realFile, "real binary stub");
    const { stdout, isSymlink } = run({
      canonical: "bat",
      flags: { is_os_ubuntu: 1 },
      bins: ["batcat"],
    });
    expect(isSymlink).toBe(false);
    expect(fs.readFileSync(realFile, "utf-8")).toBe("real binary stub");
    expect(stdout).toMatch(/Skipped \(real file at/);
  });

  it("replaces an existing symlink with a fresh one", () => {
    const linkPath = path.join(sandbox, "home", ".local/bin/bat");
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync("/nonexistent/old-target", linkPath);
    const { linkTarget, isSymlink } = run({
      canonical: "bat",
      flags: { is_os_ubuntu: 1 },
      bins: ["batcat"],
    });
    expect(isSymlink).toBe(true);
    expect(linkTarget).toBe(path.join(sandbox, "bin", "batcat"));
  });
});
