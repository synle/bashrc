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
  .split("# Install SteamTinkerLaunch using its upstream Steam Deck layout when missing.", 2)[1]
  .split("\nif ! _install_steamtinkerlaunch;", 1)[0];
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

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("SteamOS setup", () => {
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
