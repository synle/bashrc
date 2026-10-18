import { afterEach, describe, expect, it } from "vitest";

import { execFileSync, spawnSync } from "child_process";

import fs from "fs";

import os from "os";

import path from "path";

import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SETUP_PATH = path.join(ROOT_DIR, "software/scripts/steamos/setup.bash");

const setupSource = fs.readFileSync(SETUP_PATH, "utf-8");

const installerSource = setupSource
  .split("# Install SteamTinkerLaunch runtime dependencies before invoking it.", 2)[1]
  .split("\nif ! _install_steamtinkerlaunch_dependencies", 1)[0];

const addShortcutSource = setupSource
  .split("# --- Steam shortcuts ---", 2)[1]
  .split("\n# Install SteamTinkerLaunch runtime dependencies before invoking it.", 1)[0];

const shortcutCleanupSource = setupSource.split("# --- Steam shortcuts ---", 2)[1].split("\ndecky_setup_failed=0", 1)[0];

const sandboxes = [];

function createSandbox() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-setup-"));
  sandboxes.push(sandbox);
  return sandbox;
}

function runInstaller(home, binFolder, calls = 1) {
  const invocation = Array.from({ length: calls }, () => "_install_steamtinkerlaunch").join("\n");
  return execFileSync("/bin/bash", ["-c", `${installerSource}\n${invocation}\ntype -P steamtinkerlaunch`], {
    encoding: "utf-8",
    env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` },
  });
}

function writeCommand(binFolder, name, body) {
  fs.writeFileSync(path.join(binFolder, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
}

function makeShortcuts(entries) {
  const string = (value) => Buffer.concat([Buffer.from(value, "utf-8"), Buffer.from([0])]);
  const field = (name, value) => Buffer.concat([Buffer.from([1]), string(name), string(value)]);
  const shortcuts = [Buffer.from([0]), string("shortcuts")];

  for (const [index, entry] of entries.entries()) {
    shortcuts.push(Buffer.from([0]), string(String(index)), field("AppName", entry.name));
    for (const [key, value] of Object.entries(entry.fields)) shortcuts.push(field(key, value));
    shortcuts.push(Buffer.from([8]));
  }
  shortcuts.push(Buffer.from([8, 8]));
  return Buffer.concat(shortcuts);
}

function readShortcuts(data) {
  let offset = 11;
  const readString = () => {
    const end = data.indexOf(0, offset);
    const value = data.toString("utf-8", offset, end);
    offset = end + 1;
    return value;
  };
  const shortcuts = [];

  while (data[offset] !== 8) {
    offset += 1;
    readString();
    const fields = {};
    while (data[offset] !== 8) {
      const type = data[offset++];
      const name = readString();
      fields[name] = type === 1 ? readString() : null;
      if (type !== 1) throw new Error(`Unexpected fixture field type ${type}`);
    }
    offset += 1;
    shortcuts.push(fields);
  }
  return shortcuts;
}

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("SteamOS setup", () => {
it("preserves a launcher owned by another installation", () => {
    const home = createSandbox();
    const binFolder = path.join(home, "bin");
    const prefix = path.join(home, "stl/prefix");
    const launcher = path.join(home, ".local/bin/steamtinkerlaunch");
    fs.mkdirSync(binFolder);
    fs.mkdirSync(prefix, { recursive: true });
    fs.mkdirSync(path.dirname(launcher), { recursive: true });
    fs.writeFileSync(path.join(prefix, "steamtinkerlaunch"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
    fs.writeFileSync(launcher, "user-owned\n");

    const result = spawnSync("/bin/bash", ["-c", `${installerSource}\n_install_steamtinkerlaunch`], {
      encoding: "utf-8",
      env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("launcher already exists and is not managed by this setup");
    expect(fs.readFileSync(launcher, "utf-8")).toBe("user-owned\n");
  });

it("contains no readonly Limine assignment when sourced repeatedly", () => {
    expect(setupSource).not.toMatch(/readonly\s+_LIMINE_BOOT_TIMEOUT/);
    expect(setupSource).toContain("sudo awk -v timeout=2");
  });
});
