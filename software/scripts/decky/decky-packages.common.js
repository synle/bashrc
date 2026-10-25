/** Normalize trusted Decky inventory entries and validate repository or pinned upstream ZIPs. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { LIMITS, readZip } = require("./decky-zip.common.js");

/** Checkout or extracted installer root used by local ZIP consumers. */
const REPO_ROOT = path.resolve(__dirname, "../../..");
/** Only this owner-approved asset folder accepts compact repository ZIP entries. */
const ASSET_FOLDER = "assets/steamos/decky_loader_plugins/";

/** Validate relative repository archive name (string); return it or throw before filesystem/network access. */
function repositoryArchivePath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith(ASSET_FOLDER) ||
    !/^[A-Za-z0-9_-]+_v[0-9.]+\.zip$/.test(value.slice(ASSET_FOLDER.length))
  )
    throw new Error("package path must name a versioned ZIP directly inside " + ASSET_FOLDER);
  return value;
}

/** Read bounded regular archive bytes beneath repoRoot (string); reject links, missing files, and oversized archives. */
function readRepositoryArchive(relative, repoRoot = REPO_ROOT) {
  const target = path.join(fs.realpathSync(repoRoot), repositoryArchivePath(relative));
  if (fs.realpathSync(target) !== target) throw new Error("repository package must not use symlinks");
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > LIMITS.download)
      throw new Error("repository package must be a regular, single-link ZIP between 1 byte and 256 MiB");
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/** Return bounded JSON object from ZIP members (Map) at name (string); throw on malformed or missing metadata. */
function metadata(members, name) {
  const member = members.get(name);
  if (!member || member.size > LIMITS.metadata) throw new Error("required JSON metadata missing or exceeds 1 MiB");
  try {
    const value = JSON.parse(member.read().toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON metadata must be an object");
    return value;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error("ZIP metadata must contain valid JSON", { cause: error });
  }
}

/** Validate payload (Buffer) against trusted pin (object); return void or throw before any protected writes. */
function validatePackage(payload, pin) {
  if (crypto.createHash("sha256").update(payload).digest("hex") !== pin.sha256)
    throw new Error("package SHA-256 does not match the pinned version");
  const members = readZip(payload);
  for (const [name, member] of members) {
    if (name.split("/")[0] !== pin.root) throw new Error("package root does not match the selected identity");
    member.read();
  }
  const theme = pin.path.startsWith("decky_css_loader/");
  const manifest = metadata(members, `${pin.root}/${theme ? "theme.json" : "plugin.json"}`);
  const version = theme ? manifest.version : metadata(members, `${pin.root}/package.json`).version;
  if (!theme && !members.get(`${pin.root}/dist/index.js`)?.size) throw new Error("plugin must contain a built dist/index.js");
  if (manifest.name !== pin.name || typeof version !== "string" || version.replace(/^v/, "") !== pin.version)
    throw new Error("package name/version does not match the selected identity");
  if (theme && manifest.id !== pin.theme_id) throw new Error("theme ID does not match the selected identity");
}

/** Resolve compact or rich selections (object[]) beneath repoRoot (string); return validated pins, rejecting duplicates and unsafe inputs. */
function resolvePackages(selections, repoRoot = REPO_ROOT) {
  if (!Array.isArray(selections)) throw new Error("decky_packages must be an array");
  const paths = new Set();
  const destinations = new Set();
  return selections.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("package entry must be an object");
    if (typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 256 || /[\x00-\x1f\x7f/\\]/.test(entry.name))
      throw new Error("package name must be a nonempty identity without separators or control characters");
    if (typeof entry.version !== "string" || entry.version.length > 32 || !/^[0-9]+(?:\.[0-9]+)*$/.test(entry.version))
      throw new Error("package version must be a numeric dotted version");
    let pin;
    if (entry.url !== undefined) {
      if (
        typeof entry.path !== "string" ||
        !/^(decky_plugin|decky_css_loader)\/[A-Za-z0-9_-]+_v[0-9.]+\.zip$/.test(entry.path) ||
        typeof entry.root !== "string" ||
        !entry.root ||
        entry.root.startsWith(".") ||
        /[\x00-\x1f\x7f/\\]/.test(entry.root) ||
        typeof entry.url !== "string" ||
        !entry.url.startsWith("https://") ||
        typeof entry.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        Object.hasOwn(entry, "local_path")
      )
        throw new Error("upstream package requires a safe bundle path, root, HTTPS url, and SHA-256");
      pin = { ...entry };
    } else {
      if (Object.keys(entry).some((key) => !["path", "name", "version"].includes(key)))
        throw new Error("repository package accepts only path, name, and version");
      const relative = repositoryArchivePath(entry.path);
      const payload = readRepositoryArchive(relative, repoRoot);
      const members = readZip(payload);
      const roots = new Set([...members.keys()].map((name) => name.split("/")[0]));
      const root = [...roots][0];
      if (roots.size !== 1 || root.startsWith(".")) throw new Error("package must contain one safe selected root");
      const plugin = members.has(`${root}/plugin.json`);
      const theme = members.has(`${root}/theme.json`);
      if (plugin === theme) throw new Error("package root must contain exactly one plugin.json or theme.json");
      const manifest = metadata(members, `${root}/${theme ? "theme.json" : "plugin.json"}`);
      if (theme && (typeof manifest.id !== "string" || !manifest.id)) throw new Error("theme ID must be a nonempty string");
      pin = {
        path: `${theme ? "decky_css_loader" : "decky_plugin"}/${path.basename(relative)}`,
        name: entry.name,
        version: entry.version,
        root,
        source: relative,
        local_path: relative,
        sha256: crypto.createHash("sha256").update(payload).digest("hex"),
        ...(theme ? { theme_id: manifest.id } : {}),
      };
      validatePackage(payload, pin);
    }
    const destination = `${pin.path.split("/")[0]}/${pin.root}`;
    if (paths.has(pin.path) || destinations.has(destination)) throw new Error("duplicate package path or installation root");
    paths.add(pin.path);
    destinations.add(destination);
    return pin;
  });
}

/** Validate inventory object and exact Loader pin; return normalized version (string) or throw before installation. */
function loaderVersion(inventory) {
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory) || !Array.isArray(inventory.decky_packages))
    throw new Error("inventory requires decky_loader_version and decky_packages");
  if (typeof inventory.decky_loader_version !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(inventory.decky_loader_version))
    throw new Error("decky_loader_version must be an exact stable version such as 3.3.0");
  return inventory.decky_loader_version;
}

module.exports = {
  REPO_ROOT,
  ASSET_FOLDER,
  repositoryArchivePath,
  readRepositoryArchive,
  metadata,
  validatePackage,
  resolvePackages,
  loaderVersion,
};
