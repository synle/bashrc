/**
 * build-installer.js - Builds a self-extracting single-file installer for synle/bashrc.
 *
 * Output: .build/install-bashrc.sh
 *
 * The installer is a bash script with a base64-encoded gzipped tarball appended
 * after a sentinel line. At runtime it:
 *
 *   1. Extracts the tarball to a temp dir ($BASHRC_INSTALLER_DIR, defaults to /tmp/...).
 *   2. cd's into the extracted repo.
 *   3. exec's `bash run.sh "$@"` so callers can pass any run.sh flag through.
 *
 * Because the extracted directory contains software/index.js, run.sh auto-detects
 * IS_LOCAL_REPO=1 and serves every script from disk — no GitHub raw fetches, no
 * rate-limit hits, fully offline-capable after the initial download.
 *
 * Usage:
 *   make build_installer
 *   node software/tools/build-installer.js
 *
 * CI publishes the output to the binary-cache rolling release on synle/bashrc as
 * `bashrc-installer__install-bashrc.sh` (same `<app>__<file>` namespace as the
 * per-OS profile mirrors), so end-users can:
 *
 *   curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh | bash
 */
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

/** Repo root resolved relative to this file's location. */
const REPO_ROOT = path.resolve(__dirname, "..", "..");
/** Output directory (.build/ is gitignored except for tracked profile artifacts). */
const OUTPUT_DIR = path.join(REPO_ROOT, ".build");
/** Final installer path. */
const OUTPUT_PATH = path.join(OUTPUT_DIR, "install-bashrc.sh");

/**
 * Files and folders bundled into the installer payload, relative to REPO_ROOT.
 * Keep minimal: only what run.sh + index.js + the script runner actually read at
 * install time. assets/ is excluded — fonts.js fetches font binaries via
 * getGitHubRawUrl at runtime, never from local disk.
 */
const FILES_TO_BUNDLE = [
  "run.sh",
  "software/index.js",
  "software/common.js",
  "software/bootstrap",
  "software/scripts",
  "software/metadata",
];

/**
 * Tar --exclude patterns. Strip test fixtures, snapshots, OS junk, and any
 * generated build output that might be lying around when developers run
 * `make build_installer` locally.
 */
const TAR_EXCLUDES = ["*.spec.js", "__snapshots__", ".DS_Store", "node_modules"];

/**
 * Sentinel that separates the bash header from the base64 payload. Must appear
 * on its own line exactly once (the awk extractor matches it with `^...$`).
 */
const PAYLOAD_MARKER = "__BASHRC_INSTALLER_PAYLOAD_BELOW__";

/**
 * Resolve the current short git SHA for the build banner. Returns "unknown"
 * when git is unavailable or the directory isn't a repo (shouldn't happen in
 * CI, but the fallback keeps `node build-installer.js` from crashing in
 * weird tarball-of-the-repo scenarios).
 *
 * @returns {string} 7-char git SHA, or "unknown".
 */
function getGitSha() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Build the gzipped tarball payload by shelling out to `tar`. Returns the
 * raw compressed bytes — caller is responsible for base64-encoding before
 * writing to disk.
 *
 * @returns {Buffer} gzipped tarball bytes.
 * @throws {Error} when tar exits non-zero or isn't on PATH.
 */
