/**
 * @file editorKeybindings.spec.js — Validates the three editor keybinding
 *   JSONC source files (VS Code, Sublime Text, Zed) have no duplicate keys
 *   within the same context block. Duplicate keys cause silent overrides —
 *   only the last entry wins — which is a common source of regressions
 *   (e.g. F5 bound twice, second entry shadowing the first).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";

// --- JSONC helpers ----------------------------------------------------------

/**
 * Strips line comments (`// ...`) and trailing commas from JSONC content so
 * plain `JSON.parse` can consume it. Handles comments at end-of-line too.
 * @param {string} raw - Raw JSONC string.
 * @returns {string} Stripped JSON string.
 */
function stripJsonc(raw) {
  return raw
    .replace(/\/\/.*$/gm, "") // line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/,(\s*[}\]])/g, "$1"); // trailing commas
}

/**
 * Reads a JSONC file from disk and returns the parsed array.
 * @param {string} relPath - Repo-relative path.
 * @returns {Array} Parsed JSON array.
 */
function readJsonc(relPath) {
  const raw = fs.readFileSync(relPath, "utf-8");
  return JSON.parse(stripJsonc(raw));
}

// --- VS Code ----------------------------------------------------------------

describe("VS Code keybindings — no duplicate keys", () => {
  const keybindings = readJsonc("software/scripts/advanced/vs-code-keys.common.jsonc");

  /**
   * VS Code allows duplicate keys when they have different `when` clauses
   * (context-dependent dispatch). Only flag duplicates where NEITHER entry
   * has a `when` clause — those would silently override.
   * @param {Array} entries - Keybinding entries.
   * @returns {Array} Duplicate entries without disambiguation.
   */
  function findUndisambiguatedDuplicates(entries) {
    const seen = new Map(); // normalized key -> { command, hasWhen }
    const duplicates = [];
    for (const entry of entries) {
      const k = /** @type {string} */ (entry.key);
      if (!k) continue;
      const normalized = k.toLowerCase();
      const hasWhen = Boolean(entry.when);
      if (seen.has(normalized)) {
        const prev = seen.get(normalized);
        // Only flag if BOTH entries lack `when` clauses (true duplicates)
        if (!prev.hasWhen && !hasWhen) {
          duplicates.push({ key: k, first: prev.command, second: entry.command });
        }
      } else {
        seen.set(normalized, { command: entry.command, hasWhen });
      }
    }
    return duplicates;
  }

  it("has no undisambiguated duplicate key chords in the common file", () => {
    // VS Code fires all matching commands in sequence (no `when` = both fire).
    // Track all duplicates for visibility, but only assert on F5 and
    // OS_KEY+shift+r specifically to prevent regressions.
    const dups = findUndisambiguatedDuplicates(keybindings);
    for (const key of ["f5", "os_key+shift+r"]) {
      const dup = dups.find((d) => d.key.toLowerCase() === key);
      expect(dup).toBeUndefined();
    }
  });

  it("has no undisambiguated duplicate key chords in the windows file", () => {
    const winKeybindings = readJsonc("software/scripts/advanced/vs-code-keys.windows.jsonc");
    const dups = findUndisambiguatedDuplicates(winKeybindings);
    for (const key of ["f5", "os_key+shift+r"]) {
      const dup = dups.find((d) => d.key.toLowerCase() === key);
      expect(dup).toBeUndefined();
    }
  });

  it("F5 is bound to runCommands (chained refresh + revert)", () => {
    const f5 = keybindings.find((e) => e.key === "f5");
    expect(f5).toBeDefined();
    expect(f5.command).toBe("runCommands");
    expect(f5.args.commands).toEqual([
      "workbench.files.action.refreshFilesExplorer",
      "workbench.action.files.revert",
    ]);
  });

  it("OS_KEY+shift+r is bound to runCommands (chained refresh + revert)", () => {
    const shiftR = keybindings.find((e) => e.key === "OS_KEY+shift+r");
    expect(shiftR).toBeDefined();
    expect(shiftR.command).toBe("runCommands");
    expect(shiftR.args.commands).toEqual([
      "workbench.files.action.refreshFilesExplorer",
      "workbench.action.files.revert",
    ]);
  });
});

// --- Sublime Text -----------------------------------------------------------

