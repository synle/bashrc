import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import runtime from "../scripts/decky/decky-runtime.common.js";

/** Original host state restored after every isolated Linux installation simulation. */
let original;
/** Test-owned desktop account home, populated independently for every test. */
let home;

/** Return an isolated home-relative filename; no filesystem side effects. */
function file(name) {
  return path.join(home, name);
}

/** Run the public installer without package pins; return its verification promise or rejection. */
function install() {
  return runtime.install({ pins: [], cacheUrl: null });
}

/** Assert rejected setup leaves the existing Loader, stamp, plugins, and privileged commands untouched. */
function expectUnchangedInstallation() {
  expect(fs.readFileSync(file("homebrew/services/PluginLoader"), "utf8")).toBe("existing service");
  expect(fs.readFileSync(file("homebrew/services/.loader.version"), "utf8")).toBe("v3.2.10\n");
  expect(fs.readdirSync(file("homebrew/plugins"))).toEqual([]);
  expect(fs.existsSync(file("commands"))).toBe(false);
  const logFolder = fs.readdirSync(file("Desktop"))[0];
  const log = fs.readFileSync(file(`Desktop/${logFolder}/install.log`), "utf8");
  expect(log).toContain("phase=failed");
  expect(log).not.toContain("phase=complete");
}

beforeEach(() => {
  original = {
    platform: Object.getOwnPropertyDescriptor(process, "platform"),
    userInfo: os.userInfo,
    home: process.env.HOME,
    path: process.env.PATH,
  };
  home = fs.mkdtempSync(path.join(os.tmpdir(), "decky-version-"));
  fs.mkdirSync(file("bin"));
  fs.mkdirSync(file("homebrew/services"), { recursive: true });
  fs.mkdirSync(file("homebrew/plugins"));
  fs.writeFileSync(file("homebrew/services/PluginLoader"), "existing service", { mode: 0o755 });
  fs.writeFileSync(file("homebrew/services/.loader.version"), "v3.2.10\n");
  // Fields recorded from the upstream stable release API during this investigation.
  fs.writeFileSync(file("release.json"), '{"tag_name":"v3.3.0","prerelease":false,"draft":false}');
  fs.writeFileSync(file("bootstrap-version"), "v3.3.0\n");
  fs.writeFileSync(file("bootstrap.sh"), fs.readFileSync("software/tests/fixtures/decky-loader-bootstrap.txt"));
  fs.writeFileSync(file("bin/jq"), "#!/bin/bash\nexit 0\n", { mode: 0o755 });
  fs.writeFileSync(
    file("bin/curl"),
    `#!/bin/bash
printf '%s\\n' "$*" >> "$HOME/downloads"
case "$*" in
  *api.github.com/repos/SteamDeckHomebrew/decky-loader/releases/tags/v*) cp "$HOME/release.json" "\${@: -1}" ;;
  *) cp "$HOME/bootstrap.sh" "\${@: -1}" ;;
esac
`,
    { mode: 0o755 },
  );
  fs.writeFileSync(
    file("bin/sudo"),
    `#!/bin/bash
printf '%s\\n' "$*" >> "$HOME/commands"
if [ "$1" = systemctl ]; then
  if [ -f "$HOME/service-failure" ] && [ "$(command cat "$HOME/service-failure")" = "$2" ]; then exit 44; fi
  exit 0
fi
if [ -f "$HOME/bootstrap-failure" ]; then exit 43; fi
/bin/bash "$2" "$3" || exit $?
mkdir -p "$HOME/homebrew/services" "$HOME/homebrew/plugins"
printf service > "$HOME/homebrew/services/PluginLoader"
chmod 755 "$HOME/homebrew/services/PluginLoader"
cp "$HOME/bootstrap-version" "$HOME/homebrew/services/.loader.version"
`,
    { mode: 0o755 },
  );
  Object.defineProperty(process, "platform", { value: "linux" });
  os.userInfo = () => ({ uid: 12345, gid: 23456, homedir: home });
  process.env.HOME = home;
  process.env.PATH = `${file("bin")}:${original.path}`;
});

