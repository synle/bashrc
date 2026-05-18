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
 * Dynamic token expansion is implemented in two places (runtime):
 *   - Bash (Linux/macOS): software/scripts/advanced/bash-autocomplete-complete-spec.common.bash
 *   - PowerShell (Windows): software/scripts/windows/powershell-profile.ps1.bash
 *
 * Macro definitions (resolved at BUILD time — runtime parsers never see them):
 *
 * Per-spec-file static flag lists live as `>` lines at the bottom of the spec file:
 *
 *   add|__git_files__,__git_add_flags__
 *   diff|__git_files__,__git_diff_flags__
 *
 *   >__git_add_flags__|--all,-A,--patch,-p,--update,-u,--force,-f,...
 *   >__git_diff_flags__|--staged,--cached,--word-diff,--stat,--name-only,...
 *
 * Syntax:
 *   - Line starts with `>` (sorts macros below command lines via dedupeSpecLines).
 *   - Followed by macro name `__name__` (matches the same `__token__` shape as
 *     dynamic tokens — they're indistinguishable to the human reader at the
 *     reference site, only the `>` definition line marks them as static).
 *   - Pipe-separated body, comma-delimited entries — same as command lines.
 *
 * expandSpecMacros() resolves macro references recursively (max 10 layers),
 * dedupes the expanded completion list, and strips macro definition lines
 * from the output before the spec content is injected into bash/PowerShell
 * templates. Result: the seven `__git_*_flags__` lists live in the git spec
 * file (declarative + diffable), not duplicated in two completer implementations.
 *
 * To add a new command:
 *   1. Create the spec file: software/metadata/autocomplete-complete-spec/<command>
 *   2. Add an entry to SPEC_COMMANDS below
 *   3. Run `make format_build_include` to propagate to consuming scripts
 *
 * To add a new dynamic token (expanded at runtime by shell/PowerShell):
 *   1. Add the token name to DYNAMIC_TOKENS below
 *   2. Add expansion logic in software/scripts/advanced/bash-autocomplete-complete-spec.common.bash
 *   3. Add expansion logic in software/scripts/windows/powershell-profile.ps1.bash
 *   4. Document the token in the table above
 *
 * To add a new static macro for a command (e.g. extra flag list):
 *   1. Add a `>__name__|val,val,...` line to the relevant spec file (or to
 *      the generator that writes it, e.g. autocomplete-spec-git.js)
 *   2. Reference it from any command line in the SAME spec file
 *   3. No completer code changes required
 */

/**
 * Allow-list of `__token__` names that runtime shells expand themselves.
 * Used by expandSpecMacros() and the spec-validation tests to reject
 * unknown / typo'd token references at build time. Keep this in sync
 * with the runtime expansion logic in:
 *   - software/scripts/advanced/bash-autocomplete-complete-spec.common.bash
 *   - software/scripts/windows/powershell-profile.ps1.bash
 */
const DYNAMIC_TOKENS = [
  "__git_branches__",
  "__git_remotes__",
  "__git_files__",
  "__git_head_refs__",
  "__git_commits__",
  "__npm_scripts__",
  "__makefile_targets__",
  "__ssh_hosts__",
  "__tldr_commands__",
  "__cargo_targets__",
  "__python_scripts__",
  "__gradle_tasks__",
  "__composer_scripts__",
  "__files__",
  "__folders__",
  "__paths__",
  "__nested_text_files__",
  "__nested_files__",
  "__nested_folders__",
  "__nested_paths__",
];

/**
 * Deduplicates spec lines by prefix (left of |). If two lines share the same prefix, keeps the longer one.
 * Command lines and `>__name__|...` macro-definition lines are sorted into separate sections —
 * commands first, then a blank line, then macros — so macros always sit at the bottom of the
 * generated spec file regardless of where they appear in the input array.
 * @param {string[]} lines - Array of spec lines in "prefix|completions" format.
 * @returns {string} Sorted, deduped spec content joined by newlines.
 */
function dedupeSpecLines(lines) {
  const commands = new Map();
  const macros = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const target = trimmed.startsWith(">") ? macros : commands;
    const prefix = trimmed.split("|")[0];
    const existing = target.get(prefix);
    if (!existing || trimmed.length > existing.length) {
      target.set(prefix, trimmed);
    }
  }
  const commandLines = [...commands.values()].sort();
  const macroLines = [...macros.values()].sort();
  const sections = [];
  if (commandLines.length > 0) sections.push(commandLines.join("\n"));
  if (macroLines.length > 0) sections.push(macroLines.join("\n"));
  return sections.join("\n\n") + "\n";
}

