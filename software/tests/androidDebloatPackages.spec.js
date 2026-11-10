/** Android package cleanup keeps used integrations and removes only selected apps. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import { spawnSync } from "child_process";

/** Shared Android source; all ADB commands run through the fixture stub. */
const ANDROID_SOURCE = fs.readFileSync("docs/android/android.sh", "utf8");

/** Entrypoints exercise the same collections as a normal cleanup or restore. */
const DEBLOAT_SOURCE = fs.readFileSync("docs/android/android.debloat.sh", "utf8");

/** Restore entrypoint must also leave protected package state alone. */
const RESTORE_SOURCE = fs.readFileSync("docs/android/android.restore.sh", "utf8");

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

/** Requested unused extras belong in the default cleanup collection. */
const NEW_REMOVALS = [
  "com.aura.oobe.samsung",
  "com.aura.oobe.samsung.gl",
  "com.samsung.android.livestickers",
  "com.samsung.android.app.settings.bixby",
  "com.samsung.android.samsungpassautofill",
];

/**
 * Executes real cleanup sources with an in-shell ADB stub and no device access.
 * @param {string} entrypoint Shell statements appended after the shared source.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status, output, and traced fake ADB commands.
 */
function runAndroid(entrypoint) {
  return spawnSync("/bin/sh", ["-s"], {
    input: `adb() { printf 'ADB %s\\n' "$*" >&3; }\nexec 3>&1\n${ANDROID_SOURCE}\n${entrypoint}`,
    env: { ...process.env, BASH_ENV: "/dev/null", ENV: "/dev/null" },
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}

describe("Android debloat package policy", () => {
  it("keeps protected integrations out of both normalized removal collections", () => {
    const result = runAndroid('printf \'%s\\n\' "$DEBLOAT_SAFE" "$DEBLOAT_AGGRESSIVE"');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("com.samsung.android.smartcallprovider\n");
    expect(PROTECTED_PACKAGES.filter((name) => result.stdout.includes(`\n${name}\n`))).toMatchInlineSnapshot(`[]`);
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

  it("keeps high-risk replacement apps out of default cleanup", () => {
    const result = runAndroid(DEBLOAT_SOURCE);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("ADB shell pm uninstall com.samsung.android.honeyboard\n");
    expect(result.stdout).not.toContain("ADB shell pm uninstall com.samsung.android.dialer\n");
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
});
