/** Shared worktree rows for inventory output and interactive cleanup confirmations. */
const { spawnSync } = require("child_process");

/** @type {number} Maximum duration of one optional native disk-usage probe. */
const SIZE_TIMEOUT_MS = 2000;
/** @type {number} Output limit for the optional disk-usage probe. */
const SIZE_OUTPUT_LIMIT = 64 * 1024;
/** @type {number} Bytes in the KiB units emitted by du -k. */
const KIB_BYTES = 1024;
/** @type {number} Decimal storage-unit divisor, matching MB/GB labels. */
const UNIT_BASE = 1000;
/** @type {string[]} Human-readable decimal storage units. */
const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"];

/**
 * Escape terminal controls without changing the underlying branch or path value.
 * @param {string} value Display text.
 * @returns {string} Single-line terminal-safe text.
 */
function display(value) {
  return value.replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
}

/**
 * Measure allocated disk usage without following symlinks or reading file contents.
 * @param {string} folder Absolute registered worktree path.
 * @returns {string} Decimal storage label, or unknown when the optional probe cannot finish reliably.
 * @sideEffects Runs native du with ignored stdin and a two-second deadline; never mutates files.
 */
function storageSize(folder) {
  const result = spawnSync("du", ["-skP", folder], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: SIZE_TIMEOUT_MS,
    maxBuffer: SIZE_OUTPUT_LIMIT,
  });
  if (result.error || result.status !== 0) return "unknown";
  const match = result.stdout.match(/^\s*(\d+)(?:\s|$)/);
  if (!match) return "unknown";
  const kib = Number(match[1]);
  if (!Number.isSafeInteger(kib) || kib > Math.floor(Number.MAX_SAFE_INTEGER / KIB_BYTES)) return "unknown";

  let amount = kib * KIB_BYTES;
  let unit = 0;
  while (amount >= UNIT_BASE && unit < SIZE_UNITS.length - 1) {
    amount /= UNIT_BASE;
    unit += 1;
  }
  return amount.toFixed(1).replace(/\.0$/, "") + SIZE_UNITS[unit];
}

/**
 * Render one consistent worktree row for inventories, cleanup statuses, and confirmations.
 * @param {{path: string, branch: string|null, bare?: boolean}} worktree Registered path and display branch name, not a raw Git ref.
 * @param {{prefix?: string, size?: string, reason?: string}} [details] Trusted prefix, optional pre-deletion size, and untrusted reason text.
 * @returns {string} Prefix, bracketed storage size, branch, path, and optional reason on one line.
 * @sideEffects Probes disk usage only when size is omitted; unavailable sizes remain visible as unknown.
 */
function worktreeInfo(worktree, { prefix = "🌳", size = storageSize(worktree.path), reason } = {}) {
  const branch = worktree.bare ? "(bare)" : (worktree.branch ?? "(detached)");
  const row = prefix + " [" + display(size) + "]  " + display(branch) + "  " + display(worktree.path);
  return reason === undefined ? row : row + "  " + display(reason);
}

module.exports = { display, storageSize, worktreeInfo };