/**
 * Expands `>__name__|val,val,...` macro definitions in spec content at build time.
 *
 * - Parses every line starting with `>` as a macro definition (must match
 *   `^>(__\w+__)\|(.*)$` — throws on malformed `>` lines or duplicate names).
 * - For each remaining command line, splits the completions on `,` and replaces
 *   any token whose name matches a macro with the macro's body, recursively
 *   (up to maxDepth layers). Cycles and over-deep references throw.
 * - Unknown `__token__` references that are NOT defined as a local macro AND
 *   NOT in DYNAMIC_TOKENS throw — they are almost certainly typos.
 * - Dedupes the expanded completion list per line (first-occurrence order).
 * - Drops all macro definition lines from the output.
 *
 * The result is a spec body where every `__static_flag__` macro reference has
 * been replaced with its literal flag list, but dynamic tokens (`__git_files__`,
 * `__npm_scripts__`, etc.) pass through unchanged for runtime expansion by the
 * shell/PowerShell completer.
 *
 * @param {string} content - Raw spec file content.
 * @param {{maxDepth?: number, knownDynamicTokens?: string[]}} [options]
 *   - maxDepth: macro recursion ceiling (default 10).
 *   - knownDynamicTokens: list of `__token__` names allowed as passthrough
 *     references (default DYNAMIC_TOKENS).
 * @returns {string} Spec content with macros resolved and definition lines removed.
 */
