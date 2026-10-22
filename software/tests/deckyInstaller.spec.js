import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import crypto from "crypto";
import { createRequire } from "module";
import { spawnSync } from "child_process";
import zip from "../scripts/decky/decky-zip.common.js";
import runtime from "../scripts/decky/decky-runtime.common.js";
import installer from "../tools/build-installer.js";

/** Real CommonJS consumer used to load the staged runtime without invoking installation. */
const requireModule = createRequire(import.meta.url);
/** Test-owned workspaces, never a live desktop home. */
const folders = [];
/** Standard script source evaluated with the same globals supplied by the bootstrap engine. */
const entrySource = fs.readFileSync("software/scripts/decky-and-css-loader.standalone.js", "utf8");

/** Return a new private test workspace with executable fixture tools. */
function workspace() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "decky-consumer-"));
  folders.push(folder);
  fs.mkdirSync(path.join(folder, "bin"));
  return folder;
}

/** Evaluate the standard script with real engine guards/templates/file I/O, capturing only emitted Bash instead of installing. */
async function emit(overrides = {}) {
  const folder = workspace();
  const output = [];
  const source = fs.readFileSync("software/index.js", "utf8");
  const boundary = source.indexOf("\n(async function () {");
  if (boundary < 0) throw new Error("bootstrap library boundary unavailable");
  const context = vm.createContext({
    require: requireModule,
    process: {
      ...process,
      argv: [],
      env: {
        ...process.env,
        is_os_steamos: "1",
        is_os_mac: "0",
        is_os_wsl: overrides.is_os_wsl ? "1" : "0",
        CI: overrides.IS_CI ? "1" : "0",
        IS_DRY_RUN: overrides.IS_DRY_RUN ? "1" : "0",
        BASHRC_TEMP_DIR: folder,
      },
    },
    console,
    Buffer,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    output,
  });
  context.global = context;
  vm.runInContext(source.slice(0, boundary) + "\nemitBash = (content) => output.push(content); log = () => {}; echo = () => {};", context);
  await vm.runInContext(`${entrySource}\ndoWork()`, context);
  return { folder, bash: output.join("\n") };
}

