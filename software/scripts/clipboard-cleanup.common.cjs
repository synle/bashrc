#!/usr/bin/env node
/** Independent clipboard retention: newest regular files by mtime, per type then overall. */
const fs = require("fs");
const path = require("path");

/** Deployment root for editor environments without shell exports. */
const DEPLOYED_ROOT = "__SY_CLIPBOARD_ROOT__";
/** Default per-type retention. */
const DEFAULT_PER_TYPE = 10;
/** Default combined retention. */
const DEFAULT_TOTAL = 20;
/** Upper bound for explicitly requested retention counts. */
const MAX_RETAINED = 100000;

/**
 * Remove expired managed clipboard files; leave unrelated files and symlinks alone.
 * @param {string} root Personal root, not the clipboard folder.
 * @param {number} perType Maximum files retained for each type.
 * @param {number} total Maximum combined files retained.
 * @returns {number} Number removed.
 * @throws {Error} On invalid roots, limits, unsafe folders, or filesystem errors.
 */
function cleanup(root, perType = DEFAULT_PER_TYPE, total = DEFAULT_TOTAL) {
  if (!root || !path.isAbsolute(root)) throw new Error("SY_ROOT_FOLDER must be an absolute non-empty folder");
  if (![perType, total].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= MAX_RETAINED))
    throw new Error("retention limits must be integers between 0 and 100000");
  const folder = path.join(root, ".syle_clipboard");
  const files = [];
  for (const [location, type] of [
    [folder, "image"],
    [path.join(folder, "plain"), "plain"],
  ]) {
    if (!fs.existsSync(location)) continue;
    if (fs.lstatSync(location).isSymbolicLink() || !fs.lstatSync(location).isDirectory())
      throw new Error("clipboard storage must be a real folder");
    for (const name of fs.readdirSync(location)) {
      if (type === "image" && !name.endsWith(".png")) continue;
      const file = path.join(location, name);
      const stat = fs.lstatSync(file);
      if (stat.isFile()) files.push({ file, type, stat, parent: fs.realpathSync(location) });
    }
  }
  files.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs || a.file.localeCompare(b.file));
  const counts = { plain: 0, image: 0 };
  let retained = 0;
  let removed = 0;
  for (const entry of files) {
    if (counts[entry.type] < perType && retained < total) {
      counts[entry.type]++;
      retained++;
      continue;
    }
    // Recheck identity and freshness before deleting; concurrent updates survive this pass.
    if (fs.realpathSync(path.dirname(entry.file)) !== entry.parent) throw new Error("clipboard folder changed during cleanup");
    const current = fs.lstatSync(entry.file);
    if (!current.isFile() || current.ino !== entry.stat.ino || current.mtimeMs !== entry.stat.mtimeMs) continue;
    fs.unlinkSync(entry.file);
    removed++;
  }
  return removed;
}

module.exports = { cleanup };
if (require.main === module) {
  if (process.argv.slice(2).some((arg) => ["--help", "-h", "help"].includes(arg))) {
    process.stdout.write(
      "syle_clipboard_cleanup: prune clipboard files by modified time\nUsage: syle_clipboard_cleanup [per-type=10] [total=20]\nCLIPBOARD_IMAGE_FOLDER overrides are not pruned.\n",
    );
  } else {
    try {
      if (process.argv.length > 4) throw new Error("expected at most two retention limits");
      const removed = cleanup(
        process.env.SY_ROOT_FOLDER || DEPLOYED_ROOT,
        process.argv[2] === undefined ? DEFAULT_PER_TYPE : Number(process.argv[2]),
        process.argv[3] === undefined ? DEFAULT_TOTAL : Number(process.argv[3]),
      );
      process.stdout.write(`Removed ${removed} clipboard files\n`);
    } catch (error) {
      process.stderr.write(`syle_clipboard_cleanup: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