afterEach(() => {
  Object.defineProperty(process, "platform", original.platform);
  os.userInfo = original.userInfo;
  process.env.HOME = original.home;
  process.env.PATH = original.path;
  fs.rmSync(home, { recursive: true, force: true });
});

describe("Decky Loader stable-version installation (Linux and elevation simulated)", () => {
  it("upgrades an existing outdated Loader instead of skipping it", async () => {
    await install();
    expect(fs.readFileSync(file("homebrew/services/.loader.version"), "utf8")).toBe("v3.3.0\n");
    expect(fs.readFileSync(file("homebrew/services/PluginLoader"), "utf8")).toBe("service");
    expect(JSON.parse(fs.readFileSync(file("selected-release.json"), "utf8")).tag_name).toBe("v3.3.0");
    expect(fs.readFileSync(file("downloads"), "utf8")).toContain(
      "https://github.com/SteamDeckHomebrew/decky-installer/releases/latest/download/install_release.sh",
    );
  });

  it.each(["v3.3.0\n", "3.3.0", " \nv3.3.0 \n"])("skips reinstalling a current Loader with stamp %j", async (stamp) => {
    fs.writeFileSync(file("homebrew/services/.loader.version"), stamp);
    await install();
    expect(fs.readFileSync(file("homebrew/services/PluginLoader"), "utf8")).toBe("existing service");
    expect(fs.readFileSync(file("commands"), "utf8")).toBe(
      "systemctl restart plugin_loader.service\nsystemctl is-active --quiet plugin_loader.service\n",
    );
    expect(fs.readFileSync(file("downloads"), "utf8")).toContain(
      "https://api.github.com/repos/SteamDeckHomebrew/decky-loader/releases/tags/v3.3.0",
    );
    expect(fs.readFileSync(file("downloads"), "utf8")).not.toContain("install_release.sh");
  });

  it("checks again but does not reinstall on the second run after upgrading", async () => {
    await install();
    const commands = fs.readFileSync(file("commands"), "utf8");
    await install();
    expect(fs.readFileSync(file("commands"), "utf8")).toBe(
      commands + "systemctl restart plugin_loader.service\nsystemctl is-active --quiet plugin_loader.service\n",
    );
    expect(fs.readFileSync(file("homebrew/services/.loader.version"), "utf8")).toBe("v3.3.0\n");
    expect(fs.readdirSync(file("Desktop"))).toHaveLength(2);
  });

  it.each(["", "not-a-version", "v3.3.0-pre1"])("repairs an unknown or nonstable installed stamp %j", async (stamp) => {
    fs.writeFileSync(file("homebrew/services/.loader.version"), stamp);
    await install();
    expect(fs.readFileSync(file("homebrew/services/.loader.version"), "utf8")).toBe("v3.3.0\n");
  });

  it("installs when the executable is absent despite a current version stamp", async () => {
    fs.writeFileSync(file("homebrew/services/.loader.version"), "v3.3.0\n");
    fs.unlinkSync(file("homebrew/services/PluginLoader"));
    await install();
    expect(fs.readFileSync(file("homebrew/services/PluginLoader"), "utf8")).toBe("service");
  });

  it("repairs a missing version stamp instead of trusting executable presence", async () => {
    fs.unlinkSync(file("homebrew/services/.loader.version"));
    await install();
    expect(fs.readFileSync(file("homebrew/services/.loader.version"), "utf8")).toBe("v3.3.0\n");
  });

  it("repairs a missing plugins folder despite a current version stamp", async () => {
    fs.writeFileSync(file("homebrew/services/.loader.version"), "v3.3.0\n");
    fs.rmdirSync(file("homebrew/plugins"));
    await install();
    expect(fs.statSync(file("homebrew/plugins")).isDirectory()).toBe(true);
    expect(fs.readFileSync(file("homebrew/services/PluginLoader"), "utf8")).toBe("service");
  });

  it.each([
    "null",
    "[]",
    '"unexpected"',
    "{}",
    '{"tag_name":3}',
    '{"tag_name":"v3.3.0-pre1","prerelease":false,"draft":false}',
    '{"tag_name":"v3.3.0","prerelease":true,"draft":false}',
    '{"tag_name":"v3.3.0","prerelease":false,"draft":true}',
    '{"tag_name":"v3.3.0","prerelease":false}',
  ])("rejects invalid stable-release metadata %s before elevation", async (payload) => {
    fs.writeFileSync(file("release.json"), payload);
    await expect(install()).rejects.toThrow("Loader stable release metadata requires");
    expectUnchangedInstallation();
  });

  it("rejects malformed JSON without modifying an existing installation", async () => {
    fs.writeFileSync(file("release.json"), "{");
    await expect(install()).rejects.toThrow(SyntaxError);
    expectUnchangedInstallation();
  });

  it("rejects oversized release metadata before JSON parsing or elevation", async () => {
    fs.writeFileSync(file("release.json"), " ".repeat(1024 * 1024 + 1));
    await expect(install()).rejects.toThrow("Loader release metadata exceeds 1 MiB");
    expectUnchangedInstallation();
  });

  it("fails closed when the release lookup is unavailable", async () => {
    fs.writeFileSync(file("bin/curl"), "#!/bin/bash\nexit 28\n");
    await expect(install()).rejects.toThrow("download failed status=28");
    expectUnchangedInstallation();
  });

  it("does not claim an old Loader is current when its upgrade fails", async () => {
    fs.writeFileSync(file("bootstrap-failure"), "");
    await expect(install()).rejects.toThrow("sudo failed status=43");
    expect(fs.readFileSync(file("homebrew/services/.loader.version"), "utf8")).toBe("v3.2.10\n");
    expect(fs.readdirSync(file("homebrew/plugins"))).toEqual([]);
  });

  it("rejects a valid stable release that is not the configured Loader pin", async () => {
    fs.writeFileSync(file("release.json"), '{"tag_name":"v3.4.0","prerelease":false,"draft":false}');
    await expect(install()).rejects.toThrow("Loader release does not match decky_loader_version");
    expectUnchangedInstallation();
  });

  it("restores the hand-picked Loader even when a newer version is installed", async () => {
    fs.writeFileSync(file("homebrew/services/.loader.version"), "v9.0.0\n");
    await install();
    expect(fs.readFileSync(file("homebrew/services/.loader.version"), "utf8")).toBe("v3.3.0\n");
    expect(JSON.parse(fs.readFileSync(file("selected-release.json"), "utf8")).tag_name).toBe("v3.3.0");
  });

  it.each(["missing", "duplicate"])("fails closed on a %s upstream release selector", async (kind) => {
    const original = fs.readFileSync(file("bootstrap.sh"), "utf8");
    fs.writeFileSync(file("bootstrap.sh"), kind === "missing" ? "#!/bin/bash\nexit 0\n" : original + original);
    await expect(install()).rejects.toThrow("Loader bootstrap release selector changed");
    expectUnchangedInstallation();
  });

  it.each(["restart", "is-active"])("does not report completion when service %s fails", async (operation) => {
    fs.writeFileSync(file("homebrew/services/.loader.version"), "v3.3.0\n");
    fs.writeFileSync(file("service-failure"), operation);
    await expect(install()).rejects.toThrow("sudo failed status=44");
    const logFolder = fs.readdirSync(file("Desktop"))[0];
    const log = fs.readFileSync(file(`Desktop/${logFolder}/install.log`), "utf8");
    expect(log).toContain("phase=failed");
    expect(log).not.toContain("phase=complete");
  });

  it("rejects an installer that leaves the old version rather than reporting success", async () => {
    fs.writeFileSync(file("bootstrap-version"), "v3.2.10\n");
    await expect(install()).rejects.toThrow("Decky Loader installed version does not match decky_loader_version");
    expect(fs.readdirSync(file("homebrew/plugins"))).toEqual([]);
    const logFolder = fs.readdirSync(file("Desktop"))[0];
    const log = fs.readFileSync(file(`Desktop/${logFolder}/install.log`), "utf8");
    expect(log).toContain("phase=failed");
    expect(log).not.toContain("phase=complete");
  });
});
