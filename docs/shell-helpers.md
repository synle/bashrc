# Shell helper reference

[Developer guide](../DEV.md). Run repository commands from the checkout root.

## Running a Subset

`./run` invokes `run.sh` and accepts `--file` / `--files` and `--preset` / `--presets`, with either `=value` or a separate value.
Names match exactly and case-insensitively by default. File selectors accept exact paths, basenames, or basenames without extensions.
Use `name*` for prefix matches, `*name` for suffix matches, and `*name*` for contains matches. Internal stars are unsupported.
Quote wildcard arguments so the shell passes them unchanged. One match runs automatically; multiple matches require confirmation before any selected script executes.
The red warning names `files` or `presets` and lists all matches. Enter accepts; No, EOF, a 30-second timeout, or no terminal cancels.
Pass `--skip-prompt` to run every eligible match without selector confirmation, including without a terminal. This presence flag defaults to false.
Match warnings, missing-name errors, OS/work-profile guards, and unrelated prompts remain unchanged. The single-dash form `-skip-prompt` also works.
There are no short file/preset aliases; existing `-f` still means force refresh.

```bash
./run --files=git.js              # one script
./run --file git.js               # singular alias, separate value
./run 'vim*'                      # all scripts with this basename prefix
./run --skip-prompt 'vim*'        # all eligible matches without selector confirmation
./run --files='*config.js'        # explicit suffix match
./run --preset=lightweight        # named preset
./run --preset=terminal,prompt    # union
./run --presets terminal         # plural alias, separate value
./run '@llm*'                     # preset prefix expansion with confirmation
./run @llm                        # strict preset lookup
./run editors                     # bare arg: script-first, preset fallback
./run --refresh="fzf.js,fonts.js" # force-refresh specific scripts
./run --dryrun --setup            # preview, no writes
./run --remove --files=fzf.js     # undoWork for one script
```

Presets live in `software/metadata/presets.jsonc` (JSONC). Each entry declares `files[]` and/or recursive `presets[]`; cycles rejected at parse time by `expandPresetFiles`, guarded by `software/tests/presets.spec.js`. Composites: `lightweight` / `heavyweight`. Building blocks: `editors`, `emulators`, `apps`, `browsers`, `terminal`, `prompt`, `llm`.

Resolution priority: file flags are script-only; preset flags and bare `@<x>` are preset-only; other bare arguments search scripts first, then presets.
Exact file paths take priority over basename matches. Script matches take priority over bare-name preset fallback.
Explicit comma-separated lists do not require confirmation merely because they contain several keywords.
Missing separate option values fail before selection. Existing empty `--files=` and `--preset=` values remain no-ops.

### Selector migration

Hash-prefixed preset shorthand is no longer supported. Replace `'#name'` with `@name`, or use `--preset=name`.
Implicit fuzzy abbreviations are no longer supported. Replace `--preset=editor` with `--preset=editors` or quote `--preset='editor*'`.
For automation without a terminal, provide exact preset names or unambiguous file paths, or pass `--skip-prompt` to accept every eligible match.
Both SteamOS setup installer calls pass `--skip-prompt` so matching-name confirmation cannot interrupt those delegations.

## Purging local Git branches and tags

The shell helper `purge_branches_and_tags` operates only on the current repository:

```bash
purge_branches_and_tags --dry-run
purge_branches_and_tags
```

It keeps origin's detected default branch, falling back to local `main`, then `master` when origin cannot identify a default.
The retained branch must exist locally. The command switches to it without forcing checkout, deletes every other local branch, including unmerged branches, and deletes all local tags.
Remote branches and tags remain unchanged. The command never resets or cleans working files and never removes linked worktrees.
Checkout failures stop deletion; branches checked out in other worktrees cause a nonzero result and can leave an incomplete purge.
Unpushed branch tips and local-only tags lose their names; record any needed commit IDs before purging.
Remote-backed refs can be fetched again, but local-only refs have no guaranteed recovery.

## Native navigation

`gogitroot` (alias `goroot`) returns to the nearest enclosing Git worktree root, including nested repositories and linked worktrees.
Outside a Git worktree, it returns Git's error without changing folders.
`godown` aliases `godownload`, including its optional subfolder argument.

