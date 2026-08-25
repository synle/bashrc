#!/usr/bin/env node
/**
 * Restores the XFCE config backup (.build/tar-xcfe-config.tar.gz) key-by-key.
 *
 * Instead of overwriting ~/.config/xfce4 wholesale, this compares every setting
 * in the backup against the live xfconf values on this machine and only applies
 * the keys that are missing or different (an upsert). Files outside xfconf
 * (panel launchers, desktop icons, helpers.rc) are copied file-by-file, only
 * when their content differs.
 *
 * Flow:
 *   1. list every differing key / file with its backup value vs live value
 *   2. if nothing differs, exit without prompting
 *   3. ask y/N confirmation (bypassed by --yes)
 *   4. snapshot the live config to a pre-restore tarball before writing anything
 *   5. apply the changes key-by-key
 *
 * Usage:
 *   node software/tools/restore-xfce-config.js            # diff + confirm
 *   node software/tools/restore-xfce-config.js --yes      # skip confirmation
 */

const readline = require("readline");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..", "..");
const TARBALL = path.join(REPO_ROOT, ".build", "tar-xcfe-config.tar.gz");
const YES = process.argv.includes("--yes");

/** @type {{kind: 'property', channel: string, propPath: string, leaf: object, live: string[] | null}[]} */
const propertyActions = [];
/** @type {{kind: 'file', src: string, dest: string}[]} */
const fileActions = [];
let skipped = 0;

/**
 * Runs a command, returning stdout or null when it fails (missing key, etc).
 * @param {string} cmd
 * @param {string[]} args
 * @returns {string | null}
 */
function tryRun(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    return null;
  }
}

/** Exits with a skip message when a precondition fails (always exit 0). */
function skip(message) {
  console.error(`restore-xfce: ${message} - skipping`);
  process.exit(0);
}

/** Guard: Ubuntu-family OS only (Ubuntu, Mint, other debian derivatives). */
function guardOs() {
  let id = "";
  let idLike = "";
  try {
    const release = fs.readFileSync("/etc/os-release", "utf8");
    id = (release.match(/^ID=(.*)$/m) || [""])[1] || "";
    idLike = (release.match(/^ID_LIKE=(.*)$/m) || [""])[1] || "";
  } catch (err) {
    // unreadable os-release -> treated as non-ubuntu below
  }
  if (!`${id} ${idLike}`.includes("ubuntu") && !`${id} ${idLike}`.includes("debian")) {
    skip(`not an Ubuntu-family OS (${id})`);
  }
}

/** Guard: an XFCE session must own the current display. */
function guardXfceSession() {
  const desktop = process.env.XDG_CURRENT_DESKTOP || "";
  if (desktop !== "XFCE" && !tryRun("pgrep", ["-x", "xfce4-session"])) {
    skip("no running XFCE session detected");
  }
}

/** Decodes the XML entities xfconf writes inside attribute and text values. */
function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Parses one xfconf channel XML into a flat map of propertyPath -> leaf.
 * Leaf shapes: { type, value } for scalars, { type: 'array', values } for arrays.
 * Containers (type="empty") are recursed into, never returned.
 *
 * @param {string} xmlText
 * @returns {Record<string, {type: string, value?: string, values?: string[]}>}
 */
function parseXfconfXml(xmlText) {
  const leaves = {};
  // each frame: { path, arrayValues } - arrayValues set only for array props
  const stack = [];
  const tokenRegex =
    /<property\b([^>]*?)(\/?)>|<\/property>|<value\b([^>]*?)\/>|<value\b[^>]*>([\s\S]*?)<\/value>/g;
  let match;
  while ((match = tokenRegex.exec(xmlText)) !== null) {
    const [fullTag, attrText, selfClosing, valueAttr, valueText] = match;
    if (fullTag === "</property>") {
      const frame = stack.pop();
      if (frame && frame.arrayValues) {
        leaves[frame.path] = { type: "array", values: frame.arrayValues };
      }
      continue;
    }
    if (valueAttr !== undefined || valueText !== undefined) {
      const top = stack[stack.length - 1];
      if (top && top.arrayValues) {
        // xfconf writes arrays as <value type="string" value="x"/> or text nodes
        const raw =
          valueAttr !== undefined
            ? (valueAttr.match(/value="([^"]*)"/) || ["", ""])[1]
            : valueText;
        top.arrayValues.push(decodeXmlEntities(raw));
      }
      continue;
    }
    const attrs = {};
    const attrRegex = /(name|type|value)="([^"]*)"/g;
    let attr;
    while ((attr = attrRegex.exec(attrText)) !== null) {
      attrs[attr[1]] = decodeXmlEntities(attr[2]);
    }
    const parentPath = stack.length ? stack[stack.length - 1].path : "";
    const propPath = parentPath ? `${parentPath}/${attrs.name}` : attrs.name;
    if (selfClosing === "/") {
      if (attrs.type && attrs.type !== "empty") {
        leaves[propPath] = { type: attrs.type, value: attrs.value };
      }
      continue;
    }
    // opening tag: arrays collect <value> children; empties just nest
    stack.push({
      path: propPath,
      arrayValues: attrs.type === "array" ? [] : null,
    });
  }
  return leaves;
}