function expandSpecMacros(content, options) {
  const opts = options || {};
  const maxDepth = opts.maxDepth !== undefined ? opts.maxDepth : 10;
  const dynamic = new Set(opts.knownDynamicTokens || DYNAMIC_TOKENS);

  const macros = new Map();
  /** @type {Array<{prefix?: string, tokens?: string[], rawCommand?: string}>} */
  const commandEntries = [];

  for (const rawLine of content.split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith(">")) {
      const m = trimmed.match(/^>(__[a-zA-Z0-9_]+__)\|(.*)$/);
      if (!m) {
        throw new Error(`expandSpecMacros: malformed macro line "${trimmed}" (expected ">__name__|val,val,...")`);
      }
      const name = m[1];
      const body = m[2];
      if (macros.has(name)) {
        throw new Error(`expandSpecMacros: duplicate macro definition for "${name}"`);
      }
      const tokens = body
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      macros.set(name, tokens);
      continue;
    }
    const pipeIdx = trimmed.indexOf("|");
    if (pipeIdx < 0) {
      commandEntries.push({ rawCommand: trimmed });
      continue;
    }
    const prefix = trimmed.slice(0, pipeIdx);
    const body = trimmed.slice(pipeIdx + 1);
    const tokens = body
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    commandEntries.push({ prefix, tokens });
  }

  if (macros.size === 0) {
    // Still validate that any __token__ references are recognized dynamic tokens.
    for (const entry of commandEntries) {
      if (!entry.tokens) continue;
      for (const tok of entry.tokens) {
        if (/^__[a-zA-Z0-9_]+__$/.test(tok) && !dynamic.has(tok)) {
          throw new Error(`expandSpecMacros: unknown token "${tok}" (not a local macro and not in DYNAMIC_TOKENS)`);
        }
      }
    }
    return content;
  }

  /**
   * Recursively resolves macro references in a token list.
   * @param {string[]} tokens - Token list to expand.
   * @param {number} depth - Current recursion depth.
   * @param {Set<string>} seen - Macro names currently being expanded (for cycle detection).
   * @returns {string[]} Expanded token list with macros substituted.
   */
  function expandTokens(tokens, depth, seen) {
    if (depth > maxDepth) {
      throw new Error(`expandSpecMacros: macro recursion exceeded ${maxDepth} layers`);
    }
    const out = [];
    for (const tok of tokens) {
      if (macros.has(tok)) {
        if (seen.has(tok)) {
          throw new Error(`expandSpecMacros: macro cycle detected on "${tok}"`);
        }
        seen.add(tok);
        for (const sub of expandTokens(macros.get(tok), depth + 1, seen)) {
          out.push(sub);
        }
        seen.delete(tok);
      } else if (/^__[a-zA-Z0-9_]+__$/.test(tok) && !dynamic.has(tok)) {
        throw new Error(`expandSpecMacros: unknown token "${tok}" (not a local macro and not in DYNAMIC_TOKENS)`);
      } else {
        out.push(tok);
      }
    }
    return out;
  }

  const outLines = [];
  for (const entry of commandEntries) {
    if (entry.rawCommand !== undefined) {
      outLines.push(entry.rawCommand);
      continue;
    }
    const expanded = expandTokens(entry.tokens, 0, new Set());
    const seen = new Set();
    const deduped = [];
    for (const t of expanded) {
      if (!seen.has(t)) {
        seen.add(t);
        deduped.push(t);
      }
    }
    outLines.push(entry.prefix + "|" + deduped.join(","));
  }

  return outLines.join("\n") + "\n";
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
  {
    command: "cat",
    specFile: "software/metadata/autocomplete-complete-spec/cat",
  },
  { command: "bat", specCommand: "cat" },
  { command: "batcat", specCommand: "cat" },
  { command: "less", specCommand: "cat" },
  // ---- Text / file editors (completes with paths) ----
  {
    command: "vim",
    specFile: "software/metadata/autocomplete-complete-spec/vim",
  },
  { command: "code", specCommand: "vim" },
  { command: "subl", specCommand: "vim" },
  { command: "zed", specCommand: "vim" },
  // ---- Directory navigation and listing (completes with folders) ----
  {
    command: "cd",
    specFile: "software/metadata/autocomplete-complete-spec/cd",
  },
  {
    command: "eza",
    specFile: "software/metadata/autocomplete-complete-spec/eza",
  },
  {
    command: "ls",
    specFile: "software/metadata/autocomplete-complete-spec/ls",
  },
  {
    command: "tree",
    specFile: "software/metadata/autocomplete-complete-spec/tree",
    os: "mac,linux",
  },
  {
    command: "zoxide",
    specFile: "software/metadata/autocomplete-complete-spec/zoxide",
  },
  // ---- File search and processing ----
  {
    command: "fd",
    specFile: "software/metadata/autocomplete-complete-spec/fd",
  },
  {
    command: "jq",
    specFile: "software/metadata/autocomplete-complete-spec/jq",
  },
  {
    command: "rg",
    specFile: "software/metadata/autocomplete-complete-spec/rg",
  },
  // ---- Git ----
  {
    command: "delta",
    specFile: "software/metadata/autocomplete-complete-spec/delta",
  },
  { command: "g", specCommand: "git" },
  {
    command: "gh",
    specFile: "software/metadata/autocomplete-complete-spec/gh",
  },
  {
    command: "git",
    specFile: "software/metadata/autocomplete-complete-spec/git",
  },
  // ---- Package managers and runtimes ----
  {
    command: "brew",
    specFile: "software/metadata/autocomplete-complete-spec/brew",
    os: "mac,linux",
  },
  {
    command: "bun",
    specFile: "software/metadata/autocomplete-complete-spec/bun",
  },
  {
    command: "cargo",
    specFile: "software/metadata/autocomplete-complete-spec/cargo",
  },
  {
    command: "composer",
    specFile: "software/metadata/autocomplete-complete-spec/composer",
  },
  {
    command: "deno",
    specFile: "software/metadata/autocomplete-complete-spec/deno",
  },
  {
    command: "fnm",
    specFile: "software/metadata/autocomplete-complete-spec/fnm",
  },
  { command: "n", specCommand: "npm" },
  {
    command: "npm",
    specFile: "software/metadata/autocomplete-complete-spec/npm",
  },
  {
    command: "npx",
    specFile: "software/metadata/autocomplete-complete-spec/npx",
  },
  {
    command: "uv",
    specFile: "software/metadata/autocomplete-complete-spec/uv",
  },
  { command: "y", specCommand: "yarn" },
  {
    command: "yarn",
    specFile: "software/metadata/autocomplete-complete-spec/yarn",
  },
  // ---- Build tools ----
  { command: "gmake", specCommand: "make", os: "mac" },
  {
    command: "gradle",
    specFile: "software/metadata/autocomplete-complete-spec/gradle",
  },
  { command: "gradlew", specCommand: "gradle" },
  {
    command: "make",
    specFile: "software/metadata/autocomplete-complete-spec/make",
    os: "mac,linux",
  },
  // ---- Containers and orchestration ----
  {
    command: "docker",
    specFile: "software/metadata/autocomplete-complete-spec/docker",
  },
  {
    command: "docker-compose",
    specFile: "software/metadata/autocomplete-complete-spec/docker-compose",
  },
  {
    command: "kubectl",
    specFile: "software/metadata/autocomplete-complete-spec/kubectl",
  },
  // ---- Cloud CLIs ----
  {
    command: "aws",
    specFile: "software/metadata/autocomplete-complete-spec/aws",
  },
  {
    command: "az",
    specFile: "software/metadata/autocomplete-complete-spec/az",
  },
  {
    command: "gcloud",
    specFile: "software/metadata/autocomplete-complete-spec/gcloud",
  },
  // ---- Network and remote ----
  {
    command: "curl",
    specFile: "software/metadata/autocomplete-complete-spec/curl",
  },
  {
    command: "rsync",
    specFile: "software/metadata/autocomplete-complete-spec/rsync",
  },
  { command: "s", specCommand: "ssh" },
  {
    command: "ssh",
    specFile: "software/metadata/autocomplete-complete-spec/ssh",
  },
  // ---- AI / agentic tools ----
  {
    command: "claude",
    specFile: "software/metadata/autocomplete-complete-spec/claude",
  },
  { command: "cl", specCommand: "claude" },
  { command: "cm", specCommand: "claude" },
  {
    command: "opencode",
    specFile: "software/metadata/autocomplete-complete-spec/opencode",
  },
  // The `copilot` binary (from @github/copilot / brew `copilot-cli`) ships its own
  // bash completion (`copilot completion bash`), so we intentionally do NOT register
  // a static spec here. The legacy `github-copilot-cli` / `co` aliases pointed at the
  // deprecated @githubnext/github-copilot-cli npm package and were removed.
  // ---- System and services ----
  {
    command: "adb",
    specFile: "software/metadata/autocomplete-complete-spec/adb",
  },
  {
    command: "journalctl",
    specFile: "software/metadata/autocomplete-complete-spec/journalctl",
    os: "mac,linux",
  },
  {
    command: "sqlite3",
    specFile: "software/metadata/autocomplete-complete-spec/sqlite3",
  },
  {
    command: "systemctl",
    specFile: "software/metadata/autocomplete-complete-spec/systemctl",
    os: "mac,linux",
  },
  {
    command: "tldr",
    specFile: "software/metadata/autocomplete-complete-spec/tldr",
  },
  {
    command: "tmux",
    specFile: "software/metadata/autocomplete-complete-spec/tmux",
    os: "mac,linux",
  },
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

    // ---- Macro definitions: static flag lists referenced by command lines above ----
    // These are resolved at BUILD time by expandSpecMacros() in autocomplete.common.js
    // before the spec content is injected into bash/PowerShell templates. The runtime
    // parsers never see them — adding a flag here is the only place to change.
    const macroLines = [
      ">__git_add_flags__|--all,-A,--patch,-p,--update,-u,--force,-f,--intent-to-add,-N,--dry-run,-n,--verbose,-v,--edit,-e",
      ">__git_branch_flags__|--all,-a,--delete,-d,-D,--force,-f,--move,-m,-M,--copy,-c,--list,-l,--remotes,-r,--verbose,-v,--set-upstream-to,-u,--unset-upstream,--sort,--contains,--no-contains,--merged,--no-merged,--show-current,--track,-t,--no-track",
      ">__git_commit_flags__|--all,-a,--message,-m,--amend,--no-edit,--allow-empty,--no-verify,--fixup,--squash,--signoff,-s,--verbose,-v,--dry-run,--patch,-p,--author,--date",
      ">__git_diff_flags__|--staged,--cached,--word-diff,--stat,--name-only,--name-status,--no-index,--color,--no-color,--ignore-all-space,-w,--ignore-space-change,-b,--compact-summary,--diff-filter",
      ">__git_log_flags__|--oneline,--graph,--all,--stat,--patch,-p,--follow,--author,--since,--until,--grep,-n,--decorate,--abbrev-commit,--date,--format,--no-merges,--first-parent,--reverse",
      ">__git_rebase_flags__|--abort,--continue,--skip,--interactive,-i,--onto,--reapply-cherry-picks,--autosquash,--no-autosquash,--exec,-x,--update-refs,--keep-base,--quit,--edit-todo",
      ">__git_show_flags__|--stat,--name-only,--name-status,--format,--patch,-p,--word-diff,-w,--no-patch,--abbrev-commit,--color,--no-color",
    ];

    // ---- Dynamic section: aliases from .build/gitconfig ----
    // NOTE: reads .build/gitconfig because this runs at build time (after git.js writes it)
    const gitconfigContent = await readText`${".build/gitconfig"}`;
    const aliasLines = _parseGitAliases(gitconfigContent, staticLines);

    const newContent = dedupeSpecLines([...staticLines, ...aliasLines, ...macroLines]);

    log(
      ">> Update autocomplete git config >",
      targetPath,
      `(${staticLines.length} static + ${aliasLines.length} aliases + ${macroLines.length} macros)`,
    );
    await safeWriteText(targetPath, newContent, backupContent);
  } catch (err) {
    log(`>> Skipped: autocomplete-spec-git (${err.message})`);
  }
}
