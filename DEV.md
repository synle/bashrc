# DEV.md

Comprehensive developer architecture guide for `synle/bashrc`. Start here to understand how the system works before making changes.

For coding conventions and rules, see [CLAUDE.md](CLAUDE.md).

## High-Level Architecture

```
                      +-----------------------+
                      |       run.sh          |  Entry point
                      |  (bash pre-scan,      |  Encodes $@ as JSON
                      |   OS detection,       |  into BASHRC_RAW_ARGS
                      |   env setup)          |
                      +---------+-------------+
                                |
                  sources common-env.sh (inlined via BEGIN/END)
                                |
                      +---------v-------------+
                      |   cat index.js | node |  Node layer
                      |  (parseRawArgs,       |  Generates bash
                      |   discover scripts,   |  commands to stdout
                      |   emit bundles)       |
                      +---------+-------------+
                                | stdout (bash commands)
                      +---------v-------------+
                      |        bash           |  Execution layer
                      |  (executes emitted    |  Runs heredoc bundles,
                      |   commands, installs  |  installs tools,
                      |   tools, writes       |  writes configs,
                      |   configs)            |  assembles profile
                      +-----------------------+
```

The core insight: **Node generates bash commands; bash executes them.** Node runs once and exits instantly. Bash receives a stream of heredoc bundles and processes them sequentially. This gives scripts full access to Node (async I/O, JSON, template literals) while keeping native shell integration.

## Directory Structure

```
bashrc/
├── run.sh                        # Entry point (bash pre-scan, arg encoding, run_files())
├── install.sh                    # GitHub Codespaces bootstrap
├── Makefile                      # Build targets (.ONESHELL, GNU Make 4+)
├── CLAUDE.md                     # Coding conventions and rules
├── DEV.md                        # This file (architecture guide)
├── README.md                     # Project overview and usage
├── package.json                  # Dependencies (react, vite, vitest, prettier)
│
├── software/
│   ├── index.js                  # Dual-purpose: utility library + bootstrap engine (~3800 lines)
│   ├── common.js                 # Shared constants, replaceBlock(), marker handling
│   ├── index.d.ts                # Auto-generated TypeScript declarations
│   │
│   ├── bootstrap/                # Core bootstrap files
│   │   ├── common-env.sh         # Shared env constants (OS flags, paths, limits)
│   │   ├── common-functions.bash # Shared bash functions (npm_install_global, has_persistent_binary, curl_bash_install, etc.)
│   │   ├── profile-core.sh       # Core profile: PATH, aliases, exports
│   │   ├── profile-advanced.sh   # Advanced profile: history, utilities, find_path, etc.
│   │   └── setup.sh              # Installation bootstrap snippet
│   │
│   ├── scripts/                  # ~96 auto-discovered setup scripts
│   │   ├── *.js / *.sh           # Cross-platform scripts
│   │   ├── advanced/             # 50 scripts (opt-in via IS_ADVANCED_PROFILE_ENABLED)
│   │   ├── mac/                  # macOS-specific (13 scripts)
│   │   ├── ubuntu/               # Ubuntu/Debian/Mint
│   │   ├── arch_linux/           # Arch Linux / AUR
│   │   ├── redhat/               # RHEL / Fedora
│   │   ├── windows/              # Windows PowerShell
│   │   ├── wsl/                  # WSL-specific
│   │   ├── mingw64/              # MinGW on Windows
│   │   ├── chromeos/             # ChromeOS / Crostini
│   │   ├── android_termux/       # Android Termux
│   │   └── steamos/              # SteamOS / Steam Deck
│   │
│   ├── metadata/                 # Autocomplete specs, script configs, hosts file
│   │   ├── autocomplete.common.js            # Source of truth for spec command mappings
│   │   └── autocomplete-complete-spec/<cmd>  # 37+ spec data files
│   │
│   ├── tools/                    # Build and formatting tools
│   │   ├── build-include.js      # BEGIN/END block inliner + inline marker processor
│   │   ├── format-jsdocs.js      # JSDoc formatter
│   │   ├── format-script-indexes.js  # Script registry updater
│   │   ├── format-shell.sh       # shfmt wrapper
│   │   └── new-script.sh         # New script template generator
│   │
│   └── tests/                    # 29+ Vitest spec files
│       ├── setup.js              # VM sandbox loader (getIndexFunction, mockFs, etc.)
│       └── *.spec.js             # Unit, profile syntax, smoke, buildconfig tests
│
├── src/                          # React webapp source
│   ├── components/               # UI components
│   └── helpers/                  # Utility functions
│
├── webapp/                       # Built webapp (GitHub Pages)
│   ├── index.jsx                 # Main React app
│   ├── index.html                # HTML template
│   └── *.scss                    # Stylesheets
│
├── .build/                       # Generated artifacts (DO NOT EDIT)
│   └── profile_bashrc_*.sh       # Pre-built profiles per OS
│
├── .github/
│   ├── workflows/build-main.yml  # CI/CD: Prep -> 5 parallel OS builds -> Deploy -> Test
│   └── actions/ci-build/         # Reusable build action with job summary
│
├── .devcontainer/                # GitHub Codespaces config
└── docs/                         # Platform guides and reference docs
```

