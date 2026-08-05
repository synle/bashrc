/**
 * Guards every git alias against referencing a command that does not exist.
 *
 * The numbered aliases in `software/scripts/git.js` are generated, so a typo in the
 * delegation target is invisible until someone actually runs the alias — the generator
 * happily emitted `patch-view1 = "!git patch-viewn 1"` for every N, and git only
 * complained at call time with `git: 'patch-viewn' is not a git command`. This spec
 * renders the same config the installer writes and resolves every `git <word>`
 * reference against the alias table plus git's own command list, so the failure lands
 * at build time instead.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GIT_SCRIPT = path.join(ROOT_DIR, "software/scripts/git.js");
const GIT_CONFIG_TEMPLATE = path.join(ROOT_DIR, "software/scripts/git.gitconfig");
const NUMBERED_ALIAS_MARKER = /^# BEGIN\/END - GIT_NUMBERED_ALIASES$/m;

/**
 * Loads `git.js` into a bare sandbox. Only declarations run at load time, so the
 * helpers that depend on `software/index.js` globals never execute.
 * @returns {Record<string, any>} The populated sandbox.
 */
function loadGitScriptSandbox() {
  const sandbox = {};
  const source = fs.readFileSync(GIT_SCRIPT, "utf-8").replace(/^(const|let) /gm, "var ");
  vm.runInNewContext(source, sandbox);
  return sandbox;
}

/** Renders the gitconfig exactly as `_getGitConfig` does, with numbered aliases expanded. */
function renderGitConfig() {
  const { _getNumberedAliasSnippet } = loadGitScriptSandbox();
  expect(typeof _getNumberedAliasSnippet).toBe("function");

  const template = fs.readFileSync(GIT_CONFIG_TEMPLATE, "utf-8");
  expect(template).toMatch(NUMBERED_ALIAS_MARKER);
  return template.replace(NUMBERED_ALIAS_MARKER, _getNumberedAliasSnippet());
}

/** Returns every alias name defined in the `[alias]` section of `config`. */
function parseAliasNames(config) {
  const section = config.split("[alias]")[1] || "";
  return new Set([...section.matchAll(/^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*=/gm)].map((match) => match[1]));
}

/**
 * Every command name git itself understands. `--list-cmds` landed in git 2.18; on
 * anything older the set comes back empty and the builtin half of the check is skipped
 * rather than reporting the entire standard library as missing.
 * @returns {Set<string>} Known git command names, possibly empty.
 */
function gitBuiltinCommands() {
  try {
    const output = execFileSync("git", ["--list-cmds=main,others,nohelpers"], { encoding: "utf-8" });
    return new Set(output.split(/\s+/).filter(Boolean));
  } catch (err) {
    return new Set();
  }
}

/**
 * Collects `<alias> -> <target>` pairs for every command an alias delegates to:
 * the leading word of a plain alias, and each `git <word>` inside a `!shell` alias.
 * @param {string} config - Rendered gitconfig content.
 * @returns {Array<{ alias: string, target: string, kind: string }>} Delegation edges.
 */
function collectAliasReferences(config) {
  const section = config.split("[alias]")[1] || "";
  const references = [];

  for (const [, alias, rawValue] of section.matchAll(/^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*=\s*(.*)$/gm)) {
    const value = rawValue.trim();

    // A plain (non-`!`) alias expands to a git command: its first word must resolve.
    if (!value.startsWith("!") && !value.startsWith('"!')) {
      const first = value.split(/\s+/)[0];
      if (first) references.push({ alias, target: first, kind: "expansion" });
      continue;
    }

    // A `!shell` alias may invoke git any number of times, optionally with -c/-C/--no-pager.
    for (const [, target] of value.matchAll(/\bgit\s+(?:-c\s+\S+\s+|-C\s+\S+\s+|--no-pager\s+)*([a-zA-Z0-9][a-zA-Z0-9_.-]*)/g)) {
      references.push({ alias, target, kind: "shell" });
    }
  }

  return references;
}

/**
 * Unwraps a raw gitconfig alias value into the exact string git hands to `sh -c`.
 * Git strips the surrounding `"` and unescapes `\"` / `\\`, so the scan below has to see
 * the shell's own quoting rather than the file's escaping of it.
 * @param {string} rawValue - The alias value exactly as written in the gitconfig line.
 * @returns {string} The resolved config value.
 */