`cd` tries native Bash navigation first, preserving exact paths, options, `CDPATH`, symlinks, previous-folder behavior, HOME, and failure status.
Missing paths use fuzzy matching from their longest existing folder prefix, including parent-relative paths and absolute paths expanded from `~/`.
Without an existing prefix, relative queries search from the current folder.
Files, exact paths, bare `..`, and option forms retain native behavior; unresolved `.` or `..` components never enter fuzzy matching.
An asynchronous breadth-first search considers at most 3 levels below the anchor, 20,000 entries, and 2 seconds.
The first matching depth wins. Within that depth, exact components rank above prefixes, prefixes above substrings, then shorter suffixes and lexical paths.
Search reuses `_IGNORED_FOLDERS_JSON`; excluded cache folders stay hidden unless every matching excluded component appears exactly in the segmented query.
One match prints `print_action_summary` and changes directory. Multiple matches show at most five paths; choose 1–5 or type a displayed path.
Anchored matches display absolute paths; unanchored matches retain relative paths.
Selection requires terminal stdin and an accessible `/dev/tty`; piped stdin remains untouched even when a controlling terminal exists.
Searches with no safe match preserve Bash's native failure status.
The `..`, `...`, and `....` aliases use `cd`; folder completion keeps the shared registry. Profile refresh does not remove navigation history.

Refresh the complete profile with `./run`, then open a fresh shell.
Refresh completion alone with `./run --files=advanced/bash-autocomplete-complete-spec.js` or the broader `./run --preset=terminal`.
Regression coverage lives in `software/tests/nativeCd.spec.js` and `software/tests/integration/fuzzyCd.spec.js`.

## Native file listing

`ls` uses the native executable without an alias, wrapper, or injected arguments.
`ll` is a function that forwards arguments to native `ls` with long-listing options, readable sizes, and file-type indicators.
When `filter_unwanted` is available, `ll` pipes output through its shared ignore patterns, hiding metadata such as `.DS_Store` and other matched clutter.
Other hidden files remain visible unless a shared pattern matches them. Minimal profiles without the advanced filter retain native output.
The filter operates on output lines, so its patterns can also match folder headers or other listing text.
Native errors remain nonzero; a successful listing with no retained lines returns zero. Filtering never modifies files.

- `ls_newest` / `ls_newest_first`: newest entries last / first.
- `ls_biggest` / `ls_biggest_first`: largest entries last / first.

Sorting shortcuts are explicit aliases to `ll`, not generated command variants.
Long listings retain native timestamps, permission columns, terminal colors, and supported GNU hyperlinks.
Use `ll --help` for usage. Refresh the profile with `./run`, then open a fresh shell.

## Image compression

