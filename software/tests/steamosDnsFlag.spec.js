/** Isolated Bash flag contract: manual SteamOS identity survives shared bootstrap detection. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";

/** Actual SteamOS assignment and override, ending before unrelated distro detection. @type {string} */
const detectionSource = fs
  .readFileSync("run.sh", "utf8")
  .split('is_os_steamos=0 && _detect_os --name "steamos" && is_os_steamos=1')[1]
  .split("is_os_redhat=0")[0];

/** Real assignment paired with the extracted override; no filesystem probes or service calls. @type {string} */
const steamDetectionSource = 'is_os_steamos=0 && _detect_os --name "steamos" && is_os_steamos=1' + detectionSource;

/** Real snapshot loop, which persists flags for child shells and sudo Node installers. @type {string} */
const snapshotSource = fs.readFileSync("run.sh", "utf8").split('os_flags=""')[1].split("unset var")[0];

describe("SteamOS identity through shared bootstrap", () => {
  it.each([
    ["manual SteamOS on an Arch-derived system", "1", "1", "0", "1"],
    ["explicit opt-out on SteamOS", "0", "1", "1", "0"],
    ["normal SteamOS detection", "", "0", "1", "1"],
    ["normal non-SteamOS detection", "", "1", "0", "0"],
    ["invalid override does not enable SteamOS", "true", "0", "0", "0"],
    ["invalid override does not disable detected SteamOS", "invalid", "0", "1", "1"],
  ])("persists the correct flag for %s", (_label, override, inherited, detected, expected) => {
    const result = spawnSync(
      "/bin/bash",
      [
        "-c",
        `
function _detect_os() { [ "$DETECTED_STEAMOS" = 1 ]; }
${steamDetectionSource}
os_flags=""
${snapshotSource}
eval "$os_flags"
printf 'flag=%s child=' "$is_os_steamos"
/bin/bash -c 'printf "%s\\n" "$is_os_steamos"'
`,
      ],
      {
        encoding: "utf8",
        timeout: 5000,
        env: {
          PATH: "/usr/bin:/bin",
          BASH_ENV: "",
          _IS_OS_STEAMOS_OVERRIDE: override,
          is_os_steamos: inherited,
          DETECTED_STEAMOS: detected,
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(`flag=${expected} child=${expected}\n`);
  });
});
