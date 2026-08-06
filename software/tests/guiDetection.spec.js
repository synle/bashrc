/**
 * GUI/display detection tests for software/bootstrap/common-env.sh.
 *
 * `_detect_gui_flags` is the single source of truth for is_gui / is_gui_x11 /
 * is_gui_wayland — both the bash `((is_gui))` checks and the JS globals in
 * software/index.js read what it exports, so a regression here silently changes
 * which GUI apps get installed on every platform.
 *
 * The function is replayed in a hermetic subshell with faked env so we can assert
 * every combination of display server, ssh session, and OS flag.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COMMON_ENV = path.join(ROOT_DIR, "software/bootstrap/common-env.sh");

/** Every flag _detect_gui_flags is responsible for. */
const GUI_FLAGS = ["is_gui", "is_gui_x11", "is_gui_wayland"];

/**
 * Pull the `_detect_gui_flags` definition out of common-env.sh so the test drives
 * the real source rather than a copy. Sourcing the whole file is not an option —
 * its battery-detection cascade shells out to pmset/powershell.exe.
 * @returns {string} the function definition block
 */
function extractDetector() {
  const lines = fs.readFileSync(COMMON_ENV, "utf-8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("function _detect_gui_flags()"));
  if (start === -1) throw new Error("could not locate 'function _detect_gui_flags()' in common-env.sh");
  let close = start + 1;
  while (close < lines.length && lines[close] !== "}") close++;
  if (close === lines.length) throw new Error("could not locate closing brace of _detect_gui_flags");
  return lines.slice(start, close + 1).join("\n");
}

const DETECTOR = extractDetector();

/**
 * Run _detect_gui_flags under a controlled environment and return the resulting flags.
 * @param {Record<string, string>} [env] - env vars to set (e.g. { DISPLAY: ":0" }); everything else is unset
 * @returns {Record<string, number>}
 */
function detectGuiFlags(env = {}) {
  const script = [
    DETECTOR,
    // Clear every input so the host's real session can't leak into the assertions.
    "unset DISPLAY WAYLAND_DISPLAY SSH_CONNECTION SSH_CLIENT is_os_mac is_os_windows",
    "unset BASHRC_FORCE_IS_GUI BASHRC_FORCE_IS_GUI_X11 BASHRC_FORCE_IS_GUI_WAYLAND",
    ...Object.entries(env).map(([k, v]) => `export ${k}=${JSON.stringify(v)}`),
    "_detect_gui_flags",
    ...GUI_FLAGS.map((f) => `echo ${f}=\${${f}:-MISSING}`),
  ].join("\n");

  const out = execFileSync("bash", ["-c", script], { encoding: "utf-8" });
  /** @type {Record<string, number>} */
  const flags = {};
  for (const line of out.trim().split("\n")) {
    const m = line.match(/^(is_gui[a-z0-9_]*)=(.+)$/);
    if (m) flags[m[1]] = Number(m[2]);
  }
  return flags;
}

describe("_detect_gui_flags", () => {
  it("headless linux (no DISPLAY, no WAYLAND_DISPLAY) → everything 0", () => {
    expect(detectGuiFlags()).toEqual({ is_gui: 0, is_gui_x11: 0, is_gui_wayland: 0 });
  });

  it("X11 session → is_gui + is_gui_x11, wayland stays 0", () => {
    expect(detectGuiFlags({ DISPLAY: ":0" })).toEqual({ is_gui: 1, is_gui_x11: 1, is_gui_wayland: 0 });
  });

  it("Wayland session → is_gui + is_gui_wayland, x11 stays 0", () => {
    expect(detectGuiFlags({ WAYLAND_DISPLAY: "wayland-0" })).toEqual({ is_gui: 1, is_gui_x11: 0, is_gui_wayland: 1 });
  });

  it("Wayland with XWayland → both server flags set", () => {
    expect(detectGuiFlags({ DISPLAY: ":0", WAYLAND_DISPLAY: "wayland-0" })).toEqual({
      is_gui: 1,
      is_gui_x11: 1,
      is_gui_wayland: 1,
    });
  });

  it("mac has a desktop session even with no DISPLAY", () => {
    expect(detectGuiFlags({ is_os_mac: "1" })).toEqual({ is_gui: 1, is_gui_x11: 0, is_gui_wayland: 0 });
  });

  it("windows has a desktop session even with no DISPLAY", () => {
    expect(detectGuiFlags({ is_os_windows: "1" })).toEqual({ is_gui: 1, is_gui_x11: 0, is_gui_wayland: 0 });
  });

  it("WSLg sets DISPLAY → counts as x11", () => {
    const flags = detectGuiFlags({ is_os_windows: "1", DISPLAY: ":0" });
    expect(flags.is_gui_x11).toBe(1);
    expect(flags.is_gui).toBe(1);
  });

  it("SSH_CONNECTION forces is_gui=0 even on mac", () => {
    expect(detectGuiFlags({ is_os_mac: "1", SSH_CONNECTION: "10.0.0.1 22 10.0.0.2 22" }).is_gui).toBe(0);
  });

  it("SSH_CLIENT forces is_gui=0 even with a live X11 server", () => {
    expect(detectGuiFlags({ DISPLAY: ":0", SSH_CLIENT: "10.0.0.1 22 22" }).is_gui).toBe(0);
  });

  it("ssh -X keeps is_gui_x11=1 so forwarded xclip still resolves", () => {
    const flags = detectGuiFlags({ DISPLAY: "localhost:10.0", SSH_CONNECTION: "10.0.0.1 22 10.0.0.2 22" });
    expect(flags.is_gui_x11).toBe(1);
    expect(flags.is_gui).toBe(0);
  });

  it("every flag is always a 0/1 integer, never empty or MISSING", () => {
    for (const env of [{}, { DISPLAY: ":0" }, { WAYLAND_DISPLAY: "wayland-0" }, { is_os_mac: "1" }]) {
      const flags = detectGuiFlags(env);
      for (const name of GUI_FLAGS) {
        expect([0, 1], `${name} for ${JSON.stringify(env)}`).toContain(flags[name]);
      }
    }
  });

  it("exports all three flags so node inherits them as env vars", () => {
    const out = execFileSync("bash", ["-c", [DETECTOR, "_detect_gui_flags", "export -p | grep is_gui"].join("\n")], {
      encoding: "utf-8",
    });
    for (const name of GUI_FLAGS) {
      expect(out).toContain(name);
    }
  });

  it("parses under the bash 3.2 floor (/bin/bash)", () => {
    expect(() => execFileSync("/bin/bash", ["-n", COMMON_ENV], { encoding: "utf-8" })).not.toThrow();
  });
});

describe("_detect_gui_flags overrides", () => {
  // run.sh maps --is_gui=0 to BASHRC_FORCE_IS_GUI=0. The override has to be applied
  // INSIDE the detector: $BASH_ENV points every non-interactive bash at
  // ~/.bash_syle_common, so the emitted install script and its node heredocs re-run
  // _detect_gui_flags and would otherwise recompute the detected value back on top.

  it("BASHRC_FORCE_IS_GUI=0 forces headless even with a display attached", () => {
    expect(detectGuiFlags({ DISPLAY: ":0", BASHRC_FORCE_IS_GUI: "0" }).is_gui).toBe(0);
  });

  it("BASHRC_FORCE_IS_GUI=1 forces a GUI even on a headless ssh session", () => {
    expect(detectGuiFlags({ SSH_CONNECTION: "1.2.3.4 22 5.6.7.8 22", BASHRC_FORCE_IS_GUI: "1" }).is_gui).toBe(1);
  });

  it("overrides each flag independently", () => {
    const flags = detectGuiFlags({ BASHRC_FORCE_IS_GUI_X11: "1", BASHRC_FORCE_IS_GUI_WAYLAND: "1" });
    expect(flags.is_gui_x11).toBe(1);
    expect(flags.is_gui_wayland).toBe(1);
    // is_gui is computed before the overrides land, so it stays detected.
    expect(flags.is_gui).toBe(0);
  });

  it("ignores a non 0/1 override rather than coercing it", () => {
    // run.sh normalizes user input to exactly "0" or "1"; anything else is a bug
    // upstream and must not corrupt the flag into a non-integer.
    for (const value of ["", "yes", "true", "2"]) {
      expect(detectGuiFlags({ DISPLAY: ":0", BASHRC_FORCE_IS_GUI: value }).is_gui, `value=${value}`).toBe(1);
    }
  });

  it("survives a re-detect, which is what BASH_ENV triggers on every subshell", () => {
    const script = [
      DETECTOR,
      "unset DISPLAY WAYLAND_DISPLAY SSH_CONNECTION SSH_CLIENT is_os_windows",
      "export is_os_mac=1 BASHRC_FORCE_IS_GUI=0",
      "_detect_gui_flags",
      "_detect_gui_flags",
      "_detect_gui_flags",
      "echo is_gui=$is_gui",
    ].join("\n");
    expect(execFileSync("bash", ["-c", script], { encoding: "utf-8" }).trim()).toBe("is_gui=0");
  });
});

describe("exitIfNoGui", () => {
  // The sandbox loads index.js with no is_gui env var set, so all three flags are
  // false — i.e. the headless case, which is the one the guard exists to catch.
  const exitIfNoGui = getIndexFunction("exitIfNoGui");

  it("all three flags default to false when the env vars are absent", () => {
    expect(getIndexConstant("is_gui")).toBe(false);
    expect(getIndexConstant("is_gui_x11")).toBe(false);
    expect(getIndexConstant("is_gui_wayland")).toBe(false);
  });

  it("throws ScriptSkipError on a headless host so the runner skips the script", () => {
    expect(() => exitIfNoGui()).toThrow(/No GUI display available/);
    try {
      exitIfNoGui();
    } catch (e) {
      // ScriptSkipError is caught by the per-script try/catch as a clean skip;
      // any other error name would fail the whole run instead.
      expect(e.name).toBe("ScriptSkipError");
    }
  });

  it("names the specific display server in x11 / wayland mode", () => {
    expect(() => exitIfNoGui("x11")).toThrow(/No x11 display server available/);
    expect(() => exitIfNoGui("wayland")).toThrow(/No wayland display server available/);
  });

  it("rejects an unknown mode with a hard error, not a silent skip", () => {
    let caught;
    try {
      exitIfNoGui("xorg");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.name).not.toBe("ScriptSkipError");
    expect(caught.message).toMatch(/unknown mode 'xorg'/);
  });
});