`image_compress` compresses individual PNG/JPG/JPEG files or recursively processes a folder, preserving relative paths.
It requires Node.js and the `sharp` executable from [sharp-cli](https://github.com/vseventer/sharp-cli).
Use Bash on macOS or WSL, and Git Bash on native Windows; this is not a PowerShell function.
Dependencies are not installed automatically.

```bash
image_compress --purge=no photo.jpg                          # retain photo.jpg; create photo.converted.jpg
image_compress --quality=85 --purge=0 photos compressed       # retain sources; mirror images into compressed/
image_compress --outputFormat=png --purge=no photo.jpg        # create photo.converted.png
image_compress --outputFormat=jpg --autoOrient=y photos out  # convert recursively, then remove successful sources
image_compress --help
```

| Option                              | Default        | Meaning                                                                       |
| ----------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| `--quality=0-100`                   | JPG 82; PNG 85 | Lossy encoder quality; zero maps to the encoder minimum of one.               |
| `--compression=0-9`                 | 9              | PNG zlib compression level; ignored for JPEG.                                 |
| `--purge=value`                     | true           | Replace sources in place, or remove them after successful output publication. |
| `--autoOrient=value`                | true           | Apply EXIF orientation before encoding.                                       |
| `--outputFormat=preserve\|jpg\|png` | preserve       | Keep the input extension or convert to the chosen format.                     |

Both booleans use the global `is_truthy`: `1`, `true`, `y`, and `yes` enable them, case-insensitively; other values disable them.
Options also accept separate values and must precede the input. Use `--` before a leading-dash input.
An explicit output always names a folder, including for a single source file.

**The default is destructive:** `--purge=true` replaces or deletes original images after successful lossy encoding.
Without an output folder, purge replaces the source; a format change writes the new extension and removes the old file.
Without purge or an output folder, names gain `.converted` before their preserved or chosen extension.
With an output folder, names remain ordinary filenames and nested folders mirror the input structure.
PNG uses palette reduction, so it is not lossless. JPEG conversion flattens transparency onto white. Sharp strips metadata by default.
Compression may increase file size; repeated lossy conversion can reduce quality further. Keep backups when using purge.

The command preflights existing destinations and name collisions before encoding; it never intentionally overwrites a separate existing destination.
Each image is staged beside its destination; encoding failures retain the source and remove staging files.
Detected source changes also prevent replacement or purge. The command is not a lock against arbitrary concurrent filesystem writers.
Successful earlier conversions remain when a later file fails; the batch returns nonzero for any failure.
Each encoder invocation has a two-minute deadline.
Recursive scans skip symlinks, protected `.secret.` paths, previously converted images, and the explicit output subtree.
Direct symlink inputs and outputs are rejected; parent aliases such as macOS `/var` are resolved to physical paths.

The function is included in the standard profile; refresh with `./run` and open a fresh shell.
Contract tests live in `software/tests/imageCompress*.spec.js`; their owned encoder fixture verifies command arguments and filesystem behavior, not compression quality.

## Worktree listing

`worktree_list` lists primary and linked worktrees without changing Git state or querying remote services.
It scans the current folder and nested repositories through depth three, excluding hidden/cache folders and symbolic-link recursion.
Discovered repositories include all registered worktrees, even when linked paths lie outside the scan folder.

```bash
worktree_list           # pretty output (default)
worktree_list --pretty  # explicit pretty output
worktree_list --raw     # JSON array
```

Pretty output groups worktrees under `📦 <org>/<repo>  <root_path>` headers.
Each worktree row uses `🌳 [<size>]  <branch_name>  <worktree_path>`.
Interactive `worktree_clean --mode interactive` prints the same row before each pending all/y/N confirmation.
Cleanup statuses use one line: `<icon> <action> [<size>]  <branch_name>  <worktree_path>  <reason>`.
Sizes are measured before deletion so removed rows retain their storage information.
Cleanup repository headers compact the repository, root path, and default ref onto one line.
Both commands use the shared `git.worktree_info.cjs` formatter deployed beside them by the installer.
Size is allocated disk usage from `du -skP`, including ignored and untracked content without following symlinks.
Decimal labels use 1 MB = 1,000,000 bytes; shared Git objects outside linked worktrees are not counted.
Missing, unreadable, unsupported, or timed-out measurements show `[unknown]`; each probe has a two-second deadline.
Raw JSON does not probe sizes or add size fields.
Raw records contain `branch_name`, `repo`, `org`, `worktree_path`, and `root_path`.
`root_path` identifies the primary checkout; detached/bare branches and unknown organizations use JSON `null`.
Repositories without a network origin use the primary folder name.
Malformed network origin URLs fail with a diagnostic instead of producing an inventory.
Pretty output labels detached/bare branches and escapes terminal control bytes; raw JSON preserves exact path values.
An empty scope produces `[]` in raw mode.

Install through `./run --files=git-functions.js` or the broader `./run --preset=terminal`.

## Terminal links

Terminal link helpers render labels in blue without explanatory hints. Open links with your terminal's link gesture; modifier keys vary by terminal.
Agent replies use Markdown links where supported, otherwise complete plain URLs. Raw OSC 8 bytes belong only in terminal programs.

- Shell: call `format_hyperlink "$url"` directly between `printf` calls, never through command substitution.
- Installer diagnostics: `log()` linkifies HTTP(S) and file URLs on stderr without changing generated stdout.
- Git helpers: PR and worktree links emit OSC 8 only on their human output TTY.
- Delta: hyperlink behavior follows the active Git configuration. File targets may require an installed editor URI handler.
- Pager: `PAGER="less -R"` preserves OSC 8 on supported less versions. Do not use unsafe `less -r` as a workaround.
- Listing: native `ls` remains unchanged. `ll` requests automatic hyperlinks only when GNU ls advertises support; BSD ls keeps its existing flags.
- Search: `rg_link` and `fd_link` add native hyperlink flags only on a non-dumb terminal when the binary advertises support.
- tmux: the configured append-only `hyperlinks` feature enables forwarding on supported versions.
- Ghostty inside tmux: Shift bypasses mouse capture; the existing macOS gesture is Shift+Cmd+click.
- Pipes, redirected output, JSON, clipboard contents, and machine-only link lists receive no added OSC 8 or color escapes.

Refresh the profile with `./run`; refresh Git tooling with `./run --files=git-functions.js` or the broader `./run --preset=terminal`.
Unsupported applications keep their native output. Byte-level PTY tests do not prove physical clicking in every emulator.

### File search colors and Git diffs

The profile defaults `LS_COLORS` to terminal ANSI colors, avoiding fd's bright fixed 256-color fallback.
Regular file names use the terminal foreground; folders, links, and executables retain native palette distinctions.
Custom values, including an explicitly empty `LS_COLORS`, remain unchanged.

Git's `d`, `dh`, `ds`, and their one-/two-column variants send unified patches to the configured pager.
Delta performs word highlighting itself; Git's `--word-diff` markup prevents normal Delta line rendering even when the pager runs.
Log shortcuts keep their graph for ordinary history and disable it for explicit patch flags so Delta can recognize patch headers.
Explicit `--no-pager`, `GIT_PAGER`, and command-specific pager settings still follow Git's native precedence.

Test terminal support directly:

```bash
printf '\033]8;;https://example.com\033\\\033[34mExample\033[0m\033]8;;\033\\\n'
```

The [Delta hyperlink manual](https://dandavison.github.io/delta/hyperlinks.html) describes file and commit targets.

## Smart file diff

`diff file1 file2` compares arbitrary files in Delta's one-column layout; `file1` stays left, `file2` stays right. `diff -delta2 file1 file2` selects two columns.

Both layouts use Git's no-index comparison, including inside repositories. For Delta styling, configure Delta as Git's pager; Git controls terminal rendering.

Add leading `-r` or `--reverse` to swap left and right before comparison.
The reverse flag and renderer selector may appear in either order before the operands:

```bash
diff -r file1 file2
diff --reverse target_file sha1
diff -delta2 -r target_file sha1 sha2
diff --reverse -code target_file sha1 sha2
```

Repeated reverse flags still reverse only once. Use `--` before filenames that resemble wrapper flags.
Working-tree Git comparisons also reverse through Git's `-R` option.
With native flags, such as `diff --reverse -u file1 file2`, the final two operands must be existing files.
For native recursive folder comparison, bypass the wrapper with `command diff -r folder1 folder2`.

Tracked-file history supports two additional forms:

```bash
diff target_file sha1       # file at sha1 on the left, committed HEAD on the right
diff target_file sha1 sha2  # file at sha1 on the left, file at sha2 on the right
```

With two operands, an existing second path always takes precedence, even if its name resembles a commit.
Only a nonexistent second path triggers file/revision fallback; directories and broken symlinks receive file errors instead.
Three positional operands always select tracked-file revision mode.
Both historical forms require a Git-tracked file in the current repository, with file contents present at both commits.
Commit revisions such as abbreviated hashes, `HEAD`, and `HEAD~1` are accepted; blobs, trees, and invalid revisions are rejected.
Errors identify each invalid revision as `sha1=<value>` or `sha2=<value>` and return nonzero without launching a comparison.
The implicit second revision is committed `HEAD`, never staged or unstaged file content.
Historical comparisons do not change the index or working tree.

All renderer selectors below also accept these historical forms, such as `diff -delta2 target_file sha1 sha2` and `diff -code target_file sha1`.
Historical bytes are written without newline trimming into private snapshots under `${TMPDIR:-/tmp}/diff-revisions.*`.
Terminal comparisons and failed launches remove their snapshots.
Successful GUI launches retain snapshots for asynchronous readers and print their folder to stderr; remove that folder after use.

Use `diff -code file1 file2` for VS Code. Use `diff -zed` or `diff -z` for Zed, and `diff -winmerge` for WinMerge. Use `diff -smerge` or `diff -sublime_merge` for Sublime Merge.

Sublime Merge uses `smerge` first, then falls back to `smerge.exe`. Other editor modes require their named command or launcher. Missing commands produce an error instead of silently changing tools.

Shortcuts: `diff_delta1`, `diff_delta2`, `diff_code`, `diff_zed`, `diff_z`, `diff_winmerge`, `diff_smerge`, and `diff_sublime_merge`. Each alias accepts its matching mode's arguments.

`pdiff [diff options] file` compares the clipboard on the left with the supplied file on the right, reusing `paste` and `diff`.
The final argument is the file; preceding options pass unchanged to `diff`. Examples: `pdiff file`, `pdiff -delta2 file`, `pdiff -code file`, and `pdiff -u file`.
Use `pdiff -- -filename` for a leading-dash filename.
Matching shortcuts are `pdiff_delta1`, `pdiff_delta2`, `pdiff_code`, `pdiff_zed`, `pdiff_z`, `pdiff_winmerge`, `pdiff_smerge`, and `pdiff_sublime_merge`.

Clipboard bytes go directly into a private `mktemp` file under `${TMPDIR:-/tmp}` without stripping trailing newlines.
Successful captures remain as `pdiff.*` snapshots because GUI launchers may return before reading them; remove these clipboard-bearing files when done.
Missing files and help requests do not read the clipboard. Failed captures remove partial snapshots and return the capture failure without launching a comparison.

With no selector, two file paths compare by default. Two commit hashes compare Git revisions; an available GitHub remote preserves the existing compare-page opening.

Inside a repository, no arguments show tracked working changes. One path shows tracked changes or compares an untracked file against empty content. Outside a repository, one path is compared against standard input by native `diff`.

Prefix a leading-dash filename with `--`. Unselected leading flags such as `-u` pass directly to native `diff`. Explicit `-delta1` and `-delta2` modes accept Git diff flags.
