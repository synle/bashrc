/** Installs spec-based bash autocomplete for all commands defined in SPEC_COMMANDS. */
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
  {
    command: "github-copilot-cli",
    specFile: "software/metadata/autocomplete-complete-spec/github-copilot-cli",
  },
  { command: "copilot", specCommand: "github-copilot-cli" },
  { command: "co", specCommand: "github-copilot-cli" },
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

/** Registers spec-based bash autocomplete for each command in SPEC_COMMANDS. */
async function doWork() {
  const commonFunctions = await readText`software/scripts/advanced/bash-autocomplete-complete-spec.common.bash`;
  const template = await readText`software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash`;

  // emit shared helpers (__to_opts, __to_opts_sorted, __spec_complete) once at the top
  const parts = [commonFunctions];
  for (const entry of SPEC_COMMANDS) {
    const { command, os } = entry;
    if (os) {
      const allowed = os.split(",");
      const currentOs = is_os_mac ? "mac" : is_os_windows ? "windows" : "linux";
      if (!allowed.includes(currentOs)) {
        log(`>>> Skipped complete-spec for ${command} (not for ${currentOs})`);
        continue;
      }
    }
    if (!entry.specCommand && !(await isBinaryFound(command, true))) {
      log(`>>> Skipped complete-spec for ${command} (not found in PATH)`);
      continue;
    }

    const resolvedSpecFile = _resolveSpecFile(entry);
    if (!resolvedSpecFile) {
      log(`>>> Skipped complete-spec for ${command} (no spec file resolved)`);
      continue;
    }
    const specContent = await readText`${resolvedSpecFile}`;
    log(`>>> Registering complete-spec for ${command}`);

    const effectiveMaxDepth = entry.maxDepth || MAX_NESTED_DEPTH;
    const completerScript = template
      .replace(/\{\{COMMAND\}\}/g, command)
      .replace("{{SPEC_CONTENT}}", specContent)
      .replace(/\{\{MAX_NESTED_DEPTH\}\}/g, String(effectiveMaxDepth));
    parts.push(
      code`
        # BEGIN ${command} Spec Autocomplete
        ${LINE_BREAK_HASH}
        # ${command} (spec-based autocomplete)
        ${LINE_BREAK_HASH}
        ${completerScript}
        # END ${command} Spec Autocomplete
      `,
    );
  }

  registerWithBashSyleAutocompleteWithRawContent("Spec Autocomplete", parts.join("\n\n\n"));
}
