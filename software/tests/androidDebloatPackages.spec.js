/** Android package cleanup keeps used integrations and removes only selected apps. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import { spawnSync } from "child_process";

/** Shared ADB helper source; all ADB commands run through the fixture stub. */
const COMMON_SOURCE = fs.readFileSync("docs/android/common-android.sh", "utf8");

/** Shared Android source; all ADB commands run through the fixture stub. */
const ANDROID_SOURCE = fs.readFileSync("docs/android/android-mobile.sh", "utf8");

/** Entrypoints exercise the same collections as a normal cleanup or restore. */
const DEBLOAT_SOURCE = fs.readFileSync("docs/android/android-mobile.debloat.sh", "utf8");

/** Restore entrypoint must also leave protected package state alone. */
const RESTORE_SOURCE = fs.readFileSync("docs/android/android-mobile.restore.sh", "utf8");

/** User-selected features and known shared dependencies must never be removed. */
const PROTECTED_PACKAGES = [
  "com.sec.android.app.shealth",
  "com.sec.android.app.voicenote",
  "com.microsoft.appmanager",
  "com.samsung.android.mdx",
  "com.samsung.android.mdx.kit",
  "com.samsung.android.mdx.quickboard",
  "com.samsung.android.dynamiclock",
  "com.sec.android.app.desktoplauncher",
  "com.sec.android.desktopmode.uiservice",
  "com.sec.android.app.dexonpc",
  "com.samsung.android.forest",
  "com.samsung.android.app.appsedge",
  "com.samsung.android.mobileservice",
];

/** Requested unused extras and Google-replaced Samsung apps belong in default cleanup. */
const NEW_REMOVALS = [
  "com.aura.oobe.samsung",
  "com.aura.oobe.samsung.gl",
  "com.samsung.android.livestickers",
  "com.samsung.android.app.settings.bixby",
  "com.samsung.android.samsungpassautofill",
  "com.samsung.android.calendar",
  "com.samsung.android.messaging",
  "com.sec.android.app.clockpackage",
  "com.samsung.android.visionintelligence",
  "com.samsung.android.rubin.app",
  "com.samsung.android.smartcallprovider",
  "com.samsung.android.authfw",
];

/**
 * Executes real cleanup sources with an in-shell ADB stub and no device access.
 * @param {string} entrypoint Shell statements appended after the shared source.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status, output, and traced fake ADB commands.
 */
