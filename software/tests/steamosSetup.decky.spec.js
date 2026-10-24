import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import protectedInstaller from "../scripts/decky/decky-install.common.js";
import zip from "../scripts/decky/decky-zip.common.js";

/** Standalone setup functions, excluding unrelated interactive system changes. */
const setupSource = fs.readFileSync("software/scripts/steamos/setup.bash", "utf8");
/** Startup boundary remains independently executable. */
const preflightSource = setupSource.slice(
  setupSource.indexOf("function _start_steamos_setup_log()"),
  setupSource.indexOf("\n_start_steamos_setup_log || exit 1"),
);
/** Decky delegates to the standard bootstrap, which supplies Node. */
const deckySource = setupSource.split("# --- Decky Loader + plugins + CSS Loader themes ---")[1].split("# --- Steam shortcuts ---")[0];
/** Test-owned temporary homes. */
const homes = [];

/** Create a private fixture home with an existing, untouched Loader service; return string path. */
function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "decky-protected-node-"));
  homes.push(home);
  fs.mkdirSync(path.join(home, "bin"));
  fs.mkdirSync(path.join(home, "homebrew/services"), { recursive: true });
  fs.mkdirSync(path.join(home, "homebrew/plugins"));
  fs.writeFileSync(path.join(home, "homebrew/services/PluginLoader"), "existing service", { mode: 0o755 });
  return home;
}

/** Encode actual ZIP fixture members; return bytes and archive path without executing downloaded code. */
function archive(home, { flags = [], theme = false, manifest, entries } = {}) {
  const files =
    entries ??
    (theme
      ? [["Example Theme/theme.json", Buffer.from("{}")]]
      : [
          ["Example/plugin.json", Buffer.from(manifest ?? JSON.stringify({ name: "Example", flags }))],
          ["Example/package.json", Buffer.from('{"version":"1"}')],
          ["Example/dist/index.js", Buffer.from("verified payload")],
          ["Example/bin/helper", Buffer.from("executable payload")],
        ]);
  const bytes = zip.writeZip(new Map(files));
  const central = bytes.readUInt32LE(bytes.length - 6);
  if (!entries && !theme) {
    let offset = central;
    for (let index = 0; index < 3; index++) offset += 46 + bytes.readUInt16LE(offset + 28);
    bytes.writeUInt32LE((0o100755 * 65536) >>> 0, offset + 38);
  }
  const file = path.join(home, theme ? "theme.zip" : "plugin.zip");
  fs.writeFileSync(file, bytes);
  return { file, bytes };
}

/**
 * Test-owned Linux privilege boundary: translate /proc descriptor paths on macOS and record requested chowns.
 * Real ZIP, no-follow opens, hardlink checks, writes, readbacks, and chmod run; Linux elevation/NSS do not.
 */
