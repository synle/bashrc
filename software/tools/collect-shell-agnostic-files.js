/** Save tracked shell sources for the optional shell-portability validators. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

/** Shared saved-list location; respect the platform's temporary-folder configuration. */
const SHELL_AGNOSTIC_FILES_PATH = path.join(os.tmpdir(), "shell-agnostic-files.txt");
/** Bound Git collection independently of analyzer execution. */
const GIT_TIMEOUT_MS = 5000;
/** Bound the tracked filename inventory without imposing a shell argument limit. */
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;

/**
 * Collect tracked shell paths from the current repository and atomically save JSON.
 * @returns {void} Prints the saved-list filename; sets status 2 on collection/write failure.
 * @sideEffects Runs Git without a shell and replaces the saved list; never reads source content.
 */
function main() {
  try {
    const tracked = execFileSync("git", ["ls-files", "-z", "--", "*.sh", "*.bash", "*.zsh"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
    });
    const files = tracked.split("\0").filter((file) => file && !file.endsWith(".ps1.bash") && !/^(\.build|dist|coverage)\//.test(file));
    // Publish a complete list so concurrent readers never see partial JSON.
    const stagingFolder = fs.mkdtempSync(path.join(os.tmpdir(), "shell-agnostic-files-"));
    try {
      const stagingFile = path.join(stagingFolder, "files.txt");
      fs.writeFileSync(stagingFile, `${JSON.stringify(files, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(stagingFile, SHELL_AGNOSTIC_FILES_PATH);
    } finally {
      fs.rmSync(stagingFolder, { recursive: true, force: true });
    }
    process.stdout.write(`${SHELL_AGNOSTIC_FILES_PATH}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: { code: "COLLECTION_UNAVAILABLE", message: error.message } })}\n`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { SHELL_AGNOSTIC_FILES_PATH };