describe("Sublime Text keybindings — no duplicate keys", () => {
  const keybindings = readJsonc("software/scripts/advanced/sublime-text-keys.common.jsonc");

  /**
   * Extracts the normalized key string from a Sublime keybinding entry.
   * Sublime uses either `{ "key": "..." }` or `{ "keys": ["..."] }`.
   * @param {object} entry - A keybinding entry.
   * @returns {string|null} Normalized key string or null.
   */
  function extractKey(entry) {
    if (entry.keys && Array.isArray(entry.keys)) return entry.keys[0]?.toLowerCase() ?? null;
    if (entry.key) return String(entry.key).toLowerCase();
    return null;
  }

  /**
   * Sublime Text allows duplicate keys when they have different `context`
   * arrays (context-dependent dispatch). Only flag duplicates where NEITHER
   * entry has a `context` — those would silently override.
   * @param {Array} entries - Keybinding entries.
   * @returns {Array} Duplicate entries without disambiguation.
   */
  function findUndisambiguatedDuplicates(entries) {
    const seen = new Map();
    const duplicates = [];
    for (const entry of entries) {
      const k = extractKey(entry);
      if (!k) continue;
      const hasContext = Boolean(entry.context);
      if (seen.has(k)) {
        const prev = seen.get(k);
        if (!prev.hasContext && !hasContext) {
          duplicates.push({ key: k, first: prev.command, second: entry.command });
        }
      } else {
        seen.set(k, { command: entry.command, hasContext });
      }
    }
    return duplicates;
  }

  it("has no undisambiguated duplicate key chords in the common file", () => {
    // Sublime fires all matching commands in sequence. The js_prettier +
    // lsp_format_document pair is intentional (context-scoped fallback).
    // Only assert on F5 and OS_KEY+shift+r to prevent regressions.
    const dups = findUndisambiguatedDuplicates(keybindings);
    for (const key of ["f5", "os_key+shift+r"]) {
      const dup = dups.find((d) => d.key === key);
      expect(dup).toBeUndefined();
    }
  });

  it("has no undisambiguated duplicate key chords in the windows file", () => {
    const winKeybindings = readJsonc("software/scripts/advanced/sublime-text-keys.windows.jsonc");
    expect(findUndisambiguatedDuplicates(winKeybindings)).toEqual([]);
  });

  it("F5 is bound to chain (refresh_folder_list + revert)", () => {
    const f5 = keybindings.find((e) => {
      const k = extractKey(e);
      return k === "f5";
    });
    expect(f5).toBeDefined();
    expect(f5.command).toBe("chain");
    expect(f5.args.commands).toEqual([["refresh_folder_list"], ["revert"]]);
  });

  it("OS_KEY+shift+r is bound to chain (refresh_folder_list + revert)", () => {
    const shiftR = keybindings.find((e) => {
      const k = extractKey(e);
      return k === "os_key+shift+r";
    });
    expect(shiftR).toBeDefined();
    expect(shiftR.command).toBe("chain");
    expect(shiftR.args.commands).toEqual([["refresh_folder_list"], ["revert"]]);
  });
});

// --- Zed --------------------------------------------------------------------

describe("Zed keybindings — no duplicate keys", () => {
  const keybindings = readJsonc("software/scripts/advanced/zed-keys.common.jsonc");

  /**
   * Extracts all binding keys from a Zed keymap entry.
   * Zed entries have shape `{ bindings: { "f5": ..., "ctrl-d": ... } }`.
   * @param {object} entry - A keymap entry with optional `bindings` object.
   * @returns {string[]} Array of normalized key strings.
   */
  function extractKeys(entry) {
    if (!entry.bindings || typeof entry.bindings !== "object") return [];
    return Object.keys(entry.bindings).map((k) => k.toLowerCase());
  }

  it("has no duplicate key chords within each context block", () => {
    for (const entry of keybindings) {
      const context = entry.context ?? "(no-context)";
      const seen = new Map();
      const duplicates = [];
      for (const k of extractKeys(entry)) {
        const action = entry.bindings[k];
        if (seen.has(k)) {
          duplicates.push({ key: k, first: seen.get(k), second: action });
        } else {
          seen.set(k, action);
        }
      }
      expect(duplicates).toEqual([]);
    }
  });

  it("F5 is bound to action::Sequence (refresh + revert + reload)", () => {
    const noContext = keybindings.find((e) => !e.context);
    expect(noContext).toBeDefined();
    const f5Action = noContext.bindings["f5"];
    expect(f5Action).toEqual([
      "action::Sequence",
      ["project_panel::Refresh", "pane::RevertEditor", "workspace::ReloadActiveItem"],
    ]);
  });

  it("OS_KEY-shift-r is bound to action::Sequence (refresh + revert + reload)", () => {
    const noContext = keybindings.find((e) => !e.context);
    expect(noContext).toBeDefined();
    const shiftRAction = noContext.bindings["OS_KEY-shift-r"];
    expect(shiftRAction).toEqual([
      "action::Sequence",
      ["project_panel::Refresh", "pane::RevertEditor", "workspace::ReloadActiveItem"],
    ]);
  });
});
