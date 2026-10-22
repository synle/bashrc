import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Manual installer source; exercise its Decky entry point without unrelated setup. */
const setupSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/steamos/setup.bash"), "utf8");
/** Shell functions used by the Decky installation entry point. */
const deckySource = setupSource.split("# --- Decky Loader + plugins + CSS Loader themes ---")[1].split("# --- Steam shortcuts ---")[0];
/** Startup preflight exercised independently of interactive prompts and unrelated installs. */
const preflightSource = setupSource.slice(
  setupSource.indexOf("function _start_steamos_setup_log()"),
  setupSource.indexOf("\n_start_steamos_setup_log || exit 1"),
);
/** Test-owned temporary homes removed after each subprocess test. */
const homes = [];

/** Create a real ZIP and a protected Decky layout; return fixture paths. */
function fixture(flags = []) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "decky-ownership-"));
  homes.push(home);
  const bin = path.join(home, "bin");
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(home, "homebrew/services"), { recursive: true });
  fs.writeFileSync(path.join(home, "homebrew/services/PluginLoader"), "existing service", { mode: 0o755 });
  fs.mkdirSync(path.join(home, "homebrew/plugins"), { mode: 0o555 });
  const zip = spawnSync(
    "python3",
    [
      "-c",
      `import json,sys,zipfile
with zipfile.ZipFile(sys.argv[1], 'w') as z:
    z.writestr('Example/plugin.json', json.dumps({'name': 'Example', 'flags': json.loads(sys.argv[2])}))
    z.writestr('Example/package.json', '{"version":"1"}')
    z.writestr('Example/dist/index.js', 'verified payload')
    executable = zipfile.ZipInfo('Example/bin/helper')
    executable.external_attr = (0o100755 << 16)
    z.writestr(executable, 'executable payload')
with zipfile.ZipFile(sys.argv[3], 'w') as z:
    z.writestr('Example Theme/theme.json', '{}')
`,
      path.join(home, "plugin.zip"),
      JSON.stringify(flags),
      path.join(home, "theme.zip"),
    ],
    { encoding: "utf8" },
  );
  if (zip.status !== 0) throw new Error(zip.stderr);
  // This boundary substitute cannot elevate on macOS. Record requested ownership
  // while exercising real ZIP parsing, descriptor-relative writes, and chmod calls.
  fs.writeFileSync(
    path.join(bin, "sudo"),
    `#!/bin/bash
printf '%s\\n' "$*" >> "$HOME/elevated-commands"
exec python3 "$HOME/privilege-boundary.py" "$@"
`,
    { mode: 0o755 },
  );
  fs.writeFileSync(
    path.join(home, "privilege-boundary.py"),
    `import json,os,pwd,sys,types
os.chmod(os.path.join(os.environ['HOME'], 'homebrew/plugins'), 0o755)
original = pwd.getpwuid
host_uid = os.getuid()
def account(uid):
    result = original(uid)
    if uid == host_uid:
        return types.SimpleNamespace(pw_dir=os.environ.get('TEST_ACCOUNT_HOME', os.environ['HOME']), pw_uid=int(os.environ.get('TEST_ACCOUNT_UID', result.pw_uid)), pw_gid=result.pw_gid, pw_name=result.pw_name)
    return result
pwd.getpwuid = account
original_stat = os.fstat
owners = {}
def record_owner(fd, uid, gid):
    inode = original_stat(fd).st_ino
    if os.environ.get('TEST_CHOWN_FAIL'):
        raise PermissionError('fixture chown denied')
    if not os.environ.get('TEST_OWNER_VERIFY_FAIL'):
        owners[inode] = (uid, gid)
    with open(os.path.join(os.environ['HOME'], 'ownership.jsonl'), 'a') as out:
        out.write(json.dumps({'inode': inode, 'uid': uid, 'gid': gid}) + '\\n')
def recorded_stat(fd):
    value = original_stat(fd)
    if value.st_ino in owners:
        fields = list(value)
        fields[4:6] = owners[value.st_ino]
        return os.stat_result(fields)
    return value
os.fchown = record_owner
os.fstat = recorded_stat
sys.argv = ['-'] + sys.argv[3:]
source = sys.stdin.read()
coverage_source = os.environ.get('DECKY_TEST_COVERAGE_SOURCE')
if coverage_source:
    import coverage
    measurement = coverage.Coverage(data_file=coverage_source + '.coverage', data_suffix=True, branch=True)
    measurement.start()
try:
    exec(compile(source, coverage_source or '<decky-installer>', 'exec'))
finally:
    if coverage_source:
        measurement.stop()
        measurement.save()
`,
  );
  return home;
}