## Request Lifecycle: Full Setup Run

A complete `bash run.sh --setup` goes through these steps:

### Step 1: Bash Pre-Scan

`run.sh` sources `common-env.sh` (inlined between BEGIN/END markers) to set shared constants. It does a minimal pre-scan of `$@` for `--verbose` (enables `set -x`) and `--no-color`. All other flags are left for Node.

```bash
# run.sh pre-scan (simplified)
for arg in "$@"; do
  case "$arg" in
    --verbose|-v) set -x ;;
    --no-color) export NO_COLOR=1 ;;
  esac
done
```

### Step 2: OS Detection

`run.sh` detects the platform and exports `is_os_<name>=1` flags:

```bash
# 10 OS flags
is_os_mac, is_os_ubuntu, is_os_chromeos, is_os_mingw64,
is_os_android_termux, is_os_arch_linux, is_os_steamos,
is_os_redhat, is_os_windows, is_os_wsl
```

### Step 3: Arg Encoding

`run.sh` JSON-encodes `$@` into `BASHRC_RAW_ARGS` so Node can parse structured args:

```bash
export BASHRC_RAW_ARGS=$(printf '%s\n' "$@" | jq -R . | jq -s .)
```

### Step 4: Local vs Remote Detection

`run_files()` checks if `software/index.js` exists locally. If yes, runs locally. If no, fetches the repo via tarball (or git clone fallback) into a temp directory.

### Step 5: Node Arg Parsing

`parseRawArgs()` in `index.js` reads `BASHRC_RAW_ARGS` and sets `process.env` variables:

```
--files="git.js"      -> TEST_SCRIPT_FILES="git.js"
--force-refresh       -> IS_FORCE_REFRESH="1"
--setup               -> IS_SETUP="1"
--dryrun              -> IS_DRYRUN="1"
--remove              -> IS_REMOVE="1"
--lightweight         -> IS_LIGHTWEIGHT="1"
bare args             -> treated as file names
```

### Step 6: Script Discovery

`getSoftwareScriptFiles()` finds all scripts in `software/scripts/`, then filters:

1. Exclude `.common.js` files (shared helpers, not runnable)
2. Exclude `.standalone.js` files (run-only-on-demand via `--files`)
3. Exclude `_full-setup.*` unless `--setup` mode
4. Exclude `advanced/` unless `IS_ADVANCED_PROFILE_ENABLED=1`
5. Filter by OS-specific folders (only include current platform's folder)
6. If `--files` specified, fuzzy-match to resolve filenames

### Step 7: Script Sorting & Bundling

Scripts are sorted into priority tiers:

```
_init.js           (1st)  Global init
<os>/_init.*       (2nd)  OS-specific init
_full-setup.*      (3rd)  System deps (--setup only)
a-z alphabetical   (4th)  Main scripts (_only sorts before a-z)
~prefix            (5th)  Cleanup/wrapup
lastFiles          (6th)  Pinned last: bash-syle-content.js, vs-code-ext.sh
```

Consecutive scripts of the same type are bundled into single process invocations:

```
[git.js, vim-config.js, fzf.js]  -> one `node` heredoc (JS bundle)
[tool-a.sh, tool-b.sh]           -> separate bash heredocs (SH bundle)
[~cleanup.js]                    -> individual (~ prefix = unbundleable)
```

### Step 8: Bundle Emission

Node emits bash heredoc commands to stdout. For JS bundles:

```bash
node <<'_BASHRC_INLINE_EOF_'
  // index.js globals loaded once
  (function() { /* git.js doWork() */ })();
  (function() { /* vim-config.js doWork() */ })();
  (function() { /* fzf.js doWork() */ })();
_BASHRC_INLINE_EOF_
```

Each script is IIFE-wrapped to isolate scope while sharing index.js globals.

For SH bundles, each script gets its own heredoc:

```bash
bash <<'_BASHRC_SH_SCRIPT_EOF_'
  # tool-a.sh content
_BASHRC_SH_SCRIPT_EOF_

bash <<'_BASHRC_SH_SCRIPT_EOF_'
  # tool-b.sh content
_BASHRC_SH_SCRIPT_EOF_
```

SH scripts are NOT concatenated -- separate heredocs ensure background tasks in one script don't block the next.

### Step 9: Profile Assembly

During execution, scripts register their profile blocks:

1. `_init.js` wipes `~/.bash_syle` and reassembles from `profile-core.sh` + `profile-advanced.sh`
2. Scripts call `registerWithBashSyleProfile()` or `registerPlatformTweaks()` to fill pre-placed markers
3. `~cleanup.js` strips any unfilled markers and writes build artifacts

## Layer-by-Layer Breakdown

### Layer 1: Bash Bootstrap (`run.sh`, `common-env.sh`)

Sets up the execution environment. Responsible for:

- OS detection (exports `is_os_*` flags)
- Arg pre-scan (`--verbose`, `--no-color`)
- JSON encoding of args into `BASHRC_RAW_ARGS`
- Local vs remote repo detection
- Temp directory creation (`$BASHRC_TEMP_DIR`)
- Timing initialization (`run_timing.json`)

### Layer 2: Node Engine (`index.js`, `common.js`)

`index.js` serves two purposes:

**Utility library** -- provides ~200 global functions used by scripts:

- File I/O: `readText`, `readJson`, `writeText`, `writeJson`, `backupConfigFile`
- Path search: `findPath`, `findPathList`, `findPathFromList`, `pathExists`
- Shell emission: `emitBash`, `emitLines`, `emitInstallPackages`
- Config manipulation: `replaceBlock`, `registerWithBashSyleProfile`, `registerPlatformTweaks`
- Platform detection: `is_os_mac`, `is_os_ubuntu`, etc. (boolean globals via `getRuntimeOption`)
- Helpers: `execBash`, `log`, `code`, `list`, `json` (tagged template literals)

**Bootstrap entry point** -- orchestrates script execution:

- `parseRawArgs()` -- parses CLI flags from `BASHRC_RAW_ARGS`
- `getSoftwareScriptFiles()` -- discovers and filters scripts
- `_runScripts()` -- sorts, bundles, and emits scripts
- `_emitBundledJsScripts()` / `_emitBundledShScripts()` -- emit heredoc bundles
- `printScriptProcessingResults()` -- timing and status reporting

### Layer 3: Scripts (`software/scripts/`)

Each script is a self-contained unit:

**JS scripts** (`.js`):

- Export `doWork()` (required) and optionally `undoWork()` for `--remove`
- Have access to all index.js globals (file I/O, platform detection, etc.)
- Generate bash commands via `emitBash()` for shell-level operations

**Shell scripts** (`.sh`):

- Plain bash with `#!/usr/bin/env bash` shebang
- Source shared functions via `# SOURCE software/bootstrap/common-functions.bash`
- Execute directly in bash layer

**Special extensions:**
| Extension | Runner | Bundleable |
|-------------|-------------------|------------|
| `.js` | `node` | Yes |
| `.su.js` | `sudo -E node` | Yes |
| `.sh` | `bash` | Yes |
| `.sh.js` | `node \| bash` | No |
| `.su.sh.js` | `sudo node \| bash` | No |

### Layer 4: Profile Assembly

The generated `~/.bash_syle` file is assembled from templates with pre-placed markers:

| Registration Function             | Template File                                          | Used By                       |
| --------------------------------- | ------------------------------------------------------ | ----------------------------- |
| `registerWithBashSyleProfile()`   | `software/bootstrap/profile-core.sh` (top)             | Most scripts (fzf, fnm, etc.) |
| `registerPlatformTweaks()`        | `software/bootstrap/profile-advanced.sh` (bottom)      | `_only.js` in OS folders      |
| `registerWithPowershellProfile()` | `software/scripts/windows/powershell-profile.ps1.bash` | Windows scripts               |

## Data Flow Diagrams

### Full Setup (`bash run.sh --setup`)

```
run.sh --setup
  |
  +-> common-env.sh: export env vars, OS flags
  +-> BASHRC_RAW_ARGS: JSON-encode args
  +-> run_files(): detect local/remote
  |
  +-> cat index.js | node
  |     |
  |     +-> parseRawArgs(): IS_SETUP=1
  |     +-> getSoftwareScriptFiles(): include _full-setup.* scripts
  |     +-> _runScripts():
  |           _init.js           -> wipe & init ~/.bash_syle
  |           <os>/_init.js      -> OS-specific init
  |           <os>/_full-setup.sh -> apt/brew/pacman installs
  |           git.js, fzf.js...  -> tool configs (bundled)
  |           ~cleanup.js        -> strip unfilled markers
  |           bash-syle-content.js -> finalize profile
  |
  +-> run.sh finale: merge timing into run_timing.json
```

### Single Script (`bash run.sh --files="git.js"`)

```
run.sh --files="git.js"
  |
  +-> index.js: parseRawArgs() -> TEST_SCRIPT_FILES="git.js"
  +-> getSoftwareScriptFiles(): only "git.js" (fuzzy-matched)
  +-> _runScripts(): single JS bundle
  |     +-> node heredoc with git.js doWork()
  +-> run.sh finale
```

### Profile Refresh (`make setup_local_profile`)

```
make setup_local_profile
  |
  +-> bash run.sh (no --setup)
  +-> _full-setup.* scripts excluded (no IS_SETUP)
  +-> All other scripts run: configs written, profile assembled
  +-> No package installs
```

## Content Inclusion Systems

### BEGIN/END (Build-Time Inlining)

`software/tools/build-include.js` scans files for markers and inlines referenced file content:

```bash
# BEGIN software/bootstrap/common-env.sh
# (content of common-env.sh is inlined here by make format_build_include)
# END software/bootstrap/common-env.sh
```

Used in `run.sh` to inline `common-env.sh`, in profiles to inline shared blocks, and in JSONC for inline marker replacement (`// {{dark.key}}`).

Run: `make format_build_include`

### SOURCE (Runtime Inlining)

`// SOURCE path` or `# SOURCE path` markers are resolved at runtime by `readText()`:

```bash
# SOURCE software/bootstrap/common-functions.bash
```

Content is expanded in memory between `SOURCE_BEGIN`/`SOURCE_END` markers. Never modifies the repo source file. Cached per run via `_sourceContentCache`.

Prefer SOURCE over BEGIN/END when sharing code between scripts -- avoids duplicated content in the repo.

### When to Use Which

| System    | When                                       | Where Content Lives |
| --------- | ------------------------------------------ | ------------------- |
| BEGIN/END | Content must be physically present in file | In the repo file    |
| SOURCE    | Content can be loaded at runtime           | In memory only      |

## Path Search API

Unified API for finding files, folders, and executables across bash and JS:

### JS Functions

```javascript
// Core: returns all matches (array)
findPathList(srcDir, regex, { type: "folder" });

// Convenience: returns first match or null (proxies to findPathList)
findPath(srcDir, regex, { type: "folder" });

// Search multiple [dir, regex] tuples
findPathFromList(
  [
    [dir1, regex1],
    [dir2, regex2],
  ],
  { type: "folder" },
);

// Boolean existence check (delegates to findPath for regex mode)
pathExists(path); // simple: does path exist?
pathExists(dir, regex, "file"); // child search: matching file in dir?

// Options: { type: 'file'|'folder'|'any', recursive: false }
```

### Bash Functions

```bash
# Core: returns all matches (newline-separated)
find_path_list path1 path2 ... --folder

# Convenience: returns first match (proxies to find_path_list)
find_path path1 path2 ... --folder

# Modes: --file, --folder, --exec, --any (default)
# Supports glob wildcards: find_path '/usr/bin/vim*' --exec
```

## Script System

### Adding a New Script

1. Create `software/scripts/my-tool.js` (or `<os>/my-tool.js` for OS-specific):

```javascript
/** Configure my-tool settings. */
async function doWork() {
  exitIfLimitedSupportOs();

  const configPath = path.join(process.env.HOME, ".my-tool.conf");
  await backupConfigFile(configPath);
  await writeText(
    configPath,
    code`
    setting1=value1
    setting2=value2
  `,
  );

  registerWithBashSyleProfile(
    "my-tool",
    code`
    export MY_TOOL_HOME="\$HOME/.my-tool"
  `,
  );
}
```

2. If it's a `.sh` script, start with:

```bash
#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
```

3. No registration needed -- `getSoftwareScriptFiles()` auto-discovers it.

4. Test: `bash run.sh --files="my-tool.js" --dryrun`

5. If it installs a CLI binary, add a `check_binary` call in `.github/actions/ci-build/action.yml`.

### Standalone Scripts (`.standalone.js`)

Scripts named `*.standalone.js` are excluded from full runs, setup runs, and dryrun tests. They can only be run explicitly via `--files`. Use this convention for utility scripts that should not run as part of the normal pipeline.

**`~refresh-source.standalone.js`** — Refreshes all `SOURCE_BEGIN`/`SOURCE_END` blocks in `BASH_SYLE_PATH` by re-reading the referenced source files. Automatically appended to every `--files` run by `_doWorkTestFiles()`. Full runs handle this via `~cleanup.js` instead.

### Guard Functions

Use these at the top of scripts to skip on unsupported platforms:

```javascript
exitIfLimitedSupportOs(); // Skip on android_termux, mingw64, and lightweight mode
exitIfUnsupportedOs(); // Skip with custom message
exitIfNotTargetOs(); // Skip if not running on the target OS folder
exitIfNotSudo(); // Skip if not running as sudo (.su.js scripts)
exitIfPathNotFound(path); // Skip if a required path doesn't exist
exitIfPathFound(path); // Skip if a conflicting path already exists
```

### Script Priority Prefixes

| Prefix        | Tier | Purpose                                     |
| ------------- | ---- | ------------------------------------------- |
| `_init`       | 1st  | Global initialization                       |
| `<os>/_init`  | 2nd  | OS-specific initialization                  |
| `_full-setup` | 3rd  | System dependency installs (--setup only)   |
| `_only`       | 4th- | OS-specific config (sorts before a-z)       |
| (none)        | 4th  | Regular scripts (alphabetical)              |
| `~`           | 5th  | Cleanup/wrapup (unbundleable)               |
| lastFiles     | 6th  | Pinned last: bash-syle-content, vs-code-ext |

## Timing & Benchmarking

`run.sh` creates `$BASHRC_TEMP_DIR/run_timing.json` at startup. During execution:

- **JS bundles**: `Date.now()` around each `doWork()`, merged via `_mergeScriptTimings()`
- **SH scripts**: `date +%s` before/after (seconds precision x 1000), merged via inline `node -e`
- **run.sh finale**: adds `end` and `duration_seconds` to the file

Status values: `"success"`, `"error"` (with detail), `"skipped"` (ScriptSkipError).

CI reads `run_timing.json` for the job summary.

## Autocomplete System (Complete-Spec)

Spec-based tab completion that works on both Bash and PowerShell from the same source:

### Spec Format

One file per command in `software/metadata/autocomplete-complete-spec/<cmd>`:

```
checkout|__git_branches__,__git_files__,--force,-f,-b,-B
commit|__git_commit_flags__
push|__git_remotes__,__git_branches__,--force,-f,--set-upstream,-u
```

Format: `subcommand|completion1,completion2,...`

### Dynamic Tokens

27 tokens that expand at tab time: `__git_branches__`, `__git_remotes__`, `__npm_scripts__`, `__makefile_targets__`, `__ssh_hosts__`, `__folders__`, etc.

### Adding a Command

1. Create spec file: `software/metadata/autocomplete-complete-spec/<cmd>`
2. Add `specFile` entry to `SPEC_COMMANDS` in `software/metadata/autocomplete.common.js`
3. Run: `make format_build_include`
4. For aliases, use `specCommand` instead of `specFile` to proxy

## CI/CD Pipeline

GitHub Actions (`.github/workflows/build-main.yml`):

```
Phase 1: Prep
  ubuntu-latest: format code, build-include, build webapp, commit changes

Phase 2: Build (5 parallel jobs)
  +-> Ubuntu build
  +-> RHEL build
  +-> Arch Linux build
  +-> Debian build
  +-> macOS build
  Each: install deps, run setup, verify binaries, run tests

Phase 3: Deploy
  Publish webapp to GitHub Pages

Phase 4: Test
  Additional test suites
```

All CI steps use Makefile targets. The build action generates a job summary with collapsible sections for profile syntax, binary verification, script results (from `run_timing.json`), and build summary.

## Testing

Five test suites:

| Suite          | Command                 | What It Tests                             |
| -------------- | ----------------------- | ----------------------------------------- |
| Unit           | `make test_unit`        | index.js functions in VM sandbox (vitest) |
| Profile Syntax | `make test_profile`     | `bash -n` syntax checks on .sh files      |
| Smoke          | `make test_smoke`       | Puppeteer webapp tests                    |
| Build Config   | `make test_buildconfig` | Inline snapshot shape tests               |
| Dry Run        | `make test_dryrun`      | Dry-run all JS scripts (no file writes)   |

Run all: `make test_all`

### Test Sandbox

`software/tests/setup.js` loads index.js in a VM sandbox:

```javascript
const findPath = getIndexFunction("findPath");
const EDITOR_CONFIGS = getIndexConstant("EDITOR_CONFIGS");

// Mock filesystem
mockFsExistence["/path/to/file"] = true;
mockFsDirEntries["/dir"] = [{ name: "child", isDirectory: () => true, isFile: () => false }];
```

Mocks auto-reset in `beforeEach`.

## Debugging Scripts in VS Code

The repo includes a VS Code debug configuration for stepping through individual `software/scripts/*.js` files with breakpoints.

### Setup

1. Open the repo in VS Code.
2. Open any script file under `software/scripts/` (e.g. `software/scripts/fonts.js`).
3. Press **F5** (or Run > Start Debugging).

The launch config (`.vscode/launch.json`) runs `software/.debug-runner.js` with the currently open file as the argument. It sets `NODE_OPTIONS=--max-old-space-size=4096` to avoid V8 heap limits on large scripts.

### How It Works

`.debug-runner.js` loads `software/index.js` as a library (stripping the IIFE entry point) into a `vm` context, then runs the target script in the same context with its **original filename** — this is what makes VS Code breakpoints work. Finally, it calls `doWork()` from the script, mimicking the normal pipeline.

### Environment Variables

The launch config pre-sets these env vars so scripts can run outside the normal `run.sh` pipeline:

| Variable                         | Value                                       |
| -------------------------------- | ------------------------------------------- |
| `NODE_OPTIONS`                   | `--max-old-space-size=4096` (V8 heap limit) |
| `IS_LOCAL_MODE`                  | `true`                                      |
| `BASH_PROFILE_CODE_REPO_RAW_URL` | `https://github.com/synle/bashrc/blob/HEAD` |
| `BASH_SYLE_PATH`                 | `$HOME/.bash_syle`                          |
| `BASH_SYLE_COMMON_PATH`          | `$HOME/.bash_syle_common`                   |
| `is_os_mac`                      | `1`                                         |
| `TZ`                             | `UTC`                                       |

Adjust `is_os_mac` to match your platform (e.g. `is_os_ubuntu=1` on Linux).

### Tips

- Only files under `software/scripts/` are accepted — `.debug-runner.js` rejects other paths.
- Set breakpoints in both the script file and `software/index.js` utility functions.
- The integrated terminal shows `[debug-runner]` log output — check there for errors.
- If you hit V8 memory limits, increase `--max-old-space-size` in `.vscode/launch.json`.

## Where to Edit (Quick Reference)

| Task                               | File(s)                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Add a new CLI tool                 | `software/scripts/<tool>.js` + ci-build `check_binary`                          |
| Add OS support                     | Use `/add-os` skill                                                             |
| Add autocomplete spec              | `software/metadata/autocomplete-complete-spec/<cmd>` + `autocomplete.common.js` |
| Change a shell alias               | `software/bootstrap/profile-core.sh`                                            |
| Add a user-facing bash function    | `software/bootstrap/profile-advanced.sh`                                        |
| Change editor theme colors         | `software/tools/build-include.js` (color map)                                   |
| Change ignored folders/binary exts | `EDITOR_CONFIGS` in `software/index.js`                                         |
| Change env constants               | `software/bootstrap/common-env.sh`                                              |
| Add a shared bash function         | `software/bootstrap/common-functions.bash`                                      |
| Add/change profile marker blocks   | `profile-core.sh` (pre-core) or `profile-advanced.sh` (post)                    |
| Add a test                         | `software/tests/<name>.spec.js`                                                 |
| Modify CI pipeline                 | `.github/workflows/build-main.yml`                                              |
| Modify CI build step               | `.github/actions/ci-build/action.yml`                                           |

## Key Architectural Rules

1. **Node writes to stdout only via `emitBash()`.** All other output uses `log()` (stderr). `console.log` is forbidden.

2. **Scripts are stateless and idempotent.** Each script can run independently in any order. No script depends on another script's side effects during the same run.

3. **Profile writes go through registration functions.** Never write to `BASH_SYLE_PATH` directly -- use `registerWithBashSyleProfile()` or `registerPlatformTweaks()`.

4. **OS-specific code lives in OS folders.** Don't add platform checks to cross-platform scripts when an OS folder script would be cleaner.

5. **`.build/` is generated output.** Never edit manually. It's rebuilt on every `make format_build_include` and CI run.

6. **BEGIN/END markers are build-include managed.** Edit the source file, not the inlined content. Run `make format_build_include` to sync.

7. **Guard early, not deep.** Use `exitIf*` functions at the top of `doWork()`, not buried in conditional branches.

8. **Back up before writing.** Always call `await backupConfigFile(path)` before modifying user config files.

## Known Limitations

- **`node | bash` pipeline**: Node must finish generating ALL commands before bash starts executing. Long-running Node operations block the entire pipeline.
- **Heredoc stdin consumption**: Subprocesses in `_full-setup.sh` scripts can consume the heredoc's stdin, crashing the script. Mitigated with `< /dev/null` redirection.
- **Glob ambiguity**: `find_path` / `find_path_list` skip glob patterns that match multiple results in file/folder/any modes (only exec mode iterates all matches).
- **No incremental runs**: Every run re-generates the entire profile. There's no diff-based "only update changed sections" mode.
- **Bundle type boundaries**: When a JS script is followed by a SH script, the JS bundle closes and a new SH bundle opens. Mixing types forces bundle splits.
- **Limited support OSes**: Android Termux and MinGW64 skip most scripts via `exitIfLimitedSupportOs()`. Only core configs (git, vim, bashrc) run on these platforms.
