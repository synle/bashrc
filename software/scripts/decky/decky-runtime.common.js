/** Node.js Decky bundle builder, cache staging, and opt-in installation orchestration. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { LIMITS, readZip, writeZip } = require("./decky-zip.common.js");
const {
  REPO_ROOT,
  repositoryArchivePath,
  readRepositoryArchive,
  metadata,
  validatePackage,
  resolvePackages,
  loaderVersion,
} = require("./decky-packages.common.js");
/** Canonical selected Loader version and compact/rich package entries. */
const inventory = require("../../metadata/decky-packages.json");

/** Rolling release cache; package trust comes from the local pins, not remote metadata. */
const CACHE_URL = "https://github.com/synle/bashrc/releases/download/binary-cache/steamos-decky__bundle.zip";
/** Upstream Loader bootstrap, adapted only at its verified release selector to honor the exact inventory pin. */
const LOADER_URL = "https://github.com/SteamDeckHomebrew/decky-installer/releases/latest/download/install_release.sh";
/** GitHub tagged-release endpoint; never use a floating latest release for an explicit Loader pin. */
const LOADER_RELEASE_URL = "https://api.github.com/repos/SteamDeckHomebrew/decky-loader/releases/tags/v";
/** Verified upstream selector; drift rejects installation rather than silently installing an unselected release. */
const LOADER_SELECTOR =
  'RELEASE=$(curl -s \'https://api.github.com/repos/SteamDeckHomebrew/decky-loader/releases\' | jq -r "first(.[] | select(.prerelease == "false"))")';
/** Bound simultaneous artifact downloads without an additional runtime dependency. */
const DOWNLOAD_BATCH_SIZE = 3;

