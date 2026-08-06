/**
 * Tests for the freshness gate in _npm_install_global (software/bootstrap/common-functions.bash).
 *
 * The gate exists so a fresh CLI is not re-downloaded on every run. Its failure mode is silent
 * and total: it used to accept a fresh ~/.local/lib/node_modules/<pkg> tree as proof of a
 * working install, so any caller that deleted ~/.local/bin/<bin> to force a clean reinstall
 * (claude/install.sh, copilot/install.sh's self-heal) made the gate skip the npm call and left
 * the launcher permanently deleted — a fully installed package tree with `claude: command not
 * found`. These tests pin both directions: a package that declares a bin must reinstall when
 * its launcher is gone, and a package that ships no bin at all must still skip on the
 * node_modules marker alone.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COMMON_ENV = path.join(ROOT_DIR, "software/bootstrap/common-env.sh");
const COMMON_FUNCTIONS = path.join(ROOT_DIR, "software/bootstrap/common-functions.bash");

/** Host tools the gate and its helpers shell out to. Symlinked into the sandbox PATH. */
const REQUIRED_TOOLS = [
  "stat",
  "date",
  "file",
  "uname",
  "rm",
  "mkdir",
  "dirname",
  "basename",
  "sysctl",
  "tr",
  "cut",
  "sed",
  "grep",
  "cat",
  "ln",
  "awk",
  "head",
  "id",
  "chmod",
  "arch",
];

let sandbox = "";

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_npm_install_global_gate_");
  fs.mkdirSync(path.join(sandbox, "bin"));
  fs.mkdirSync(path.join(sandbox, "home"));
  fs.mkdirSync(path.join(sandbox, "tmp"));
  for (const tool of REQUIRED_TOOLS) {
    for (const dir of ["/usr/bin", "/bin", "/usr/sbin", "/sbin", "/usr/local/bin", "/opt/homebrew/bin"]) {
      const src = path.join(dir, tool);
      if (fs.existsSync(src)) {
        fs.symlinkSync(src, path.join(sandbox, "bin", tool));
        break;
      }
    }
  }
  // _npm_global_declares_bin reads package.json through node — use the node running vitest.
  fs.symlinkSync(process.execPath, path.join(sandbox, "bin", "node"));
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Lay down a fake global npm install under the sandbox HOME.
 *
 * @param {object} opts
 * @param {string} opts.pkg - package name as it appears under lib/node_modules (e.g. "@anthropic-ai/claude-code")
 * @param {object|string|null} opts.bin - the package.json `bin` field; null omits it entirely
 * @param {string} [opts.launcher] - name of the launcher to create in ~/.local/bin (omit for none)
 */
function seedInstall({ pkg, bin, launcher }) {
  const home = path.join(sandbox, "home");
  const libDir = path.join(home, ".local/lib/node_modules", pkg);
  fs.mkdirSync(libDir, { recursive: true });
  const pkgJson = { name: pkg, version: "1.0.0" };
  if (bin != null) pkgJson.bin = bin;
  fs.writeFileSync(path.join(libDir, "package.json"), JSON.stringify(pkgJson));
  if (launcher) {
    const binDir = path.join(home, ".local/bin");
    fs.mkdirSync(binDir, { recursive: true });
    // npm installs launchers as symlinks into the package tree; mirror that shape.
    fs.symlinkSync(path.join(libDir, "launcher.js"), path.join(binDir, launcher));
    fs.writeFileSync(path.join(libDir, "launcher.js"), "#!/usr/bin/env node\n");
    fs.chmodSync(path.join(libDir, "launcher.js"), 0o755);
  }
}

/**
 * Drive `_npm_install_global <pkg> <bin> true` in a hermetic bash subshell with the real
 * `npm install -g` stubbed out, and report whether the gate skipped or let the install run.
 *
 * @param {object} opts
 * @param {string} opts.pkg
 * @param {string} opts.bin
 * @returns {{ stdout: string, skipped: boolean, installed: boolean }}
 */
