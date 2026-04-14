import { describe, it, expect } from "vitest";
import fs from "fs";
import vm from "vm";

// ---- load script functions into a minimal sandbox ----
const scriptSource = fs.readFileSync("software/metadata/autocomplete-spec-git.js", "utf-8");

// strip the BEGIN/END build-include block (autocomplete.common.js) — we only need the local functions
const strippedSource = scriptSource.replace(/\/\/ BEGIN[\s\S]*?\/\/ END[^\n]*\n/, "").replace(/^async function doWork[\s\S]*/, ""); // strip doWork — it depends on index.js globals

const sandbox = {};
vm.runInNewContext(strippedSource.replace(/^(const|let) /gm, "var "), sandbox);

const _getTokenForAlias = sandbox._getTokenForAlias;
const _parseGitAliases = sandbox._parseGitAliases;

// ---- tests ----

describe("_getTokenForAlias", () => {
  it("should return branches + files for checkout", () => {
    expect(_getTokenForAlias("checkout -b")).toBe("__git_branches__,__git_files__");
  });

  it("should return branches for merge", () => {
    expect(_getTokenForAlias("merge --no-ff")).toBe("__git_branches__");
  });

  it("should return remotes + branches for push", () => {
    expect(_getTokenForAlias("push origin")).toBe("__git_remotes__,__git_branches__");
  });

  it("should return branches + rebase flags for rebase", () => {
    expect(_getTokenForAlias("rebase -i")).toBe("__git_branches__,__git_rebase_flags__");
  });

  it("should return branches + files for shell wrapper with checkout", () => {
    expect(_getTokenForAlias('"!git checkout $1"')).toBe("__git_branches__,__git_files__");
  });

  it("should return files + add flags for add", () => {
    expect(_getTokenForAlias("add -A")).toBe("__git_files__,__git_add_flags__");
  });

  it("should return files + diff flags for diff", () => {
    expect(_getTokenForAlias("diff --word-diff -w")).toBe("__git_files__,__git_diff_flags__");
  });

  it("should return files for restore", () => {
    expect(_getTokenForAlias("restore --staged")).toBe("__git_files__");
  });

  it("should return remotes for fetch", () => {
    expect(_getTokenForAlias("fetch --all --prune")).toBe("__git_remotes__");
  });

  it("should return remotes for remote", () => {
    expect(_getTokenForAlias("remote -v")).toBe("__git_remotes__");
  });

  it("should return commit flags for commit", () => {
    expect(_getTokenForAlias("commit --allow-empty --no-verify -m")).toBe("__git_commit_flags__");
  });

  it("should return log flags for log", () => {
    expect(_getTokenForAlias("log --oneline --graph")).toBe("__git_log_flags__");
  });

  it("should return show flags for show", () => {
    expect(_getTokenForAlias("show --stat")).toBe("__git_show_flags__");
  });

  it("should return files + head refs for reset", () => {
    expect(_getTokenForAlias("reset HEAD~1")).toBe("__git_files__,__git_head_refs__");
  });

  it("should return branches + branch flags for branch", () => {
    expect(_getTokenForAlias("branch -vv")).toBe("__git_branches__,__git_branch_flags__");
  });

  it("should return empty string for unknown commands", () => {
    expect(_getTokenForAlias("status -sb")).toBe("");
  });

  it("should handle !git prefix in shell aliases", () => {
    expect(_getTokenForAlias('"!git rebase -i HEAD~1"')).toBe("__git_branches__,__git_rebase_flags__");
  });

  it("should handle !f() shell function wrapper", () => {
    expect(_getTokenForAlias('"!f() { git checkout $1; }; f"')).toBe("__git_branches__,__git_files__");
  });
});

