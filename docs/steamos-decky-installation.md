# Decky installation, repository packages, permissions, and diagnostics

## Opt-in installation

Run as the normal Linux desktop account, **not** with `sudo`:

```bash
./run --files=software/scripts/decky-and-css-loader.standalone.js
```

The installer is on-demand only and can share a comma-separated `--files=` selection.
The self-extracting bootstrap includes Node helpers, inventory, and approved repository ZIPs; `run.sh` supplies Node.
SteamOS [`setup.bash`](../software/scripts/steamos/setup.bash) delegates through that bootstrap after explicit confirmation.
Other setup choices and shortcut tooling remain separate. Decky validation and installation use Node.js, not Python.

Linux desktops excluding WSL are supported. CI and dry-run selections skip downloads and protected writes.
The runtime rejects root and mismatched HOME before creating logs or downloading packages.
`curl`, `sudo`, Linux account lookup (`getent`), and `/proc/self/fd` are required.
`jq` is required only when the upstream Loader bootstrap must run.

## Authoritative inventory

[`software/metadata/decky-packages.json`](../software/metadata/decky-packages.json) contains:

```json
{
  "decky_loader_version": "3.3.0",
  "decky_packages": [
    {
      "path": "assets/steamos/decky_loader_plugins/HueSync_v3.9.0.zip",
      "name": "HueSync",
      "version": "3.9.0"
    }
  ]
}
```

This example shows one entry; the canonical inventory retains all ten plugins and nine themes.
Versions are hand-picked repository versions, not automatic upstream-latest selections.
Eighteen selected archives live in `assets/steamos/decky_loader_plugins/`; Decky-Framegen uses a pinned upstream release archive.
That folder is the only approved source for compact entries requiring `path`, `name`, and `version`.

The runtime derives SHA-256, actual native archive root, plugin/theme kind, and theme ID from trusted repository bytes.
It verifies embedded identity, version, and compiled plugin payload before installation.
Names and filenames need not match native archive roots.
Source symlinks, hardlinks, unsafe paths, missing files, oversized files, and duplicate installation roots fail closed.
The self-extracting installer carries the ZIP folder; local runs read their checkout, while remote script runs fetch approved repository paths.
Upstream attribution remains in [`assets/steamos/README.md`](../assets/steamos/README.md).

Existing rich entries remain supported with bundle `path`, `name`, `version`, `root`, HTTPS `url`, `sha256`, and optional `source`/`theme_id`.
Arbitrary remote ZIPs still require an independently verified hash; calculating a hash after an untrusted download does not establish authenticity.
Migrating a former array-only inventory requires wrapping it under `decky_packages` and adding an exact stable `decky_loader_version`.

