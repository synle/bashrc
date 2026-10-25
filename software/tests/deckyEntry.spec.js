/** Exercise the real packaged and emitted Decky installer entry without live provisioning. */
import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { spawnSync } from "child_process";
import installer from "../tools/build-installer.js";

/** Load the actual CommonJS modules included in the extracted installer. */
const requireModule = createRequire(import.meta.url);
/** Private test workspaces removed after every test. */
const folders = [];
/** Actual standard entry evaluated through the bootstrap library. */
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
    expect(requireModule(path.join(folder, "software/metadata/decky-packages.json")).decky_packages).toHaveLength(19);
    expect(fs.existsSync(path.join(folder, "software/scripts/decky-and-css-loader.standalone.js"))).toBe(true);
    expect(fs.readdirSync(path.join(folder, "assets/steamos/decky_loader_plugins"))).toHaveLength(18);
    expect(
      requireModule(path.join(folder, "software/scripts/decky/decky-packages.common.js")).resolvePackages(
        requireModule(path.join(folder, "software/metadata/decky-packages.json")).decky_packages,
      ),
    ).toHaveLength(19);
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
    expect(requireModule(path.join(stage, "software/metadata/decky-packages.json")).decky_packages).toHaveLength(19);
    // Test-owned elevation seam still resolves actual repository archives through the staged package module.
    fs.writeFileSync(
      runtime,
      `exports.install = async (options) => {
      const packages = require('./decky-packages.common.js');
      const inventory = require('../../metadata/decky-packages.json');
      const pins = packages.resolvePackages(inventory.decky_packages, options.repoRoot);
      process.stdout.write(pins.length + ' resolved selected packages\\n');
    };`,
    );
    const result = spawnSync("/bin/bash", ["-c", bash], { encoding: "utf8", timeout: 15000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("19 resolved selected packages\n");
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