function runAndroid(entrypoint) {
  return spawnSync("/bin/sh", ["-s"], {
    input: `adb() {
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
        ${NEW_REMOVALS.join("|")}) printf 'package:%s\\n' "$_adb_list_pkg" ;;
      esac
      ;;
  esac
}
exec 3>&1
${COMMON_SOURCE}
${ANDROID_SOURCE}
${entrypoint}`,
    env: { ...process.env, BASH_ENV: "/dev/null", ENV: "/dev/null" },
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}

function runAndroidWithExistingPackage(entrypoint, extraCases = "") {
  return spawnSync("/bin/sh", ["-s"], {
    input: `adb() {
  printf 'ADB %s\\n' "$*" >&3
  case "$*" in
    ${extraCases}
    "shell pm list users") printf 'UserInfo{0:Owner:4c13} running\\nUserInfo{11:Work profile:1030} running\\n' ;;
    "shell pm list packages pkg.remove"|"shell pm list packages -e pkg.remove"|"shell pm list packages -e --user 0 pkg.remove"|"shell pm list packages -e --user 11 pkg.remove"|"shell pm list packages -u --user 0 pkg.remove"|"shell pm list packages -u --user 11 pkg.remove") printf 'package:pkg.remove\\n' ;;
    "shell pm disable-user --user 0 pkg.remove"|"shell pm disable-user --user 11 pkg.remove") printf 'Success\\n' ;;
    "shell pm disable-user -k --user 0 pkg.remove"|"shell pm disable-user -k --user 11 pkg.remove") printf 'Unknown package: --user\\n' >&2; return 1 ;;
  esac
}
exec 3>&1
${COMMON_SOURCE}
${entrypoint}
`,
    env: { ...process.env, BASH_ENV: "/dev/null", ENV: "/dev/null" },
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}

describe("Android debloat package policy", () => {
  it("keeps protected integrations out of every normalized removal collection", () => {
    const result = runAndroid('printf \'%s\\n\' "$DEBLOAT_SAFE" "$DEBLOAT_SEMI_AGGRESSIVE" "$DEBLOAT_AGGRESSIVE"');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("com.samsung.android.smartcallprovider\n");
    expect(PROTECTED_PACKAGES.filter((name) => result.stdout.includes(`\n${name}\n`))).toMatchInlineSnapshot(`[]`);
  });

  it("uses supported disable-user syntax for every ADB user", () => {
    const result = runAndroidWithExistingPackage("_remove_app pkg.remove");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.split("\n").filter((line) => line.includes("pm disable-user"))).toMatchInlineSnapshot(`
      [
        "ADB shell pm disable-user --user 0 pkg.remove",
        "ADB shell pm disable-user --user 11 pkg.remove",
      ]
    `);
  });

  it("reports Removed when every user uninstall succeeds", () => {
    const result = runAndroidWithExistingPackage(
      '_remove_app pkg.remove\n_log_app_action pkg.remove DEBLOAT_SEMI_AGGRESSIVE Success "$APP_ACTION_RESULT" 3 16',
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(">>> pkg.remove > DEBLOAT_SEMI_AGGRESSIVE > Success > Removed > [3/16 - 18%]");
  });

  it("names the users when an app can only be disabled", () => {
    const result = runAndroidWithExistingPackage(
      '_remove_app pkg.remove\n_log_app_action pkg.remove DEBLOAT_SEMI_AGGRESSIVE Success "$APP_ACTION_RESULT" 3 16',
      `
    "shell pm uninstall pkg.remove") printf 'Failure [failed]\\n' >&2; return 1 ;;
    "shell pm uninstall -k --user 0 pkg.remove") printf 'Failure [failed]\\n' >&2; return 1 ;;
    "shell pm uninstall -k --user 11 pkg.remove") printf 'Failure [failed]\\n' >&2; return 1 ;;
`,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(">>> pkg.remove > DEBLOAT_SEMI_AGGRESSIVE > Success > Disabled for users 0,11 > [3/16 - 18%]");
  });

  it("reports removal and disable per user when outcomes differ", () => {
    const result = runAndroidWithExistingPackage(
      '_remove_app pkg.remove\n_log_app_action pkg.remove DEBLOAT_SEMI_AGGRESSIVE Success "$APP_ACTION_RESULT" 3 16',
      `
    "shell pm disable-user --user 11 pkg.remove") printf 'Error: cannot disable user 11\\n' >&2; return 1 ;;
    "shell pm uninstall pkg.remove") printf 'Failure [failed]\\n' >&2; return 1 ;;
    "shell pm uninstall -k --user 0 pkg.remove") printf 'Failure [failed]\\n' >&2; return 1 ;;
`,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      ">>> pkg.remove > DEBLOAT_SEMI_AGGRESSIVE > Success > Removed for users 11; Disabled for users 0 > [3/16 - 18%]",
    );
  });

  it("removes requested extras without removing protected integrations", () => {
    const result = runAndroid(DEBLOAT_SOURCE);
    expect(result.status, result.stderr).toBe(0);
    expect(NEW_REMOVALS.filter((name) => result.stdout.includes(`ADB shell pm uninstall -k --user 0 ${name}\n`))).toMatchInlineSnapshot(`
      [
        "com.aura.oobe.samsung",
        "com.aura.oobe.samsung.gl",
        "com.samsung.android.livestickers",
        "com.samsung.android.app.settings.bixby",
        "com.samsung.android.samsungpassautofill",
        "com.samsung.android.calendar",
        "com.samsung.android.messaging",
        "com.sec.android.app.clockpackage",
        "com.samsung.android.visionintelligence",
        "com.samsung.android.rubin.app",
        "com.samsung.android.smartcallprovider",
        "com.samsung.android.authfw",
      ]
    `);
    expect(PROTECTED_PACKAGES.filter((name) => result.stdout.includes(`ADB shell pm uninstall ${name}\n`))).toMatchInlineSnapshot(`[]`);
  });

  it("keeps protected integrations out of bulk restore", () => {
    const result = runAndroid(RESTORE_SOURCE);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("ADB shell cmd package install-existing com.samsung.android.smartcallprovider\n");
    expect(
      PROTECTED_PACKAGES.filter((name) => result.stdout.includes(`ADB shell cmd package install-existing ${name}\n`)),
    ).toMatchInlineSnapshot(`[]`);
    expect(PROTECTED_PACKAGES.filter((name) => result.stdout.includes(`ADB shell pm enable ${name}\n`))).toMatchInlineSnapshot(`[]`);
  });

  it("runs active semi-aggressive replacements but keeps commented aggressive apps", () => {
    const result = runAndroid(DEBLOAT_SOURCE);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("ADB shell pm uninstall com.samsung.android.app.dressroom\n");
    expect(result.stdout).not.toContain("ADB shell pm uninstall com.google.android.gms.supervision\n");
  });

  it("uses one space before concrete package comments", () => {
    const collections = ANDROID_SOURCE.slice(
      ANDROID_SOURCE.indexOf('DEBLOAT_SAFE="'),
      ANDROID_SOURCE.indexOf("# Safe is the master collection."),
    );
    expect(collections).not.toMatch(/^com\.[\w.]+ {2,}#/m);
    expect(collections).not.toContain("[Not Needed]");
    expect(collections).toContain("# com.sec.android.app.shealth | [WARNING]");
    expect(collections).toContain("# com.microsoft.appmanager | [WARNING]");
  });

  it("marks a package that is not installed as a yellow warning", () => {
    const result = runAndroid('_log_color_enabled() { return 0; }\nremove_app_collection "com.example.not-installed" "DEBLOAT_SAFE"');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(">>> com.example.not-installed > DEBLOAT_SAFE > Warning > Skipped - package not found > [1/1 - 100%]");
    expect(result.stdout).toContain("\u001b[0;33m");
    expect(result.stdout).not.toContain("\u001b[0;32m");
  });
});
