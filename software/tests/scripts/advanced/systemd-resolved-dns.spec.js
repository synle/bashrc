/** Isolated installer contract tests; no host DNS files or services are accessed. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { getIndexConstant, getIndexFunction } from "../../setup.js";

/** Absolute source identity used for reading and optional VM coverage. @type {string} */
const SCRIPT_PATH = path.resolve("software/scripts/advanced/systemd-resolved-dns.su.js");
/** Fixed installer target represented only by in-memory fixture data. @type {string} */
const CONFIG_PATH = "/etc/systemd/resolved.conf";
/** Resolver block prescribed by the request, with an accurate Quad9 label. @type {string} */
const DNS_BLOCK = `# Sy Bootstrap DNS Cloudflare DNS with Family Filter
[Resolve]
# Primary: Cloudflare Family (Malware + Family Content Filter)
DNS=1.1.1.3 1.0.0.3 2606:4700:4700::1113 2606:4700:4700::1003
# Fallback: Quad9 (Malware blocking + ECS; no family content filter)
FallbackDNS=9.9.9.11 149.112.112.11 2620:fe::11`;

/**
 * Load the installer with owned IO boundaries represented by private fixture state.
 * @param {string} [content=""] - Existing configuration bytes.
 * @returns {object} VM context, effect records, and callable installer entry point.
 * @throws {Error} When repository source cannot be loaded.
 * No host filesystem mutation or subprocess execution is available to the VM.
 */
