/** Deploys the Windows PowerShell profile with inline autocomplete spec data. */
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
 * Registers inline PowerShell autocomplete spec data as profile blocks via registerWithPowershellProfile.
 */
async function _registerInlineSpecs() {
  for (const entry of SPEC_COMMANDS) {
    const { command, os } = entry;
    if (os && !os.split(",").includes("windows")) continue;
    const resolvedSpecFile = _resolveSpecFile(entry);
    if (!resolvedSpecFile) continue;
    const specContent = await readText`${resolvedSpecFile}`;
    if (!specContent) continue;
    // Resolve `>__name__|...` static macros at build time so the PowerShell
    // _Register-SpecCompleter only sees fully-expanded command lines.
    const expandedSpec = expandSpecMacros(specContent);

    // convert spec lines to a PowerShell string array
    const lines = expandedSpec
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => `  "${l.replace(/"/g, '`"')}"`)
      .join(",\n");

    const maxDepthParam = entry.maxDepth ? ` -MaxDepthOverride ${entry.maxDepth}` : "";
    registerWithPowershellProfile(
      `${command} spec-autocomplete`,
      code`
        # ${command} autocomplete (inline spec data)
        _Register-SpecCompleter -Command "${command}"${maxDepthParam} -SpecData @(
        ${lines}
        )
      `,
    );
  }
}

/** Deploys the PowerShell profile and writes build output. */
async function doWork() {
  log(">> Setting up Windows Powershell Profile");

  // register inline spec autocomplete blocks into the profile
  log(">>> Registering inline autocomplete specs");
  await _registerInlineSpecs();

  // deployment and cleanup handled by windows/~cleanup.js
}