function run({ pkg, bin }) {
  const home = path.join(sandbox, "home");
  const marker = path.join(sandbox, "install-attempted");
  const script = [
    `HOME=${JSON.stringify(home)}`,
    `PATH=${JSON.stringify(path.join(sandbox, "bin"))}`,
    `export BASHRC_TEMP_DIR=${JSON.stringify(path.join(sandbox, "tmp"))}`,
    `IS_REFRESH_MODE=0`,
    `IS_FORCE_REFRESH=0`,
    `IS_CI=0`,
    `is_os_wsl=0`,
    `source ${JSON.stringify(COMMON_ENV)} > /dev/null 2>&1`,
    `source ${JSON.stringify(COMMON_FUNCTIONS)}`,
    // Stub the two things that would touch the network / the real filesystem. A marker file
    // is the signal that the gate let the install through.
    `function find_native_node() { return 1; }`,
    `function run_native() { echo "$*" >> ${JSON.stringify(marker)}; return 0; }`,
    `_npm_install_global ${JSON.stringify(pkg)} ${JSON.stringify(bin)} true`,
  ].join("\n");
  const scriptPath = path.join(sandbox, "run.sh");
  fs.writeFileSync(scriptPath, script);
  const stdout = execFileSync("bash", [scriptPath], { encoding: "utf-8" });
  return {
    stdout,
    skipped: />> Skipped \(not stale:/.test(stdout),
    installed: fs.existsSync(marker),
  };
}

describe("_npm_install_global freshness gate", () => {
  it("reinstalls when the launcher was deleted but the package tree survived (claude)", () => {
    // Exactly the broken state claude/install.sh's old unconditional `rm -f ~/.local/bin/claude`
    // produced: fresh node_modules tree, no launcher, so `claude: command not found` forever.
    seedInstall({ pkg: "@anthropic-ai/claude-code", bin: { claude: "bin/claude.exe" } });
    const { skipped, installed } = run({ pkg: "@anthropic-ai/claude-code", bin: "claude" });
    expect(skipped).toBe(false);
    expect(installed).toBe(true);
  });

  it("reinstalls a missing launcher declared in the string form of `bin` (prettier)", () => {
    seedInstall({ pkg: "prettier", bin: "bin/prettier.cjs" });
    const { skipped, installed } = run({ pkg: "prettier", bin: "prettier" });
    expect(skipped).toBe(false);
    expect(installed).toBe(true);
  });

  it("skips a healthy install where the launcher is present", () => {
    seedInstall({ pkg: "@github/copilot", bin: { copilot: "npm-loader.js" }, launcher: "copilot" });
    const { skipped, installed } = run({ pkg: "@github/copilot", bin: "copilot" });
    expect(skipped).toBe(true);
    expect(installed).toBe(false);
  });

  it("skips when the launcher is renamed and present under that name (typescript -> tsc)", () => {
    seedInstall({ pkg: "typescript", bin: { tsc: "bin/tsc" }, launcher: "tsc" });
    const { skipped, installed } = run({ pkg: "typescript", bin: "tsc" });
    expect(skipped).toBe(true);
    expect(installed).toBe(false);
  });

  it("skips packages that ship no bin at all (vscode-markdown-languageserver)", () => {
    // The node_modules marker is the only evidence these can ever offer — holding them to a
    // launcher would reinstall them on every single run.
    seedInstall({ pkg: "vscode-markdown-languageserver", bin: null });
    const { skipped, installed } = run({
      pkg: "vscode-markdown-languageserver",
      bin: "vscode-markdown-language-server",
    });
    expect(skipped).toBe(true);
    expect(installed).toBe(false);
  });

  it("skips a package whose `bin` map is empty", () => {
    seedInstall({ pkg: "some-lib", bin: {} });
    const { skipped, installed } = run({ pkg: "some-lib", bin: "some-lib" });
    expect(skipped).toBe(true);
    expect(installed).toBe(false);
  });

  it("installs when nothing is present at all (first run)", () => {
    const { skipped, installed } = run({ pkg: "@google/gemini-cli", bin: "gemini" });
    expect(skipped).toBe(false);
    expect(installed).toBe(true);
  });
});
