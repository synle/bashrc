/** Linux-only, descriptor-anchored protected Decky writes; never recursively chowns or removes installed state. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { LIMITS, readZip } = require("./decky-zip.common.js");

/** Resolve numeric uid through the system account database; return {uid:number,gid:number,home:string,name:string}. */
function lookupAccount(uid) {
  if (!/^[0-9]+$/.test(String(uid))) throw new Error("invoking UID must be numeric");
  const fields = execFileSync("getent", ["passwd", String(uid)], { encoding: "utf8", timeout: 10000 })
    .trim()
    .split(":");
  if (fields.length !== 7 || Number(fields[2]) !== Number(uid)) throw new Error("invoking account not found");
  return { uid: Number(fields[2]), gid: Number(fields[3]), home: fields[5], name: fields[0] };
}

/**
 * Install archive (string) beneath verified home (string), kind ('plugins'|'themes'), uid and pinned SHA-256.
 * Returns void or throws phase/member diagnostics. Dependencies allow exercising the OS privilege boundary in tests.
 * Linux /proc/self/fd supplies descriptor-relative paths unavailable in Node's filesystem API; O_NOFOLLOW anchors
 * each child open, and every target is checked before truncation. Preserves extras, settings, and executable bits.
 */
function installArchive(
  archive,
  home,
  kind,
  uid,
  sha256,
  { filesystem = fs, accountLookup = lookupAccount, report = (message) => process.stderr.write(`>>> Decky ${message}\n`) } = {},
) {
  const io = filesystem;
  const folders = new Map();
  let phase = "identity";
  let member = "<none>";
  /** Return descriptor-relative child path (string); names have already passed ZIP validation. */
  const child = (fd, name) => `/proc/self/fd/${fd}/${name}`;
  /** Open an existing or newly-created child folder without following links; return owned descriptor (number). */
  function openFolder(parent, name, create = false) {
    const target = child(parent, name);
    if (create) {
      try {
        io.mkdirSync(target, { mode: 0o755 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    return io.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  }
  /** Set and verify descriptor ownership/mode; throw if the OS did not apply the requested state. */
  function permissions(fd, owner, mode) {
    io.fchownSync(fd, owner.uid, owner.gid);
    io.fchmodSync(fd, mode);
    const value = io.fstatSync(fd);
    if (value.uid !== owner.uid || value.gid !== owner.gid || (value.mode & 0o777) !== mode)
      throw new Error("installed ownership or mode verification failed");
  }
  try {
    const account = accountLookup(uid);
    if (account.uid === 0 || io.realpathSync(home) !== io.realpathSync(account.home))
      throw new Error("HOME must match a non-root invoking account");
    if (!["plugins", "themes"].includes(kind)) throw new Error("kind must be plugins or themes");
    phase = "archive-validation";
    if (io.statSync(archive).size > LIMITS.download) throw new Error("archive exceeds download limit");
    const payload = io.readFileSync(archive);
    if (crypto.createHash("sha256").update(payload).digest("hex") !== sha256)
      throw new Error("archive SHA-256 does not match the pinned version");
    const members = readZip(payload);
    const roots = new Set([...members.keys()].map((name) => name.split("/")[0]));
    const root = [...roots][0];
    if (roots.size !== 1 || root.startsWith(".")) throw new Error("archive must have exactly one safe top-level folder");
    const manifestName = `${root}/${kind === "plugins" ? "plugin.json" : "theme.json"}`;
    const manifestEntry = members.get(manifestName);
    if (!manifestEntry || manifestEntry.size > LIMITS.metadata) throw new Error("archive is missing bounded required metadata");
    member = manifestName;
    const manifest = JSON.parse(manifestEntry.read().toString("utf8"));
    if (
      !manifest ||
      typeof manifest !== "object" ||
      Array.isArray(manifest) ||
      (manifest.flags !== undefined && !Array.isArray(manifest.flags))
    )
      throw new Error("manifest must be an object with an optional flags array");
    const rootPlugin = kind === "plugins" && (manifest.flags ?? []).includes("root");
    const contentOwner = rootPlugin ? { uid: 0, gid: 0 } : account;
    // Finish all decompression/CRC checks before any destination or ownership changes.
    for (const [name, entry] of members) {
      member = name;
      entry.read();
    }
    report(
      `archive=${path.basename(archive)} target=${kind}/${root} root_plugin=${rootPlugin} content_uid=${contentOwner.uid} content_gid=${contentOwner.gid}`,
    );
    phase = "destination-preflight";
    const homeFd = io.openSync(home, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    let homebrew;
    try {
      homebrew = openFolder(homeFd, "homebrew");
    } finally {
      io.closeSync(homeFd);
    }
    try {
      folders.set("", openFolder(homebrew, kind, kind === "themes"));
    } finally {
      io.closeSync(homebrew);
    }
    const names = new Set([root]);
    for (const name of members.keys()) {
      const parts = name.replace(/\/$/, "").split("/");
      for (let index = 1; index < parts.length; index++) names.add(parts.slice(0, index).join("/"));
      if (name.endsWith("/")) names.add(name.slice(0, -1));
    }
    for (const name of [...names].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))) {
      member = name;
      const parent = path.posix.dirname(name);
      folders.set(name, openFolder(folders.get(parent === "." ? "" : parent), path.posix.basename(name), true));
    }
    for (const name of members.keys()) {
      if (name.endsWith("/")) continue;
      member = name;
      const target = child(folders.get(path.posix.dirname(name)), path.posix.basename(name));
      try {
        const value = io.lstatSync(target);
        if (!value.isFile() || value.nlink !== 1) throw new Error("destination contains a symlink, hardlink, or special file");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    phase = "write-and-verify";
    for (const [name, entry] of members) {
      if (name.endsWith("/")) continue;
      member = name;
      const target = child(folders.get(path.posix.dirname(name)), path.posix.basename(name));
      const fd = io.openSync(target, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600);
      try {
        const value = io.fstatSync(fd);
        if (!value.isFile() || value.nlink !== 1) throw new Error("destination changed to a hardlink or special file");
        const owner = kind === "plugins" && name === manifestName ? { uid: 0, gid: 0 } : contentOwner;
        const mode = (entry.mode | value.mode) & 0o111 || (kind === "plugins" && name === manifestName) ? 0o755 : 0o644;
        const data = entry.read();
        io.ftruncateSync(fd, 0);
        io.writeFileSync(fd, data);
        permissions(fd, owner, mode);
        const readback = Buffer.alloc(data.length);
        let read = 0;
        while (read < data.length) {
          const size = io.readSync(fd, readback, read, data.length - read, read);
          if (size === 0) break;
          read += size;
        }
        if (read !== data.length || !readback.equals(data) || io.fstatSync(fd).size !== data.length)
          throw new Error("installed file content verification failed");
      } finally {
        io.closeSync(fd);
      }
    }
    phase = "folder-permissions";
    for (const [name, fd] of folders) {
      member = name;
      if (!name && kind === "plugins") continue;
      const owner = kind === "plugins" && name === root ? { uid: 0, gid: 0 } : contentOwner;
      permissions(fd, owner, 0o755);
    }
    report(`phase=verified target=${kind}/${root} ownership=verified mode=verified`);
  } catch (error) {
    throw new Error(`phase=${phase} failed: ${error.message}; member=${JSON.stringify(member)}`, { cause: error });
  } finally {
    for (const fd of folders.values()) io.closeSync(fd);
  }
}

module.exports = { installArchive };
if (require.main === module) {
  try {
    if (process.platform !== "linux") throw new Error("protected Decky writes require Linux /proc/self/fd");
    installArchive(...process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`>>> Decky ${error.message}\n`);
    process.exitCode = 1;
  }
}
