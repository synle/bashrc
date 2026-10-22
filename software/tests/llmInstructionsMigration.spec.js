import { describe, expect, it } from "vitest";
import { fileSystem, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

/** Existing deployment surfaces must retain their locations after the source move. */
const CLIENTS = [
  { cli: "claude", helper: "_doInstructionsWork", folder: "/mock/home/.claude", file: "CLAUDE.md", prepend: false },
  { cli: "copilot", helper: "_doCopilotInstructionsWork", folder: "/mock/home/.copilot", file: "copilot-instructions.md", prepend: true },
  { cli: "gemini", helper: "_doGeminiInstructionsWork", folder: "/mock/home/.gemini", file: "GEMINI.md", prepend: false },
  { cli: "opencode", helper: "_doOpencodeInstructionsWork", folder: "/mock/home/.config/opencode", file: "AGENTS.md", prepend: false },
  { cli: "pi", helper: "_doPiInstructionsWork", folder: "/mock/home/.pi/agent", file: "AGENTS.md", prepend: false },
];

/** Source-path markers are migration input, not an active reference to the previous file. */
const PREVIOUS_MARKER = "synle/bashrc | software/scripts/advanced/llm/_common/instructions.md";
/** The managed block identifies the current repository source. */
const CURRENT_MARKER = "synle/bashrc | software/scripts/advanced/llm/_common/v_current/instructions.md";

/**
 * Formats a deployed block using the existing Markdown marker protocol.
 * @param {string} marker - Managed block key.
 * @param {string} body - Instruction content.
 * @returns {string} A complete block with a trailing newline.
 */
function block(marker, body) {
  return `<!-- BEGIN ${marker} -->\n${body}\n<!-- END ${marker} -->\n`;
}

describe.each(CLIENTS)("$cli instruction-source migration", ({ cli, helper, folder, file, prepend }) => {
  it.each([PREVIOUS_MARKER, "managed-rules", CURRENT_MARKER])(
    "replaces %s without losing user content and stays idempotent",
    async (marker) => {
      loadScriptHelpers(`software/scripts/advanced/llm/${cli}/setup.js`);
      setSandboxGlobal("getLLMCustomInstructions", async () => "current guidance");
      setSandboxGlobal("backupConfigFile", async () => {});
      const target = `${folder}/${file}`;
      fileSystem[target] = `user preface\n\n${block(marker, "previous guidance")}\nuser ending\n`;

      await getIndexFunction(helper)(folder);

      const expected = prepend
        ? `${block(CURRENT_MARKER, "current guidance")}\nuser preface\n\nuser ending\n`
        : `user preface\n\nuser ending\n\n${block(CURRENT_MARKER, "current guidance")}`;
      // An existing current block is updated in place except Copilot's intentional prepend.
      const expectedInPlace = `user preface\n\n${block(CURRENT_MARKER, "current guidance")}\nuser ending\n`;
      // writeText normalizes surrounding whitespace; compare every nonempty line in order.
      expect(fileSystem[target].split("\n").filter(Boolean)).toEqual(
        (marker === CURRENT_MARKER && !prepend ? expectedInPlace : expected).split("\n").filter(Boolean),
      );

      const first = fileSystem[target];
      await getIndexFunction(helper)(folder);
      expect(fileSystem[target]).toBe(first);
    },
  );
});
