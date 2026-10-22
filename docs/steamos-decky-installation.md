# Decky installation, cache, permissions, and diagnostics

## Opt-in installation

Run as the normal Linux desktop account, **not** with `sudo`:

```bash
bash run.sh --files=decky-and-css-loader
```

The installer is on-demand only. It can share a comma-separated `--files=` selection
with other scripts. The self-extracting bootstrap includes the Node modules and
trusted package inventory; `run.sh` supplies Node. SteamOS
[`setup.bash`](../software/scripts/steamos/setup.bash) delegates through that bootstrap
after its explicit Decky confirmation. Other setup prompts and Steam shortcut tooling
remain separate; the Decky builder, stager, protected installer, and tests use Node.js,
not Python.

Linux desktop installations excluding WSL are supported. CI and dry-run selections
skip downloads and protected writes. The runtime rejects root and mismatched HOME
before creating logs or downloading packages. `curl`, `sudo`, Linux account lookup
(`getent`), and `/proc/self/fd` are required. `jq` is required only if the upstream
Loader bootstrap must run. Existing Loader services are not upgraded or restarted.

## Cache and trust

The canonical [`decky-packages.json`](../software/metadata/decky-packages.json)
pins nine plugins and nine themes. The first request is the rolling release asset
`steamos-decky__bundle.zip`. Missing, stale, or invalid packages recover from their
exact pinned upstream URLs. Downloads run concurrently in complete batches of **3**;
a failed batch waits for all in-flight work and starts no further batch.

Bundle paths remain `decky_plugin/` and `decky_css_loader/`, with
`<name>_v<version>.zip` filenames. `metadata.json` records provenance, hashes,
identities, versions, roots, and theme IDs. Remote metadata cannot change trusted pins.
Validation covers SHA-256, ZIP32 paths/types/bounds/CRC, selected root, identity,
version, theme ID, and nonempty compiled plugin `dist/index.js`. No downloaded
plugin code executes during validation. Limits are 256 MiB per download/member,
1 GiB expanded per archive, 1 MiB per JSON member, and 10,000 ZIP entries.

Centered Home v1.3 is selected. Existing extra files and settings remain intact.

## Ownership and repair

For the standard root-run Decky service, top-level plugin folders and `plugin.json`
are root-owned with mode `755`. Ordinary contents belong to the desktop account;
contents of plugins declaring the `root` flag belong to root. Themes belong to the
desktop account. Executable bits and extra files/settings are preserved. No blanket
recursive ownership or permission change runs across `homebrew`. Custom non-root
Decky services are outside this ownership policy.

Every run reapplies and verifies selected archive members, even at matching versions.
Protected writes use no-follow file descriptors anchored through Linux `/proc/self/fd`.
Destination symlinks, hardlinked files, special files, and invalid archives fail closed.
All archive payloads validate before destination mutation; filesystem failure during
writes can still leave a partial update. Rerun after correcting the reported cause.
No failure is reported as a verified installation.

## Saved diagnostics

The shared installer prints its private `~/Desktop/decky-install-*/install.log` path.
It records staging phases, package installation, protected write/verification output,
Loader bootstrap output when needed, and failure diagnostics. The private folder is
mode `700`; the log is mode `600`. Temporary download work is removed on success or
failure; logs persist. SteamOS setup also retains its private
`~/Desktop/steamos-setup.XXXXXX` stdout/stderr log, with timestamp, identity, OS/kernel,
Bash version, and source checksum (unavailable for streamed input).

Review logs before sharing: they may include local account and filesystem paths.
Terminal-only password prompts are not captured. No shell tracing or credential dump
is enabled. Downloads stay unprivileged; only upstream Loader bootstrap and protected
archive writes use scoped `sudo`.

## Refresh all packages to the latest verified versions

Use the repo-local [`refresh-steamos-decky-plugins` skill](../.agents/skills/refresh-steamos-decky-plugins/SKILL.md).
Ask an agent: **“Refresh all pinned Decky plugins and CSS Loader themes to the latest
verified installable releases.”** No package arguments means every inventory entry;
name specific packages only for a partial refresh.

The skill discovers upstream releases and approved theme blobs, verifies installable
archives, updates the single JSON inventory, tests, and rebuilds the whole bundle.
It reports old/new versions and blocked candidates instead of silently downgrading
or accepting unbuilt source ZIPs. Building alone does not discover updates or change
pins. Publication still requires a successful default-branch push; refreshing does
not install plugins, upload releases, or commit automatically.

## Build and checks

```bash
make build_decky_bundle DECKY_BUNDLE_OUTPUT="$HOME/steamos-decky__bundle.zip"
npx vitest run --config vitest.config.js software/tests/steamosSetup.cache.spec.js software/tests/steamosSetup.decky.spec.js software/tests/deckyZip.spec.js software/tests/deckyInstaller.spec.js
```

The deterministic Node builder downloads upstream-only, validates every pin and the
completed bundle, then atomically replaces output. Failed builds preserve previous
output. CI builds outside the checkout on PRs without release credentials; publication
uses credentials only on default-branch pushes after a successful build. It uploads a
uniquely named candidate before renaming the previous asset to a backup and activating
the candidate. Only successful activation permits backup deletion; activation failure
attempts to restore the previous name. Unlike local output replacement, GitHub asset
renames are not atomic. Interruption or failed rollback can require manual restoration
of the retained `.previous-*` asset's canonical name. Do not delete recovery assets
until the canonical bundle downloads and validates. No ZIPs are committed under
`assets/steamos/`.

`software/tests/deckyPublication.spec.js` executes the actual workflow shell against a
local release-API simulation, including upload, activation, rollback, and cleanup
failures. It does not verify live GitHub mutation behavior.

macOS tests simulate Linux descriptor paths and chown requests while exercising real
ZIP parsing, no-follow opens, writes, readback, and chmod. They do not establish live
sudo, NSS, Loader service, Gaming Mode, or SteamOS device behavior.
