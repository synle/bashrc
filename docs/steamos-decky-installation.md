# Decky installation permissions and diagnostics

The standalone [`setup.bash`](../software/scripts/steamos/setup.bash) installs
Decky plugins and CSS Loader themes from this repository's vendored archives.
Run setup as the normal desktop account, **not** with `sudo`. Setup rejects root
and a `HOME` that differs from the invoking account's home. For Decky, setup uses
`sudo` only for the upstream installer and protected plugin/theme writes; downloads
and Steam configuration stay under the normal account. Other optional system tasks
retain their existing scoped elevation. Setup also offers shortcut cleanup and
system changes; decline unrelated prompts when testing Decky.

## Ownership and repair

For the standard root-run Decky service installed by this helper, top-level plugin
folders and `plugin.json` are root-owned with mode `755`. Ordinary plugin contents
belong to the desktop account; contents of plugins declaring the `root` flag,
including HueSync, belong to root. Themes belong to the desktop account. Executable
bits are preserved, and unrelated service files and extra plugin settings are not
modified. Setup does not recursively change ownership or permissions across
`homebrew`. Custom non-root Decky service configurations are outside this helper's
supported ownership policy.

Every run reapplies and verifies archive members, even when the installed version
matches. This repairs missing or truncated files left by failed extraction; it does
not delete extra files. ZIPs are checked for unsafe paths, symlinks, special files,
duplicate members, CRC errors, and required metadata before payload writes. Existing
symlink/hardlink file targets and symlinked destination folders are rejected. The
extraction limits are 1 GiB per archive and 256 MiB per file.

## Saved diagnostics

Setup prints the path to a private `~/Desktop/steamos-setup.XXXXXX` log containing
stdout and stderr. Startup diagnostics include timestamp, account identity,
OS/kernel, Python version, and script checksum (unavailable for streamed input).
Each Decky archive logs its SHA-256, size, resolved account/group, privilege choice,
target ownership/mode before and after installation, and verified file count.
Failures report the phase, archive, member, error, and nonzero status. Shell tracing
is not enabled, and the installer does not dump archive contents or credentials.
Terminal-only confirmation/password prompts are not part of the captured streams.
Review the log before sharing it: it includes local account and filesystem paths.

If installation fails, retain the log and staged ZIPs in
`~/Desktop/decky_plugins/`. Correct the reported cause, then rerun setup and select
Decky installation. Repeated runs repair archive members; no manual recursive
`chmod` or `chown` of `homebrew` is needed. A failed write can leave that archive
partially updated, so a failure is never reported as a verified installation.
