# snip — CLI output filter

[`snip`](https://github.com/edouard-claude/snip) shrinks verbose command output down to
the part worth reading. It matters most when the reader is an LLM paying for every token:
`git log -20` costs 27,573 bytes raw and 1,555 through snip, a 95% cut with the commit
list still intact.

The shell integration ships in
[`software/scripts/bash-snip.profile.bash`](../software/scripts/bash-snip.profile.bash),
inlined into `~/.bash_syle` by a `# SOURCE` marker in
`software/bootstrap/profile-advanced.sh`. The binary itself is **not** installed by this
repo — see [Installing the binary](#installing-the-binary).

| Function               | Does                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| `sn`                   | Run a command through snip when a filter covers it (`-f` to force) |
| `snip_coverage`        | Report how much of your own shell history snip can filter          |
| `snip_logs`            | List / print the full output snip saved when a filter tee'd        |
| `_snip_ready`          | [internal] Succeed when the snip binary is on `PATH`               |
| `_snip_tee_folder`     | [internal] Resolve the folder snip tees full output into           |
| `_snip_history_shapes` | [internal] Rank `$HISTFILE` by `<binary> <subcommand>`             |

Every function carries inline `--help`, which is the source of truth:

```bash
sn --help
snip_coverage --help
snip_logs --help
```

## Why this is opt-in and never a transparent wrapper

**snip rewrites output even when stdout is a pipe.** That single fact drives the whole
design. Measured against the real binary:

```console
$ command ls -la /usr/bin | wc -l
927
$ snip run -- ls -la /usr/bin | head -1
Aug 12 19:51  aa  346976
```

The permission, link-count, owner, and group columns are gone and the remaining ones are
reordered — from a pipe, not from a terminal. Anything parsing that output would silently
read the wrong field. So `git`, `ls`, `gh`, and friends are deliberately left as
themselves; there is no `snip_on` toggle and no shell function shadowing a real binary.
Reach for `sn` when you want the short form, and call the binary directly when you want
the bytes.

This is the same reason the repo insists on `command cat` over a bare `cat` that may be
aliased to `bat` — a wrapper that mangles a byte stream is a wrapper you cannot build a
script on.

## `sn` — the opt-in prefix

`sn` dispatches four ways and stays silent when it passes through:

| Condition                                        | What happens                 |
| ------------------------------------------------ | ---------------------------- |
| The name is a **shell alias**                    | Resolve it, then re-dispatch |
| snip not installed, or no filter for the command | Run it untouched             |
| The name is a **shell function**                 | Run the function untouched   |
| A filter exists                                  | Run it through `snip run --` |

The exit code is always the command's own — `sn bash -c 'exit 42'` returns 42.

```bash
sn ls -la                                       # alias resolved, then filtered
sn gh pr view 3184 --repo acme/widget-store
sn -f git log -20                               # -f overrides the function branch
```

### Aliases are resolved, not refused

Bash expands an alias in **command position only**, so `sn ls` would otherwise die with
`command not found` — a universal bash fact that hits every wrapper function, snip just
makes it visible. `sn` resolves the leading alias itself, exactly as the shell would:

```console
$ alias ls
alias ls='ls -1 -F --color'
$ sn ls -la
Aug 23 07:59  ./  1344
Aug 22 20:58  ../  608
```

`ls -la` becomes `ls -1 -F --color -la`, matches the `ls` filter, and drops from 2,920
bytes to 1,375. Resolution is bounded at five hops and stops as soon as an alias resolves
to its own name, so the self-referential `ls='ls -1 -F --color'` cannot spin.

**Resolution can also resolve _away_ from a filter.** `make` is aliased to `gmake` here,
and `snip check -- gmake validate` reports no filter where `make validate` matches the
`make` filter. `sn` follows the alias because that is what the shell does and the alias is
there for a reason — but it means `sn make validate` filters nothing. Run
`snip check -- <command>` when it matters.

### Shell functions keep their wrapper unless you say otherwise

`npm install` has a snip filter, but `npm` in this repo is a **shell function** from
[`bash-command-wrappers.profile.bash`](../software/scripts/bash-command-wrappers.profile.bash)
that turns bare args into `npm run <name>` and picks up the fnm-activated node. snip execs
a real binary, so routing through it would silently skip that wrapper. `sn` detects the
function and runs it directly instead:

```console
$ sn npm install
REPO-WRAPPER-RAN: install
```

Same for `node`, `python`, `pip`, `yarn`, `bat`, `sqlite`, `su`, and `git` — `git` is a
function that invalidates the prompt's git cache after a mutating subcommand.

`-f` (or `--force`) makes the trade explicitly: filter through the real binary and accept
that the wrapper is bypassed. That is what unlocks snip's nine git filters:

```console
$ sn git log -20        # function branch — full 27,573-byte log
$ sn -f git log -20     # 1,555 bytes
20 commits:
050452f wip (38 minutes ago) <Sy Le>
```

For `git log` nothing is lost, since the wrapper's cache invalidation only fires on
mutating subcommands. `sn -f git push` would skip it — which is exactly why `-f` is
something you type rather than the default.

When snip is absent, `sn` is a transparent passthrough. That is what makes it safe to type
into a doc, a script, or an agent instruction without gating on whether the machine has
snip installed.

## `snip_coverage` — where snip is and isn't helping

`snip discover` scans agent session transcripts. `snip_coverage` reads the commands **you
actually typed**, buckets them by the same `<binary> <subcommand>` shape snip keys filters
on, and checks each of the top N:

```console
$ snip_coverage 10
      29  ls                             ls
      15  tmux new-window                -
      10  git                            -
       6  paste                          -
       6  cp                             -
       5  patch                          -
       5  make                           make
       4  tmux                           -
       4  git s                          -
       4  g s                            -
  > Coverage > 2/10 command shapes > 34/88 runs (38%)
```

`<top-n>` defaults to 25. A `-` on a shape you run constantly is the argument for adding a
project-local filter (see [Project-local filters](#project-local-filters)).

Reads `$HISTFILE`, falling back to `$HOME/.bash_history`, matching `history_cleanup` in
[`bash-history.profile.bash`](../software/scripts/bash-history.profile.bash). Pipelines are
truncated at the first `|`, `;`, `&`, `<`, or `>` so `paste | ...` registers as `paste`
rather than as its own shape; leading env assignments and `sudo` / `command` / `sn`
prefixes are stepped over; and a second token that is a flag is dropped, because `ls -la`
is covered by the plain `ls` filter.

## `snip_logs` — reading back what was filtered out

Some filters tee the unfiltered output to disk so the dropped lines survive a failure.
snip ships no command to read those back, which is the gap this fills:

```bash
snip_logs           # list every saved log, newest first
snip_logs 1         # print the newest
snip_logs 1787203970-ruff.log   # print one by name
```

The folder is `$SNIP_TEE_DIR` when set, otherwise derived from the `tracking.db_path` that
`snip config` prints — the tee folder is its sibling. Deriving beats hardcoding the XDG
guess, which is only the default. `tee.mode` defaults to `failures`; set `SNIP_TEE=all` to
tee successful runs too.

## Installing the binary

[`software/scripts/advanced/snip.sh`](../software/scripts/advanced/snip.sh) installs the
binary through snip's own POSIX installer (`curl -fsSL .../install.sh | sh`) on macOS and
Linux, gated on `has_persistent_binary` so it is a no-op once present. It lands in
`/usr/local/bin` when writable, otherwise `$HOME/.local/bin`. Windows is skipped — the
installer ships no Windows release. `snip` is in the `warn` list of
[`software/metadata/ci-binaries.json`](../software/metadata/ci-binaries.json), never
`required`, since it is an advanced-profile tool absent on limited-support OSes.

```bash
bash run.sh --files="snip.sh"   # install / refresh the binary
snip --version                  # currently v0.24.1, 132 filters
```

The profile partial still has no hard dependency on it — `_snip_ready` gates every path,
`sn` degrades to a passthrough, and `snip_coverage` / `snip_logs` report plainly that snip
is missing, so a machine that skipped the installer (limited-support OS, install failure)
keeps working.

## No agent integration — removed on purpose

snip is a **human-only** tool here. There is no Claude/Copilot/Gemini hook and no
opencode plugin, and there must not be one. Every attempt to auto-route an agent's shell
commands through snip was reverted because snip's agent hooks / the `opencode-snip`
plugin rewrite the command by prepending `snip`, which breaks two things fundamentally:

- **Compound commands** — a `for … do … done` loop or a multi-command one-liner comes
  out as `snip for …; snip do …; snip done`, which is invalid bash (`snip: for cannot be
proxied`, `syntax error near unexpected token 'do'`).
- **Machine-readable output** — a `gh pr list --json …` (or any `--json` / `--jq`) result
  the agent needs to parse is filtered by snip and arrives corrupted.

The agent runs every command through snip with no TTY guard and no compound-command
detection, so there is no safe subset. `snip init --agent …`, the `~/.copilot/hooks/snip.json`
hook, the `~/.claude/settings.json` `PreToolUse` entry, the `~/.gemini/GEMINI.md` block, and
the `opencode-snip` plugin are all intentionally **not** installed. Leave it that way.

The token-saving benefit is kept for the human path instead, where it is safe: the
TTY-guarded interactive shell wrappers (see `bash-snip-command-wrappers.profile.bash`) and
the explicit `sn <cmd>` helper.

## What is deliberately not wired

**No project-local filters yet.** See below.

**No `git` / `gh` / `ls` shadowing.** Covered under
[Why this is opt-in](#why-this-is-opt-in-and-never-a-transparent-wrapper).

## Project-local filters

snip loads filters from `filters.dir` (`~/.config/snip/filters`, YAML, one file per
filter) and supports project-local filter files gated behind a SHA-256 trust store:

```bash
snip trust <file>     # trust a project-local filter by hash
snip untrust <file>
```

An untrusted file is skipped with `snip: skipping untrusted filter <path> (run 'snip trust
<path>' to trust)`. Nothing here ships a filter yet — the obvious candidate is
`bash run.sh`, this repo's own primary command, which `snip check` reports as **no
filter** despite being one of the most verbose things anyone runs here. The cost is a
per-machine `snip trust` step, which is why it has not been taken on speculatively.

## A filter existing does not guarantee a saving

Measured on this machine, same command run both ways:

| Command           | Raw    | Through snip | Saved |
| ----------------- | ------ | ------------ | ----- |
| `git log -20`     | 27,573 | 1,555        | 95%   |
| `ls -la /usr/bin` | 57,214 | 9,441        | 84%   |
| `git status`      | 469    | 97           | 80%   |
| `make --help`     | 2,904  | 2,903        | 1%    |

`make --help` matches the `make` filter and saves nothing — the filter targets build
output, not help text. Check with `snip check -- <command>` (exit `0` when a filter
matches, `1` when none does) rather than assuming a matched filter is a win.

## Reference

```bash
snip check -- git log     # which filter covers this command
snip run -- <cmd>         # run through the filter pipeline
snip gain                 # token-savings report (--daily/--weekly/--top N)
snip cc-economics         # the same, priced per API tier
snip verify               # run the filters' own inline tests
snip config               # resolved paths and settings
snip discover             # scan agent sessions for missed opportunities
snip proxy -- <cmd>       # run with filtering explicitly off
```

Savings accumulate in a SQLite tracking db (`tracking.db_path` from `snip config`), so
`snip gain` reports across every run, not just the current shell.
