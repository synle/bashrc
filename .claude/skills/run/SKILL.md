---
name: run
description: Generate the `bash run.sh --files=''` command for a script in software/scripts/. Use when you want to test-run a specific script.
argument-hint: <script-name-or-keyword> [more scripts...]
---

Generate the matching `bash run.sh --files='...'` command for a script in `software/scripts/`.

The user's query is: `$ARGUMENTS`

## Rules

- Only match scripts that are runnable via `run.sh --files=`. Per CLAUDE.md, these are files in `software/scripts/` with `.js` or `.sh` extensions.
- **Exclude** these non-runnable files:
  - Files with `_` prefix (`_init.js`, `_only.js`, `_only.sh`, `_full-setup.sh`, `_full-setup.ps1.bash`)
  - Files with `~` prefix (`~cleanup.js`, `~wrapup.sh`)
  - Anything in `software/bootstrap/`
  - Anything in `software/tools/`
  - Anything in `software/tests/`
  - Anything in `software/metadata/`
  - `.common.js` suffixed files (e.g. `editor.common.js`)
  - Skeleton files (e.g. `bash-autocomplete-complete-spec-skeleton.bash`)
  - Non-script files (`.jsonc`, `.zip`, `.ini`, `.gitconfig`, `.bash`, `.ps1`)
- OS-specific scripts are fine (e.g. `software/scripts/mac/brew.sh` -> `--files="mac/brew.sh"`).

## Steps

1. Run `find software/scripts -type f \( -name '*.js' -o -name '*.sh' \)` to get all candidate scripts.
2. Filter out excluded files per the rules above.
3. Split `$ARGUMENTS` by spaces/commas into individual queries. Fuzzy-match each query against the remaining filenames (basename without extension, or partial path match).
4. Resolve all queries to their matching script paths. If any query has multiple close matches, list them and ask the user to pick.
5. If any query has no match, tell the user and list a few similar candidates.
6. Combine all resolved paths into a single comma-separated `--files=` value and **execute**: `bash run.sh --files="fzf.js,git.js,mac/brew.sh"`

The `--files=` value should use paths relative to `software/scripts/` (e.g. `fzf.js`, `mac/brew.sh`, `git.js`), comma-separated for multiple scripts.

Always run the command after resolving all matches -- don't just print it.