Decky-Framegen's stable release ZIP exceeds [GitHub's 100 MiB Git-file limit](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
Its rich entry pins the exact release URL, native root, version, and independently verified SHA-256; the generated cache bundle includes the archive.
No Git LFS or oversized Git object is required. Existing Decky LSFG-VK remains selected as a separate plugin.
After installation, open Decky-Framegen and choose **Setup OptiScaler Mod**, then configure each game according to upstream guidance.
The installer does not enable frame generation or patch games automatically.

## Exact Loader version

Setup compares `~/homebrew/services/.loader.version` with the configured Loader version.
A complete matching installation skips Loader reinstallation, but package reapplication and final service restart still run.
Missing, unreadable, or different stamps trigger installation of the selected version, including replacement of newer, custom, or prerelease versions.
Blank versions and floating values such as `latest` are invalid.

The runtime checks the tagged GitHub release, requiring the exact selected stable tag, `prerelease=false`, and `draft=false`.
The upstream shell installer has no version argument.
The runtime replaces only its verified release-selection line with a read of the validated tagged-release snapshot supplied as an argument.
A changed or duplicated upstream selector stops installation before elevation rather than silently selecting another release.
Post-install version verification is mandatory. Failed lookup, bootstrap, or verification never reports an unknown version as current.
The upstream bootstrap retains its existing service setup behavior and can restart the service during Loader replacement.

## Cache and trust

The runtime first tries the rolling `steamos-decky__bundle.zip` release asset.
Missing, stale, or invalid cached packages recover from their selected repository ZIPs or exact rich-entry upstream URLs.
A changed repository ZIP produces a new trusted hash, so an older cache cannot override it even at the same package version.
Downloads run in complete concurrent batches of **3**; a failed batch waits for in-flight work and starts no further batch.

Bundle paths remain `decky_plugin/` and `decky_css_loader/`, with `<name>_v<version>.zip` filenames.
`metadata.json` records provenance, hashes, identities, versions, roots, theme IDs, and repository source paths.
Remote bundle metadata cannot change the selected inventory or derived trusted hashes.
Validation covers SHA-256, ZIP32 paths/types/bounds/CRC, selected root, identity, version, theme ID, and nonempty plugin `dist/index.js`.
No downloaded plugin code executes during validation.
Limits remain 256 MiB per download/member, 1 GiB expanded per archive, 1 MiB per JSON member, and 10,000 ZIP entries.
Centered Home v1.3 remains selected.

## Ownership, overwrite, and reload

Every run reapplies and verifies selected archive members, even at matching versions or when installed packages are newer.
The repository wins for files included in selected archives; unrelated plugins, extra files, and settings outside those members remain intact.
This is not a folder wipe: obsolete extra files are not automatically removed.
After every successful package pass, setup runs `sudo systemctl restart plugin_loader.service` and verifies active state.
A failed restart or inactive service fails setup; it never prints verified completion.

For the standard root-run Decky service, top-level plugin folders and `plugin.json` are root-owned with mode `755`.
Ordinary contents belong to the desktop account; contents of plugins declaring `root` belong to root.
Themes belong to the desktop account. Executable bits remain preserved.
No blanket recursive ownership/permission change runs across `homebrew`; custom non-root Decky services remain outside this policy.

Protected writes use no-follow descriptors anchored through Linux `/proc/self/fd`.
Destination symlinks, hardlinked files, special files, and invalid archives fail closed.
All archive payloads validate before destination mutation, but filesystem failure during writes can leave a partial update.
Correct the reported cause and rerun to reapply the selected files.

## Saved diagnostics and long package output

The Decky installer prints its private `~/Desktop/decky-install-*/install.log` path.
It records staging, protected write/readback output, Loader version/bootstrap checks, service restart/active checks, and failures.
The folder is mode `700`; the log is mode `600`. Temporary download work is removed on success or failure; logs persist.
SteamOS setup also retains its private Desktop `steamos-setup.XXXXXX` stdout/stderr log with timestamp, identity, OS/kernel, Bash version, and source checksum.
Streamed setup cannot record a source checksum.

SteamOS collects operational yes/no choices, including USB wake-up, before downloads and installation.
The final completion acknowledgment remains at the end.
Only long pacman, Flatpak, and paru operations redirect stdout/stderr to one private per-run file:
`sy-log-<UTC-start-time>-steamos-setup-output.<unique>.txt`.
The temporary root uses `BASHRC_TEMP_ROOT_DIR`, then `TMPDIR`, then `/tmp`.
Progress, failure status, and log location remain visible. Short setup output is not suppressed.
Package commands cannot consume streamed setup input; Flatpak installation accepts its package confirmation noninteractively.

Review logs before sharing: they can contain account/filesystem paths and package-manager diagnostics.
Terminal password prompts are not captured. No shell tracing or credential dump is enabled.
Downloads stay unprivileged; upstream Loader bootstrap, protected archive writes, and service operations use scoped `sudo`.

## Refresh and build

The repo-local [`refresh-steamos-decky-plugins` skill](../.agents/skills/refresh-steamos-decky-plugins/SKILL.md) discovers verified installable updates.
Without package arguments it checks every selected entry; supplied names scope a partial refresh.
It compares GitHub stable releases, the approved Decky store, and approved DeckThemes blobs without silently downgrading newer verified pins.
For compact entries, it verifies candidate bytes before adding a versioned repository ZIP and changing the inventory path/version.
Existing hand-picked versions stay unchanged until an explicit refresh selects replacements.
Building alone does not discover updates, change pins, install packages, commit, or publish releases.

```bash
make build_decky_bundle DECKY_BUNDLE_OUTPUT="$HOME/steamos-decky__bundle.zip"
npx vitest run --config vitest.config.js software/tests/decky*.spec.js software/tests/steamosSetup*.spec.js
```

The deterministic Node builder bypasses the cache, reads repository ZIPs, downloads rich-entry upstream artifacts, and validates the completed bundle.
It atomically replaces successful output; failed builds preserve previous output.
CI builds outside the checkout without release credentials on PRs and publishes only after successful default-branch builds.
Publication uploads a unique candidate, renames the previous asset to a backup, and activates the candidate before deleting the backup.
GitHub asset renames are not atomic. Activation failure attempts restoration; interrupted or failed rollback can require restoring the retained `.previous-*` canonical name.
Keep recovery assets until the canonical bundle downloads and validates.
Source ZIPs are committed only in the approved asset folder; generated bundles are never committed.

`software/tests/deckyPublication.spec.js` exercises publication/rollback failures against a local release-API simulation, not live GitHub mutation.
macOS tests simulate Linux descriptor paths and ownership requests while exercising real ZIP parsing, no-follow opens, writes, readback, and chmod.
They do not establish live sudo, NSS, Loader service health, Gaming Mode, or SteamOS-device compatibility.