/**
 * Reads the live value of one xfconf property; null when missing.
 * @param {string} channel
 * @param {string} propPath
 * @returns {string[] | null}
 */
function getLiveValue(channel, propPath) {
  const out = tryRun("xfconf-query", ["-c", channel, "-p", `/${propPath}`]);
  if (out === null) {
    return null;
  }
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    // array properties print a "Value is an array with N items:" banner first
    .filter((line) => !/^Value is an array with \d+ items:$/.test(line));
}

/** Normalizes a stored value for comparison (xfconf prints booleans uppercase). */
function normalizeValue(value) {
  if (/^(true|false)$/i.test(value)) {
    return value.toUpperCase();
  }
  return value.trim();
}

/** Compares two setting values, tolerating numeric formatting ("1" vs "1.000000"). */
function valuesEqual(a, b) {
  if (a === b) {
    return true;
  }
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isNaN(numA) || Number.isNaN(numB)) {
    return false;
  }
  // xfconf rounds stored floats ("165.001783" vs "165.00178304578182")
  return Math.abs(numA - numB) <= 1e-6 * Math.max(1, Math.abs(numA), Math.abs(numB));
}

/**
 * Plans one leaf property when its live value differs from the backup.
 * @param {string} channel
 * @param {string} propPath
 * @param {{type: string, value?: string, values?: string[]}} leaf
 */
function planProperty(channel, propPath, leaf) {
  const live = getLiveValue(channel, propPath);
  const wanted =
    leaf.type === "array"
      ? leaf.values.map(normalizeValue)
      : [normalizeValue(leaf.value)];
  const same =
    live !== null &&
    live.length === wanted.length &&
    live.every((v, i) => valuesEqual(normalizeValue(v), wanted[i]));
  if (!same) {
    propertyActions.push({ kind: "property", channel, propPath, leaf, live });
  } else {
    skipped++;
  }
}

/**
 * Plans one file copy when the destination is missing or has different content.
 * @param {string} src
 * @param {string} dest
 */
function planFile(src, dest) {
  const srcContent = fs.readFileSync(src);
  let destContent = null;
  try {
    destContent = fs.readFileSync(dest);
  } catch (err) {
    // missing destination -> needs create
  }
  if (destContent && Buffer.compare(srcContent, destContent) === 0) {
    skipped++;
    return;
  }
  fileActions.push({ kind: "file", src, dest });
}

/** Prints every planned change with its backup value vs live value. */
function printPlan() {
  for (const action of propertyActions) {
    const wanted =
      action.leaf.type === "array"
        ? action.leaf.values.map(normalizeValue)
        : [normalizeValue(action.leaf.value)];
    const current =
      action.live === null ? "(missing)" : JSON.stringify(action.live.map(normalizeValue));
    console.log(`  ${action.live === null ? "CREATE" : "UPDATE"} /${action.channel}/${action.propPath}`);
    console.log(`    backup: ${JSON.stringify(wanted)}`);
    console.log(`    live:   ${current}`);
  }
  for (const action of fileActions) {
    const srcContent = fs.readFileSync(action.src);
    let destNote = "(missing on live)";
    try {
      destNote = `${fs.statSync(action.dest).size} bytes`;
    } catch (err) {
      // missing destination
    }
    console.log(`  ${destNote.startsWith("(") ? "CREATE" : "UPDATE"} file ${action.dest}`);
    console.log(`    backup: ${srcContent.length} bytes`);
    console.log(`    live:   ${destNote}`);
  }
}

