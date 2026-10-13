/** SteamOS manual setup regression checks. */
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

/** Creates an isolated home and records it for cleanup. */
function createSandbox() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-setup-"));
  sandboxes.push(sandbox);
  return sandbox;
}

/** Runs the extracted SteamTinkerLaunch installer in an isolated home. */
function runInstaller(home, binFolder, calls = 1) {
  const invocation = Array.from({ length: calls }, () => "_install_steamtinkerlaunch").join("\n");
  return execFileSync("/bin/bash", ["-c", `${installerSource}\n${invocation}\ntype -P steamtinkerlaunch`], {
    encoding: "utf-8",
    env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` },
  });
}

/** Writes an executable fixture command. */
function writeCommand(binFolder, name, body) {
  fs.writeFileSync(path.join(binFolder, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
}

/** Encodes Steam string fields and app shortcuts into a compact shortcuts.vdf fixture. */
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

/** Reads string fields from Steam shortcut objects in a shortcuts.vdf fixture. */
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
  it("installs SteamTinkerLaunch dependencies before shortcuts are added", () => {
    const dependencySetup = setupSource.indexOf("if ! _install_steamtinkerlaunch_dependencies");
    const firstShortcut = setupSource.indexOf('_add_steam_shortcut "Moonlight"');

    expect(setupSource).toContain("sudo pacman -S --needed --noconfirm xdotool xorg-xwininfo yad");
    expect(setupSource).toContain("SteamTinkerLaunch requires Yad 7.2 or newer");
    expect(dependencySetup).toBeGreaterThan(0);
    expect(dependencySetup).toBeLessThan(firstShortcut);
  });

  it("downloads the configured Moonlight release version", () => {
    expect(setupSource).toContain('MOONLIGHT_VERSION="6.2.0"');
    expect(setupSource).toContain(
      '"https://github.com/moonlight-stream/moonlight-qt/releases/download/v$MOONLIGHT_VERSION/Moonlight-$MOONLIGHT_VERSION-x86_64.AppImage"',
    );
  });

  it("backs up and clears active-account shortcuts and creates a working restore script", () => {
    const home = createSandbox();
    const shortcutsPath = path.join(home, ".steam/steam/userdata/12345/config/shortcuts.vdf");
    const desktopFolder = path.join(home, "Desktop");
    fs.mkdirSync(path.dirname(shortcutsPath), { recursive: true });
    fs.mkdirSync(desktopFolder);
    const original = makeShortcuts([
      { name: "Old Moonlight", fields: { Exe: '"/old/moonlight"' } },
      { name: "Custom Tool", fields: { Exe: '"/custom/tool"' } },
    ]);
    fs.writeFileSync(shortcutsPath, original);

    const result = spawnSync(
      "/bin/bash",
      ["-c", `${shortcutCleanupSource}\nfunction pgrep() { return 1; }\n_clear_user_steam_shortcuts "$HOME/Desktop"`],
      { encoding: "utf-8", env: { ...process.env, HOME: home } },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("removed 2 non-Steam shortcut(s)");
    expect(result.stdout).toContain('  - "Old Moonlight"');
    expect(result.stdout).toContain('  - "Custom Tool"');
    const backupPath = result.stdout.match(/Steam cleanup backup: (.+)/)?.[1];
    const restoreScript = result.stdout.match(/Restore instructions: (.+)/)?.[1];
    expect(backupPath).toMatch(new RegExp(`^${desktopFolder}/shortcuts\\.vdf\\.bak_\\d{8}_\\d{6}_\\d{6}$`));
    expect(restoreScript).toBe(`${backupPath}.restore.sh`);
    expect(fs.readFileSync(backupPath)).toEqual(original);
    expect(readShortcuts(fs.readFileSync(shortcutsPath))).toEqual([]);
    expect(fs.readFileSync(restoreScript, "utf-8")).toContain("cp -- ");
    expect(fs.readFileSync(restoreScript, "utf-8")).toContain(backupPath);
    expect(fs.readFileSync(restoreScript, "utf-8")).toContain(shortcutsPath);

    fs.writeFileSync(shortcutsPath, makeShortcuts([{ name: "New shortcut", fields: { Exe: '"/new"' } }]));
    const binFolder = path.join(home, "bin");
    fs.mkdirSync(binFolder);
    writeCommand(binFolder, "pgrep", "exit 1");
    const restore = spawnSync("/bin/bash", [restoreScript], {
      encoding: "utf-8",
      env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` },
    });

    expect(restore.status, `${restore.stdout}\n${restore.stderr}`).toBe(0);
    expect(fs.readFileSync(shortcutsPath)).toEqual(original);
  });

  it("does not clear shortcuts while Steam is running", () => {
    const home = createSandbox();
    const shortcutsPath = path.join(home, ".steam/steam/userdata/12345/config/shortcuts.vdf");
    const desktopFolder = path.join(home, "Desktop");
    fs.mkdirSync(path.dirname(shortcutsPath), { recursive: true });
    fs.mkdirSync(desktopFolder);
    const original = makeShortcuts([{ name: "Keep me", fields: { Exe: '"/keep"' } }]);
    fs.writeFileSync(shortcutsPath, original);

    const result = spawnSync(
      "/bin/bash",
      ["-c", `${shortcutCleanupSource}\nfunction pgrep() { return 0; }\n_clear_user_steam_shortcuts "$HOME/Desktop"`],
      { encoding: "utf-8", env: { ...process.env, HOME: home } },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("close Steam completely before clearing shortcuts");
    expect(fs.readFileSync(shortcutsPath)).toEqual(original);
    expect(fs.readdirSync(desktopFolder)).toEqual([]);
  });

  it("leaves an empty shortcuts file unchanged and creates no recovery files", () => {
    const home = createSandbox();
    const shortcutsPath = path.join(home, ".steam/steam/userdata/12345/config/shortcuts.vdf");
    const desktopFolder = path.join(home, "Desktop");
    const emptyShortcuts = Buffer.from([0, ...Buffer.from("shortcuts\0"), 8, 8]);
    fs.mkdirSync(path.dirname(shortcutsPath), { recursive: true });
    fs.mkdirSync(desktopFolder);
    fs.writeFileSync(shortcutsPath, emptyShortcuts);

    const result = spawnSync(
      "/bin/bash",
      ["-c", `${shortcutCleanupSource}\nfunction pgrep() { return 1; }\n_clear_user_steam_shortcuts "$HOME/Desktop"`],
      { encoding: "utf-8", env: { ...process.env, HOME: home } },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no user-defined non-Steam shortcuts found; nothing removed");
    expect(fs.readFileSync(shortcutsPath)).toEqual(emptyShortcuts);
    expect(fs.readdirSync(desktopFolder)).toEqual([]);
  });

  it("verifies SteamTinkerLaunch actually wrote each shortcut", () => {
    expect(setupSource).toContain('if ! _steam_shortcut_exists path "$registered_exepath"; then');
    expect(setupSource).toContain('if ! _steam_shortcut_exists title "$title"; then');
    expect(setupSource).toContain("SteamTinkerLaunch returned success but shortcut is absent");
  });

  it("rejects missing Steam executable paths before invoking SteamTinkerLaunch", () => {
    const home = createSandbox();
    const invokedPath = path.join(home, "steamtinkerlaunch-invoked");
    const result = spawnSync(
      "/bin/bash",
      [
        "-c",
        `${addShortcutSource}\nfunction steamtinkerlaunch() { touch "$HOME/steamtinkerlaunch-invoked"; }\n_steamtinkerlaunch_add --appname=Missing --exepath="$1"`,
        "bash",
        path.join(home, "Applications/Missing.AppImage"),
      ],
      { encoding: "utf-8", env: { ...process.env, HOME: home } },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("binary or AppImage path not found or not present");
    expect(fs.existsSync(invokedPath)).toBe(false);
  });

  it("registers the EmuDeck-installed ES-DE AppImage under the requested Steam name", () => {
    expect(setupSource).toContain('_add_steam_shortcut "ES-DE Emulation Station" "/home/deck/Applications/ES-DE.AppImage"');
  });

  it("updates an existing app shortcut by name and removes same-name duplicates", () => {
    const home = createSandbox();
    const shortcutsPath = path.join(home, ".steam/steam/userdata/12345/config/shortcuts.vdf");
    fs.mkdirSync(path.dirname(shortcutsPath), { recursive: true });
    fs.writeFileSync(
      shortcutsPath,
      makeShortcuts([
        { name: "Moonlight", fields: { Exe: '"/old/Moonlight.AppImage"', StartDir: '"/old"', LaunchOptions: "--old" } },
        { name: "Other App", fields: { Exe: '"/other/app"' } },
        { name: "Moonlight", fields: { Exe: '"/duplicate/Moonlight.AppImage"' } },
      ]),
    );
    const newExecutable = path.join(home, "Apps/Moonlight.AppImage");
    fs.mkdirSync(path.dirname(newExecutable), { recursive: true });
    fs.writeFileSync(newExecutable, "app\n", { mode: 0o755 });

    const result = spawnSync(
      "/bin/bash",
      ["-c", `${addShortcutSource}\nfunction pgrep() { return 1; }\n_add_steam_shortcut Moonlight "$1"`, "bash", newExecutable],
      { encoding: "utf-8", env: { ...process.env, HOME: home } },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const shortcuts = readShortcuts(fs.readFileSync(shortcutsPath));
    expect(shortcuts).toHaveLength(2);
    expect(shortcuts.find((shortcut) => shortcut.AppName === "Moonlight")).toMatchObject({
      Exe: `"${newExecutable}"`,
      StartDir: '"/old"',
      LaunchOptions: "--old",
    });
  });

  it("registers and refreshes Brave site tiles with absolute Brave path and current URL", () => {
    const home = createSandbox();
    const binFolder = path.join(home, "bin");
    const accountFolder = path.join(home, ".steam/steam/userdata/12345/config");
    const braveExecutable = path.join(binFolder, "brave");
    const shortcutsPath = path.join(accountFolder, "shortcuts.vdf");
    fs.mkdirSync(binFolder, { recursive: true });
    fs.mkdirSync(accountFolder, { recursive: true });
    fs.writeFileSync(braveExecutable, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
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
_add_url_steam_shortcut Netflix https://www.netflix.com/`,
      ],
      { encoding: "utf-8", env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` } },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(readShortcuts(fs.readFileSync(shortcutsPath))).toEqual([
      {
        AppName: "Netflix",
        Exe: `"${braveExecutable}"`,
        StartDir: '"./"',
        LaunchOptions: "--app=https://www.netflix.com/",
      },
    ]);
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
        env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` },
      },
    );

    expect(result.status).toBe(0);
    expect(fs.existsSync(addedMarker)).toBe(true);
    expect(result.stdout).toContain("Steam: added Example");
  });

  it("only runs Decky setup after explicit initial confirmation", () => {
    const deckyPrompt = setupSource.indexOf(">>> Install Decky Loader, plugins, and CSS Loader themes?");
    const deckyCall = setupSource.indexOf('if [ "$DO_DECKY_SETUP" -eq 1 ]; then');
    const upgradePrompt = setupSource.indexOf(">>> Run system upgrade");

    expect(deckyPrompt).toBeGreaterThan(0);
    expect(deckyPrompt).toBeLessThan(upgradePrompt);
    expect(deckyCall).toBeGreaterThan(deckyPrompt);
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