function boundary(home, { chownFailure = false, ownerFailure = false, readFailure = false, race = false } = {}) {
  const descriptors = new Map();
  const owners = new Map();
  const messages = [];
  /** Resolve a test descriptor path to its anchored real fixture path; reject unknown handles. */
  function resolve(target) {
    return String(target).replace(/^\/proc\/self\/fd\/(\d+)\//, (_match, fd) => descriptors.get(Number(fd)) + "/");
  }
  const filesystem = {
    ...fs,
    openSync(target, flags, mode) {
      const actual = resolve(target);
      const fd = fs.openSync(actual, flags, mode);
      descriptors.set(fd, actual);
      return fd;
    },
    closeSync(fd) {
      descriptors.delete(fd);
      fs.closeSync(fd);
    },
    mkdirSync(target, options) {
      fs.mkdirSync(resolve(target), options);
    },
    lstatSync(target) {
      return fs.lstatSync(resolve(target));
    },
    fstatSync(fd) {
      const value = fs.fstatSync(fd);
      const owner = owners.get(value.ino);
      if (owner) Object.assign(value, owner);
      if (race && value.isFile()) value.nlink = 2;
      return value;
    },
    fchownSync(fd, uid, gid) {
      if (chownFailure) throw new Error("fixture chown denied");
      if (!ownerFailure) owners.set(fs.fstatSync(fd).ino, { uid, gid });
    },
    readSync(...args) {
      if (readFailure) return 0;
      return fs.readSync(...args);
    },
  };
  const options = { filesystem, accountLookup: () => ({ uid: 12345, gid: 23456, home }), report: (value) => messages.push(value) };
  return { options, messages, owners, descriptors };
}

/** Install a fixture through the real protected Node function; return recorded OS-boundary observations. */
function install(home, options = {}, overrides = {}) {
  const item = archive(home, options);
  const host = boundary(home, overrides);
  const hash = crypto.createHash("sha256").update(item.bytes).digest("hex");
  protectedInstaller.installArchive(item.file, home, options.theme ? "themes" : "plugins", "12345", hash, host.options);
  return host;
}

/** Run preflight in its actual Bash consumer, with only the platform account lookup substituted. */
function runPreflight(home, { root = false, mismatch = false, missing = false, stream = false } = {}) {
  const script = path.join(home, "preflight.bash");
  fs.writeFileSync(
    script,
    `function id() { if [ "\${1:-}" = '-u' ]; then echo ${root ? "0" : "12345"}; else echo 'uid=12345 fixture'; fi; }\nfunction getent() { echo 'fixture:x:12345:23456::${mismatch ? "/" : home}:/bin/bash'; }\n${preflightSource}\n_start_steamos_setup_log || exit $?\necho 'stdout marker'\necho 'stderr marker' >&2\n`,
  );
  // type -P intentionally requires a binary, not merely a shell function.
  fs.writeFileSync(path.join(home, "bin/getent"), "#!/bin/bash\nexit 0\n", { mode: 0o755 });
  return spawnSync("/bin/bash", stream ? ["-c", 'exec /bin/bash <(command cat "$1")', "bash", script] : [script], {
    encoding: "utf8",
    timeout: 15000,
    env: { ...process.env, HOME: home, PATH: missing ? "" : `${home}/bin:${process.env.PATH}` },
  });
}

afterEach(() => {
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

describe("SteamOS preflight and private logging (Bash subprocess)", () => {
  it.each([
    ["root", { root: true }, "normal desktop user"],
    ["HOME mismatch", { mismatch: true }, "HOME does not match"],
    ["missing account lookup", { missing: true }, "required command unavailable: getent"],
  ])("rejects %s before downloads or logs", (_label, options, message) => {
    const home = fixture();
    const result = runPreflight(home, options);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(fs.existsSync(path.join(home, "Desktop"))).toBe(false);
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toEqual([]);
  });
  it.each([false, true])("persists private stdout/stderr/identity diagnostics; streamed=%s", (stream) => {
    const home = fixture();
    const result = runPreflight(home, { stream });
    expect(result.status, result.stderr).toBe(0);
    const logPath = path.join(home, "Desktop", fs.readdirSync(path.join(home, "Desktop"))[0]);
    const log = fs.readFileSync(logPath, "utf8");
    expect(log).toContain("stdout marker");
    expect(log).toContain("stderr marker");
    expect(log).toContain("identity: uid=12345 fixture");
    expect(log).toContain("runtime: bash ");
    expect(log).toContain(stream ? "unavailable (streamed script input)" : "source checksum:");
    expect(fs.statSync(logPath).mode & 0o777).toBe(0o600);
  });
});

describe("Decky protected Node installation (simulated Linux privilege boundary)", () => {
  it("keeps the Loader and extras, requests mixed plugin ownership, and verifies real installed bytes/modes", () => {
    const home = fixture();
    const host = install(home);
    expect(fs.readFileSync(path.join(home, "homebrew/plugins/Example/dist/index.js"), "utf8")).toBe("verified payload");
    expect(host.owners.get(fs.statSync(path.join(home, "homebrew/plugins/Example/dist/index.js")).ino)).toEqual({ uid: 12345, gid: 23456 });
    expect(host.owners.get(fs.statSync(path.join(home, "homebrew/plugins/Example")).ino)).toEqual({ uid: 0, gid: 0 });
    expect(host.owners.get(fs.statSync(path.join(home, "homebrew/plugins/Example/plugin.json")).ino)).toEqual({ uid: 0, gid: 0 });
    expect(fs.statSync(path.join(home, "homebrew/plugins/Example/plugin.json")).mode & 0o777).toBe(0o755);
    expect(fs.statSync(path.join(home, "homebrew/plugins/Example/bin/helper")).mode & 0o777).toBe(0o755);
    expect(fs.readFileSync(path.join(home, "homebrew/services/PluginLoader"), "utf8")).toBe("existing service");
    expect(host.messages.at(-1)).toBe("phase=verified target=plugins/Example ownership=verified mode=verified");
    expect(host.descriptors.size).toBe(0);
  });
  it("preserves Centered Home settings and installs themes as the desktop user", () => {
    const home = fixture();
    fs.mkdirSync(path.join(home, "homebrew/themes/Centered Home"), { recursive: true });
    const settings = path.join(home, "homebrew/themes/Centered Home/settings.json");
    fs.writeFileSync(settings, '{"keep":true}', { mode: 0o600 });
    const host = install(home, { theme: true });
    expect(fs.readFileSync(settings, "utf8")).toBe('{"keep":true}');
    expect(fs.statSync(settings).mode & 0o777).toBe(0o600);
    expect(host.owners.get(fs.statSync(path.join(home, "homebrew/themes/Example Theme/theme.json")).ino)).toEqual({
      uid: 12345,
      gid: 23456,
    });
    expect(host.owners.get(fs.statSync(path.join(home, "homebrew/themes")).ino)).toEqual({ uid: 12345, gid: 23456 });
    expect(fs.readdirSync(path.join(home, "homebrew/themes"))).toEqual(["Centered Home", "Example Theme"]);
  });
  it("assigns root-plugin contents to root, without altering service ownership/mode", () => {
    const home = fixture();
    const host = install(home, { flags: ["root"] });
    expect(host.owners.get(fs.statSync(path.join(home, "homebrew/plugins/Example/dist/index.js")).ino)).toEqual({ uid: 0, gid: 0 });
    expect(fs.statSync(path.join(home, "homebrew/services/PluginLoader")).mode & 0o777).toBe(0o755);
  });
  it("repairs a matching-version partial install and preserves extra files and executable bits on rerun", () => {
    const home = fixture();
    install(home);
    fs.unlinkSync(path.join(home, "homebrew/plugins/Example/dist/index.js"));
    fs.writeFileSync(path.join(home, "homebrew/plugins/Example/custom-setting"), "retain", { mode: 0o600 });
    fs.chmodSync(path.join(home, "homebrew/plugins/Example/package.json"), 0o755);
    install(home);
    expect(fs.readFileSync(path.join(home, "homebrew/plugins/Example/dist/index.js"), "utf8")).toBe("verified payload");
    expect(fs.statSync(path.join(home, "homebrew/plugins/Example/package.json")).mode & 0o777).toBe(0o755);
    expect(fs.readFileSync(path.join(home, "homebrew/plugins/Example/custom-setting"), "utf8")).toBe("retain");
    expect(fs.statSync(path.join(home, "homebrew/plugins/Example/custom-setting")).mode & 0o777).toBe(0o600);
  });
  it.each([
    ["non-object", "[]"],
    ["invalid flags", '{"flags":"root"}'],
    ["invalid JSON", "{"],
  ])("rejects %s metadata before payload writes or ownership changes", (_label, manifest) => {
    const home = fixture();
    const item = archive(home, { manifest });
    const host = boundary(home);
    expect(() =>
      protectedInstaller.installArchive(
        item.file,
        home,
        "plugins",
        "12345",
        crypto.createHash("sha256").update(item.bytes).digest("hex"),
        host.options,
      ),
    ).toThrow("phase=archive-validation failed");
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toEqual([]);
    expect(host.owners.size).toBe(0);
    expect(host.descriptors.size).toBe(0);
  });
  it.each(["symlink", "hardlink", "folder link"])("rejects a destination %s before payload/ownership changes", (kind) => {
    const home = fixture();
    fs.mkdirSync(path.join(home, "outside"));
    const external = path.join(home, "outside/untouched");
    fs.writeFileSync(external, "untouched");
    const root = path.join(home, "homebrew/plugins/Example");
    if (kind === "folder link") fs.symlinkSync(path.join(home, "outside"), root);
    else {
      fs.mkdirSync(root);
      if (kind === "symlink") fs.symlinkSync(external, path.join(root, "plugin.json"));
      else fs.linkSync(external, path.join(root, "plugin.json"));
    }
    const item = archive(home);
    const host = boundary(home);
    expect(() =>
      protectedInstaller.installArchive(
        item.file,
        home,
        "plugins",
        "12345",
        crypto.createHash("sha256").update(item.bytes).digest("hex"),
        host.options,
      ),
    ).toThrow("phase=destination-preflight failed");
    expect(fs.readFileSync(external, "utf8")).toBe("untouched");
    expect(fs.existsSync(path.join(root, "package.json"))).toBe(false);
    expect(host.owners.size).toBe(0);
    expect(host.descriptors.size).toBe(0);
  });
  it.each([
    ["chown denied", { chownFailure: true }, "fixture chown denied"],
    ["ownership ignored", { ownerFailure: true }, "ownership or mode verification failed"],
    ["short read", { readFailure: true }, "file content verification failed"],
    ["hardlink race", { race: true }, "changed to a hardlink"],
  ])("reports %s without a false verified result", (_label, overrides, message) => {
    const home = fixture();
    const item = archive(home);
    const host = boundary(home, overrides);
    expect(() =>
      protectedInstaller.installArchive(
        item.file,
        home,
        "plugins",
        "12345",
        crypto.createHash("sha256").update(item.bytes).digest("hex"),
        host.options,
      ),
    ).toThrow(message);
    expect(host.messages.join("\n")).not.toContain("phase=verified");
    expect(host.descriptors.size).toBe(0);
  });
  it.each([
    ["root", { uid: 0 }],
    ["HOME mismatch", { home: "/" }],
  ])("rejects %s before destinations are opened", (_label, accountOverride) => {
    const home = fixture();
    const item = archive(home);
    const host = boundary(home);
    expect(() =>
      protectedInstaller.installArchive(item.file, home, "plugins", "12345", "irrelevant", {
        ...host.options,
        accountLookup: () => ({ uid: 12345, gid: 23456, home, ...accountOverride }),
      }),
    ).toThrow("phase=identity failed");
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toEqual([]);
    expect(host.owners.size).toBe(0);
  });
  it("rejects unknown kind and wrong archive hash before destinations are opened", () => {
    const home = fixture();
    const item = archive(home);
    const host = boundary(home);
    expect(() => protectedInstaller.installArchive(item.file, home, "other", "12345", "irrelevant", host.options)).toThrow(
      "kind must be plugins or themes",
    );
    expect(() => protectedInstaller.installArchive(item.file, home, "plugins", "12345", "irrelevant", host.options)).toThrow("SHA-256");
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toEqual([]);
    expect(host.owners.size).toBe(0);
  });
});

describe("SteamOS Decky delegation (Bash subprocess)", () => {
  it.each([0, 37])("runs the standard opt-in script, cleans its private download, and propagates status=%s", (status) => {
    const home = fixture();
    fs.writeFileSync(path.join(home, "bootstrap"), `#!/bin/bash\nprintf '%s\\n' "$@" > "$HOME/args"\nexit ${status}\n`);
    fs.writeFileSync(
      path.join(home, "bin/curl"),
      '#!/bin/bash\nprintf "%s\\n" "$*" > "$HOME/request"\nprintf "%s\\n" "${@: -1}" > "$HOME/download"\ncp "$HOME/bootstrap" "${@: -1}"\n',
      { mode: 0o755 },
    );
    const result = spawnSync("/bin/bash", ["-c", `${deckySource}\n_bootstrap_decky_loader_plugins_themes`], {
      encoding: "utf8",
      timeout: 15000,
      env: { ...process.env, HOME: home, PATH: `${home}/bin:${process.env.PATH}` },
    });
    expect(result.status, result.stderr).toBe(status);
    expect(fs.readFileSync(path.join(home, "args"), "utf8")).toBe(
      "--skip-prompt\n--files=software/scripts/decky-and-css-loader.standalone.js\n",
    );
    expect(fs.readFileSync(path.join(home, "request"), "utf8")).toContain("binary-cache/bashrc-installer__install-bashrc.sh");
    expect(fs.existsSync(fs.readFileSync(path.join(home, "download"), "utf8").trim())).toBe(false);
    expect(fs.readFileSync(path.join(home, "homebrew/services/PluginLoader"), "utf8")).toBe("existing service");
  });
});
