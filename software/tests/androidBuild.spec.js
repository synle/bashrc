/** Standalone Android builds preserve source behavior without contacting devices. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Canonical builder input folder, independent of temporary fixture checkouts. */
const SOURCE_FOLDER = path.resolve("docs/android");

/** Makefile copied into fixtures to exercise recursive Make with normal discovery. */
const MAKEFILE = path.resolve("Makefile");

/** Subprocesses must not load the developer's startup files. */
const SHELL_ENV = { ...process.env, BASH_ENV: "/dev/null", ENV: "/dev/null" };

/** Private checkout root owned and removed by each test. */
let folder;

/** Android sources and generated artifacts within the private checkout. */
let androidFolder;

/**
 * Run the copied builder from outside its checkout without executing a payload.
 * @returns {import("child_process").SpawnSyncReturns<string>} Build status and diagnostics.
 */
function build() {
  return spawnSync("/bin/bash", [path.join(androidFolder, "build_android.sh")], {
    cwd: os.tmpdir(),
    env: SHELL_ENV,
    encoding: "utf8",
    timeout: 5000,
  });
}

/**
 * Execute a payload with device and download boundaries stubbed inside its shell and PATH.
 * @param {string} source Standalone script or original source pair to characterize.
 * @param {string[]} installedPackages Packages the fake ADB reports as installed.
 * @returns {import("child_process").SpawnSyncReturns<string>} Script status, output, and ADB trace.
 */
