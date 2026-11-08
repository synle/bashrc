# SteamOS setup reference

[Developer guide](../DEV.md). Run repository commands from the checkout root.

## Refreshing SteamOS Decky Plugins

`software/metadata/decky-packages.json` declares an exact `decky_loader_version` and `decky_packages`.
Compact entries require only `path`, `name`, and `version`; approved hand-picked ZIPs live under `assets/steamos/decky_loader_plugins/`.
The shared Node runtime derives hashes, native roots, package kinds, and theme IDs, while retaining rich HTTPS/hash entry support.
The self-extracting installer includes those ZIPs. Missing or stale cached packages recover from selected repository bytes or pinned upstream URLs.
Reruns overwrite selected archive members, restart `plugin_loader.service`, and verify it is active; unrelated plugins and settings remain.
SteamOS setup delegates to the same standard script. For a checked update of every package, ask:

```text
Refresh all pinned Decky plugins and CSS Loader themes to the latest verified installable releases.
```

The repo-local `refresh-steamos-decky-plugins` skill defaults to all entries; supply
package names only for a partial refresh. It discovers current stable releases,
verifies artifacts, updates pins, tests, builds, and reports updated/current/blocked
packages. Building alone does not discover updates.

Query upstream releases/store records, verify temporary candidate SHA-256, ZIP safety,
identity/version, compiled plugin payload, and theme IDs before changing inventory pins.
Keep newer verified releases; do not downgrade merely to match older store listings.
Use `<name>_v<version>.zip` filenames. Compact entries derive theme IDs and hashes from verified committed bytes; rich entries retain explicit pins.
Store metadata alone is not an archive. Preserve upstream attribution in `assets/steamos/README.md` and leave unverified candidates unchanged.

`make build_decky_bundle DECKY_BUNDLE_OUTPUT="$HOME/steamos-decky__bundle.zip"` builds
and validates deterministic output with Node.js and curl; failed builds preserve existing
output. CI builds without release credentials on PRs and publishes only on default-branch
pushes. See [`docs/steamos-decky-installation.md`](steamos-decky-installation.md).

After a refresh, run:

```bash
/bin/bash -n software/scripts/steamos/setup.bash
npx vitest run --config vitest.config.js software/tests/steamosSetup.cache.spec.js software/tests/steamosSetup.decky.spec.js software/tests/deckyZip.spec.js software/tests/deckyInstaller.spec.js
git diff --check
```

## SteamOS manual setup

`software/scripts/steamos/setup.bash` is an interactive post-install entry point, not a discoverable `./run --files=` script.
Run it from the checkout root in Desktop Mode/Konsole as the normal desktop user, never root or `sudo`:

```bash
/bin/bash software/scripts/steamos/setup.bash
```

After validating the invoking account, setup checks existing `~/.bashrc` and `~/.bash_profile` files independently.
For each file without an active direct `alias update=` definition, it saves original/latest backups and appends:

```bash
alias update='curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/software/scripts/steamos/setup.bash | bash -'
```

Missing startup files are not created. Existing `update` aliases are preserved, even when their commands differ; commented-out aliases do not block installation.
Open a new Bash session to load the alias. It reruns the complete interactive setup, including its shortcut-clearing prompt; it is not package-update-only.
Later definitions from sourced profiles can override it, including the managed SteamOS profile's existing pacman `update` alias.

Before final confirmation, setup moves top-level regular files containing the exact, case-sensitive text `- Update -` from `~/Emulation/roms/switch` into its `dlc` subfolder.
Hidden matching files are included; folders, symbolic links, nested files, and nonmatching files remain unchanged.
Setup creates `dlc` only when needed and skips an absent ROM folder.
Existing destination entries remain untouched with a diagnostic, including entries created during a no-clobber move regardless of GNU/BSD skip status.
Failed moves without a preserved conflict, failed folder creation, or a symlinked `dlc` stop setup.

Steam icon restoration selects the newest Desktop `grid*.tar.gz` by modification time, including plain `grid.tar.gz`.
It retains Desktop `grid` and then backs it up as `grid-YYYY-MM-DD.tar.gz`, adding a numeric suffix on same-day reruns.
The backup also runs when Desktop `grid` exists without an input archive.
Extraction or backup failures stop setup with an error; source icons remain available.