function buildTarball() {
  const args = ["-czf", "-", "-C", REPO_ROOT, ...TAR_EXCLUDES.flatMap((pattern) => ["--exclude", pattern]), ...FILES_TO_BUNDLE];
  const res = spawnSync("tar", args, {
    maxBuffer: 256 * 1024 * 1024,
    encoding: "buffer",
  });
  if (res.error) {
    throw new Error(`tar invocation failed: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`tar exited with status ${res.status}: ${res.stderr.toString()}`);
  }
  return res.stdout;
}

/**
 * Count the number of regular file entries inside a gzipped tarball by listing
 * it through `tar -tzf -`. Used only for the build banner — non-fatal on error.
 *
 * @param {Buffer} tarball - gzipped tar bytes.
 * @returns {number} entry count, or 0 when tar listing fails.
 */
function countTarballEntries(tarball) {
  const res = spawnSync("tar", ["-tzf", "-"], {
    input: tarball,
    encoding: "utf8",
  });
  if (res.status !== 0) return 0;
  return res.stdout.split("\n").filter((line) => line && !line.endsWith("/")).length;
}

/** Canonical URL for the installer asset published to the binary-cache rolling release. */
const INSTALLER_URL = "https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh";

/**
 * Compute a deterministic version string for the installer banner. Format:
 *
 *     v0.YYYYMMDD.HHMM.<short_sha>     e.g. v0.20260514.0930.eebf417
 *
 * The same string is used by the GitHub Actions `test` job to tag the
 * successful build commit, so the bundled installer banner and the git tag
 * are byte-identical. CI sets BASHRC_INSTALLER_VERSION explicitly (computed
 * once in the prep job and passed via env) so all consumers — installer
 * banner, git tag, future release artifacts — share the exact same value.
 * Local builds (`make build_installer`) fall back to computing it from git
 * + the current UTC clock.
 *
 * @returns {string} version string, never empty.
 */
function getVersionString() {
  if (process.env.BASHRC_INSTALLER_VERSION) {
    return process.env.BASHRC_INSTALLER_VERSION;
  }
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const min = String(now.getUTCMinutes()).padStart(2, "0");
  return `v0.${yyyy}${mm}${dd}.${hh}${min}.${getGitSha()}`;
}

/**
 * Render the bash header that prefixes the base64 payload. The header is
 * standalone-runnable up to the `exec bash run.sh` line; everything after the
 * PAYLOAD_MARKER is data, never executed.
 *
 * The header supports two invocation modes:
 *   1. Local file:   `bash install-bashrc.sh [flags]` — extracts the payload
 *      from $0 and execs run.sh.
 *   2. curl | bash:  `curl -fsSL <url> | bash -s -- [flags]` — $0 is "bash"
 *      and contains no payload, so the header re-downloads the installer to a
 *      tmp file and re-execs itself.
 *
 * @param {{version: string, sha: string, fileCount: number, payloadBytes: number}} info - build metadata for the banner.
 * @returns {string} bash header text, including the trailing payload marker line.
 */
function buildHeader({ version, sha, fileCount, payloadBytes }) {
  const timestamp = new Date().toISOString();
  const kb = (payloadBytes / 1024).toFixed(1);
  return `#!/usr/bin/env bash
#
# install-bashrc.sh - self-extracting installer for synle/bashrc
#
# Generated by software/tools/build-installer.js
# Version: ${version}
# Build:   ${sha}   ${timestamp}
# Payload: ${payloadBytes} bytes (${kb} KB), ${fileCount} files
#
# Usage (both forms support every run.sh flag — --setup, --files=, --preset=, --dryrun, --debug, ...):
#
#   # Stream from GitHub, no download needed:
#   curl -fsSL ${INSTALLER_URL} | bash
#   curl -fsSL ${INSTALLER_URL} | bash -s -- --setup --force
#   curl -fsSL ${INSTALLER_URL} | bash -s -- --files=git.js
#   curl -fsSL ${INSTALLER_URL} | bash -s -- --preset=lightweight --dryrun
#
#   # Or save once and re-run:
#   curl -fsSLO ${INSTALLER_URL}
#   bash bashrc-installer__install-bashrc.sh --setup
#
#   # Environment overrides:
#   BASHRC_INSTALLER_DIR=/path/to/extract bash ...   # custom extraction dir
#   BASHRC_INSTALLER_KEEP=1            bash ...     # keep extracted dir after exit
#
set -e

# Build identity — embedded at bundle time by software/tools/build-installer.js.
# Matches the git tag created by .github/workflows/build-main.yml's "Tag
# successful build" step, so a user can map any installer back to the exact
# commit + workflow run that produced it.
BASHRC_INSTALLER_BUILD_VERSION="${version}"
BASHRC_INSTALLER_BUILD_SHA="${sha}"
BASHRC_INSTALLER_BUILD_TIME="${timestamp}"

# Canonical download URL — used to bootstrap when this script is piped from
# stdin (curl | bash) and \$0 is "bash" instead of a real file path. Override
# BASHRC_INSTALLER_URL in the env (e.g. file:///path for offline testing).
BASHRC_INSTALLER_URL="\${BASHRC_INSTALLER_URL:-${INSTALLER_URL}}"

# Self-bootstrap: when this script is being read from stdin (curl | bash),
# \$0 is "bash" — not a file, and definitely doesn't contain our payload
# marker. In that case, re-download the installer to a real file and exec it
# so the awk-based payload extraction below can read \$0 as a file. The
# version echo below this block runs in the RE-EXEC'd process, so curl|bash
# users see it once (not twice).
if [ ! -f "\$0" ] || ! command grep -qF '${PAYLOAD_MARKER}' "\$0" 2> /dev/null; then
  __bashrc_tmp_installer="\$(mktemp -t bashrc-installer-XXXXXX.sh 2> /dev/null || mktemp /tmp/bashrc-installer-XXXXXX.sh)"
  if command -v curl > /dev/null 2>&1; then
    curl -fsSL "\$BASHRC_INSTALLER_URL" -o "\$__bashrc_tmp_installer"
  elif command -v wget > /dev/null 2>&1; then
    wget -qO "\$__bashrc_tmp_installer" "\$BASHRC_INSTALLER_URL"
  else
    echo "ERROR: install-bashrc.sh needs 'curl' or 'wget' to bootstrap from stdin" >&2
    rm -f "\$__bashrc_tmp_installer"
    exit 1
  fi
  exec bash "\$__bashrc_tmp_installer" "\$@"
fi

# Identify the running installer to the user before we touch the filesystem.
# Emitted to stderr so it never pollutes a stdout pipe consumer. Suppress with
# BASHRC_INSTALLER_QUIET=1 for scripted use cases that want clean output.
if [ -z "\${BASHRC_INSTALLER_QUIET:-}" ]; then
  echo ">> install-bashrc.sh \$BASHRC_INSTALLER_BUILD_VERSION (built \$BASHRC_INSTALLER_BUILD_TIME, sha \$BASHRC_INSTALLER_BUILD_SHA)" >&2
fi

# Where to extract the bundled repo. Override with BASHRC_INSTALLER_DIR. Default:
# a per-PID directory under \$TMPDIR (or /tmp). Cleaned up on exit unless
# BASHRC_INSTALLER_KEEP=1, which is handy for debugging an install.
EXTRACT_DIR="\${BASHRC_INSTALLER_DIR:-\${TMPDIR:-/tmp}/synle-bashrc-installer-\$\$}"
mkdir -p "\$EXTRACT_DIR"
trap '[ -n "\${BASHRC_INSTALLER_KEEP:-}" ] || rm -rf "\$EXTRACT_DIR"' EXIT

# Slice the base64 payload out of this script (everything after the marker line),
# decode it, and untar into the extract dir. macOS base64 accepts -d; GNU base64
# does too. tar -xzf - reads gzipped tar from stdin on both platforms.
awk '/^${PAYLOAD_MARKER}\$/{found=1; next} found' "\$0" \\
  | base64 -d \\
  | tar -xzf - -C "\$EXTRACT_DIR"

cd "\$EXTRACT_DIR"
# exec replaces this shell with run.sh so the EXIT trap above fires only when
# run.sh itself exits — Ctrl-C and normal completion both clean up correctly.
exec bash run.sh "\$@"

${PAYLOAD_MARKER}
`;
}

/**
 * Entry point. Builds the tarball, base64-wraps it, writes the final installer
 * to OUTPUT_PATH, and prints a short summary to stdout.
 *
 * @returns {void}
 */
/**
 * Wrap a base64 string at 76 chars per line — canonical line length emitted by
 * both BSD and GNU `base64` with no flags. Keeps the installer line-diffable
 * and avoids extremely long lines that some editors / pagers choke on.
 *
 * @param {string} b64 - unwrapped base64 string.
 * @returns {string} newline-joined wrapped base64.
 */
function wrapBase64(b64) {
  return b64.match(/.{1,76}/g).join("\n");
}

/**
 * Assemble the final installer text from a header and a (already-wrapped)
 * base64 payload. Trailing newline is added so editors don't flag the file.
 *
 * @param {string} header - bash header ending with the PAYLOAD_MARKER line.
 * @param {string} wrappedPayload - base64 payload wrapped to 76 chars/line.
 * @returns {string} full installer file contents.
 */
function assembleInstaller(header, wrappedPayload) {
  return header + wrappedPayload + "\n";
}

/**
 * Entry point. Builds the tarball, base64-wraps it, writes the final installer
 * to OUTPUT_PATH, and prints a short summary to stdout.
 *
 * @returns {{outputPath: string, payloadBytes: number, fileCount: number}} build summary.
 */
function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const tarball = buildTarball();
  const wrapped = wrapBase64(tarball.toString("base64"));
  const fileCount = countTarballEntries(tarball);
  const version = getVersionString();
  const sha = getGitSha();

  const header = buildHeader({
    version,
    sha,
    fileCount,
    payloadBytes: tarball.length,
  });

  fs.writeFileSync(OUTPUT_PATH, assembleInstaller(header, wrapped));
  fs.chmodSync(OUTPUT_PATH, 0o755);

  // Sidecar version file — CI's "Tag successful build" step reads this to
  // ensure the git tag matches the installer banner byte-for-byte. Also handy
  // for developers running `make build_installer` locally who want to know
  // what version their .build/install-bashrc.sh advertises.
  fs.writeFileSync(path.join(OUTPUT_DIR, "install-bashrc.version"), version + "\n");

  const finalSize = fs.statSync(OUTPUT_PATH).size;
  console.log(
    `>> built ${path.relative(REPO_ROOT, OUTPUT_PATH)} ${version} (${(finalSize / 1024).toFixed(1)} KB, payload ${(tarball.length / 1024).toFixed(1)} KB, ${fileCount} files)`,
  );

  return {
    outputPath: OUTPUT_PATH,
    version,
    payloadBytes: tarball.length,
    fileCount,
  };
}

// Only execute when invoked as a script (not when imported by tests).
if (require.main === module) {
  main();
}

module.exports = {
  REPO_ROOT,
  OUTPUT_DIR,
  OUTPUT_PATH,
  FILES_TO_BUNDLE,
  TAR_EXCLUDES,
  PAYLOAD_MARKER,
  INSTALLER_URL,
  buildTarball,
  countTarballEntries,
  buildHeader,
  wrapBase64,
  assembleInstaller,
  getGitSha,
  getVersionString,
  main,
};
