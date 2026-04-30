// BEGIN software/metadata/autocomplete.common.js
/**
 * Shared list of commands with spec-based autocomplete support.
 *
 * This file is the single source of truth for which commands have autocomplete
 * spec files. It is inlined via build-include into both:
 *   - software/scripts/bash-autocomplete-complete-spec.js (registers bash tab completion)
 *   - software/scripts/windows/powershell.js (generates inline PowerShell argument completers)
 *
 * Spec files live in software/metadata/autocomplete-complete-spec/<command>.
 * Each spec file contains one line per subcommand (command name is omitted — implicit from filename):
 *   subcommand1|--opt1,--opt2,-s
 *   subcommand1 nested|--deep-opt1,--deep-opt2
 *   |__token__             (base line: extra completions added alongside inferred subcommands)
 *
 * Base command completions (e.g. `docker <TAB>`) are inferred automatically from
 * all unique first words in the spec file. An optional `|...` base line adds extra
 * completions (e.g. dynamic tokens) alongside the inferred subcommands.
 *
 * Dynamic tokens (expanded at tab-completion time by both bash and PowerShell):
 *
 *   Token                  Expands to
 *   ─────────────────────  ───────────────────────────────────────────────────
 *   __git_branches__       local + remote git branch names
 *   __git_remotes__        git remote names (e.g. origin, upstream)
 *   __git_files__          modified + untracked files (git diff + ls-files)
 *   __git_head_refs__      HEAD, HEAD~1..HEAD~100, HEAD^..HEAD^^^^^^^^^^
 *   __git_commits__        up to 500 recent commit short hashes (git log --format='%h' -500)
 *   __git_add_flags__      git add flags (--all, -A, --patch, -p, --edit, -e, etc.)
 *   __git_branch_flags__   git branch flags (--all, -a, --delete, -d, --show-current, etc.)
 *   __git_commit_flags__   git commit flags (--all, -a, --message, -m, --patch, -p, etc.)
 *   __git_diff_flags__     git diff flags (--staged, --cached, --word-diff, -w, -b, etc.)
 *   __git_log_flags__      git log flags (--oneline, --graph, --all, --format, etc.)
 *   __git_show_flags__     git show flags (--stat, --name-only, --patch, --no-patch, etc.)
 *   __git_rebase_flags__   git rebase flags (--abort, --continue, --skip, -i, --exec, etc.)
 *   __npm_scripts__        script names from ./package.json
 *   __makefile_targets__   target names from ./Makefile
 *   __ssh_hosts__          hostnames from ~/.ssh/config and ~/.ssh/config.d/*
 *   __tldr_commands__      available tldr page names (tldr --list)
 *   __cargo_targets__      binary/package names from ./Cargo.toml
 *   __python_scripts__     script names from ./pyproject.toml ([project.scripts] or [tool.poetry.scripts])
 *   __gradle_tasks__       task names from ./gradlew tasks --all (or gradle)
 *   __composer_scripts__   script names from ./composer.json
 *   __files__              regular files in the current directory
 *   __folders__            directories in the current directory
 *   __paths__              files and directories in the current directory
 *   __nested_text_files__  nested text files up to MAX_NESTED_DEPTH levels deep (excludes binaries via filter_text_files_only)
 *   __nested_files__       nested files up to MAX_NESTED_DEPTH levels deep (fd/find)
 *   __nested_folders__     nested directories up to MAX_NESTED_DEPTH levels deep (fd/find)
 *   __nested_paths__       nested files and directories up to MAX_NESTED_DEPTH levels deep (fd/find)
 *
 * Token expansion is implemented in two places:
 *   - Bash (Linux/macOS): software/index.js — registerWithBashSyleAutocompleteWithRawContent()
 *   - PowerShell (Windows): software/scripts/windows/powershell-profile.ps1.bash — _Register-SpecCompleter()
 *
 * To add a new command:
 *   1. Create the spec file: software/metadata/autocomplete-complete-spec/<command>
 *   2. Add an entry to SPEC_COMMANDS below
 *   3. Run `make format_build_include` to propagate to consuming scripts
 *
 * To add a new dynamic token:
 *   1. Add expansion logic in software/index.js (bash completer)
 *   2. Add expansion logic in software/scripts/windows/powershell-profile.ps1.bash (PowerShell completer)
 *   3. Document the token in the table above
 */

