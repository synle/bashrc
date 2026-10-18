/** Autocomplete spec file validation tests. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ---- load SPEC_COMMANDS and known tokens from autocomplete.common.js ----
const commonSource = fs.readFileSync("software/metadata/autocomplete.common.js", "utf-8");

/**
 * The single declaration of $SY_ROOT_FOLDER (software/bootstrap/common-env.sh). Profile
 * partials assume it was sourced first — sourcing it in every generated test script keeps
 * that contract without a second literal here.
 */
const COMMON_ENV_PATH = path.resolve("software/bootstrap/common-env.sh");

// extract SPEC_COMMANDS array by evaluating the file in a sandbox
const vm = await import("vm");
const sandbox = {};
vm.default.runInNewContext(commonSource.replace(/^(const|let) /gm, "var ").replace(/^function /gm, "var _fn = function "), sandbox);
const SPEC_COMMANDS = sandbox.SPEC_COMMANDS;

/** Valid dynamic tokens — loaded from autocomplete.common.js DYNAMIC_TOKENS (single source of truth). */
const VALID_TOKENS = new Set(sandbox.DYNAMIC_TOKENS);

/** Unique spec file paths referenced by SPEC_COMMANDS (excludes specCommand proxies). */
const uniqueSpecFiles = [...new Set(SPEC_COMMANDS.map((c) => c.specFile).filter(Boolean))];

// ---- tests ----

describe("SPEC_COMMANDS integrity", () => {
  it("should reference spec files that exist on disk", () => {
    const missing = uniqueSpecFiles.filter((f) => !fs.existsSync(f));
    expect(missing, `Missing spec files: ${missing.join(", ")}`).toEqual([]);
  });

  it("should have matching spec files for all files in the spec directory", () => {
    const specDir = "software/metadata/autocomplete-complete-spec";
    const filesOnDisk = fs.readdirSync(specDir).map((f) => path.join(specDir, f));
    const referenced = new Set(uniqueSpecFiles);
    const unreferenced = filesOnDisk.filter((f) => !referenced.has(f));
    expect(unreferenced, `Spec files not referenced in SPEC_COMMANDS: ${unreferenced.join(", ")}`).toEqual([]);
  });

  it("should be sorted alphabetically by command name within each group", () => {
    const groups = [];
    let current = [];
    for (const entry of SPEC_COMMANDS) {
      current.push(entry.command);
    }
    // Split into groups by detecting sort breaks
    const allCommands = SPEC_COMMANDS.map((c) => c.command);
    const groupedCommands = [];
    let group = [allCommands[0]];
    for (let i = 1; i < allCommands.length; i++) {
      if (allCommands[i].localeCompare(allCommands[i - 1]) >= 0) {
        group.push(allCommands[i]);
      } else {
        groupedCommands.push(group);
        group = [allCommands[i]];
      }
    }
    groupedCommands.push(group);
    for (const g of groupedCommands) {
      const sorted = [...g].sort((a, b) => a.localeCompare(b));
      expect(g, `Group starting with "${g[0]}" is not sorted`).toEqual(sorted);
    }
  });

  it("should only use valid os values", () => {
    const validOs = new Set(["mac", "linux", "windows"]);
    const invalid = [];
    for (const { command, os } of SPEC_COMMANDS) {
      if (!os) continue;
      for (const part of os.split(",")) {
        if (!validOs.has(part)) invalid.push(`command:invalidos"{part}"`);
      }
    }
    expect(invalid, `Invalid os values`).toEqual([]);
  });

  it("should have either specFile or specCommand for every entry", () => {
    const invalid = SPEC_COMMANDS.filter((c) => !c.specFile && !c.specCommand);
    expect(
      invalid.map((c) => c.command),
      `Entries missing both specFile and specCommand`,
    ).toEqual([]);
  });

  it("should have specCommand references that point to existing commands with specFile", () => {
    const commandsWithSpecFile = new Set(SPEC_COMMANDS.filter((c) => c.specFile).map((c) => c.command));
    const invalid = SPEC_COMMANDS.filter((c) => c.specCommand && !commandsWithSpecFile.has(c.specCommand));
    expect(
      invalid.map((c) => `${c.command} -> ${c.specCommand}`),
      `specCommand references to non-existent commands`,
    ).toEqual([]);
  });

  it("should not have duplicate command names", () => {
    const seen = new Set();
    const duplicates = [];
    for (const { command } of SPEC_COMMANDS) {
      if (seen.has(command)) duplicates.push(command);
      seen.add(command);
    }
    expect(duplicates, `Duplicate commands: ${duplicates.join(", ")}`).toEqual([]);
  });
});