/**
 * Asks the user to confirm applying the plan; resolves false on anything but y.
 * @returns {Promise<boolean>}
 */
function confirmApply() {
  if (YES) {
    return Promise.resolve(true);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question("Apply these changes? [y/N] ", (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

/** Snapshots the live config so the restore itself can be undone. */
function snapshotLiveConfig() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const snapshotFile = path.join(REPO_ROOT, ".build", `tar-xcfe-config.pre-restore-${stamp}.tar.gz`);
  execFileSync("tar", ["-czf", snapshotFile, "-C", path.join(os.homedir(), ".config"), "xfce4"]);
  console.log(`restore-xfce: pre-restore snapshot written to ${snapshotFile}`);
  return snapshotFile;
}

/**
 * Executes one planned property change.
 * @param {{channel: string, propPath: string, leaf: object, live: string[] | null}} action
 */
function applyProperty(action) {
  const { channel, propPath, leaf, live } = action;
  if (live !== null) {
    // reset existing property so shape changes (scalar <-> array) work
    execFileSync("xfconf-query", ["-c", channel, "-p", `/${propPath}`, "-R", "-r"]);
  }
  const args = ["-c", channel, "-p", `/${propPath}`, "-n"];
  const values = leaf.type === "array" ? leaf.values : [leaf.value];
  for (const value of values) {
    args.push("-t", leaf.type, "-s", value);
  }
  execFileSync("xfconf-query", args);
}

/** Main entry: guards, extract, diff, confirm, snapshot, apply. */
async function main() {
  guardOs();
  guardXfceSession();
  if (!fs.existsSync(TARBALL)) {
    skip(`no backup at ${TARBALL} (run make backup_xcfe first)`);
  }
  if (!tryRun("xfconf-query", ["--version"])) {
    skip("xfconf-query not installed");
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "xfce-restore-"));
  try {
    execFileSync("tar", ["-xzf", TARBALL, "-C", staging]);
    const extractedRoot = path.join(staging, "xfce4");

    // 1. plan: xfconf channels, key-by-key.
    const xmlDir = path.join(extractedRoot, "xfconf", "xfce-perchannel-xml");
    for (const file of fs.readdirSync(xmlDir).sort()) {
      if (!file.endsWith(".xml")) {
        continue;
      }
      const channel = file.replace(/\.xml$/, "");
      const leaves = parseXfconfXml(fs.readFileSync(path.join(xmlDir, file), "utf8"));
      for (const propPath of Object.keys(leaves).sort()) {
        planProperty(channel, propPath, leaves[propPath]);
      }
    }

    // 2. plan: plain config files, copied only when content differs.
    /**
     * @param {string} dir
     * @param {string} relBase
     */
    function walkPlainFiles(dir, relBase) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name)
      )) {
        const src = path.join(dir, entry.name);
        const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (entry.name !== "xfconf") {
            walkPlainFiles(src, rel);
          }
          continue;
        }
        if (entry.name.startsWith("xfconf-")) {
          continue; // our flat dump artifacts, not real config
        }
        planFile(src, path.join(os.homedir(), ".config", "xfce4", rel));
      }
    }
    walkPlainFiles(extractedRoot, "");

    // 3. report; nothing to do -> no prompt.
    const total = propertyActions.length + fileActions.length;
    if (total === 0) {
      console.log(`restore-xfce: already in sync - ${skipped} keys/files match, nothing to do`);
      return;
    }

    console.log(
      `restore-xfce: comparing ${TARBALL} against live config - ${total} difference(s), ${skipped} already matching:\n`
    );
    printPlan();

    // 4. confirm.
    if (!(await confirmApply())) {
      console.log("restore-xfce: aborted - nothing written");
      return;
    }

    // 5. snapshot the live config first so this restore is reversible.
    snapshotLiveConfig();

    // 6. apply.
    for (const action of propertyActions) {
      applyProperty(action);
    }
    for (const action of fileActions) {
      fs.mkdirSync(path.dirname(action.dest), { recursive: true });
      fs.copyFileSync(action.src, action.dest);
    }
    console.log(`restore-xfce: applied ${total} change(s)`);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

main();
