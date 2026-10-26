/** Pins versioned native observations to their exact Sy inputs; snapshots are evidence, not a substitute for live UI checks. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import crypto from "crypto";
import ts from "typescript";

/** Parses controlled JSONC without silently accepting syntax errors. */
function read(file) {
  const parsed = ts.parseConfigFileTextToJson(file, fs.readFileSync(file, "utf8"));
  if (parsed.error) throw new Error(`Invalid native evidence input: ${file}`);
  return parsed.config;
}
/** Hashes source bytes so a palette/template edit invalidates previously accepted native observations. */
function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const evidence = read("theme/native-consumption.jsonc");

describe.each(["dark", "light"])("%s native consumption evidence", (mode) => {
  it.each(["sublime", "vscode", "claude"])("binds %s observations to the exact active template", (app) => {
    expect(evidence[app].modes.find((record) => record.mode === mode).sourceSha256).toBe(digest(`theme/sy/${app}_${mode}.jsonc`));
  });

  it("records every configured Claude override surviving the installed native merger", () => {
    const source = read(`theme/sy/claude_${mode}.jsonc`);
    const result = evidence.claude.modes.find((record) => record.mode === mode);
    expect(result.ignored).toEqual([]);
    expect(result.overrides).toBe(Object.keys(source.overrides).length);
    expect(Object.keys(source.overrides).filter((key) => !evidence.claude.allowedTokens.includes(key))).toEqual([]);
    expect(evidence.claude.remaining).toContain("interactive TUI");
  });

  it("records native semantic overrides winning and standard types falling through TextMate", () => {
    const rules = read(`theme/sy/vscode_${mode}.jsonc`)["editor.semanticTokenColorCustomizations"].rules;
    const result = evidence.vscode.modes.find((record) => record.mode === mode);
    expect(result.tokens.filter((token) => token.source === "setting")).toEqual([
      { type: "newOperator", foreground: rules.newOperator, source: "setting" },
      { type: "stringLiteral", foreground: rules.stringLiteral, source: "setting" },
      { type: "customLiteral", foreground: rules.customLiteral, source: "setting" },
      { type: "numberLiteral", foreground: rules.numberLiteral, source: "setting" },
    ]);
    expect(result.tokens.filter((token) => token.source === "TextMate fallback").map((token) => token.type)).toEqual([
      "class",
      "interface",
      "typeParameter",
      "enum",
      "namespace",
      "variable",
      "parameter",
      "property",
      "enumMember",
      "function",
      "method",
      "string",
      "number",
      "operator",
      "keyword",
    ]);
    expect(result.selectorControl.before).toBe(rules.newOperator);
    expect(result.selectorControl.wrongSelector).not.toBe(rules.newOperator);
    expect(result.semanticHighlighting).toBe(true);
  });

  it("records real Sublime grammar scopes and readable global selection/find overrides", () => {
    const result = evidence.sublime.modes.find((record) => record.mode === mode);
    const source = read(`theme/sy/sublime_${mode}.jsonc`);
    expect(result.grammars.map((grammar) => [grammar.name, grammar.scopes.length])).toEqual([
      ["JavaScript", 23],
      ["Python", 21],
      ["HTML", 12],
      ["CSS", 14],
    ]);
    const scopes = result.grammars.flatMap((grammar) => grammar.scopes);
    expect(scopes.filter((scope) => scope.foreground === result.globals.foreground)).toHaveLength(25);
    expect(scopes.filter((scope) => scope.inheritsForeground)).toHaveLength(21);
    expect(scopes.filter((scope) => scope.inheritsForeground && scope.sourceLine !== -1)).toEqual([]);
    expect(scopes.filter((scope) => scope.inheritsForeground && scope.foreground !== result.globals.foreground)).toEqual([]);
    expect(result.globals.findForeground).toBe(source.globals.find_highlight_foreground);
    expect(source.globals.selection_foreground).toBe("var(fg)");
    expect(result.globals.selectionForeground).toBe(source.variables.fg);
    expect(evidence.sublime.ui.status).toBe("derived_chrome_not_visually_verified");
  });
});

it("records the native Sublime comment foreground and source for both appearances", () => {
  expect(
    evidence.sublime.modes.map((record) => ({
      mode: record.mode,
      comment: record.grammars
        .flatMap((grammar) => grammar.scopes)
        .find((scope) => scope.scope === "source.js comment.line.double-slash.js"),
    })),
  ).toMatchInlineSnapshot(`
    [
      {
        "comment": {
          "foreground": "#76a762",
          "inheritsForeground": false,
          "scope": "source.js comment.line.double-slash.js",
          "source": "Packages/User/Sy Dark.sublime-color-scheme",
          "sourceLine": 85,
        },
        "mode": "dark",
      },
      {
        "comment": {
          "foreground": "#004a15",
          "inheritsForeground": false,
          "scope": "source.js comment.line.double-slash.js",
          "source": "Packages/User/Sy Light.sublime-color-scheme",
          "sourceLine": 85,
        },
        "mode": "light",
      },
    ]
  `);
});

describe("full Vim startup evidence", () => {
  it("keeps actual plugin startup and highlight observations tied to current sources", () => {
    expect(evidence.vim.settingsSha256).toBe(digest("software/scripts/vim-config-settings.vim"));
    expect(evidence.vim.signifyLoaded).toBe(true);
    expect(evidence.vim.lightlineLoaded).toBe(true);
    expect(evidence.vim.appearances.map((record) => record.scheme)).toEqual(["sy-dark", "sy-light", "sy-dark"]);
    for (const record of evidence.vim.appearances) {
      expect(record.sourceSha256).toBe(digest(`theme/sy/vim_${record.mode}.jsonc`));
      expect(record.lightlineScheme).toBe("sy");
      expect(record.groups.SignifySignAdd.target).toBe("DiffAdd");
      expect(record.groups.SignifySignChange.target).toBe("DiffChange");
      expect(record.groups.SignifySignDelete.target).toBe("DiffDelete");
    }
    expect(evidence.vim.cursorLineConceal).toBe("reference_only_no_consumer_found_in_installed_plugins_or_vim_runtime");
  });
});