function fixture(content = "") {
  const effects = { backups: [], writes: [], commands: [], logs: [] };
  const context = vm.createContext({
    IS_DRY_RUN: false,
    EXEC_DEFAULT_TIMEOUT_MS: getIndexConstant("EXEC_DEFAULT_TIMEOUT_MS"),
    EXEC_MAX_TIMEOUT_MS: getIndexConstant("EXEC_MAX_TIMEOUT_MS"),
    global: { is_os_mac: 0, is_os_windows: 0, is_os_android_termux: 0 },
    process: { getuid: () => 0 },
    ScriptSkipError: class ScriptSkipError extends Error {},
    content,
    exists: true,
    systemctlAvailable: true,
    fs: {
      readFileSync: (target, encoding) => {
        expect(target).toBe(CONFIG_PATH);
        expect(encoding).toBe("utf8");
        return context.content;
      },
    },
    pathExists: (target, match, type) => {
      expect([target, match, type]).toEqual([CONFIG_PATH, undefined, "file"]);
      return context.exists;
    },
    hasBinary: (name) => {
      expect(name).toBe("systemctl");
      return context.systemctlAvailable;
    },
    backupConfigFile: async (target) => {
      effects.backups.push({ target, content: context.content });
    },
    writeText: async (target, output) => {
      effects.writes.push({ target, content: output });
      context.content = output.trim();
    },
    execSync: (command, options) => {
      effects.commands.push({ command, options: { timeout: options.timeout } });
      // Native execSync returns null with inherited stdout; exercise the real helper contract.
      return options.stdio === "inherit" ? null : "";
    },
    log: (...args) => effects.logs.push(args),
  });
  const helperSource = ["exitIfNotSudo", "exitIfUnsupportedOs", "resolveExecTimeout", "execBashSync"]
    .map((name) => getIndexFunction(name).toString())
    .join("\n");
  // Serialized helpers reference their original Istanbul counter closures during coverage runs.
  for (const counter of new Set(helperSource.match(/\bcov_\w+(?=\()/g) || [])) {
    context[counter] = getIndexFunction(counter);
  }
  vm.runInContext(helperSource, context);
  let source = fs.readFileSync(SCRIPT_PATH, "utf8");
  if (process.env.BASHRC_TEST_COVERAGE === "1") {
    const { createInstrumenter } = createRequire(import.meta.url)("istanbul-lib-instrument");
    source = createInstrumenter({
      coverageVariable: "__VITEST_COVERAGE__",
      coverageGlobalScope: "globalThis",
      esModules: false,
      produceSourceMap: false,
    }).instrumentSync(source, SCRIPT_PATH);
    context.__VITEST_COVERAGE__ = globalThis.__VITEST_COVERAGE__ ||= {};
  }
  vm.runInContext(source, context, { filename: SCRIPT_PATH });
  return { context, effects, run: () => context.doWork() };
}

describe("systemd-resolved DNS bootstrap", () => {
  it("backs up prior settings, comments all prior lines, and deploys the requested DNS block", async () => {
    const original = "# Existing comment\n[Resolve]\nDNS=192.0.2.1\n\n  # Indented comment\nDNSSEC=yes\n";
    const { context, effects, run } = fixture(original);
    await run();
    expect(context.content).toBe(`# Existing comment
# [Resolve]
# DNS=192.0.2.1
#\x20
#   # Indented comment
# DNSSEC=yes
#\x20

${DNS_BLOCK}`);
    expect(effects.backups).toEqual([{ target: CONFIG_PATH, content: original }]);
    expect(effects.commands).toEqual([{ command: "systemctl restart systemd-resolved", options: { timeout: 30000 } }]);
  });

  it("leaves an empty existing file with only the selected resolver block", async () => {
    const { context, run } = fixture();
    await run();
    expect(context.content).toBe(DNS_BLOCK);
  });

  it("normalizes CRLF without leaving carriage returns in the deployed configuration", async () => {
    const { context, run } = fixture("# Original\r\n[Resolve]\r\nDNS=192.0.2.2");
    await run();
    expect(context.content).toBe(`# Original\n# [Resolve]\n# DNS=192.0.2.2\n\n${DNS_BLOCK}`);
  });

  it("skips an absent file or non-file target without creating configuration or restarting", async () => {
    const { context, effects, run } = fixture("untouched");
    context.exists = false;
    await run();
    expect(context.content).toBe("untouched");
    expect([effects.backups, effects.writes, effects.commands]).toEqual([[], [], []]);
  });

  it("skips the old marker even when its resolver values differ", async () => {
    const original = "# Sy Bootstrap DNS Cloudflare DNS with Family Filter\n[Resolve]\nDNS=1.1.1.3\nFallbackDNS=1.1.1.2";
    const { context, effects, run } = fixture(original);
    await run();
    expect(context.content).toBe(original);
    expect([effects.backups, effects.writes, effects.commands]).toEqual([[], [], []]);
  });

  it("reruns without duplicate configuration, another backup, or another service restart", async () => {
    const { context, effects, run } = fixture("[Resolve]");
    await run();
    const firstContent = context.content;
    await run();
    expect(context.content).toBe(firstContent);
    expect(effects.backups).toEqual([{ target: CONFIG_PATH, content: "[Resolve]" }]);
    expect(effects.writes).toEqual([{ target: CONFIG_PATH, content: firstContent }]);
    expect(effects.commands).toEqual([{ command: "systemctl restart systemd-resolved", options: { timeout: 30000 } }]);
  });

  it("dry-runs without filesystem mutation, sudo privilege, or a systemctl binary", async () => {
    const { context, effects, run } = fixture("[Resolve]");
    context.IS_DRY_RUN = true;
    context.process.getuid = () => 1000;
    context.systemctlAvailable = false;
    await run();
    expect(context.content).toBe("[Resolve]");
    expect([effects.backups, effects.writes, effects.commands]).toEqual([[], [], []]);
  });

  it("rejects non-root execution without touching configuration or services", async () => {
    const { context, effects, run } = fixture("[Resolve]");
    context.process.getuid = () => 1000;
    await expect(run()).rejects.toThrow("Requires sudo/root privileges");
    expect(context.content).toBe("[Resolve]");
    expect([effects.backups, effects.writes, effects.commands]).toEqual([[], [], []]);
  });

  it.each(["is_os_mac", "is_os_windows", "is_os_android_termux"])("skips unsupported %s without side effects", async (flag) => {
    const { context, effects, run } = fixture("[Resolve]");
    context.global[flag] = 1;
    await expect(run()).rejects.toThrow(`Not supported on ${flag}`);
    expect(context.content).toBe("[Resolve]");
    expect([effects.backups, effects.writes, effects.commands]).toEqual([[], [], []]);
  });

  it("rejects missing systemctl before backup or mutation", async () => {
    const { context, effects, run } = fixture("[Resolve]");
    context.systemctlAvailable = false;
    await expect(run()).rejects.toThrow("systemctl is required to restart systemd-resolved");
    expect(context.content).toBe("[Resolve]");
    expect([effects.backups, effects.writes, effects.commands]).toEqual([[], [], []]);
  });

  it("propagates read failure instead of treating unreadable configuration as empty", async () => {
    const { context, effects, run } = fixture("[Resolve]");
    context.fs.readFileSync = () => {
      throw new Error("fixture read failure");
    };
    await expect(run()).rejects.toThrow("fixture read failure");
    expect(context.content).toBe("[Resolve]");
    expect([effects.backups, effects.writes, effects.commands]).toEqual([[], [], []]);
  });

  it("propagates backup failure without writing or restarting", async () => {
    const { context, effects, run } = fixture("[Resolve]");
    context.backupConfigFile = async () => {
      throw new Error("fixture backup failure");
    };
    await expect(run()).rejects.toThrow("fixture backup failure");
    expect(context.content).toBe("[Resolve]");
    expect([effects.writes, effects.commands]).toEqual([[], []]);
  });

  it("rejects a concurrent edit after backup without overwriting the new bytes", async () => {
    const { context, effects, run } = fixture("[Resolve]");
    context.backupConfigFile = async () => {
      context.content = "DNS=192.0.2.3";
    };
    await expect(run()).rejects.toThrow("resolved.conf changed during backup; rerun after other writers finish");
    expect(context.content).toBe("DNS=192.0.2.3");
    expect([effects.writes, effects.commands]).toEqual([[], []]);
  });

  it("propagates write failure without requesting a restart", async () => {
    const { context, effects, run } = fixture("[Resolve]");
    context.writeText = async () => {
      throw new Error("fixture write failure");
    };
    await expect(run()).rejects.toThrow("fixture write failure");
    expect(context.content).toBe("[Resolve]");
    expect(effects.commands).toEqual([]);
  });

  it("propagates restart failure while retaining the backed-up deployed configuration", async () => {
    const { context, effects, run } = fixture("[Resolve]");
    context.execSync = (command, options) => {
      effects.commands.push({ command, options: { timeout: options.timeout } });
      throw new Error("fixture restart failure");
    };
    await expect(run()).rejects.toThrow("fixture restart failure");
    expect(context.content).toBe(`# [Resolve]\n\n${DNS_BLOCK}`);
    expect(effects.backups).toEqual([{ target: CONFIG_PATH, content: "[Resolve]" }]);
    expect(effects.commands).toEqual([{ command: "systemctl restart systemd-resolved", options: { timeout: 30000 } }]);
  });
});