/** Run the actual Decky bootstrap with local downloads and a recorded privilege boundary. */
function install(home, overrides = {}) {
  return spawnSync(
    "/bin/bash",
    [
      "-c",
      `${deckySource}
function curl() {
  if [ -n "\${TEST_ASSETS_FOLDER:-}" ]; then
    cp "$TEST_ASSETS_FOLDER/\${2##*/steamos/}" "\${@: -1}"
    return $?
  fi
  case "$2" in
    */decky_plugin/*) cp "$HOME/plugin.zip" "\${@: -1}" ;;
    */decky_css_loader/*) cp "$HOME/theme.zip" "\${@: -1}" ;;
    *) return 91 ;;
  esac
}
DECKY_PLUGINS_FOLDER="$HOME/Desktop/decky_plugins"
CSS_LOADER_THEMES_FOLDER="$DECKY_PLUGINS_FOLDER/css_loader_themes"
_bootstrap_decky_loader_plugins_themes
`,
    ],
    {
      encoding: "utf8",
      timeout: 15000,
      env: { ...process.env, HOME: home, PATH: `${path.join(home, "bin")}:${process.env.PATH}`, ...overrides },
    },
  );
}

afterEach(() => {
  for (const home of homes.splice(0)) {
    fs.chmodSync(path.join(home, "homebrew/plugins"), 0o755);
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/** Execute one protected archive installation, optionally injecting OS-boundary failures. */
function runArchive(home, archive = path.join(home, "plugin.zip"), kind = "plugins", overrides = {}) {
  return spawnSync("/bin/bash", ["-c", `${deckySource}\n_install_decky_archive "$1" "$2"`, "bash", archive, kind], {
    encoding: "utf8",
    timeout: 15000,
    env: { ...process.env, HOME: home, PATH: `${path.join(home, "bin")}:${process.env.PATH}`, ...overrides },
  });
}

/** Replace a fixture archive with literal hostile or boundary-case ZIP members. */
function replaceArchive(home, entries) {
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import json,sys,zipfile
with zipfile.ZipFile(sys.argv[1], 'w') as bundle:
    for entry in json.loads(sys.argv[2]):
        info = zipfile.ZipInfo(entry['name'])
        info.external_attr = entry.get('mode', 0o100644) << 16
        bundle.writestr(info, entry.get('data', ''))
`,
      path.join(home, "plugin.zip"),
      JSON.stringify(entries),
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
}

/** Execute only startup preflight, then write markers to both captured streams. */
function runPreflight(home, shellSetup = "", overrides = {}, sourceMode = "file") {
  const script = path.join(home, "preflight.bash");
  fs.writeFileSync(
    script,
    `${shellSetup}\n${preflightSource}\n_start_steamos_setup_log || exit $?\necho 'stdout marker'\necho 'stderr marker' >&2\n`,
  );
  const args = sourceMode === "stream" ? ["-c", 'exec /bin/bash <(command cat "$1")', "bash", script] : [script];
  return spawnSync("/bin/bash", args, {
    encoding: "utf8",
    timeout: 15000,
    env: { ...process.env, HOME: home, DECKY_TEST_COVERAGE_SOURCE: "", ...overrides },
  });
}

/** Return the last requested UID/GID for a persisted fixture file. */
function requestedOwner(home, target) {
  const inode = fs.statSync(target).ino;
  return fs
    .readFileSync(path.join(home, "ownership.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse)
    .filter((record) => record.inode === inode)
    .at(-1);
}

describe("SteamOS setup account and persistent logging (subprocess)", () => {
  it("rejects root before creating downloads or a log", () => {
    const home = fixture();
    const result = runPreflight(home, "function id() { echo 0; }");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("run as your normal desktop user, not root or sudo");
    expect(fs.existsSync(path.join(home, "Desktop"))).toBe(false);
    expect(fs.existsSync(path.join(home, "elevated-commands"))).toBe(false);
  });

  it("rejects an unrelated HOME before creating downloads or a log", () => {
    const home = fixture();
    const result = runPreflight(home);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("HOME does not match the invoking account");
    expect(fs.existsSync(path.join(home, "Desktop"))).toBe(false);
    expect(fs.existsSync(path.join(home, "elevated-commands"))).toBe(false);
  });

  it("reports missing Python before attempting a download or privileged action", () => {
    const home = fixture();
    const result = runPreflight(home, "function id() { echo 123; }", { PATH: path.join(home, "bin") });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("required command unavailable: python3");
    expect(fs.existsSync(path.join(home, "Desktop"))).toBe(false);
    expect(fs.existsSync(path.join(home, "elevated-commands"))).toBe(false);
  });

  it("persists stdout, stderr, identity, runtime, and source checksum in a private Desktop log", () => {
    const home = fixture();
    const result = runPreflight(
      home,
      `function python3() {
  if [ "$1" = "--version" ]; then command python3 --version
  else command python3 "$HOME/privilege-boundary.py" python3 "$@"; fi
}`,
    );
    expect(result.status, result.stderr).toBe(0);
    const logPath = path.join(home, "Desktop", fs.readdirSync(path.join(home, "Desktop"))[0]);
    const log = fs.readFileSync(logPath, "utf8");
    expect(log).toContain("stdout marker");
    expect(log).toContain("stderr marker");
    expect(log).toContain("SteamOS setup identity: uid=");
    expect(log).toContain("SteamOS setup runtime: Python ");
    expect(log).toContain("SteamOS setup source checksum:");
    expect(fs.statSync(logPath).mode & 0o777).toBe(0o600);
    expect(fs.existsSync(path.join(home, "elevated-commands"))).toBe(false);
  });
});

describe("SteamOS streamed setup logging (subprocess)", () => {
  it("does not consume pending setup commands when recording the script checksum", () => {
    const home = fixture();
    const result = runPreflight(
      home,
      `function python3() {
  if [ "$1" = "--version" ]; then command python3 --version
  else command python3 "$HOME/privilege-boundary.py" python3 "$@"; fi
}`,
      {},
      "stream",
    );
    expect(result.status, result.stderr).toBe(0);
    const logPath = path.join(home, "Desktop", fs.readdirSync(path.join(home, "Desktop"))[0]);
    const log = fs.readFileSync(logPath, "utf8");
    expect(log).toContain("unavailable (streamed script input)");
    expect(log).toContain("stdout marker");
    expect(log).toContain("stderr marker");
  });
});

describe("Decky protected archive installation (subprocess)", () => {
  it("installs plugins and themes through scoped elevation instead of unprivileged unzip", () => {
    const home = fixture();
    const result = install(home);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(fs.readFileSync(path.join(home, "homebrew/plugins/Example/dist/index.js"), "utf8")).toBe("verified payload");
    expect(fs.readFileSync(path.join(home, "homebrew/themes/Example Theme/theme.json"), "utf8")).toBe("{}");
    expect(fs.readFileSync(path.join(home, "elevated-commands"), "utf8")).toContain("python3 -");
    expect(fs.readFileSync(path.join(home, "homebrew/services/PluginLoader"), "utf8")).toBe("existing service");
    expect(result.stdout).toContain("phase=complete plugins=9 themes=9");
  });

  it("installs all 18 real vendored plugin and theme archives, including HueSync", () => {
    const home = fixture();
    const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets/steamos");
    const result = install(home, { TEST_ASSETS_FOLDER: assets });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("phase=verified target=plugins/HueSync");
    expect(result.stdout).toContain("phase=verified target=themes/Centered Home");
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toHaveLength(9);
    expect(fs.readdirSync(path.join(home, "homebrew/themes"))).toHaveLength(9);
    expect(JSON.parse(fs.readFileSync(path.join(home, "homebrew/plugins/HueSync/plugin.json"), "utf8")).flags).toContain("root");
    expect(requestedOwner(home, path.join(home, "homebrew/plugins/HueSync/plugin.json"))).toMatchObject({ uid: 0, gid: 0 });
  });

  it("requests host ownership for ordinary content and root ownership for the plugin folder and manifest", () => {
    const home = fixture();
    const result = runArchive(home);
    expect(result.status, result.stderr).toBe(0);
    expect(requestedOwner(home, path.join(home, "homebrew/plugins/Example/dist/index.js"))).toMatchObject({
      uid: process.getuid(),
      gid: process.getgid(),
    });
    expect(requestedOwner(home, path.join(home, "homebrew/plugins/Example"))).toMatchObject({ uid: 0, gid: 0 });
    expect(requestedOwner(home, path.join(home, "homebrew/plugins/Example/plugin.json"))).toMatchObject({ uid: 0, gid: 0 });
    expect(fs.statSync(path.join(home, "homebrew/plugins/Example/plugin.json")).mode & 0o777).toBe(0o755);
  });

  it("requests root ownership for root-plugin content without changing the Loader service", () => {
    const home = fixture(["root"]);
    const result = runArchive(home);
    expect(result.status, result.stderr).toBe(0);
    expect(requestedOwner(home, path.join(home, "homebrew/plugins/Example/dist/index.js"))).toMatchObject({ uid: 0, gid: 0 });
    expect(result.stdout).toContain("root_plugin=True content_uid=0 content_gid=0");
    expect(fs.statSync(path.join(home, "homebrew/services/PluginLoader")).mode & 0o777).toBe(0o755);
  });

  it("repairs matching-version partial installs on repeated runs and preserves executable bits and extra files", () => {
    const home = fixture();
    expect(runArchive(home).status).toBe(0);
    fs.unlinkSync(path.join(home, "homebrew/plugins/Example/dist/index.js"));
    fs.writeFileSync(path.join(home, "homebrew/plugins/Example/custom-setting"), "retain", { mode: 0o600 });
    fs.chmodSync(path.join(home, "homebrew/plugins/Example/package.json"), 0o755);
    const result = runArchive(home);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(home, "homebrew/plugins/Example/dist/index.js"), "utf8")).toBe("verified payload");
    expect(fs.statSync(path.join(home, "homebrew/plugins/Example/bin/helper")).mode & 0o777).toBe(0o755);
    expect(fs.statSync(path.join(home, "homebrew/plugins/Example/package.json")).mode & 0o777).toBe(0o755);
    expect(fs.readFileSync(path.join(home, "homebrew/plugins/Example/custom-setting"), "utf8")).toBe("retain");
    expect(fs.statSync(path.join(home, "homebrew/plugins/Example/custom-setting")).mode & 0o777).toBe(0o600);
  });

  it("installs theme files and folders as the host account", () => {
    const home = fixture();
    const result = runArchive(home, path.join(home, "theme.zip"), "themes");
    expect(result.status, result.stderr).toBe(0);
    expect(requestedOwner(home, path.join(home, "homebrew/themes/Example Theme/theme.json"))).toMatchObject({
      uid: process.getuid(),
      gid: process.getgid(),
    });
    expect(requestedOwner(home, path.join(home, "homebrew/themes/Example Theme"))).toMatchObject({
      uid: process.getuid(),
      gid: process.getgid(),
    });
  });

  it.each([
    ["parent traversal", [{ name: "../escape" }]],
    ["absolute path", [{ name: "/escape" }]],
    ["backslash", [{ name: "Example/evil\\name" }]],
    ["control character", [{ name: "Example/evil\nname" }]],
    ["symlink member", [{ name: "Example/link", data: "/etc/passwd", mode: 0o120777 }]],
    ["multiple roots", [{ name: "One/a" }, { name: "Two/b" }]],
    ["missing metadata", [{ name: "Example/index.js" }]],
    ["directory metadata", [{ name: "Example/plugin.json/", mode: 0o40755 }]],
    ["duplicate members", [{ name: "Example/a" }, { name: "Example/a" }]],
    ["empty archive", []],
    ["non-object manifest", [{ name: "Example/plugin.json", data: "[]" }]],
    ["invalid flags", [{ name: "Example/plugin.json", data: '{"flags":"root"}' }]],
    ["invalid JSON", [{ name: "Example/plugin.json", data: "{" }]],
  ])("rejects %s before any payload or ownership change", (_label, entries) => {
    const home = fixture();
    replaceArchive(home, entries);
    const result = runArchive(home);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("phase=archive-validation failed");
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toEqual([]);
    expect(fs.existsSync(path.join(home, "ownership.jsonl"))).toBe(false);
    expect(fs.existsSync(path.join(home, "escape"))).toBe(false);
  });

  it.each(["symlink", "hardlink"])("rejects an existing %s without changing its external target", (kind) => {
    const home = fixture();
    fs.chmodSync(path.join(home, "homebrew/plugins"), 0o755);
    fs.mkdirSync(path.join(home, "homebrew/plugins/Example"));
    fs.writeFileSync(path.join(home, "external"), "untouched");
    const destination = path.join(home, "homebrew/plugins/Example/plugin.json");
    if (kind === "symlink") fs.symlinkSync(path.join(home, "external"), destination);
    else fs.linkSync(path.join(home, "external"), destination);
    const result = runArchive(home);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("phase=destination-preflight failed");
    expect(fs.readFileSync(path.join(home, "external"), "utf8")).toBe("untouched");
    expect(fs.existsSync(path.join(home, "homebrew/plugins/Example/package.json"))).toBe(false);
    expect(fs.existsSync(path.join(home, "ownership.jsonl"))).toBe(false);
  });

  it("rejects a symlinked destination folder without writing outside the install tree", () => {
    const home = fixture();
    fs.chmodSync(path.join(home, "homebrew/plugins"), 0o755);
    fs.mkdirSync(path.join(home, "external"));
    fs.symlinkSync(path.join(home, "external"), path.join(home, "homebrew/plugins/Example"));
    const result = runArchive(home);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("phase=destination-preflight failed");
    expect(fs.readdirSync(path.join(home, "external"))).toEqual([]);
    expect(fs.existsSync(path.join(home, "ownership.jsonl"))).toBe(false);
  });

  it.each([
    ["HOME mismatch", { TEST_ACCOUNT_HOME: "/another-home" }],
    ["root account", { TEST_ACCOUNT_UID: "0" }],
  ])("rejects %s before opening destination folders", (_label, overrides) => {
    const home = fixture();
    const result = runArchive(home, path.join(home, "plugin.zip"), "plugins", overrides);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("phase=identity failed");
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toEqual([]);
    expect(fs.existsSync(path.join(home, "ownership.jsonl"))).toBe(false);
  });

  it("rejects an unknown install kind before touching any destination", () => {
    const home = fixture();
    const result = runArchive(home, path.join(home, "plugin.zip"), "other");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("kind must be plugins or themes");
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toEqual([]);
    expect(fs.existsSync(path.join(home, "ownership.jsonl"))).toBe(false);
  });

  it.each([41, 97, 203])("rejects deterministic ZIP payload mutation seed=%i before any payload write", (seed) => {
    const home = fixture();
    const archive = path.join(home, "plugin.zip");
    const bytes = fs.readFileSync(archive);
    const payload = Buffer.from("verified payload");
    const offset = bytes.indexOf(payload);
    expect(offset).toBeGreaterThanOrEqual(0);
    bytes[offset + (seed % payload.length)] ^= 0x80;
    fs.writeFileSync(archive, bytes);
    const result = runArchive(home);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("phase=archive-validation failed");
    expect(result.stderr).toContain("member='Example/dist/index.js'");
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toEqual([]);
    expect(fs.existsSync(path.join(home, "ownership.jsonl"))).toBe(false);
  });

  it("reports ownership failures with phase, archive, and nonzero exit status", () => {
    const home = fixture();
    const result = runArchive(home, path.join(home, "plugin.zip"), "plugins", { TEST_CHOWN_FAIL: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("phase=write-and-verify failed: PermissionError: fixture chown denied");
    expect(result.stderr).toContain("archive=plugin.zip kind=plugins status=1");
    expect(result.stderr).toContain("member='Example/plugin.json'");
    expect(result.stdout).not.toContain("phase=verified");
  });

  it("fails verification when ownership does not change", () => {
    const home = fixture();
    const result = runArchive(home, path.join(home, "plugin.zip"), "plugins", { TEST_OWNER_VERIFY_FAIL: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("installed file content, ownership, or mode verification failed");
    expect(result.stdout).not.toContain("phase=verified");
  });

  it("propagates sudo denial and stops the bootstrap before themes", () => {
    const home = fixture();
    fs.writeFileSync(path.join(home, "bin/sudo"), "#!/bin/bash\necho 'fixture sudo denied' >&2\nexit 37\n", { mode: 0o755 });
    const result = install(home);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("status=37");
    expect(result.stderr).toContain("fixture sudo denied");
    expect(result.stdout).not.toContain("Downloading CSS Loader theme");
    expect(fs.readdirSync(path.join(home, "homebrew/plugins"))).toEqual([]);
  });
});