/**
 * Deduplicates spec lines by prefix (left of |). If two lines share the same prefix, keeps the longer one.
 * @param {string[]} lines - Array of spec lines in "prefix|completions" format.
 * @returns {string} Sorted, deduped spec content joined by newlines.
 */
function dedupeSpecLines(lines) {
  const byPrefix = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const prefix = trimmed.split("|")[0];
    const existing = byPrefix.get(prefix);
    if (!existing || trimmed.length > existing.length) {
      byPrefix.set(prefix, trimmed);
    }
  }
  return [...byPrefix.values()].sort().join("\n") + "\n";
}

/**
 * @type {Array<{command: string, specFile?: string, specCommand?: string, os?: string, maxDepth?: number}>}
 * Each entry must have either specFile (path to spec data) or specCommand (proxy to
 * another command's spec — avoids duplicating specFile paths for aliases).
 *
 * os field restricts which platforms register this command's autocomplete:
 *   - undefined  = all platforms (mac, linux, windows)
 *   - "mac"      = mac only
 *   - "linux"    = linux only (ubuntu, redhat, arch, etc.)
 *   - "windows"  = windows only
 *   - "mac,linux"     = mac + linux (skip windows)
 *   - "mac,windows"   = mac + windows (skip linux)
 *   - "linux,windows" = linux + windows (skip mac)
 *
 * maxDepth field overrides MAX_NESTED_DEPTH for __nested_*__ token expansion:
 *   - undefined  = use global MAX_NESTED_DEPTH (default 3)
 *   - number     = use this value instead (e.g. 4 for deeper file trees)
 *   - For specCommand proxies, maxDepth on the proxy entry takes precedence.
 */