/** Download HTTPS URL (string) into destination (string); resolve void or reject on bounded curl failure. */
function download(url, destination) {
  if (!url.startsWith("https://")) return Promise.reject(new Error("download URL must use HTTPS"));
  return new Promise((resolve, reject) => {
    const child = spawn(
      "curl",
      [
        "-fsSL",
        "--connect-timeout",
        "15",
        "--max-time",
        "90",
        "--max-filesize",
        String(LIMITS.download),
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        url,
        "-o",
        destination,
      ],
      { stdio: ["ignore", "ignore", "inherit"], timeout: 100000, killSignal: "SIGKILL" },
    );
    child.on("error", reject);
    child.on("close", (status) => {
      if (status !== 0) return reject(new Error(`download failed status=${status}`));
      try {
        const size = fs.statSync(destination).size;
        if (size < 1 || size > LIMITS.download) throw new Error("download size must be between 1 and 256 MiB");
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/** Return validated cache payloads (Map) matching pins exactly; reject unsafe bundles, recover bad packages individually. */
function cachedPackages(payload, pins, report) {
  const members = readZip(payload);
  const allowed = new Set(["metadata.json", "decky_plugin/", "decky_css_loader/", ...pins.map((pin) => pin.path)]);
  for (const name of members.keys()) if (!allowed.has(name)) throw new Error("bundle contains an unselected member");
  const info = metadata(members, "metadata.json");
  if (info.schema_version !== 1 || !Array.isArray(info.packages))
    throw new Error("bundle metadata requires schema_version=1 and packages array");
  const records = new Map();
  for (const record of info.packages) {
    if (!record || typeof record !== "object" || typeof record.path !== "string" || records.has(record.path))
      throw new Error("bundle metadata requires unique package paths");
    records.set(record.path, record);
  }
  const accepted = new Map();
  for (const pin of pins) {
    const record = records.get(pin.path);
    if (
      !record ||
      Object.keys(record).length !== Object.keys(pin).length ||
      Object.keys(pin).some((key) => record[key] !== pin[key]) ||
      !members.has(pin.path)
    )
      continue;
    try {
      const bytes = members.get(pin.path).read();
      validatePackage(bytes, pin);
      accepted.set(pin.path, bytes);
    } catch (error) {
      report(`cache rejected package=${path.basename(pin.path)}: ${error.message}`);
    }
  }
  return accepted;
}

/** Return deterministic UTF-8 metadata bytes (Buffer) for trusted pins (object[]); no side effects. */
function metadataBytes(pins) {
  return Buffer.from(JSON.stringify({ schema_version: 1, packages: pins }, null, 2) + "\n");
}

/**
 * Stage selections into a new private folder (string); return resolved pins or reject on validation/IO errors.
 * Options supply compact/rich pins, repository root/raw URL, cache URL, downloader, and diagnostic reporter.
 * Cache is attempted first; missing packages download in batches of 3. Wait for all in-flight work before failure.
 * Only the caller-owned staging folder is written; callers must remove it after failures or consumption.
 */
async function stage(
  folder,
  {
    pins: selections = inventory.decky_packages,
    repoRoot = REPO_ROOT,
    repositoryUrl = null,
    cacheUrl = CACHE_URL,
    downloader = download,
    report = (message) => process.stderr.write(`>>> Decky ${message}\n`),
  } = {},
) {
  if (!Array.isArray(selections)) throw new Error("decky_packages must be an array");
  fs.mkdirSync(folder, { mode: 0o700 });
  if (repositoryUrl !== null) {
    if (typeof repositoryUrl !== "string" || !repositoryUrl.startsWith("https://")) throw new Error("repository URL must use HTTPS");
    repoRoot = path.join(folder, "repository");
    fs.mkdirSync(repoRoot);
    const local = selections.filter((entry) => entry && entry.url === undefined);
    for (let start = 0; start < local.length; start += DOWNLOAD_BATCH_SIZE) {
      const results = await Promise.allSettled(
        local.slice(start, start + DOWNLOAD_BATCH_SIZE).map(async (entry) => {
          const relative = repositoryArchivePath(entry.path);
          const target = path.join(repoRoot, relative);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          await downloader(repositoryUrl.replace(/\?raw=1$/, "") + relative, target);
          return target;
        }),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
    }
  }
  const pins = resolvePackages(selections, repoRoot);
  fs.mkdirSync(path.join(folder, "decky_plugin"));
  fs.mkdirSync(path.join(folder, "decky_css_loader"));
  let accepted = new Map();
  const cache = path.join(folder, "cache.zip");
  if (cacheUrl !== null) {
    report("phase=cache-download");
    try {
      await downloader(cacheUrl, cache);
      accepted = cachedPackages(fs.readFileSync(cache), pins, report);
    } catch (error) {
      report(`cache unavailable or invalid: ${error.message}; trying upstream`);
    }
  }
  const missing = pins.filter((pin) => !accepted.has(pin.path));
  for (let start = 0; start < missing.length; start += DOWNLOAD_BATCH_SIZE) {
    const results = await Promise.allSettled(
      missing.slice(start, start + DOWNLOAD_BATCH_SIZE).map(async (pin) => {
        report(`phase=${pin.local_path ? "repository-read" : "upstream-download"} package=${path.basename(pin.path)}`);
        const temporary = path.join(folder, path.basename(pin.path) + ".download");
        if (!pin.local_path) await downloader(pin.url, temporary);
        const payload = pin.local_path ? readRepositoryArchive(pin.local_path, repoRoot) : fs.readFileSync(temporary);
        validatePackage(payload, pin);
        accepted.set(pin.path, payload);
        if (!pin.local_path) fs.unlinkSync(temporary);
        return pin.path;
      }),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }
  for (const pin of pins) {
    fs.writeFileSync(path.join(folder, pin.path), accepted.get(pin.path), { flag: "wx", mode: 0o600 });
    report(`phase=staged package=${path.basename(pin.path)}`);
  }
  fs.writeFileSync(path.join(folder, "metadata.json"), metadataBytes(pins), { flag: "wx", mode: 0o600 });
  if (fs.existsSync(cache)) fs.unlinkSync(cache);
  return pins;
}

/** Build deterministic repository/upstream bundle at output (string); reject without replacing previous output on failure. */
async function build(output, options = {}) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const work = fs.mkdtempSync(path.join(path.dirname(output), ".decky-build-"));
  try {
    const folder = path.join(work, "packages");
    const pins = await stage(folder, { ...options, cacheUrl: null });
    const entries = new Map([
      ["metadata.json", metadataBytes(pins)],
      ...pins.map((pin) => [pin.path, fs.readFileSync(path.join(folder, pin.path))]),
    ]);
    const payload = writeZip(entries);
    const accepted = cachedPackages(payload, pins, () => {});
    if (accepted.size !== pins.length) throw new Error("built bundle failed complete validation");
    const temporary = path.join(work, "bundle.zip");
    fs.writeFileSync(temporary, payload, { flag: "wx" });
    fs.renameSync(temporary, output);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** Execute a named program with args (string[]), inheriting diagnostics; throw on nonzero status or spawn failure. */
function command(program, args, options = {}) {
  const result = spawnSync(program, args, { stdio: ["ignore", "inherit", "inherit"], timeout: 300000, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(program)} failed status=${result.status}`);
}

/**
 * Install Decky and validated packages for the invoking desktop user; resolve void or reject on failure.
 * Requires Linux, matching non-root HOME, curl, sudo, Node, and jq only when Loader bootstrap is needed.
 * Enforces the configured Loader version, reapplies all packages, restarts the service, and verifies it is active.
 * Downloads stay unprivileged; only upstream bootstrap and descriptor-anchored archive writes use sudo.
 * @param {object} options - Trusted staging options, including optional package pins and downloader.
 * @returns {Promise<void>} Resolves after verification; rejects on version lookup, bootstrap, or package failures.
 */
async function install(options = {}) {
  if (process.platform !== "linux") throw new Error("Decky requires a Linux desktop");
  const account = os.userInfo();
  const home = process.env.HOME;
  if (account.uid === 0 || !home || fs.realpathSync(home) !== fs.realpathSync(account.homedir))
    throw new Error("HOME must match a non-root invoking account");
  const selectedVersion = loaderVersion(options.inventory ?? inventory);
  const desktop = path.join(home, "Desktop");
  fs.mkdirSync(desktop, { recursive: true });
  const logFolder = fs.mkdtempSync(path.join(desktop, "decky-install-"));
  const logFile = path.join(logFolder, "install.log");
  const log = fs.openSync(logFile, "wx", 0o600);
  /** Persist phase diagnostics and display them; downloaded code is never executed by staging. */
  function report(message) {
    fs.writeSync(log, `${message}\n`);
    process.stderr.write(`${message}\n`);
  }
  report(`>>> Decky private log: ${logFile}`);
  const commandOptions = { stdio: ["ignore", log, log] };
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "decky-install-"));
  try {
    const folder = path.join(work, "packages");
    const pins = await stage(folder, { ...options, pins: options.pins ?? (options.inventory ?? inventory).decky_packages, report });
    report(">>> Decky phase=loader-version-check");
    const releaseFile = path.join(work, "loader-release.json");
    await download(LOADER_RELEASE_URL + selectedVersion, releaseFile);
    if (fs.statSync(releaseFile).size > LIMITS.metadata) throw new Error("Loader release metadata exceeds 1 MiB");
    const release = JSON.parse(fs.readFileSync(releaseFile, "utf8"));
    if (
      !release ||
      typeof release !== "object" ||
      Array.isArray(release) ||
      typeof release.tag_name !== "string" ||
      !/^v?[0-9]+\.[0-9]+\.[0-9]+$/.test(release.tag_name) ||
      release.prerelease !== false ||
      release.draft !== false
    )
      throw new Error("Loader stable release metadata requires a stable tag_name, prerelease=false, and draft=false");
    if (release.tag_name.replace(/^v/, "") !== selectedVersion) throw new Error("Loader release does not match decky_loader_version");
    const service = path.join(home, "homebrew/services/PluginLoader");
    const versionFile = path.join(home, "homebrew/services/.loader.version");
    let installedVersion = "";
    try {
      fs.accessSync(service, fs.constants.X_OK);
      if (fs.statSync(path.join(home, "homebrew/plugins")).isDirectory()) {
        const version = fs.readFileSync(versionFile, "utf8").trim().replace(/^v/, "");
        if (/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) installedVersion = version;
      }
    } catch (error) {
      if (!["ENOENT", "EACCES"].includes(error.code)) throw error;
      report(`>>> Decky Loader version unavailable code=${error.code}; selected version installation required`);
    }
    report(`>>> Decky phase=loader-version installed=${installedVersion || "unknown"} selected=${selectedVersion}`);
    if (installedVersion !== selectedVersion) {
      command("jq", ["--version"], commandOptions);
      const bootstrap = path.join(work, "install_release.sh");
      await download(LOADER_URL, bootstrap);
      const script = fs.readFileSync(bootstrap, "utf8");
      if (script.split("\n").filter((line) => line.startsWith("RELEASE=")).length !== 1 || !script.split("\n").includes(LOADER_SELECTOR))
        throw new Error("Loader bootstrap release selector changed; refusing an unpinned installation");
      fs.writeFileSync(bootstrap, script.replace(LOADER_SELECTOR, 'RELEASE=$(command cat -- "$1")'));
      command("sudo", ["bash", bootstrap, releaseFile], commandOptions);
      fs.accessSync(service, fs.constants.X_OK);
      if (!fs.statSync(path.join(home, "homebrew/plugins")).isDirectory())
        throw new Error("Decky Loader installation did not create its plugin folder");
      if (fs.readFileSync(versionFile, "utf8").trim().replace(/^v/, "") !== selectedVersion)
        throw new Error("Decky Loader installed version does not match decky_loader_version");
      report(`>>> Decky phase=loader-updated version=${selectedVersion}`);
    } else {
      report(`>>> Decky phase=loader-current version=${selectedVersion}; skipping Loader reinstall`);
    }
    for (const pin of pins) {
      const archive = path.join(folder, pin.path);
      const kind = pin.path.startsWith("decky_plugin/") ? "plugins" : "themes";
      report(`>>> Decky phase=install archive=${path.basename(archive)} kind=${kind} privilege=sudo`);
      command(
        "sudo",
        [process.execPath, path.join(__dirname, "decky-install.common.js"), archive, home, kind, String(account.uid), pin.sha256],
        commandOptions,
      );
    }
    report(">>> Decky phase=service-restart");
    command("sudo", ["systemctl", "restart", "plugin_loader.service"], commandOptions);
    command("sudo", ["systemctl", "is-active", "--quiet", "plugin_loader.service"], commandOptions);
    report(">>> Decky phase=service-active");
    report(">>> Decky phase=complete");
  } catch (error) {
    report(`>>> Decky phase=failed ${error.message}`);
    throw error;
  } finally {
    fs.closeSync(log);
    fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = { CACHE_URL, DOWNLOAD_BATCH_SIZE, download, validatePackage, stage, build, install };