/** Prepare isolated desktop/tool fixtures; optionally run the real orchestrator with simulated NSS/platform/elevation. */
function runInstaller({
  existing = true,
  sudoStatus = 0,
  root = false,
  badHome = false,
  badCache = false,
  bootstrapFailure = false,
  fixtureOnly = false,
} = {}) {
  const home = workspace();
  const plugin = zip.writeZip(
    new Map([
      ["Example/plugin.json", Buffer.from('{"name":"Example"}')],
      ["Example/package.json", Buffer.from('{"version":"1.2.3"}')],
      ["Example/dist/index.js", Buffer.from("do not execute")],
    ]),
  );
  const pin = {
    path: "decky_plugin/Example_v1.2.3.zip",
    name: "Example",
    version: "1.2.3",
    root: "Example",
    source: "https://example.test/source",
    url: "https://example.test/artifact.zip",
    sha256: crypto.createHash("sha256").update(plugin).digest("hex"),
  };
  const cache = zip.writeZip(
    new Map([
      ["metadata.json", Buffer.from(JSON.stringify({ schema_version: 1, packages: [pin] }))],
      [pin.path, plugin],
    ]),
  );
  fs.writeFileSync(path.join(home, "cache.zip"), cache);
  fs.writeFileSync(
    path.join(home, "bin/sudo"),
    `#!/bin/bash\nprintf '%s\\n' "$*" >> "$HOME/commands"\necho 'protected child diagnostic'\nif [ "$1" = bash ]; then\n  ${bootstrapFailure ? "exit 43" : 'mkdir -p "$HOME/homebrew/services" "$HOME/homebrew/plugins"; printf service > "$HOME/homebrew/services/PluginLoader"; chmod 755 "$HOME/homebrew/services/PluginLoader"'}\nfi\nexit ${sudoStatus}\n`,
    { mode: 0o755 },
  );
  fs.writeFileSync(path.join(home, "bin/jq"), '#!/bin/bash\necho "fixture jq version"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(home, "bin/curl"), '#!/bin/bash\nprintf "bootstrap data" > "${@: -1}"\n', { mode: 0o755 });
  if (existing) {
    fs.mkdirSync(path.join(home, "homebrew/services"), { recursive: true });
    fs.mkdirSync(path.join(home, "homebrew/plugins"));
    fs.writeFileSync(path.join(home, "homebrew/services/PluginLoader"), "existing service", { mode: 0o755 });
  }
  if (fixtureOnly) return { home, pin };
  const source = `const fs = require('fs');
    Object.defineProperty(process, 'platform', {value:'linux'});
    require('os').userInfo = () => ({uid:${root ? 0 : 12345},gid:23456,homedir:${JSON.stringify(badHome ? "/" : home)}});
    require(${JSON.stringify(path.resolve("software/scripts/decky/decky-runtime.common.js"))}).install({
      pins: [${JSON.stringify(pin)}],
      downloader: async (_url, target) => { ${badCache ? 'throw new Error("fixture unavailable");' : 'fs.copyFileSync(process.env.HOME + "/cache.zip", target);'} }
    }).catch(error => { process.stderr.write(error.message + '\\n'); process.exitCode=1; });`;
  const result = spawnSync(process.execPath, ["-e", source], {
    encoding: "utf8",
    timeout: 15000,
    env: { ...process.env, HOME: home, PATH: `${home}/bin:${process.env.PATH}` },
  });
  return { home, pin, result };
}

afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("standard opt-in Decky script consumer", () => {
  it("loads the shared modules and inventory extracted from the real self-extracting payload", () => {
    const folder = workspace();
    const result = spawnSync("tar", ["-xzf", "-", "-C", folder], { input: installer.buildTarball(), encoding: "utf8", timeout: 15000 });
    expect(result.status, result.stderr).toBe(0);
    expect(requireModule(path.join(folder, "software/scripts/decky/decky-runtime.common.js")).CACHE_URL).toBe(
      "https://github.com/synle/bashrc/releases/download/binary-cache/steamos-decky__bundle.zip",
    );
    expect(requireModule(path.join(folder, "software/metadata/decky-packages.json"))).toHaveLength(18);
    expect(fs.existsSync(path.join(folder, "software/scripts/decky-and-css-loader.standalone.js"))).toBe(true);
    expect(fs.existsSync(path.join(folder, "assets/steamos"))).toBe(false);
  });
  it("stages loadable Node modules and pins, then invokes their emitted install entry through Bash", async () => {
    const { folder, bash } = await emit();
    const stage = path.join(
      folder,
      fs.readdirSync(folder).find((name) => name.startsWith("decky-")),
    );
    const runtime = path.join(stage, "software/scripts/decky/decky-runtime.common.js");
    expect(requireModule(runtime).CACHE_URL).toBe(
      "https://github.com/synle/bashrc/releases/download/binary-cache/steamos-decky__bundle.zip",
    );
    expect(requireModule(path.join(stage, "software/metadata/decky-packages.json"))).toHaveLength(18);
    // Test-owned runtime replacement proves the generated invocation seam without live installation.
    fs.writeFileSync(runtime, 'exports.install = async () => { process.stdout.write("fixture invoked\\n"); };');
    const result = spawnSync("/bin/bash", ["-c", bash], { encoding: "utf8", timeout: 15000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("fixture invoked\n");
  });
  it("propagates a failed emitted installer as a nonzero Bash result", async () => {
    const { folder, bash } = await emit();
    const stage = path.join(
      folder,
      fs.readdirSync(folder).find((name) => name.startsWith("decky-")),
    );
    fs.writeFileSync(
      path.join(stage, "software/scripts/decky/decky-runtime.common.js"),
      'exports.install = async () => { throw new Error("fixture rejected"); };',
    );
    const result = spawnSync("/bin/bash", ["-c", bash], { encoding: "utf8", timeout: 15000 });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(">>> Decky installation failed: fixture rejected\n");
  });
  it.each([{ IS_CI: true }, { IS_DRY_RUN: true }])("skips staging and emitted writes for %j", async (options) => {
    const { folder, bash } = await emit(options);
    expect(bash).toBe("");
    expect(fs.readdirSync(folder)).toEqual(["bin"]);
  });
  it("rejects WSL rather than emitting privileged installation", async () => {
    await expect(emit({ is_os_wsl: true })).rejects.toThrow("Not supported on is_os_wsl");
    expect(fs.readdirSync(folders.at(-1))).toEqual(["bin"]);
  });
});

describe("shared Node installer orchestration (subprocess, elevation simulated)", () => {
  it.each(["success", "empty", "curl failure", "missing", "spawn failure"])(
    "enforces download bounds and reports %s",
    async (condition) => {
      const folder = workspace();
      const originalPath = process.env.PATH;
      fs.writeFileSync(
        path.join(folder, "bin/curl"),
        `#!/bin/bash\n${condition === "curl failure" ? "exit 28" : condition === "missing" ? "exit 0" : condition === "empty" ? ': > "${@: -1}"' : 'printf verified > "${@: -1}"'}\n`,
        { mode: 0o755 },
      );
      process.env.PATH = condition === "spawn failure" ? path.join(folder, "missing") : `${folder}/bin:${originalPath}`;
      const target = path.join(folder, "download");
      try {
        await expect(runtime.download("http://example.test/artifact", target)).rejects.toThrow("HTTPS");
        if (condition === "success") {
          await runtime.download("https://example.test/artifact", target);
          expect(fs.readFileSync(target, "utf8")).toBe("verified");
        } else await expect(runtime.download("https://example.test/artifact", target)).rejects.toThrow();
      } finally {
        process.env.PATH = originalPath;
      }
    },
  );
  it.each([
    ["existing Loader", {}, false],
    ["absent Loader", { existing: false }, false],
    ["protected write rejected", { sudoStatus: 42 }, true],
    ["download rejected", { badCache: true }, true],
  ])("retains private phase diagnostics with %s", async (_label, options, fails) => {
    const { home, pin } = runInstaller({ ...options, fixtureOnly: true });
    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    const originalUserInfo = os.userInfo;
    const originalHome = process.env.HOME;
    const originalPath = process.env.PATH;
    Object.defineProperty(process, "platform", { value: "linux" });
    os.userInfo = () => ({ uid: 12345, gid: 23456, homedir: home });
    process.env.HOME = home;
    process.env.PATH = `${home}/bin:${originalPath}`;
    try {
      const operation = runtime.install({
        pins: [pin],
        downloader: async (_url, target) => {
          if (options.badCache) throw new Error("fixture unavailable");
          fs.copyFileSync(path.join(home, "cache.zip"), target);
        },
      });
      if (fails) await expect(operation).rejects.toThrow(options.badCache ? "fixture unavailable" : "sudo failed status=42");
      else await operation;
      const logs = fs.readdirSync(path.join(home, "Desktop"));
      expect(logs).toHaveLength(1);
      expect(logs.map((name) => fs.readFileSync(path.join(home, "Desktop", name, "install.log"), "utf8")).join("\n")).toContain(
        fails ? "phase=failed" : "phase=complete",
      );
    } finally {
      Object.defineProperty(process, "platform", platform);
      os.userInfo = originalUserInfo;
      process.env.HOME = originalHome;
      process.env.PATH = originalPath;
    }
  });
  it("uses cache, retains an existing Loader, requests only protected archive elevation, and saves private logs", () => {
    const { home, pin, result } = runInstaller();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("phase=complete");
    const commands = fs.readFileSync(path.join(home, "commands"), "utf8");
    expect(commands).toContain("decky-install.common.js");
    expect(commands).toContain(` ${home} plugins 12345 ${pin.sha256}`);
    expect(commands).not.toContain("install_release.sh");
    expect(fs.readFileSync(path.join(home, "homebrew/services/PluginLoader"), "utf8")).toBe("existing service");
    const logFolder = path.join(home, "Desktop", fs.readdirSync(path.join(home, "Desktop"))[0]);
    expect(fs.statSync(logFolder).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(logFolder, "install.log")).mode & 0o777).toBe(0o600);
    const log = fs.readFileSync(path.join(logFolder, "install.log"), "utf8");
    expect(log).toContain("phase=staged package=Example_v1.2.3.zip");
    expect(log).toContain("protected child diagnostic");
    expect(log).toContain("phase=complete");
  });
  it("bootstraps an absent Loader before requesting protected archive installation", () => {
    const { home, result } = runInstaller({ existing: false });
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(home, "commands"), "utf8")).toMatch(/^bash .*install_release.sh\n.*decky-install.common.js/s);
    expect(fs.readFileSync(path.join(home, "homebrew/services/PluginLoader"), "utf8")).toBe("service");
  });
  it.each([
    ["root", { root: true }],
    ["HOME mismatch", { badHome: true }],
  ])("rejects %s before logs, downloads, or elevation", (_label, options) => {
    const { home, result } = runInstaller(options);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("HOME must match a non-root invoking account");
    expect(fs.existsSync(path.join(home, "Desktop"))).toBe(false);
    expect(fs.existsSync(path.join(home, "commands"))).toBe(false);
  });
  it.each([
    ["cache/upstream unavailable", { badCache: true }, "fixture unavailable"],
    ["sudo failure", { sudoStatus: 42 }, "sudo failed status=42"],
    ["bootstrap failure", { existing: false, bootstrapFailure: true }, "sudo failed status=43"],
  ])("persists %s without reporting completion", (_label, options, diagnostic) => {
    const { home, result } = runInstaller(options);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(diagnostic);
    expect(result.stderr).not.toContain("phase=complete");
    const log = fs.readFileSync(path.join(home, "Desktop", fs.readdirSync(path.join(home, "Desktop"))[0], "install.log"), "utf8");
    expect(log).toContain(`phase=failed ${diagnostic}`);
    expect(log).not.toContain("phase=complete");
  });
});
