/** Behavioral coverage for Pi's real-executable plugin bootstrap and preset wiring. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { getIndexFunction } from "./setup.js";

/** Repository root, used to keep fake persistent executables outside /tmp. */
const ROOT = path.resolve(import.meta.dirname, "../..");
/** Installer exercised directly with the real binary-discovery helper. */
const INSTALLER = fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/pi/setup-plugins.sh"), "utf8");
/** The production discovery helper; sourcing the whole bootstrap would add unrelated effects. */
const BINARY_HELPER = fs
  .readFileSync(path.join(ROOT, "software/bootstrap/common-functions.bash"), "utf8")
  .match(/^function has_persistent_binary\(\) \{[\s\S]*?^\}/m)[0];
/** Expected native CLI requests, independently specified by the requested package inventory. */
const EXPECTED_CALLS = [
  "install|npm:pi-web-access@0.44.0|true|eof",
  "install|npm:pi-subagents@0.80.0|true|eof",
  "install|npm:pi-powerline-footer@0.20.2|true|eof",
  "install|npm:pi-lens@4.4.4|true|eof",
];
/** Per-test fixture folder, removed after every test. */
let fixture;
/** Executable folder deliberately containing spaces to exercise path quoting. */
let binFolder;

beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(ROOT, ".pi-plugins-test-"));
  binFolder = path.join(fixture, "binary folder");
  fs.mkdirSync(binFolder);
});

afterEach(() => {
  fs.rmSync(fixture, { recursive: true, force: true });
});

/**
 * Creates a fake Pi CLI that records arguments, lifecycle policy, and stdin state.
 * @returns {void} Writes an executable owned by this test only.
 */
function writePiBinary() {
  fs.writeFileSync(
    path.join(binFolder, "pi"),
    `#!/bin/bash
input_state=eof
if IFS= read -r input; then input_state=consumed; fi
printf '%s|%s|%s|%s\n' "$1" "$2" "\${npm_config_ignore_scripts:-unset}" "$input_state" >> "$CALL_LOG"
if [ "$2" = "\${FAIL_PACKAGE:-}" ]; then exit 17; fi
`,
    { mode: 0o755 },
  );
}

/**
 * Runs the production installer in isolated bash without the user's profile or binaries.
 * @param {object} options - Optional shell preamble and simulated failing package.
 * @param {string} [options.preamble] - Test-owned function or alias setup.
 * @param {string} [options.failPackage] - Package whose fake installation must fail.
 * @returns {{status: number|null, stdout: string, stderr: string, calls: string[]}} Process result and recorded calls.
 */
function runInstaller({ preamble = "", failPackage = "" } = {}) {
  const log = path.join(fixture, "calls.log");
  const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", `${BINARY_HELPER}\n${preamble}\n${INSTALLER}`], {
    encoding: "utf8",
    timeout: 5000,
    input: "bootstrap input must not be consumed\n",
    env: { PATH: binFolder, HOME: fixture, CALL_LOG: log, FAIL_PACKAGE: failPackage, BASH_ENV: "" },
  });
  return { ...result, calls: fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [] };
}

describe("Pi plugin bootstrap", () => {
  it.each([
    ["missing executable", ""],
    ["function only", 'function pi() { echo "WRONG FUNCTION" >&2; return 99; }'],
    ["alias only", 'shopt -s expand_aliases\nalias pi="echo WRONG ALIAS"'],
  ])("skips without installing when there is a %s", (_label, preamble) => {
    const result = runInstaller({ preamble });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(">> Skipped Pi plugins: pi binary not installed");
    expect(result.stderr).toBe("");
    expect(result.calls).toEqual([]);
  });

  it("installs exactly the four packages through the binary, bypassing a shadowing function and alias", () => {
    writePiBinary();
    const result = runInstaller({
      preamble: 'function pi() { echo "WRONG FUNCTION" >&2; return 99; }\nshopt -s expand_aliases\nalias pi="echo WRONG ALIAS"',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.calls).toEqual(EXPECTED_CALLS);
  });

  it.each([
    ["npm:pi-web-access@0.44.0", ["install|npm:pi-web-access@0.44.0|true|eof"]],
    ["npm:pi-subagents@0.80.0", ["install|npm:pi-web-access@0.44.0|true|eof", "install|npm:pi-subagents@0.80.0|true|eof"]],
    [
      "npm:pi-powerline-footer@0.20.2",
      [
        "install|npm:pi-web-access@0.44.0|true|eof",
        "install|npm:pi-subagents@0.80.0|true|eof",
        "install|npm:pi-powerline-footer@0.20.2|true|eof",
      ],
    ],
    ["npm:pi-lens@4.4.4", EXPECTED_CALLS],
  ])("propagates failure for %s without installing later packages", (failPackage, expected) => {
    writePiBinary();
    const result = runInstaller({ failPackage });
    expect(result.status).toBe(17);
    expect(result.calls).toEqual(expected);
  });

  it("includes plugins after Pi installation in llm, but never in the prompt-only preset", () => {
    const presets = JSON.parse(
      getIndexFunction("stripJsoncComments")(fs.readFileSync(path.join(ROOT, "software/metadata/presets.jsonc"), "utf8")),
    );
    expect(presets.llm.files.filter((file) => file.startsWith("advanced/llm/pi/"))).toEqual([
      "advanced/llm/pi/install.sh",
      "advanced/llm/pi/setup-plugins.sh",
      "advanced/llm/pi/setup.js",
    ]);
    expect(presets["llm-prompts"].files.filter((file) => file.startsWith("advanced/llm/pi/"))).toEqual(["advanced/llm/pi/setup.js"]);
  });
});
