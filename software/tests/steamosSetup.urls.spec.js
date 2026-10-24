/** Regression coverage for HTTP and HTTPS SteamOS website shortcuts. */
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Checkout root containing the setup script under test. */
const ROOT_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Setup source used to extract functions without running provisioning actions. */
const setupSource = fs.readFileSync(path.join(ROOT_FOLDER, "software/scripts/steamos/setup.bash"), "utf-8");
/** Real URL and VDF helpers, excluding top-level provisioning actions. */
const shortcutSource = [
  "_steam_shortcuts_file",
  "_steam_shortcut_exists",
  "_steam_shortcut_update_by_name",
  "_add_url_steam_shortcut",
  "_upsert_url_steam_shortcut",
]
  .map((name) => `function ${name}()${setupSource.split(`function ${name}()`, 2)[1].split("\n}\n", 1)[0]}\n}`)
  .join("\n");
/** Test-owned temporary homes removed after each case. */
const sandboxes = [];
/** An empty, valid Steam binary shortcuts file. */
const EMPTY_SHORTCUTS = Buffer.from("\x00shortcuts\x00\x08\x08", "binary");

/**
 * Run a URL helper twice against an isolated Steam account with a local registration adapter.
 * @param {string} helper - URL helper to invoke.
 * @param {string} title - Shortcut title.
 * @param {string} url - Website URL.
 * @returns {object} Process result and sandbox paths for inspecting persisted effects.
 * @throws {Error} If temporary fixture creation fails.
 */
function runShortcut(helper, title, url) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-url-"));
  sandboxes.push(home);
  const binFolder = path.join(home, "bin");
  const accountFolder = path.join(home, ".steam/steam/userdata/12345/config");
  const shortcutsPath = path.join(accountFolder, "shortcuts.vdf");
  fs.mkdirSync(binFolder);
  fs.mkdirSync(accountFolder, { recursive: true });
  fs.writeFileSync(shortcutsPath, EMPTY_SHORTCUTS);
  fs.writeFileSync(path.join(binFolder, "flatpak"), "#!/bin/bash\nexit 0\n", { mode: 0o755 });
  fs.writeFileSync(path.join(binFolder, "steamtinkerlaunch"), "#!/bin/bash\nexit 0\n", { mode: 0o755 });

  const result = spawnSync(
    "/bin/bash",
    [
      "-c",
      `${shortcutSource}
function pgrep() { return 1; }
# Isolate the owned registration adapter; keep real VDF lookup, update, and replacement.
function _steamtinkerlaunch_add() {
  local launchoptions arg
  printf '%s\\n' "$@" > "$HOME/registration-args"
  for arg in "$@"; do
    case "$arg" in
      --launchoptions=*) launchoptions="\${arg#--launchoptions=}" ;;
    esac
  done
  printf '\\000shortcuts\\000\\0000\\000\\001AppName\\000Plex\\000\\001Exe\\000"/usr/bin/flatpak"\\000\\001StartDir\\000"/usr/bin/"\\000\\001LaunchOptions\\000%s\\000\\010\\010\\010' "$launchoptions" > "$HOME/.steam/steam/userdata/12345/config/shortcuts.vdf"
}
"$1" "$2" "$3" || exit $?
"$1" "$2" "$3"`,
      "bash",
      helper,
      title,
      url,
    ],
    { encoding: "utf-8", env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` }, timeout: 10000 },
  );
  return { result, home, accountFolder, shortcutsPath };
}

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("SteamOS URL shortcut protocols", () => {
  it.each([
    [
      "_add_url_steam_shortcut",
      "http://192.168.1.45:32400/web/index.html/",
      '"run" "--command=brave" "com.brave.Browser" "--kiosk" "http://192.168.1.45:32400/web/index.html"',
    ],
    [
      "_upsert_url_steam_shortcut",
      "http://192.168.1.45:32400/web/index.html/",
      '"run" "--command=brave" "com.brave.Browser" "--kiosk" "http://192.168.1.45:32400/web/index.html"',
    ],
    ["_add_url_steam_shortcut", "https://example.com///", '"run" "--command=brave" "com.brave.Browser" "--kiosk" "https://example.com"'],
    ["_upsert_url_steam_shortcut", "https://example.com///", '"run" "--command=brave" "com.brave.Browser" "--kiosk" "https://example.com"'],
  ])("%s registers and preserves %s on repeat execution", (helper, url, launchoptions) => {
    const { result, home, shortcutsPath } = runShortcut(helper, "Plex", url);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(fs.readFileSync(path.join(home, "registration-args"), "utf-8")).toBe(
      `--appname=Plex\n--exepath=/usr/bin/flatpak\n--startdir=/usr/bin/\n--launchoptions=${launchoptions}\n--tags=Streaming,Apps\n`,
    );
    expect(fs.readFileSync(shortcutsPath)).toEqual(
      Buffer.from(
        `\x00shortcuts\x00\x000\x00\x01AppName\x00Plex\x00\x01Exe\x00"/usr/bin/flatpak"\x00\x01StartDir\x00"/usr/bin/"\x00\x01LaunchOptions\x00${launchoptions}\x00\x08\x08\x08`,
        "binary",
      ),
    );
  });

  it.each([
    ["_add_url_steam_shortcut", "", "http://example.com"],
    ["_upsert_url_steam_shortcut", "", "http://example.com"],
    ["_add_url_steam_shortcut", "Plex", ""],
    ["_upsert_url_steam_shortcut", "Plex", ""],
    ["_add_url_steam_shortcut", "Plex", "javascript:alert(1)"],
    ["_upsert_url_steam_shortcut", "Plex", "javascript:alert(1)"],
    ["_add_url_steam_shortcut", "Plex", "file:///etc/passwd"],
    ["_upsert_url_steam_shortcut", "Plex", "file:///etc/passwd"],
  ])("%s rejects title=%j URL=%j without changing shortcuts", (helper, title, url) => {
    const { result, home, accountFolder, shortcutsPath } = runShortcut(helper, title, url);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain("Steam: skipping URL shortcut; title and HTTP or HTTPS URL required.");
    expect(fs.readFileSync(shortcutsPath)).toEqual(EMPTY_SHORTCUTS);
    expect(fs.readdirSync(accountFolder)).toEqual(["shortcuts.vdf"]);
    expect(fs.existsSync(path.join(home, "registration-args"))).toBe(false);
  });
});
