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
  it("registers and refreshes Brave site tiles with absolute Brave path and current URL", () => {
    const home = createSandbox();
    const binFolder = path.join(home, "bin");
    const accountFolder = path.join(home, ".steam/steam/userdata/12345/config");
    const flatpakExecutable = path.join(binFolder, "flatpak");
    const shortcutsPath = path.join(accountFolder, "shortcuts.vdf");
    fs.mkdirSync(binFolder, { recursive: true });
    fs.mkdirSync(accountFolder, { recursive: true });
    fs.writeFileSync(flatpakExecutable, '#!/usr/bin/env bash\nif [ "$1" = "list" ]; then printf "com.brave.Browser\\n"; fi\n', {
      mode: 0o755,
    });
    fs.writeFileSync(
      shortcutsPath,
      makeShortcuts([
        {
          name: "Netflix",
          fields: { Exe: '"brave"', StartDir: '"./"', LaunchOptions: "--app=https://old.example/" },
        },
      ]),
    );

    const result = spawnSync(
      "/bin/bash",
      [
        "-c",
        `${addShortcutSource}
function pgrep() { return 1; }
function flatpak() { [ "$1" = "list" ] && printf 'com.brave.Browser\\n'; }
_add_url_steam_shortcut Netflix https://www.netflix.com///`,
      ],
      { encoding: "utf-8", env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` } },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(readShortcuts(fs.readFileSync(shortcutsPath))).toMatchInlineSnapshot(`
      [
        {
          "AppName": "Netflix",
          "Exe": ""/usr/bin/flatpak"",
          "LaunchOptions": ""run" "--command=brave" "com.brave.Browser" "--ozone-platform=x11" "--disable-smooth-scrolling" "--kiosk" "https://www.netflix.com"",
          "StartDir": ""/usr/bin/"",
        },
      ]
    `);
  });

  it("fails when SteamTinkerLaunch returns success without writing a shortcut", () => {
    const home = createSandbox();
    const binFolder = path.join(home, "bin");
    const accountFolder = path.join(home, ".steam/steam/userdata/12345/config");
    const executable = path.join(home, "Example.AppImage");
    fs.mkdirSync(binFolder);
    fs.mkdirSync(accountFolder, { recursive: true });
    fs.writeFileSync(executable, "app\n", { mode: 0o755 });
    writeCommand(binFolder, "steamtinkerlaunch", "exit 0");

    const result = spawnSync(
      "/bin/bash",
      [
        "-c",
        `${addShortcutSource}\nfunction _steam_shortcut_exists() { return 1; }\nfunction pgrep() { return 1; }\n_add_steam_shortcut Example "$1"`,
        "bash",
        executable,
      ],
      {
        encoding: "utf-8",
        env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("returned success but shortcut is absent");
    expect(result.stdout).not.toContain("Steam: added Example");
  });

  it("configures the verified Steam account before SteamTinkerLaunch resets its environment", () => {
    const home = createSandbox();
    const binFolder = path.join(home, "bin");
    const accountFolder = path.join(home, ".steam/steam/userdata/12345");
    const executable = path.join(home, "Example.AppImage");
    const addedMarker = path.join(home, "shortcut-added");
    fs.mkdirSync(binFolder);
    fs.mkdirSync(path.join(accountFolder, "config"), { recursive: true });
    fs.writeFileSync(executable, "app\n", { mode: 0o755 });
    writeCommand(
      binFolder,
      "steamtinkerlaunch",
      `unset SUSDA STUIDPATH STEAMUSERID
grep -Fx 'STEAMUSERID="12345"' "$HOME/.config/steamtinkerlaunch/global.conf" || exit 2
[ -e "$HOME/path-cache-invalidated" ] || exit 3
touch "$HOME/shortcut-added"`,
    );

    const result = spawnSync(
      "/bin/bash",
      [
        "-c",
        `${addShortcutSource}
function _steam_shortcut_exists() { [ -e "$HOME/shortcut-added" ]; }
function pgrep() { return 1; }
function rm() {
  if [ "$1" = "-f" ] && [ "$2" = "/dev/shm/steamtinkerlaunch/steampaths.txt" ]; then
    touch "$HOME/path-cache-invalidated"
    return 0
  fi
  command rm "$@"
}
_add_steam_shortcut Example "$1"`,
        "bash",
        executable,
      ],
      {
        encoding: "utf-8",
        env: { ...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, ".config"), PATH: `${binFolder}:${process.env.PATH}` },
      },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(fs.existsSync(addedMarker)).toBe(true);
    expect(result.stdout).toContain("Steam: added Example");
  });

  it("only runs Decky setup after explicit initial confirmation", () => {
    const deckyPrompt = setupSource.indexOf('_prompt "Install Decky Loader, plugins, and CSS Loader themes?"');
    const deckyCall = setupSource.indexOf('if [ "$DO_DECKY_SETUP" -eq 1 ]; then');
    const upgradePrompt = setupSource.indexOf('_prompt "Run system upgrade');

    expect(deckyPrompt).toBeGreaterThan(0);
    expect(deckyPrompt).toBeLessThan(upgradePrompt);
    expect(deckyCall).toBeGreaterThan(deckyPrompt);
    expect(upgradePrompt).toBeGreaterThan(deckyPrompt);
    expect(setupSource.slice(deckyCall, setupSource.indexOf("# Check local Steam shortcuts"))).toContain(
      "_bootstrap_decky_loader_plugins_themes",
    );
  });

  it("waits for explicit confirmation before finishing", () => {
    expect(setupSource).toContain('until _prompt "Finish and exit setup?"; do');
  });

  it("keeps an existing SteamTinkerLaunch installation untouched", () => {
    const home = createSandbox();
    const binFolder = path.join(home, "bin");
    fs.mkdirSync(binFolder);
    const existing = path.join(binFolder, "steamtinkerlaunch");
    fs.writeFileSync(existing, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });

    const output = runInstaller(home, binFolder);

    expect(output).toContain(`already installed: ${existing}`);
    expect(fs.existsSync(path.join(home, "stl"))).toBe(false);
  });

  it("reuses a ProtonUp-Qt layout and exposes it on PATH", () => {
    const home = createSandbox();
    const binFolder = path.join(home, "bin");
    const prefix = path.join(home, "stl/prefix");
    fs.mkdirSync(binFolder);
    fs.mkdirSync(prefix, { recursive: true });
    fs.writeFileSync(path.join(prefix, "steamtinkerlaunch"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });

    const output = runInstaller(home, binFolder, 2);

    expect(output).toContain(`installed: ${path.join(home, ".local/bin/steamtinkerlaunch")}`);
    expect(output).toContain(`already installed: ${path.join(home, ".local/bin/steamtinkerlaunch")}`);
    expect(fs.realpathSync(path.join(home, ".local/bin/steamtinkerlaunch"))).toBe(fs.realpathSync(path.join(prefix, "steamtinkerlaunch")));
  });

  it("downloads, initializes, and registers SteamTinkerLaunch", () => {
    const home = createSandbox();
    const binFolder = path.join(home, "bin");
    fs.mkdirSync(binFolder);
    writeCommand(binFolder, "curl", 'output="${@: -1}"; : > "$output"');
    writeCommand(
      binFolder,
      "tar",
      'destination="${@: -1}"; folder="$destination/steamtinkerlaunch-master"; mkdir -p "$folder"; printf \'#!/usr/bin/env bash\\nprintf "%%s\\n" "$*" >> "$HOME/stl-calls"\\n\' > "$folder/steamtinkerlaunch"',
    );

    const output = runInstaller(home, binFolder, 2);

    expect(output).toContain(`Installing SteamTinkerLaunch to ${path.join(home, "stl/prefix")}`);
    expect(output).toContain(`already installed: ${path.join(home, ".local/bin/steamtinkerlaunch")}`);
    expect(fs.readFileSync(path.join(home, "stl-calls"), "utf-8")).toBe("\ncompat add\n");
    expect(fs.realpathSync(path.join(home, ".local/bin/steamtinkerlaunch"))).toBe(
      fs.realpathSync(path.join(home, "stl/prefix/steamtinkerlaunch")),
    );
  });
});