const SPEC_COMMANDS = [
  // ---- File viewers (completes with files) ----
  { command: "cat", specFile: "software/metadata/autocomplete-complete-spec/cat" },
  { command: "bat", specCommand: "cat" },
  { command: "batcat", specCommand: "cat" },
  { command: "less", specCommand: "cat" },
  // ---- Text / file editors (completes with paths) ----
  { command: "vim", specFile: "software/metadata/autocomplete-complete-spec/vim" },
  { command: "code", specCommand: "vim" },
  { command: "subl", specCommand: "vim" },
  { command: "zed", specCommand: "vim" },
  // ---- Directory navigation and listing (completes with folders) ----
  { command: "cd", specFile: "software/metadata/autocomplete-complete-spec/cd" },
  { command: "eza", specFile: "software/metadata/autocomplete-complete-spec/eza" },
  { command: "ls", specFile: "software/metadata/autocomplete-complete-spec/ls" },
  { command: "tree", specFile: "software/metadata/autocomplete-complete-spec/tree", os: "mac,linux" },
  { command: "zoxide", specFile: "software/metadata/autocomplete-complete-spec/zoxide" },
  // ---- File search and processing ----
  { command: "fd", specFile: "software/metadata/autocomplete-complete-spec/fd" },
  { command: "jq", specFile: "software/metadata/autocomplete-complete-spec/jq" },
  { command: "rg", specFile: "software/metadata/autocomplete-complete-spec/rg" },
  // ---- Git ----
  { command: "delta", specFile: "software/metadata/autocomplete-complete-spec/delta" },
  { command: "g", specCommand: "git" },
  { command: "gh", specFile: "software/metadata/autocomplete-complete-spec/gh" },
  { command: "git", specFile: "software/metadata/autocomplete-complete-spec/git" },
  // ---- Package managers and runtimes ----
  { command: "brew", specFile: "software/metadata/autocomplete-complete-spec/brew", os: "mac,linux" },
  { command: "bun", specFile: "software/metadata/autocomplete-complete-spec/bun" },
  { command: "cargo", specFile: "software/metadata/autocomplete-complete-spec/cargo" },
  { command: "composer", specFile: "software/metadata/autocomplete-complete-spec/composer" },
  { command: "deno", specFile: "software/metadata/autocomplete-complete-spec/deno" },
  { command: "fnm", specFile: "software/metadata/autocomplete-complete-spec/fnm" },
  { command: "n", specCommand: "npm" },
  { command: "npm", specFile: "software/metadata/autocomplete-complete-spec/npm" },
  { command: "npx", specFile: "software/metadata/autocomplete-complete-spec/npx" },
  { command: "uv", specFile: "software/metadata/autocomplete-complete-spec/uv" },
  { command: "y", specCommand: "yarn" },
  { command: "yarn", specFile: "software/metadata/autocomplete-complete-spec/yarn" },
  // ---- Build tools ----
  { command: "gmake", specCommand: "make", os: "mac" },
  { command: "gradle", specFile: "software/metadata/autocomplete-complete-spec/gradle" },
  { command: "gradlew", specCommand: "gradle" },
  { command: "make", specFile: "software/metadata/autocomplete-complete-spec/make", os: "mac,linux" },
  // ---- Containers and orchestration ----
  { command: "docker", specFile: "software/metadata/autocomplete-complete-spec/docker" },
  { command: "docker-compose", specFile: "software/metadata/autocomplete-complete-spec/docker-compose" },
  { command: "kubectl", specFile: "software/metadata/autocomplete-complete-spec/kubectl" },
  // ---- Cloud CLIs ----
  { command: "aws", specFile: "software/metadata/autocomplete-complete-spec/aws" },
  { command: "az", specFile: "software/metadata/autocomplete-complete-spec/az" },
  { command: "gcloud", specFile: "software/metadata/autocomplete-complete-spec/gcloud" },
  // ---- Network and remote ----
  { command: "curl", specFile: "software/metadata/autocomplete-complete-spec/curl" },
  { command: "rsync", specFile: "software/metadata/autocomplete-complete-spec/rsync" },
  { command: "s", specCommand: "ssh" },
  { command: "ssh", specFile: "software/metadata/autocomplete-complete-spec/ssh" },
  // ---- System and services ----
  { command: "adb", specFile: "software/metadata/autocomplete-complete-spec/adb" },
  { command: "journalctl", specFile: "software/metadata/autocomplete-complete-spec/journalctl", os: "mac,linux" },
  { command: "sqlite3", specFile: "software/metadata/autocomplete-complete-spec/sqlite3" },
  { command: "systemctl", specFile: "software/metadata/autocomplete-complete-spec/systemctl", os: "mac,linux" },
  { command: "tldr", specFile: "software/metadata/autocomplete-complete-spec/tldr" },
  { command: "tmux", specFile: "software/metadata/autocomplete-complete-spec/tmux", os: "mac,linux" },
];

/**
 * Resolves the specFile for a SPEC_COMMANDS entry. If the entry uses specCommand
 * (proxy), looks up the target command's specFile from SPEC_COMMANDS.
 * @param {{command: string, specFile?: string, specCommand?: string}} entry - A SPEC_COMMANDS entry.
 * @returns {string|undefined} The resolved spec file path.
 */
function _resolveSpecFile(entry) {
  if (entry.specFile) return entry.specFile;
  if (entry.specCommand) {
    const target = SPEC_COMMANDS.find((e) => e.command === entry.specCommand);
    return target ? _resolveSpecFile(target) : undefined;
  }
  return undefined;
}

// MAX_NESTED_DEPTH is defined in index.js (shared global for all scripts)
// END software/metadata/autocomplete.common.js

/**
 * Generates the git autocomplete spec file from static commands + dynamic aliases.
 * Static section: core git commands with appropriate dynamic tokens (__git_branches__, __git_files__, etc.)
 * Dynamic section: aliases parsed from .build/gitconfig (built by git.js at build time).
 *
 * NOTE: reads from .build/gitconfig (not software/scripts/git.gitconfig) because this
 * runs during the build step and .build/gitconfig is the assembled output.
 */