function toConfigValue(rawValue) {
  const value = rawValue.trim();
  if (!value.startsWith('"')) return value.replace(/\s+#.*$/, "");

  let out = "";
  for (let i = 1; i < value.length; i += 1) {
    const char = value[i];
    if (char === "\\") {
      out += value[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (char === '"') break;
    out += char;
  }
  return out;
}

/**
 * Finds `%(...)` git format placeholders sitting outside any shell quote in an alias body.
 * Walks the value tracking quote state rather than pattern-matching, so `--format='%(a) %(b)'`
 * passes while a bare `--format=%(a)` is reported.
 * @param {string} body - The unescaped alias value (see `toConfigValue`).
 * @returns {string[]} Each offending placeholder, truncated for a readable failure message.
 */
function findUnquotedFormatPlaceholders(body) {
  const hits = [];
  let quote = null;

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (quote === null && (char === "'" || char === '"')) quote = char;
    else if (quote === char) quote = null;
    else if (quote === null && char === "%" && body[i + 1] === "(") hits.push(body.slice(i, i + 24));
  }

  return hits;
}

describe("git alias resolution", () => {
  const config = renderGitConfig();
  const aliasNames = parseAliasNames(config);
  const builtins = gitBuiltinCommands();
  const references = collectAliasReferences(config);

  it("should define aliases and collect delegation targets", () => {
    expect(aliasNames.size).toBeGreaterThan(100);
    expect(references.length).toBeGreaterThan(100);
  });

  it("should resolve every alias delegation target to an alias or a git command", () => {
    const unresolved = references
      .filter(({ target }) => !aliasNames.has(target) && !(builtins.size > 0 && builtins.has(target)) && builtins.size > 0)
      .map(({ alias, target, kind }) => `${alias} (${kind}) -> git ${target}`);

    expect(unresolved, `unresolved git alias targets:\n${unresolved.join("\n")}`).toEqual([]);
  });

  it("should delegate numbered patch aliases to the real base aliases", () => {
    for (const base of ["patch-get", "patch-view", "patch-download"]) {
      expect(aliasNames.has(base)).toBe(true);
      expect(config).toContain(`${base}1 = "!git ${base} 1"`);
      expect(config).toContain(`${base}1000 = "!git ${base} 1000"`);
      // the historical bug: a `<base>n` target that was never defined anywhere
      expect(aliasNames.has(`${base}n`)).toBe(false);
      expect(config).not.toContain(`!git ${base}n `);
    }
  });

  it("should delegate numbered rebase aliases to the real rn base aliases", () => {
    for (const base of ["rn", "rn-code", "rn-subl"]) {
      expect(aliasNames.has(base)).toBe(true);
    }
    expect(config).toContain('r1 = "!git rn 1"');
    expect(config).toContain('r1-code = "!git rn-code 1"');
    expect(config).toContain('r1-subl = "!git rn-subl 1"');
  });

  it("should quote every command substitution used as a command argument", () => {
    // Windows (`C:\Users\First Last\...`) and macOS (`~/My Drive/...`) repo paths contain
    // spaces. In argument position an unquoted `$(...)` word-splits into two arguments; in
    // `var=$(...)` assignment position it does not, so only the former is a bug.
    const unquoted = [...config.matchAll(/^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*=.*?(?<![=$"\\])\$\(git rev-parse --show-toplevel\)/gm)].map(
      (match) => match[1],
    );

    expect(unquoted, `unquoted $(git rev-parse --show-toplevel) in: ${unquoted.join(", ")}`).toEqual([]);
  });

  it("should not field-split filesystem paths out of git porcelain output", () => {
    // `git worktree list --porcelain` emits `worktree <path>`; `awk '{print $2}'` stops at the
    // first space, silently truncating any path containing one. `sed -n 's/^worktree //p'`
    // keeps the whole remainder of the line.
    const fieldSplit = [
      ...config.matchAll(/^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*=.*worktree list --porcelain[^\n]*?awk[^\n]*?print \$[0-9]/gm),
    ].map((match) => match[1]);

    expect(fieldSplit, `awk field-splits worktree paths in: ${fieldSplit.join(", ")}`).toEqual([]);
  });

  it("should quote every git format placeholder so sh does not choke on the parens", () => {
    // `--format=%(upstream:track)` is handed to `sh -c` verbatim, and `(` is a shell
    // metacharacter — sh aborts with `syntax error near unexpected token '('` and the
    // enclosing command substitution silently yields an empty string, so the alias keeps
    // running with a wrong value instead of failing. `sh -n` does not catch this because
    // command substitutions are only parsed at expansion time, hence the quote-state scan.
    const offenders = [];

    for (const [, alias, rawValue] of config.split("[alias]")[1].matchAll(/^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*=\s*(.*)$/gm)) {
      for (const placeholder of findUnquotedFormatPlaceholders(toConfigValue(rawValue))) {
        offenders.push(`${alias} -> ${placeholder}`);
      }
    }

    expect(offenders, `unquoted git format placeholder in:\n${offenders.join("\n")}`).toEqual([]);
  });
});
