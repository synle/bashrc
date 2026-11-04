/** Private filesystem and encoder-command fixtures for image_compress contract tests. */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Profile partial under test, loaded through its public shell function. */
const PROFILE = path.resolve("software/scripts/bash-image.profile.bash");
/** Production boolean and help definitions, without bootstrap side effects. */
const HELPERS = [
  fs.readFileSync("software/bootstrap/common-env.sh", "utf8").match(/^function is_truthy\(\) \{[\s\S]*?^\}/m)[0],
  fs.readFileSync("software/bootstrap/common-functions.bash", "utf8").match(/^function is_help_arg\(\) \{[\s\S]*?^\}/m)[0],
].join("\n");
/** Test-owned sharp command captures arguments and simulates encoder outcomes, not image quality. */
const ENCODER = `#!${process.execPath}
const fs = require('fs');
const args = process.argv.slice(2);
const input = args[args.indexOf('-i') + 1];
const output = args[args.indexOf('-o') + 1];
fs.appendFileSync(process.env.ENCODER_LOG, JSON.stringify(args) + '\\n');
if (process.env.ENCODER_MODE === 'fail' || input.endsWith(process.env.FAIL_NAME || '\\0')) process.exit(7);
if (process.env.ENCODER_MODE === 'empty') { fs.writeFileSync(output, ''); process.exit(0); }
if (process.env.ENCODER_MODE === 'change') fs.writeFileSync(input, 'changed during encoding');
if (process.env.ENCODER_MODE === 'collision') fs.writeFileSync(process.env.COLLISION_FILE, 'concurrent destination');
const prefix = args.includes('jpeg') ? Buffer.from([255, 216, 255]) : Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
fs.writeFileSync(output, Buffer.concat([prefix, fs.readFileSync(input)]));
`;

/**
 * Create a sandbox and test-owned encoder executable.
 * @returns {{root: string, file: Function, run: Function, calls: Function, clean: Function}} Isolated command fixture.
 * @throws {Error} On fixture filesystem failures; creates only private temporary files.
 */
export function imageFixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "image-compress-")));
  const bin = path.join(root, "bin");
  const log = path.join(root, "encoder.jsonl");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "sharp"), ENCODER, { mode: 0o755 });

  /**
   * Write bytes into the sandbox.
   * @param {string} name Relative filename.
   * @param {string|Buffer} [bytes] Fixture content.
   * @returns {string} Absolute filename; creates parent folders.
   * @throws {Error} On filesystem failure.
   */
  function file(name, bytes = "original image") {
    const filename = path.join(root, name);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, bytes);
    return filename;
  }

  /**
   * Invoke the real Bash wrapper with literal arguments.
   * @param {string[]} args Public command arguments.
   * @param {object} [env] Test-owned environment overrides.
   * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and captured output.
   * @throws {Error} On invalid subprocess options; writes only fixture outputs.
   */
  function run(args, env = {}) {
    return spawnSync("/bin/bash", ["--noprofile", "--norc", "-s", "--", ...args], {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
      input: `${HELPERS}\nfunction safe_source() { . "$1"; }\nsafe_source "$IMAGE_PROFILE"\nimage_compress "$@"`,
      env: { ...process.env, BASH_ENV: "/dev/null", PATH: `${bin}:${process.env.PATH}`, IMAGE_PROFILE: PROFILE, ENCODER_LOG: log, ...env },
    });
  }

  /**
   * Read the test-owned encoder boundary log.
   * @returns {string[][]} Argument lists; absent log means no invocation occurred.
   * @throws {Error} On malformed log data; no writes.
   */
  function calls() {
    return fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse) : [];
  }

  /**
   * Remove this test's private sandbox after all assertions.
   * @returns {void} Deletes only this fixture's files.
   * @throws {Error} On filesystem cleanup failure.
   */
  function clean() {
    fs.rmSync(root, { recursive: true, force: true });
  }

  return { root, file, run, calls, clean };
}