describe("_parseGitAliases", () => {
  const staticLines = ["add|__git_files__,__git_add_flags__", "checkout|__git_branches__,__git_files__", "commit|__git_commit_flags__"];

  it("should parse aliases without leading whitespace", () => {
    const config = "[alias]\nco = checkout\ncm = commit -m\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("co|__git_branches__,__git_files__");
    expect(result).toContain("cm|__git_commit_flags__");
  });

  it("should parse aliases with leading whitespace", () => {
    const config = "[alias]\n  co = checkout\n  cm = commit -m\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("co|__git_branches__,__git_files__");
    expect(result).toContain("cm|__git_commit_flags__");
  });

  it("should parse aliases with tab indentation", () => {
    const config = "[alias]\n\tco = checkout\n\tcm = commit -m\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("co|__git_branches__,__git_files__");
    expect(result).toContain("cm|__git_commit_flags__");
  });

  it("should parse aliases with extra spaces around equals", () => {
    const config = "[alias]\nco  =  checkout\ncm  =  commit -m\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("co|__git_branches__,__git_files__");
    expect(result).toContain("cm|__git_commit_flags__");
  });

  it("should parse aliases with trailing whitespace", () => {
    const config = "[alias]\nco = checkout   \ncm = commit -m   \n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("co|__git_branches__,__git_files__");
    expect(result).toContain("cm|__git_commit_flags__");
  });

  it("should parse aliases with no spaces around equals", () => {
    const config = "[alias]\nco=checkout\ncm=commit -m\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("co|__git_branches__,__git_files__");
    expect(result).toContain("cm|__git_commit_flags__");
  });

  it("should skip aliases that duplicate static entries", () => {
    const config = "[alias]\nadd = add -A\nco = checkout\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).not.toContain("add|__git_files__,__git_add_flags__");
    expect(result).toContain("co|__git_branches__,__git_files__");
  });

  it("should skip comment lines", () => {
    const config = "[alias]\n# this is a comment\nco = checkout\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toEqual(["co|__git_branches__,__git_files__"]);
  });

  it("should skip blank lines", () => {
    const config = "[alias]\n\nco = checkout\n\ncm = commit -m\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("co|__git_branches__,__git_files__");
    expect(result).toContain("cm|__git_commit_flags__");
  });

  it("should stop parsing at next section", () => {
    const config = "[alias]\nco = checkout\n[core]\nautocrlf = input\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toEqual(["co|__git_branches__,__git_files__"]);
  });

  it("should strip inline comments from definitions", () => {
    const config = "[alias]\nco = checkout # switch branch\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("co|__git_branches__,__git_files__");
  });

  it("should return empty array for empty content", () => {
    expect(_parseGitAliases("", staticLines)).toEqual([]);
    expect(_parseGitAliases(null, staticLines)).toEqual([]);
    expect(_parseGitAliases(undefined, staticLines)).toEqual([]);
  });

  it("should return empty array when no alias section exists", () => {
    const config = "[core]\nautocrlf = input\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toEqual([]);
  });

  it("should handle mixed indentation styles", () => {
    const config = "[alias]\nco = checkout\n  aa = add -A\n\tb = branch -vv\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("co|__git_branches__,__git_files__");
    expect(result).toContain("aa|__git_files__,__git_add_flags__");
    expect(result).toContain("b|__git_branches__,__git_branch_flags__");
  });

  it("should assign log flags to log aliases", () => {
    const config = "[alias]\nls = log --oneline\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("ls|__git_log_flags__");
  });

  it("should assign rebase flags to rebase aliases", () => {
    const config = "[alias]\nr = rebase --reapply-cherry-picks\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("r|__git_branches__,__git_rebase_flags__");
  });

  it("should assign diff flags to diff aliases", () => {
    const config = "[alias]\nd = diff --word-diff -w\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("d|__git_files__,__git_diff_flags__");
  });

  it("should assign show flags to show aliases", () => {
    const config = "[alias]\nshow1 = show --stat\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("show1|__git_show_flags__");
  });

  it("should drop trailing pipe for aliases with no tokens", () => {
    const config = "[alias]\nwip = status -sb\n";
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("wip");
    expect(result).not.toContain("wip|");
  });

  it("should resolve alias chains (alias referencing another alias)", () => {
    const config = '[alias]\nlogbaseline = log --oneline\nls = "!git logbaseline --stat"\nl = "!git ls --stat"\n';
    const result = _parseGitAliases(config, staticLines);
    expect(result).toContain("logbaseline|__git_log_flags__");
    expect(result).toContain("ls|__git_log_flags__");
    expect(result).toContain("l|__git_log_flags__");
  });
});
