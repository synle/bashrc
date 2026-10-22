/** Behavioral checks for Copilot's background-task wait budget at the executable boundary. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Repository-owned Copilot shell wrapper. */
const PROFILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/advanced/llm/copilot/copilot.profile.bash");

/**
 * Invoke the real wrapper with a recording executable, without starting an agent.
 * @param {string | undefined} timeout - Caller-supplied wait budget; undefined means unset.
 * @returns {import("child_process").SpawnSyncReturns<string>} Child output and exit status.
 */
function runCopilot(timeout) {
  const folder = mkdtempSync(path.join(os.tmpdir(), "copilot-task-wait-"));
  try {
    writeFileSync(
      path.join(folder, "copilot"),
      "#!/bin/bash\\nif [ -n "$COPILOT_TASK_WAIT_TIMEOUT_SECONDS" ]; then\\n  printf "%s" "$COPILOT_TASK_WAIT_TIMEOUT_SECONDS"\\nelse\\n  printf "3600"\\nfi\\nprintf " --autopilot --allow-all -p \"'audit settings; keep WIP'\\\\n\" 1\u003e\u00262\\nexit 7\\n",\n      {
        mode: 0o755,
      },
    });
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-c",
        `function llm_setup_activate() { return 0; }
${readFileSync(PROFILE, "utf8")}
copilot -p 'audit settings; keep WIP'
status=$?
printf '%s\\0' "parent=\${COPILOT_TASK_WAIT_TIMEOUT_SECONDS-unset}"
exit "$status"`,
      ],
      { cwd: folder, env, encoding: "utf8", timeout: 5000 },
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe("Copilot background-task wait budget", () => {
  it.each([
    [undefined, "3600", "parent=3600"],
    ["", "3600", "parent=3600"],
    ["7200", "7200", "parent=7200"],
  ])("exports the intended budget for caller value %j to the shell and child process", (input, expected, parent) => {
    const result = runCopilot(input);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(7);
    expect(result.stdout.split("\0")).toEqual([expected, "--autopilot", "--allow-all", "-p", "audit settings; keep WIP", parent, ""]);
  });
});