function runPayload(source, installedPackages = []) {
  return spawnSync("/bin/bash", ["-s"], {
    input: `function adb() {
  printf 'ADB %s\\n' "$*" >&3
  case "$*" in
    "shell pm list users") printf 'UserInfo{0:Owner:4c13} running\\n' ;;
    "shell pm list packages"*|"shell cmd package list packages"*)
      _adb_list_pkg=""
      for _adb_arg in "$@"; do
        case "$_adb_arg" in
          shell|pm|cmd|package|list|packages|list-packages|-u|-e|-d|-s|-3|-f|-i|-l|--user|[0-9]*) ;;
          *) _adb_list_pkg=$_adb_arg ;;
        esac
      done
      case "$_adb_list_pkg" in
        ${installedPackages.join("|") || "no-installed-packages"}) printf 'package:%s\\n' "$_adb_list_pkg" ;;
      esac
      ;;
  esac
}
function curl() { return 1; }
exec 3>&1
${source}`,
    env: {
      ...SHELL_ENV,
      PATH: `${path.join(folder, "bin")}${path.delimiter}${SHELL_ENV.PATH ?? ""}`,
    },
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "android build 'quoted' "));
  androidFolder = path.join(folder, "docs/android");
  fs.mkdirSync(androidFolder, { recursive: true });
  const stubFolder = path.join(folder, "bin");
  fs.mkdirSync(stubFolder, { recursive: true });
  fs.writeFileSync(path.join(stubFolder, "curl"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  fs.writeFileSync(path.join(androidFolder, "build_android.sh"), fs.readFileSync(path.join(SOURCE_FOLDER, "build_android.sh")));
  fs.writeFileSync(path.join(androidFolder, "common-android.sh"), fs.readFileSync(path.join(SOURCE_FOLDER, "common-android.sh")));
  for (const platform of ["android-mobile", "android-tv-fire"]) {
    fs.writeFileSync(path.join(androidFolder, `${platform}.sh`), `#!/bin/sh\nlabel=${platform}`);
    for (const action of ["debloat", "restore"]) {
      fs.writeFileSync(
        path.join(androidFolder, `${platform}.${action}.sh`),
        `#!/usr/bin/env bash\nprintf '%s %s\\n' "$label" '${action}'\n`,
      );
    }
  }
});

afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

describe("Android standalone builder", () => {
  it("creates exactly four deterministic scripts without executing their sources", () => {
    fs.appendFileSync(path.join(androidFolder, "android-mobile.sh"), '\nprintf sentinel > "$(dirname "$0")/executed"\n');
    const first = build();
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("android-mobile_debloat.sh");
    const outputFolder = path.join(androidFolder, "build");
    expect(fs.readdirSync(outputFolder).sort()).toMatchInlineSnapshot(`
      [
        "android-mobile_debloat.sh",
        "android-mobile_restore.sh",
        "android-tv-fire_debloat.sh",
        "android-tv-fire_restore.sh",
      ]
    `);
    expect(fs.existsSync(path.join(androidFolder, "executed"))).toBe(false);
    const before = fs
      .readdirSync(outputFolder)
      .sort()
      .map((name) => fs.readFileSync(path.join(outputFolder, name), "utf8"));
    const second = build();
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toBe(first.stdout);
    expect(
      fs
        .readdirSync(outputFolder)
        .sort()
        .map((name) => fs.readFileSync(path.join(outputFolder, name), "utf8")),
    ).toEqual(before);
  });

  it.each([
    ["android-mobile", "debloat"],
    ["android-mobile", "restore"],
    ["android-tv-fire", "debloat"],
    ["android-tv-fire", "restore"],
  ])("builds an executable %s %s script with one Bash shebang and source provenance", (platform, action) => {
    const result = build();
    expect(result.status, result.stderr).toBe(0);
    const output = path.join(androidFolder, "build", `${platform}_${action}.sh`);
    const source = fs.readFileSync(output, "utf8");
    expect(source.startsWith("#!/usr/bin/env bash\n")).toBe(true);
    expect(source.match(/^#!/gm)).toEqual(["#!"]);
    expect(source).toContain("Generated by docs/android/build_android.sh. DO NOT EDIT.");
    expect(source).toContain(`docs/android/${platform}.sh`);
    expect(source).toContain(`docs/android/${platform}.${action}.sh`);
    expect(fs.statSync(output).mode & 0o111).toBe(0o111);
    const execution = spawnSync(output, { env: SHELL_ENV, encoding: "utf8", timeout: 5000 });
    expect(execution.status, execution.stderr).toBe(0);
    expect(execution.stdout).toBe(`${platform} ${action}\n`);
  });

  it("fails on a missing fragment without replacing an existing artifact or leaving temporary files", () => {
    fs.mkdirSync(path.join(androidFolder, "build"));
    const output = path.join(androidFolder, "build/android-mobile_debloat.sh");
    fs.writeFileSync(output, "previous artifact\n");
    fs.unlinkSync(path.join(androidFolder, "android-mobile.debloat.sh"));
    const result = build();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("android-mobile.debloat.sh");
    expect(fs.readFileSync(output, "utf8")).toBe("previous artifact\n");
    expect(fs.readdirSync(path.dirname(output))).toMatchInlineSnapshot(`
      [
        "android-mobile_debloat.sh",
      ]
    `);
  });

  it("rejects malformed shell before replacing that artifact", () => {
    fs.mkdirSync(path.join(androidFolder, "build"));
    const output = path.join(androidFolder, "build/android-mobile_debloat.sh");
    fs.writeFileSync(output, "previous artifact\n");
    fs.writeFileSync(path.join(androidFolder, "android-mobile.debloat.sh"), "if\n");
    const result = build();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("syntax error");
    expect(fs.readFileSync(output, "utf8")).toBe("previous artifact\n");
    expect(fs.readdirSync(path.dirname(output))).toMatchInlineSnapshot(`
      [
        "android-mobile_debloat.sh",
      ]
    `);
  });

  it.each([
    ["android-mobile", "debloat", "ADB shell pm uninstall -k --user 0 com.samsung.android.calendar\n", "com.samsung.android.calendar"],
    ["android-mobile", "restore", "ADB shell cmd package install-existing com.samsung.android.calendar\n", "com.samsung.android.calendar"],
    ["android-tv-fire", "debloat", "ADB shell pm uninstall -k --user 0 com.amazon.windowshop\n", "com.amazon.windowshop"],
    ["android-tv-fire", "restore", "ADB shell cmd package install-existing com.amazon.windowshop\n", "com.amazon.windowshop"],
  ])("preserves real %s %s behavior with no device or network access", (platform, action, expectedCommand, installedPackage) => {
    const common = fs.readFileSync(path.join(SOURCE_FOLDER, "common-android.sh"), "utf8");
    const platformSource = fs.readFileSync(path.join(SOURCE_FOLDER, `${platform}.sh`), "utf8");
    const entrypoint = fs.readFileSync(path.join(SOURCE_FOLDER, `${platform}.${action}.sh`), "utf8");
    fs.writeFileSync(path.join(androidFolder, `${platform}.sh`), platformSource);
    fs.writeFileSync(path.join(androidFolder, `${platform}.${action}.sh`), entrypoint);
    const result = build();
    expect(result.status, result.stderr).toBe(0);
    const source = `${common}\n${platformSource}\n${entrypoint}`;
    const artifact = fs.readFileSync(path.join(androidFolder, "build", `${platform}_${action}.sh`), "utf8");
    const baseline = runPayload(source, [installedPackage]);
    const generated = runPayload(artifact, [installedPackage]);
    expect(baseline.status, baseline.stderr).toBe(0);
    expect(generated.status, generated.stderr).toBe(0);
    expect(generated.stdout, generated.stderr).toContain(expectedCommand);
    expect(generated.stdout).toBe(baseline.stdout);
    expect(generated.stderr).toBe(baseline.stderr);
  });

  it("runs generation after formatter prerequisites during parallel make format", () => {
    fs.writeFileSync(path.join(folder, "Makefile"), fs.readFileSync(MAKEFILE));
    fs.writeFileSync(
      path.join(folder, "fixture.mk"),
      `
.PHONY: format_build_include format_ci_binaries format_script_indexes format_jsdocs format_spec_cleanup format_shell format_prettier build_autocomplete_specs
format_build_include format_ci_binaries format_script_indexes format_jsdocs format_spec_cleanup format_prettier build_autocomplete_specs:
\t@:
format_shell:
\t@printf '%s\\n' '#!/bin/sh' 'label=formatted-android' > docs/android/android-mobile.sh
`,
    );
    const result = spawnSync("make", ["-f", "Makefile", "-f", "fixture.mk", "-j2", "format"], {
      cwd: folder,
      env: SHELL_ENV,
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("android-mobile_debloat.sh");
    const generated = spawnSync("/bin/bash", [path.join(androidFolder, "build/android-mobile_debloat.sh")], {
      env: SHELL_ENV,
      encoding: "utf8",
      timeout: 5000,
    });
    expect(generated.status, generated.stderr).toBe(0);
    expect(generated.stdout).toBe("formatted-android debloat\n");
  });
});
