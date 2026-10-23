/** Executes the standalone pi-lens installer without requiring a Pi installation. */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getIndexFunction } from "./setup.js";

/** Repository root keeps persistent binary fixtures outside temporary-root exclusions. */
const ROOT = path.resolve(import.meta.dirname, "../..");
/** Installer with only its shared pin materialized, matching runtime SOURCE expansion. */
const INSTALLER = fs
  .readFileSync(path.join(ROOT, "software/scripts/advanced/llm/pi-lens.sh"), "utf8")
  .replace(
    "# SOURCE software/scripts/advanced/llm/_common/pi-lens.common.bash",
    fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/_common/pi-lens.common.bash"), "utf8"),
  );
/** Real bootstrap functions expose first-install behavior at the package-install boundary. */
const COMMON_HELPERS = fs.readFileSync(path.join(ROOT, "software/bootstrap/common-functions.bash"), "utf8");
/** Real binary detection rejects shell functions as evidence of an installation. */
const BINARY_HELPER = COMMON_HELPERS.match(/^function has_persistent_binary\(\) \{[\s\S]*?^\}/m)[0];
/** Independent requests include optional peers required by the standalone server imports. */
const EXPECTED_REQUESTS = [
  "@earendil-works/pi-tui@1.4.0|pi-tui|true|0|eof|KEPT/p:npm_config_ignore_scripts/w",
  "typebox@1.4.3|typebox|true|0|eof|KEPT/p:npm_config_ignore_scripts/w",
  "pi-lens@4.4.4|pi-lens-mcp|true|0|eof|KEPT/p:npm_config_ignore_scripts/w",
];
/** Test-owned installation root and disposable executables. */
let fixture;

beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(ROOT, ".pi-lens-test-"));
  fs.mkdirSync(path.join(fixture, ".local/bin"), { recursive: true });
  fs.symlinkSync(process.execPath, path.join(fixture, ".local/bin/node"));
});

afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

/** Run the real installer with an owned package-install boundary and no Pi binary.
 * @param {string} mode - Success, missing launcher, wrong payload, unsupported Node, or command failure.
 * @param {string} version - Existing server version, empty for a fresh installation.
 * @returns {object} Bounded subprocess result and captured package requests.
 */
function runInstaller(mode = "success", version = "") {
  const manifest = path.join(fixture, ".local/lib/node_modules/pi-lens/package.json");
  if (version) {
    fs.mkdirSync(path.dirname(manifest), { recursive: true });
    fs.writeFileSync(manifest, JSON.stringify({ version }));
  }
  const result = spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
${mode === "real" ? COMMON_HELPERS : BINARY_HELPER}
${mode === "unsupported-node" ? "function node() { return 1; }" : ""}
function npm_install_boundary() {
  input_state=eof
  if IFS= read -r input; then input_state=consumed; fi
  printf '%s|%s|%s|%s|%s|%s\\n' "$1" "$2" "$npm_config_ignore_scripts" "$IS_REFRESH_MODE" "$input_state" "$WSLENV" >> "$HOME/request"
  [ "$MODE" = failed ] && return 17
  package_folder="$HOME/.local/lib/node_modules/\${1%@*}"
  mkdir -p "$package_folder"
  version="\${1##*@}"
  if [ "$MODE" = wrong ]; then version=0.0.0; fi
  printf '{"version":"%s"}' "$version" > "$package_folder/package.json"
  if [ "$2" = pi-lens-mcp ] && [ "$MODE" != missing ]; then
    printf '#!/bin/bash\\nexit 0\\n' > "$HOME/.local/bin/pi-lens-mcp"
    chmod +x "$HOME/.local/bin/pi-lens-mcp"
  fi
}
${
  mode === "real"
    ? `
function find_native_node() { type -P node; }
function binary_arch_mismatch() { return 1; }
function run_native() {
  binary="\${6##*/}"
  binary="\${binary%@*}"
  [ "$binary" = pi-lens ] && binary=pi-lens-mcp
  npm_install_boundary "$6" "$binary"
}
`
    : `function npm_install_global() { npm_install_boundary "$@"; }`
}
${INSTALLER}`,
    ],
    {
      encoding: "utf8",
      timeout: 10000,
      input: "remaining bootstrap stdin\n",
      env: {
        HOME: fixture,
        PATH: `${fixture}/.local/bin:/usr/bin:/bin`,
        MODE: mode,
        BASH_ENV: "",
        BASHRC_TEMP_DIR: fixture,
        WSLENV: "KEPT/p",
      },
    },
  );
  return {
    ...result,
    requests: fs.existsSync(path.join(fixture, "request")) ? fs.readFileSync(path.join(fixture, "request"), "utf8").trim().split("\n") : [],
  };
}

describe("standalone pi-lens MCP bootstrap", () => {
  it("completes a first install through the real helper when binary discovery returns nonzero", () => {
    const result = runInstaller("real");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("installed; verify");
    expect(result.requests).toEqual(EXPECTED_REQUESTS);
  });

  it("installs the pinned server and both runtime peers without Pi or lifecycle scripts", () => {
    const result = runInstaller();
    expect(result.status).toBe(0);
    expect(result.requests).toEqual(EXPECTED_REQUESTS);
    expect(result.stdout).toContain("TODO: EXPERIMENTAL pi-lens MCP");
    expect(result.stderr).toBe("");
  });

  it("forces reconciliation when an installed package does not match the pin", () => {
    const result = runInstaller("success", "0.0.0");
    expect(result.status).toBe(0);
    expect(result.requests).toEqual([
      "@earendil-works/pi-tui@1.4.0|pi-tui|true|0|eof|KEPT/p:npm_config_ignore_scripts/w",
      "typebox@1.4.3|typebox|true|0|eof|KEPT/p:npm_config_ignore_scripts/w",
      "pi-lens@4.4.4|pi-lens-mcp|true|1|eof|KEPT/p:npm_config_ignore_scripts/w",
    ]);
  });

  it("keeps normal freshness for an already-matching server", () => {
    const result = runInstaller("success", "4.4.4");
    expect(result.status).toBe(0);
    expect(result.requests).toEqual(EXPECTED_REQUESTS);
  });

  it.each([
    ["missing", 1, "executable missing"],
    ["wrong", 1, "package does not match pinned release"],
    ["failed", 17, "npm helper returned nonzero"],
  ])("does not report success when installation is %s", (mode, status, error) => {
    const result = runInstaller(mode);
    expect(result.status).toBe(status);
    expect(result.stderr).toContain(error);
    expect(result.stdout).not.toContain("installed; verify");
  });

  it("rejects an unsupported Node runtime without installing anything", () => {
    const result = runInstaller("unsupported-node");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires Node >=22.19.0");
    expect(result.requests).toEqual([]);
    expect(result.stdout).not.toContain("installed; verify");
  });

  it("includes the installer only in the installation preset", () => {
    const presets = JSON.parse(getIndexFunction("stripJsoncComments")(fs.readFileSync("software/metadata/presets.jsonc", "utf8")));
    expect(presets.llm.files).toContain("advanced/llm/pi-lens.sh");
    expect(presets["llm-prompts"].files).not.toContain("advanced/llm/pi-lens.sh");
  });
});
