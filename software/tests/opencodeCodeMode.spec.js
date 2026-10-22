/** Verifies Code Mode defaults and argument forwarding through the OpenCode wrapper. */

import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { describe, expect, it } from "vitest";

/** Absolute source of the managed wrapper under test. */
const OPENCODE_PROFILE = path.resolve("software/scripts/advanced/llm/opencode/opencode.profile.bash");

/**
 * Runs the real Bash wrapper with a fixture binary that reports its flag and arguments.
 * Always removes its temporary home and keeps inherited shell initialization disabled.
 * @param {string | undefined} flag - Caller override, or undefined to leave the flag unset.
 * @param {string} invocation - Shell invocation against the fixture command.
 * @returns {string} Child flag, forwarded arguments, and parent flag after the call.
 */
function runWrapper(flag, invocation) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-code-mode-"));
  try {
    const binary = path.join(folder, "opencode");
    const prompt = path.join(folder, "prompt with spaces.md");
    fs.writeFileSync(binary, '#!/bin/bash\nprintf "mode=%s\\n" "${OPENCODE_EXPERIMENTAL_CODE_MODE-unset}"\nprintf "<%s>\\n" "$@"\n');
    fs.chmodSync(binary, 0o755);
    fs.writeFileSync(prompt, "Read this prompt.\nKeep both lines.");
    const env = { ...process.env, PATH: `${folder}:${process.env.PATH}`, PROMPT_FILE: prompt };
    delete env.BASH_ENV;
    delete env.OPENCODE_EXPERIMENTAL_CODE_MODE;
    if (flag !== undefined) env.OPENCODE_EXPERIMENTAL_CODE_MODE = flag;
    const script = [
      "function llm_setup_activate() { return 0; }",
      `source ${JSON.stringify(OPENCODE_PROFILE)}`,
      `source ${JSON.stringify(OPENCODE_PROFILE)}`,
      invocation,
      'printf "parent=%s\\n" "${OPENCODE_EXPERIMENTAL_CODE_MODE-unset}"',
    ].join("\n");
    return execFileSync("/bin/bash", ["-O", "expand_aliases", "-c", script], { env, encoding: "utf-8" });
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

describe("OpenCode Code Mode wrapper", () => {
  it("enables Code Mode by default without leaking the flag into the caller", () => {
    expect(runWrapper(undefined, 'opencode run "two words"')).toBe("mode=1\n<run>\n<two words>\nparent=unset\n");
  });

  it("preserves an explicit opt-out", () => {
    expect(runWrapper("0", "opencode --version")).toBe("mode=0\n<--version>\nparent=0\n");
  });

  it("preserves an explicitly enabled flag", () => {
    expect(runWrapper("1", "opencode --version")).toBe("mode=1\n<--version>\nparent=1\n");
  });

  it("uses the enabled default for an empty override without changing the caller", () => {
    expect(runWrapper("", "opencode --version")).toBe("mode=1\n<--version>\nparent=\n");
  });

  it("enables Code Mode through the op alias after repeated profile sourcing", () => {
    expect(runWrapper(undefined, "eval 'op --version'")).toBe("mode=1\n<--version>\nparent=unset\n");
  });

  it.each([
    [undefined, "1", "unset"],
    ["0", "0", "0"],
  ])("forwards readable-file prompts with caller flag %s", (flag, expected, parent) => {
    expect(runWrapper(flag, 'opencode "$PROMPT_FILE"')).toBe(
      `mode=${expected}\n<--prompt>\n<Read this prompt.\nKeep both lines.>\nparent=${parent}\n`,
    );
  });
});
