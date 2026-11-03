/** Isolated launcher persistence and KDE D-Bus boundary fixtures. */
import { afterEach, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/** Production KDE launcher function, excluding its automatic invocation. */
const source = fs
  .readFileSync("software/scripts/steamos/setup.bash", "utf8")
  .split("# --- KDE favorites and taskbar pins ---")[1]
  .split("\nif ! _configure_kde_launchers;")[0];
/** Owned temporary roots. */
const roots = [];
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

it("removes installed Kate noninteractively and skips an absent package", () => {
  const setup = fs.readFileSync("software/scripts/steamos/setup.bash", "utf8");
  const removal = setup.split("# --- Remove Kate ---")[1].split("\nif type -P paru")[0];
  const result = spawnSync(
    "/bin/bash",
    [
      "-c",
      `
function type() { return 0; }
function pacman() { return "$INSTALLED"; }
function _run_long_install() { printf '%s\\n' "$@"; }
INSTALLED=0
${removal}
INSTALLED=1
${removal}
`,
    ],
    { encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toBe("Kate removal\nsudo\npacman\n-R\n--noconfirm\nkate\n");
});

it("joins the background Zed installer before deploying editor configuration", () => {
  const setup = fs.readFileSync("software/scripts/steamos/setup.bash", "utf8");
  const install = setup.split("# --- Zed background installation ---")[1].split("# Install or confirm Flatpak Brave")[0];
  const result = spawnSync(
    "/bin/bash",
    [
      "-c",
      `
function curl() { printf '%s\\n' 'exit 19'; }
${install}
wait "$ZED_INSTALL_PID"
`,
    ],
    { encoding: "utf8" },
  );
  expect(result.status).toBe(19);
  expect(setup.indexOf('wait "$ZED_INSTALL_PID"')).toBeLessThan(setup.indexOf("--files=url-porter,skippy-ff"));
});

it("persists launcher icons and adds favorites and pins only once by name", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-kde-"));
  roots.push(home);
  const bin = path.join(home, "bin");
  const apps = path.join(home, ".local/share/applications");
  fs.mkdirSync(bin);
  fs.mkdirSync(apps, { recursive: true });
  fs.mkdirSync(path.join(home, "Applications"));
  fs.mkdirSync(path.join(home, "Emulation/tools/launchers/es-de"), { recursive: true });
  fs.mkdirSync(path.join(home, ".local/zed.app/bin"), { recursive: true });
  fs.mkdirSync(path.join(home, ".local/zed.app/share/icons/hicolor/512x512/apps"), { recursive: true });
  fs.writeFileSync(path.join(home, ".local/zed.app/share/icons/hicolor/512x512/apps/zed.png"), "zed icon");
  fs.writeFileSync(path.join(home, ".local/zed.app/bin/zed"), "zed", { mode: 0o755 });
  fs.writeFileSync(path.join(home, "Applications/Ghostty.AppImage"), "ghostty", { mode: 0o755 });
  fs.writeFileSync(path.join(home, "Applications/EmuDeck.AppImage"), "emu");
  fs.writeFileSync(path.join(home, "Emulation/tools/launchers/es-de/es-de.sh"), "esde");
  fs.writeFileSync(path.join(bin, "konsole"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "kbuildsycoca6"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  fs.writeFileSync(path.join(apps, "custom-brave.desktop"), "[Desktop Entry]\nName=Brave\nExec=custom-brave\nIcon=com.brave.Browser\n");
  const database = path.join(home, ".local/share/kactivitymanagerd/resources/database");
  fs.mkdirSync(path.dirname(database), { recursive: true });
  const seeded = spawnSync("python3", [
    "-c",
    "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('CREATE TABLE ResourceLink (targettedResource TEXT, initiatingAgent TEXT)'); c.execute('INSERT INTO ResourceLink VALUES (?, ?)', ('applications:custom-brave.desktop', 'org.kde.plasma.favorites.applications')); c.commit()",
    database,
  ]);
  expect(seeded.status, seeded.stderr?.toString()).toBe(0);
  const state = path.join(home, "dbus.json");
  fs.writeFileSync(
    state,
    JSON.stringify({ favorites: ["applications:custom-brave.desktop"], launchers: ["applications:custom-brave.desktop"], writes: 0 }),
  );
  fs.writeFileSync(
    path.join(bin, "qdbus6"),
    `#!${process.execPath}
const fs = require("fs"), vm = require("vm");
const args = process.argv.slice(2), file = process.env.KDE_STATE;
const state = JSON.parse(fs.readFileSync(file));
if (args[0] === "org.kde.ActivityManager" &&
    (args[1] !== "/ActivityManager/Resources/Linking" ||
     !["org.kde.ActivityManager.ResourcesLinking.IsResourceLinkedToActivity",
       "org.kde.ActivityManager.ResourcesLinking.LinkResourceToActivity"].includes(args[2]) ||
     args[3] !== "org.kde.plasma.favorites.applications" || args[5] !== ":global")) {
  process.stderr.write("Cannot find '" + args[2] + "' in object " + args[1]);
  process.exit(1);
}
if (args[2].endsWith("IsResourceLinkedToActivity")) process.stdout.write(String(state.favorites.includes(args[4])));
else if (args[2].endsWith("LinkResourceToActivity")) state.favorites.push(args[4]);
else {
  const widget = { type: "org.kde.plasma.icontasks", readConfig: () => state.launchers,
    writeConfig: (_key, value) => { state.launchers = value; state.writes++; }, reloadConfig: () => {} };
  vm.runInNewContext(args[3], { panels: () => [{ widgets: () => [widget] }], print: (text) => process.stdout.write(text) });
}
fs.writeFileSync(file, JSON.stringify(state));
`,
    { mode: 0o755 },
  );
  const result = spawnSync("/bin/bash", ["-c", `${source}\n_configure_kde_launchers && _configure_kde_launchers`], {
    encoding: "utf8",
    timeout: 15000,
    env: {
      ...process.env,
      HOME: home,
      XDG_DATA_HOME: path.join(home, ".local/share"),
      XDG_DATA_DIRS: path.join(home, "empty"),
      PATH: `${bin}:${process.env.PATH}`,
      KDE_STATE: state,
    },
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(fs.readFileSync(state, "utf8"))).toEqual({
    favorites: [
      "applications:custom-brave.desktop",
      "applications:dev.zed.Zed.desktop",
      "applications:org.kde.konsole.desktop",
      "applications:steamos-setup-ghostty.desktop",
      "applications:steamos-setup-emudeck.desktop",
      "applications:steamos-setup-es-de.desktop",
    ],
    launchers: [
      "applications:custom-brave.desktop",
      "applications:dev.zed.Zed.desktop",
      "applications:org.kde.konsole.desktop",
      "applications:steamos-setup-ghostty.desktop",
    ],
    writes: 1,
  });
  expect(fs.readFileSync(path.join(apps, "custom-brave.desktop"), "utf8")).toContain("Exec=custom-brave");
  const persistedIcon = fs.readdirSync(path.join(home, ".local/share/icons/steamos-setup"));
  expect(persistedIcon).toHaveLength(1);
  expect(fs.readFileSync(path.join(home, ".local/share/icons/steamos-setup", persistedIcon[0]), "utf8")).toBe("zed icon");
  expect(fs.readFileSync(path.join(apps, "dev.zed.Zed.desktop"), "utf8")).toContain(`Exec="${home}/.local/zed.app/bin/zed" %U`);
  expect(fs.readFileSync(path.join(apps, "steamos-setup-ghostty.desktop"), "utf8")).toBe(
    `[Desktop Entry]\nType=Application\nName=Ghostty\nExec="${home}/Applications/Ghostty.AppImage"\nIcon=utilities-terminal\nTerminal=false\n`,
  );
  expect(fs.readFileSync(path.join(apps, "steamos-setup-es-de.desktop"), "utf8")).toContain(
    `Exec="${home}/Emulation/tools/launchers/es-de/es-de.sh"`,
  );

  // The original interface typo must fail against KDE's contract without changing saved favorites or pins.
  const before = fs.readFileSync(state, "utf8");
  const unfixed = spawnSync(
    "/bin/bash",
    [
      "-c",
      `${source.replace('link_interface = "org.kde.ActivityManager.ResourcesLinking"', 'link_interface = "org.kde.ActivityManager.Resources.Linking"')}\n_configure_kde_launchers`,
    ],
    {
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...process.env,
        HOME: home,
        XDG_DATA_HOME: path.join(home, ".local/share"),
        XDG_DATA_DIRS: path.join(home, "empty"),
        PATH: `${bin}:${process.env.PATH}`,
        KDE_STATE: state,
      },
    },
  );
  expect(unfixed.status).toBe(1);
  expect(unfixed.stderr).toContain(
    "org.kde.ActivityManager.Resources.Linking.IsResourceLinkedToActivity failed (exit 1): Cannot find 'org.kde.ActivityManager.Resources.Linking.IsResourceLinkedToActivity' in object /ActivityManager/Resources/Linking",
  );
  expect(fs.readFileSync(state, "utf8")).toBe(before);
});