describe("spec file formatting", () => {
  for (const specFile of uniqueSpecFiles) {
    const basename = path.basename(specFile);

    describe(basename, () => {
      const content = fs.readFileSync(specFile, "utf-8");
      const lines = content.split("\n");

      it("should not have trailing whitespace on any line", () => {
        const bad = lines.map((line, i) => ({ line, num: i + 1 })).filter(({ line }) => line !== line.trimEnd());
        expect(
          bad.map((b) => `line ${b.num}`),
          `Lines with trailing whitespace`,
        ).toEqual([]);
      });

      it("should not end with multiple trailing newlines", () => {
        expect(content.endsWith("\n\n"), "File should not end with multiple newlines").toBe(false);
      });

      it("should allow at most one blank line, used only as a separator before the macro section", () => {
        // Allow trailing newline; allow ONE blank line iff it immediately precedes the
        // first `>__name__|...` macro definition line (sections: commands / blank / macros).
        const trimmed = content.replace(/\n$/, "");
        const allLines = trimmed.split("\n");
        const blankIndices = allLines.map((line, i) => ({ line, num: i + 1 })).filter(({ line }) => line.trim() === "");
        if (blankIndices.length === 0) return;
        expect(blankIndices.length, `Multiple blank lines found`).toBeLessThanOrEqual(1);
        const blankIdx = blankIndices[0].num - 1;
        const nextNonBlank = allLines.slice(blankIdx + 1).find((l) => l.trim() !== "");
        expect(
          nextNonBlank && nextNonBlank.trim().startsWith(">"),
          `Blank line at line ${blankIdx + 1} is not a macro-section separator`,
        ).toBe(true);
      });

      it("should not have duplicate prefixes (left of |)", () => {
        const prefixes = new Map();
        const duplicates = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const prefix = trimmed.split("|")[0];
          if (prefixes.has(prefix)) {
            duplicates.push(`"${prefix}" on lines ${prefixes.get(prefix)} and ${lines.indexOf(line) + 1}`);
          } else {
            prefixes.set(prefix, lines.indexOf(line) + 1);
          }
        }
        expect(duplicates, `Duplicate prefixes`).toEqual([]);
      });

      it("should only use valid dynamic tokens or local macros", () => {
        // First pass: collect macro definitions (`>__name__|...` lines).
        const localMacros = new Set();
        for (const line of lines) {
          const trimmed = line.trim();
          const m = trimmed.match(/^>(__[a-zA-Z0-9_]+__)\|/);
          if (m) localMacros.add(m[1]);
        }
        const allowedTokens = new Set([...VALID_TOKENS, ...localMacros]);

        // Second pass: validate every `__token__` reference on command and macro lines.
        const invalid = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Strip leading `>__name__` for macro lines so we only validate RHS tokens.
          const body = trimmed.startsWith(">") ? trimmed.replace(/^>(__[a-zA-Z0-9_]+__)\|/, "|") : trimmed;
          const parts = body.split("|");
          if (parts.length < 2 || !parts[1]) continue;
          const completions = parts[1].split(",");
          for (const token of completions) {
            const t = token.trim();
            if (t.startsWith("__") && t.endsWith("__") && !allowedTokens.has(t)) {
              invalid.push(`tin"{trimmed}"`);
            }
          }
        }
        expect(invalid, `Invalid dynamic tokens`).toEqual([]);
      });

      it("should not have trailing pipe characters", () => {
        const bad = lines.map((line, i) => ({ line, num: i + 1 })).filter(({ line }) => line.trim().endsWith("|"));
        expect(
          bad.map((b) => `line b.num:"{lines[b.num - 1]}"`),
          `Lines with trailing pipe`,
        ).toEqual([]);
      });
    });
  }
});

// ---- dynamic token expansion (bash integration tests) ----

/** Shared spec-based autocomplete helpers (emitted once before per-command wrappers). */
const commonContent = fs.readFileSync("software/scripts/advanced/bash-autocomplete-complete-spec.common.bash", "utf-8");
/** Per-command wrapper template from the bash autocomplete template file. */
const templateContent =
  commonContent + "\n" + fs.readFileSync("software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash", "utf-8");

/**
 * Builds a bash script that sources a completion function and simulates tab completion.
 * @param {string} specContent - Spec file content to embed.
 * @param {string[]} compWords - Simulated COMP_WORDS array.
 * @param {number} compCword - Index of the word being completed.
 * @param {string} [setupCode] - Extra bash setup code to run before completion.
 * @returns {string} Bash script that prints COMPREPLY entries one per line.
 */
function buildCompletionTestScript(specContent, compWords, compCword, setupCode = "") {
  const funcBody = templateContent
    .split("{{COMMAND}}")
    .join("testcmd")
    .split("{{SPEC_CONTENT}}")
    .join(specContent)
    .split("{{MAX_NESTED_DEPTH}}")
    .join("3");
  return `#!/usr/bin/env bash
set -uo pipefail
source "${COMMON_ENV_PATH}"
source "${process.cwd()}/software/scripts/bash-fzf.profile.bash"
${setupCode}
${funcBody}
COMP_WORDS=(${compWords.map((w) => `"${w}"`).join(" ")})
COMP_CWORD=${compCword}
__spec_complete_testcmd
for r in "\COMPREPLY[@]";doecho"r"; done
`;
}

/**
 * Runs a bash completion test script and returns COMPREPLY as an array of strings.
 * @param {string} script - Bash script content.
 * @param {object} [options] - Options for execSync.
 * @param {string} [options.cwd] - Working directory.
 * @returns {string[]} Completion results.
 */
function runCompletionScript(script, options = {}) {
  const result = execSync("bash", { input: script, encoding: "utf-8", timeout: 10000, ...options });
  return result
    .trim()
    .split("\n")
    .filter((l) => l !== "");
}
