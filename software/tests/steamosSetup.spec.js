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
  it("installs SteamTinkerLaunch dependencies before shortcuts are added", () => {
    const dependencySetup = setupSource.indexOf("if ! _install_steamtinkerlaunch_dependencies");
    const firstShortcut = setupSource.indexOf('_add_steam_shortcut "Moonlight"');

    expect(setupSource).toContain("sudo pacman -S --needed --noconfirm xdotool xorg-xwininfo yad");
    expect(setupSource).toContain("SteamTinkerLaunch requires Yad 7.2 or newer");
    expect(dependencySetup).toBeGreaterThan(0);
    expect(dependencySetup).toBeLessThan(firstShortcut);
  });

  it("installs Flatpak Brave before creating its Fav launcher and other URL shortcuts", () => {
    const flatpakInstall = setupSource.indexOf("if ! flatpak install --user flathub com.brave.Browser; then");
    const braveShortcut = setupSource.indexOf('_add_url_steam_shortcut "Brave"');
    const disneyShortcut = setupSource.indexOf('_add_url_steam_shortcut "Disney+"');
    const emudeckDownload = setupSource.indexOf('curl -fsSL "https://www.emudeck.com/EmuDeck.desktop"');

    expect(flatpakInstall).toBeGreaterThan(0);
    expect(flatpakInstall).toBeLessThan(emudeckDownload);
    expect(braveShortcut).toBeGreaterThan(flatpakInstall);
    expect(disneyShortcut).toBeGreaterThan(flatpakInstall);
    expect(setupSource).not.toContain("--file-forwarding");
    expect(setupSource).not.toContain("pacman -S --needed --noconfirm brave-bin");
    expect(setupSource).not.toContain("flatpak remote-add");
    expect(setupSource).not.toContain("pacman -S --needed --noconfirm flatpak");
    expect(setupSource).not.toContain("flatpak list --user --app");
    expect(setupSource).toContain('_add_url_steam_shortcut "Brave" "https://synle.github.io/fav/"');
    expect(setupSource).not.toContain('_add_steam_shortcut "Brave"');
    expect(setupSource).not.toContain('_add_url_steam_shortcut "Fav"');
    expect(flatpakInstall).toBeLessThan(setupSource.indexOf('_add_url_steam_shortcut "Disney+"'));
  });

  it("does not run the retired pacman Brave migration", () => {
    expect(setupSource).not.toContain("pacman -Qq brave-bin");
    expect(setupSource).not.toContain("pacman -R --noconfirm brave-bin");
  });

  it("keeps pacman cleanup inline and launches fixed Brave URLs directly in kiosk mode", () => {
    expect(fs.existsSync(path.join(ROOT_DIR, "assets/steamos/remove-pacman-brave.sh"))).toBe(false);
    const urlShortcutFunction = setupSource.split("function _add_url_steam_shortcut()", 2)[1].split("\n}\n", 1)[0];
    expect(urlShortcutFunction).toContain('launchoptions="\\\"run\\\"');
    expect(urlShortcutFunction).toContain("--kiosk");
    expect(urlShortcutFunction).toContain('\\"$url\\"');
    expect(urlShortcutFunction).not.toContain("--app=");
    expect(urlShortcutFunction).not.toContain("@@u");
    expect(urlShortcutFunction).not.toContain('"@@"');
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

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
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
});