/**
 * Maps a git alias definition to its dynamic token based on the underlying command.
 * @param {string} definition - The alias value (e.g. "checkout -b", "add -A", "push origin")
 * @returns {string} The appropriate token string, or empty string for no dynamic completion.
 */
function _getTokenForAlias(definition) {
  // strip outer quotes and leading !
  let cmd = definition.replace(/^"?!/, "").replace(/"$/, "").trim();
  // try to extract "git <cmd>" from shell function bodies like "f() { git checkout $1; }; f"
  const gitInBody = cmd.match(/git\s+(\S+)/);
  if (gitInBody) {
    cmd = gitInBody[1];
  } else {
    cmd = cmd.replace(/^git\s+/, "").trim();
  }
  // extract the first word (the underlying git command)
  const firstWord = cmd.split(/[\s(;{$-]/)[0].trim();

  // map underlying git commands to their tokens (dynamic + flag tokens)
  const tokenMap = {
    checkout: "__git_branches__,__git_files__",
    switch: "__git_branches__",
    merge: "__git_branches__",
    rebase: "__git_branches__,__git_rebase_flags__",
    "cherry-pick": "__git_branches__",
    push: "__git_remotes__,__git_branches__",
    pull: "__git_remotes__,__git_branches__",
    branch: "__git_branches__,__git_branch_flags__",
    revert: "__git_branches__",
    add: "__git_files__,__git_add_flags__",
    diff: "__git_files__,__git_diff_flags__",
    restore: "__git_files__",
    reset: "__git_files__,__git_head_refs__",
    fetch: "__git_remotes__",
    remote: "__git_remotes__",
    log: "__git_log_flags__",
    show: "__git_show_flags__",
    commit: "__git_commit_flags__",
  };

  return tokenMap[firstWord] || "";
}

/**
 * Parses git aliases from a gitconfig string and returns spec lines with dynamic tokens.
 * @param {string} gitconfigContent - The full gitconfig file content
 * @param {string[]} staticLines - Static spec lines to skip duplicates against
 * @returns {string[]} Array of spec lines like "co|__git_branches__"
 */
function _parseGitAliases(gitconfigContent, staticLines) {
  const aliasLines = [];
  if (!gitconfigContent) return aliasLines;

  // first pass: collect all alias name -> definition pairs
  const aliasDefs = [];
  const lines = gitconfigContent.split("\n");
  let inAlias = false;
  for (const line of lines) {
    if (line.trim() === "[alias]") {
      inAlias = true;
      continue;
    }
    if (inAlias && line.trim().startsWith("[")) break;
    if (!inAlias) continue;

    const match = line.match(/^\s*(\S+)\s*=\s*(.+)/);
    if (!match) continue;

    const alias = match[1].trim();
    const definition = match[2].trim().replace(/#.*/, "").trim();
    aliasDefs.push({ alias, definition });
  }

  // build a lookup of alias name -> tokens (first pass: direct resolution)
  const aliasTokenMap = new Map();
  for (const { alias, definition } of aliasDefs) {
    if (staticLines.some((l) => l.startsWith(`${alias}|`))) continue;
    aliasTokenMap.set(alias, _getTokenForAlias(definition));
  }

  // second pass: resolve aliases that reference other aliases (e.g. l = "!git ls" where ls is also an alias)
  for (const { alias, definition } of aliasDefs) {
    if (!aliasTokenMap.has(alias) || aliasTokenMap.get(alias)) continue;
    // extract the referenced alias name from "!git <alias>" patterns
    let cmd = definition.replace(/^"?!/, "").replace(/"$/, "").trim();
    const gitRef = cmd.match(/git\s+(\S+)/);
    const refName = gitRef ? gitRef[1] : cmd.replace(/^git\s+/, "").split(/\s/)[0];
    // check if it references a known alias with tokens
    if (aliasTokenMap.has(refName) && aliasTokenMap.get(refName)) {
      aliasTokenMap.set(alias, aliasTokenMap.get(refName));
    }
    // also check static lines for the referenced command
    const staticMatch = staticLines.find((l) => l.startsWith(`${refName}|`));
    if (staticMatch && !aliasTokenMap.get(alias)) {
      const staticTokens = staticMatch.split("|")[1];
      if (staticTokens) aliasTokenMap.set(alias, staticTokens);
    }
  }

  for (const [alias, token] of aliasTokenMap) {
    aliasLines.push(token ? `${alias}|${token}` : alias);
  }
  return aliasLines;
}

/** Generates the git autocomplete spec file. */
async function doWork() {
  const targetPath = "software/metadata/autocomplete-complete-spec/git";
  const backupContent = await readText`${targetPath}`;

  try {
    // ---- Static section: core git commands with proper tokens ----
    const staticLines = [
      "add|__git_files__,__git_add_flags__",
      "bisect|start,bad,good,reset,skip,log,run",
      "branch|__git_branches__,__git_branch_flags__",
      "checkout|__git_branches__,__git_files__,--force,-f,-b,-B,--track,-t,--detach,--orphan,--ours,--theirs,--merge,-m,--patch,-p",
      "cherry-pick|__git_branches__,--abort,--continue,--skip,--no-commit,-n,--edit,-e,--mainline,-m",
      "clean|--force,-f,-d,--dry-run,-n,--interactive,-i,-x,-X",
      "clone|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter",
      "commit|__git_commit_flags__",
      "config|--global,--local,--system,--list,-l,--get,--unset,--edit,-e",
      "diff|__git_files__,__git_diff_flags__",
      "fetch|__git_remotes__,--all,--prune,-p,--tags,--no-tags,--force,-f,--depth,--shallow-since,--dry-run",
      "init|--bare,--template,--initial-branch,-b",
      "log|__git_log_flags__",
      "merge|__git_branches__,--abort,--continue,--no-ff,--ff-only,--squash,--no-commit,--strategy,-s,--no-verify",
      "mv|--force,-f,--dry-run,-n,--verbose,-v",
      "pull|__git_remotes__,__git_branches__,--rebase,-r,--no-rebase,--ff-only,--no-ff,--squash,--autostash,--no-autostash,--all,--prune",
      "push|__git_remotes__,__git_branches__,--force,-f,--force-with-lease,--set-upstream,-u,--delete,-d,--tags,--all,--prune,--dry-run,-n,--no-verify",
      "rebase|__git_branches__,__git_rebase_flags__",
      "remote|__git_remotes__,add,remove,rename,get-url,set-url,show,prune,-v,--verbose",
      "reset|__git_files__,__git_head_refs__,--soft,--mixed,--hard,--merge,--keep",
      "restore|__git_files__,--staged,-S,--worktree,-W,--source,-s,--patch,-p",
      "rm|--cached,-r,--force,-f,--dry-run,-n",
      "show|__git_show_flags__",
      "stash|push,pop,apply,drop,list,show,clear,--patch,-p,--include-untracked,-u,--keep-index,-k,--message,-m",
      "switch|__git_branches__,--create,-c,--detach,-d,--force,-f,--guess,--no-guess,--track,-t",
      "tag|--list,-l,--delete,-d,--annotate,-a,--force,-f,--message,-m,--sign,-s,--verify,-v",
      "worktree|add,list,lock,move,prune,remove,unlock",
    ];

    // ---- Dynamic section: aliases from .build/gitconfig ----
    // NOTE: reads .build/gitconfig because this runs at build time (after git.js writes it)
    const gitconfigContent = await readText`${".build/gitconfig"}`;
    const aliasLines = _parseGitAliases(gitconfigContent, staticLines);

    const newContent = dedupeSpecLines([...staticLines, ...aliasLines]);

    log(">> Update autocomplete git config >", targetPath, `(${staticLines.length} static + ${aliasLines.length} aliases)`);
    await safeWriteText(targetPath, newContent, backupContent);
  } catch (err) {
    log(`>> Skipped: autocomplete-spec-git (${err.message})`);
  }
}