Close Steam before changing shortcuts. The script records a private `steamos-setup.*` log on the Desktop.
Setup registers every top-level `~/Applications/*.AppImage` in Steam, making it executable when needed.
Before downloads, setup moves legacy `~/Apps/*.AppImage` files into `~/Applications` without replacing existing destination files.
It removes `~/Apps` only when empty; conflicts and unrelated files remain in the legacy folder with diagnostics.
Ghostty, Moonlight, and ProtonUp-Qt downloads use `~/Applications`; the final AppImage registration pass retains established Steam titles and collections.
Ghostty uses the pinned x86_64 stable release `1.4.0`, installed as `~/Applications/Ghostty.AppImage` with executable permissions.
A nonempty existing Ghostty AppImage skips download; reruns repair executable permissions and reuse existing launcher entries.
Failed or empty Ghostty downloads never reach the AppImage registration pass.
The Ghostty URL uses the versioned `v1.4.0` release tag instead of `tip`, whose nightly publications replace versioned asset filenames.
Shortcut titles use filenames without `.AppImage`; `ES-DE.AppImage` retains the title `ES-DE Emulation Station`.
An existing `~/Applications/ES-DE.AppImage` skips the EmuDeck installer download.
Zed installs through its official installer in the background; setup waits before running both Zed configuration scripts alongside browser extensions and tmux/vim.
Setup installs `vim`, `tmux`, `fuse2`, and `python-yaml` with `sudo pacman -S --needed --noconfirm`.
Python YAML satisfies DeckyPlumber's Python dependency; its separate running InputPlumber prerequisite remains the user's responsibility.
Kate removal uses `sudo pacman -R --noconfirm kate` only when installed.
KDE favorites include Brave, Zed, Konsole, Ghostty, EmuDeck, and ES-DE AppImage; taskbar pins include Brave, Zed, Konsole, and Ghostty.
Existing same-name entries are reused; favorites and taskbar pins are checked before additions.
New desktop entries use the requested executable paths and arguments; existing launch commands remain unchanged.
Absolute launcher icons are copied into persistent user icon storage; theme icons retain their installed theme references.
KDE integration requires a running Desktop Mode session, Python, qdbus, and kbuildsycoca; failed readback prints an incomplete-setup diagnostic.
Favorite calls use the `org.kde.ActivityManager.ResourcesLinking` interface at `/ActivityManager/Resources/Linking`; D-Bus failures retain their diagnostic output.
Steam `[DEBUG]` messages are silent unless `DEBUG=1`; normal progress, errors, and SteamTinkerLaunch output remain visible.
Use `DEBUG=1 /bin/bash software/scripts/steamos/setup.bash` or export `DEBUG=1` before running setup to enable them.
Before downloads, it asks whether to clear user-defined non-Steam shortcuts, install Decky, upgrade the system, and enable USB wake-up.
The final completion acknowledgment remains at the end.
Long pacman, Flatpak, and paru operations capture stdout/stderr in a private `sy-log-<UTC-start-time>-steamos-setup-output.<unique>.txt` file.
Its temporary root uses `BASHRC_TEMP_ROOT_DIR`, then `TMPDIR`, then `/tmp`; short progress, failure status, and log location remain visible.
The shortcut-clearing prompt defaults to Yes; declining preserves existing entries for title-based updates.
Clearing affects all user-defined non-Steam shortcuts in the selected account; review that prompt deliberately.

Brave Flatpak is a prerequisite for browser tiles. Fixed-site tiles use `--kiosk` with a direct HTTP or HTTPS URL.
Only Brave-backed tiles receive these browser flags; native application shortcuts and global Flatpak settings remain unchanged:

| Flag                         | Why it is included                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ozone-platform=x11`       | Request X11/XWayland instead of native Wayland as a compatibility workaround for reported SteamOS hangs. This is not a confirmed diagnosis or guaranteed fix. |
| `--disable-smooth-scrolling` | Disable animated scrolling as requested. This is a behavior preference, not a measured performance improvement.                                               |
| `--kiosk`                    | Keep fixed-site tiles fullscreen without browser chrome.                                                                                                      |

The [Chromium Ozone documentation](https://chromium.googlesource.com/chromium/src.git/+/HEAD/docs/ozone_overview.md) documents X11 platform selection.
The [Chromium switch definition](https://chromium.googlesource.com/chromium/src/+/HEAD/content/public/common/content_switches.cc) identifies `--disable-smooth-scrolling` as a testing switch.
GPU acceleration, hardware video decoding, and sandbox defaults remain intact. Do not add speculative rendering or performance switches without target-host measurements.
Exit Brave completely before testing new launch flags; also close Steam before updating its shortcuts.
Re-run setup with shortcut cleanup declined to refresh existing browser tiles by title without clearing unrelated entries.
Confirm X11 selection in `brave://gpu` and the applied command line in `brave://version`, then check scrolling, streaming playback, and stability on SteamOS.
These local fixture tests cannot prove that a reported browser hang is fixed.

The tile named Brave opens Fav in kiosk mode instead of launching a generic browser window.
Setup no longer registers a separate Fav tile. If shortcut cleanup is declined, previously saved Fav entries remain until manually removed.
Do not impose an HTTPS-only restriction on local HTTP services or replace kiosk launch options with `--app=` or URI forwarding.
The site registrations near the script's end are the authoritative title/URL inventory, including Plex, Apple TV+, and Crunchyroll.
URL helpers match exact titles, refresh existing entries, and refuse database changes while Steam runs.
The manual replacement helper also backs up the shortcut database and restores it if re-adding fails.

Validate changes without provisioning an unrelated host:

```bash
/bin/bash -n software/scripts/steamos/setup.bash
npx vitest run --config vitest.config.js software/tests/steamosSetup*.spec.js
```

The subprocess specs exercise isolated fixtures, not live Steam/Brave playback. Report a missing target-host run as a validation gap.

### USB wake-up

The USB wake-up prompt defaults to Yes. Choosing No skips installation and leaves existing wake settings unchanged.
Setup writes `/etc/systemd/system/usb-wake-all.service`, reloads systemd, and enables and starts the oneshot service.
An existing unit receives `.bak_original` and `.bak_latest` backups before replacement; the original backup is never overwritten.
The service enables wake-up only for USB devices exposing `power/wakeup`; hardware, firmware, and suspend mode still determine actual wake capability.
Enabling every supported USB device can cause accidental resumes. No actual wake behavior has been verified on the target host.
The boot-time service does not handle later hotplug automatically; restart it after connecting new devices:

```bash
sudo systemctl restart usb-wake-all.service
```

To stop future boot-time application without deleting the unit:

```bash
sudo systemctl disable --now usb-wake-all.service
```

Disabling the service does not undo wake settings already applied; reboot to let the kernel and other power-management configuration establish their defaults.
The unit uses `$$` so systemd passes shell variables through correctly.
It orders after USB device triggering, not after `multi-user.target`, avoiding an ordering cycle with its installation target.
