/** Verifies the Bash timeout inherited by real OpenCode wrapper invocations. */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { describe, expect, it } from "vitest";

/** Managed wrapper source evaluated in an isolated shell. */
const PROFILE = path.resolve("software/scripts/advanced/llm/opencode/opencode.profile.bash");

/**
 * Observe child and parent timeout values through the real wrapper and a private binary.
 * @param {string | undefined} override Caller timeout override; undefined leaves it unset.
 * @param {string} invocation Wrapper command or readable-file prompt invocation.
 * @returns {{status: number | null, stderr: string, stdout: string}} Process status and timeout observations.
 * @throws {Error} If fixture filesystem operations fail.
 * Creates and removes a private temporary folder; never starts the real OpenCode client.
 */
function runWrapper(override, invocation) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-timeout-"));
  try {
    fs.writeFileSync(
      path.join(folder, "opencode"),
      '#!/bin/bash\nprintf "child=%s\\n" "${OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS-unset}"\n',
    );
    fs.chmodSync(path.join(folder, "opencode"), 0o755);
    const prompt = path.join(folder, "prompt.md");
    fs.writeFileSync(prompt, "Inspect tests.");
    const env = { ...process.env, PATH: `${folder}:${process.env.PATH}`, BASH_ENV: "", PROMPT_FILE: prompt };
    delete env.OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS;
    if (override !== undefined) env.OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = override;
    return spawnSync(
      "/bin/bash",
      [
        "-c",
        `function llm_setup_activate() { return 0; }
. "$1"
${invocation}
printf 'parent=%s\\n' "\${OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS-unset}"`,
        "test",
        PROFILE,
      ],
      {
        env,
        encoding: "utf8",
        timeout: 5000,
      },
    );
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

describe("OpenCode Bash default timeout", () => {
  it.each(["opencode run 'Inspect tests'", 'opencode "$PROMPT_FILE"'])(
    "defaults to twenty minutes through %s without leaking",
    (invocation) => {
      const result = runWrapper(undefined, invocation);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe("child=1200000\nparent=unset\n");
    },
  );

  it("preserves an explicit caller timeout", () => {
    const result = runWrapper("60000", "opencode --version");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("child=60000\nparent=60000\n");
  });

  it("uses the default for an empty override without changing the parent", () => {
    const result = runWrapper("", "opencode --version");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("child=1200000\nparent=\n");
  });
});
