# assets/steamos

SteamOS / Steam Deck post-install resources used by
[`software/scripts/steamos/setup.bash`](../../software/scripts/steamos/setup.bash).
Decky ZIPs are no longer tracked here. The opt-in Node.js installer uses a
build-generated release bundle, with pinned upstream recovery.

## Steam shortcuts for apps

Run these steps in Desktop Mode (Konsole). The setup helper downloads Moonlight
6.2.0 as `~/Apps/Moonlight.AppImage`, downloads `~/Apps/ProtonUp-Qt.AppImage`,
installs Brave from Flathub as an early prerequisite, then adds its
Steam shortcuts after installation. It attempts to add each with
`_add_steam_shortcut` and five Brave site tiles with `_add_url_steam_shortcut` in
[`software/scripts/steamos/setup.bash`](../../software/scripts/steamos/setup.bash).
Leave Proton compatibility disabled.

Brave installs only with `flatpak install --user flathub com.brave.Browser`.

### Install SteamTinkerLaunch

The setup helper installs the latest SteamTinkerLaunch Git version into
`~/stl/prefix`, initializes it, registers it as a Steam compatibility tool, and
links its command into `~/.local/bin`. Existing installations on `PATH`, including
ones managed by ProtonUp-Qt, stay untouched. Check the active command with:

```bash
type -P steamtinkerlaunch
```

If automatic installation fails, open ProtonUp-Qt in Desktop Mode:

```bash
"$HOME/Apps/ProtonUp-Qt.AppImage"
```

Select the Steam installation, choose **Add version**, and install
**SteamTinkerLaunch**. For the latest Git version, ProtonUp-Qt's **About →
Advanced Mode** enables that option. Restart Steam and reopen Konsole, then
check `type -P steamtinkerlaunch` again. The upstream
[installation guide](https://github.com/sonic2kk/steamtinkerlaunch/wiki/Installation#protonup-qt)
documents this method and PATH setup. Do not install the SteamTinkerLaunch
Flatpak for the Deck's native Steam client; upstream documents it for Flatpak
Steam only.

### Inspect, add, and organize shortcuts

At startup, setup checks that Steam is closed. If Steam is open, close it and
answer **Yes** at the red prompt to recheck; answer **No** to abort. Setup then
asks whether to clear all non-Steam shortcuts from the active Steam account.
That prompt defaults to **Yes**. Press **No** to keep existing shortcuts.
Cleanup removes every user-defined shortcut for that account; Steam-installed
games and other accounts are not changed. All yes/no prompts display in red. If
cleanup fails, setup reports it and continues without clearing shortcuts.
Before clearing, setup saves the original file to
`~/Desktop/shortcuts.vdf.bak_<date_time>` and writes a matching
`~/Desktop/shortcuts.vdf.bak_<date_time>.restore.sh`. Output lists every removed
shortcut name and both exact file paths. To recover, close Steam and run the
printed `bash ~/Desktop/shortcuts.vdf.bak_<date_time>.restore.sh` command, then
restart Steam. Keep both files until you confirm the cleared library.

If Flatpak or Brave installation fails, setup reports the issue, skips Brave
shortcuts, and continues with unrelated SteamOS setup.

The setup helper sets the executable bit only on `*.AppImage` files missing it.
It reads the local account's `shortcuts.vdf` and matches both app and URL
shortcuts by their exact Steam name. Re-running setup refreshes the existing
shortcut's executable path (and, for site tiles, launch URL) instead of adding
a duplicate; extra same-name entries are removed while other shortcut metadata
is preserved. Brave tiles match Steam's Flatpak shortcut fields exactly: target
`/usr/bin/flatpak` and start in `/usr/bin/`. The plain Brave tile uses Steam's
generated launch options:
`"run" "--branch=stable" "--arch=x86_64" "--command=brave" "--file-forwarding" "com.brave.Browser" "@@u" "@@"`.
URL tiles pass each site URL directly to Brave with `"--kiosk"`;
they do not use `--app=` or Steam URI-forwarding placeholders. Setup runs
`flatpak install --user flathub com.brave.Browser` each time and does not probe
Flatpak's installed-app list before adding tiles.
Missing
or ambiguous Steam accounts, unreadable shortcut data, missing
SteamTinkerLaunch, or a running Steam client cause a logged skip, not a
duplicate entry. For a missing
shortcut, close Steam and re-run setup after fixing the reported condition;
restart Steam after shortcuts are added or updated. The default collections are
`Streaming,Apps` (Moonlight and site tiles), `Utilities,Apps` (ProtonUp-Qt), and
`Browsers,Apps` (Brave).

For manual inspection, list existing non-Steam games:

```bash
steamtinkerlaunch list non-steam
```

This list shows name, AppID, and containing folder, not the full executable;
for manual checks, use **Properties → Target** in Steam. SteamTinkerLaunch's
[shortcut guide](https://github.com/sonic2kk/steamtinkerlaunch/wiki/Add-Non-Steam-Game)
documents `list non-steam`, `--exepath`, and comma-separated `--tags` for new
shortcuts. To change collections on an existing shortcut, edit them in Steam
instead of adding another copy.

To remove unwanted shortcuts, identify each entry with
`steamtinkerlaunch list non-steam`, then remove that specific entry from Steam's
**Non-Steam** library.
Removing a shortcut does not remove its AppImage. Do not delete or replace
`shortcuts.vdf` by hand: it contains other shortcuts too, and Steam can
overwrite edits made while it runs.

### Dedicated Brave site windows

Chromium's `--app=<URL>` switch opens a page in an app-style window.
Preview Netflix in Desktop Mode:

```bash
flatpak run --command=brave com.brave.Browser --app=https://www.netflix.com/
```

The setup helper adds **Netflix**, **Disney+**, **Prime Video**, **YouTube**, and
**Plex** as separate Steam tiles using `_add_url_steam_shortcut <title> <url>`.
Plex opens `https://app.plex.tv/desktop/`. Each tile launches Brave with
`--app=<url>` and checks `AppName` for an exact title match, so the Brave
browser shortcut does not block site tiles. Re-running setup updates a tile's
URL when its title already exists. Add another site by adding a call with a
distinct title and HTTPS URL to the setup script. Close Steam and re-run setup
if registration was skipped; restart Steam to see updated tiles.

For a deliberate replacement, `_upsert_url_steam_shortcut <title> <url>` is
available but not called by setup. With Steam closed, it backs up the local
`shortcuts.vdf`, removes all shortcuts with that exact title, and re-adds the
site tile; a failed add restores the backup. The original backup stays beside
`shortcuts.vdf`. This can replace a manually configured shortcut with the same
name, so inspect the title before invoking it.

Site sign-in, playback, and DRM support depend on Brave and the streaming
service. Verify each tile in Desktop Mode and Gaming Mode on the Deck.

### Host PC shortcuts appearing through Remote Play

Non-Steam apps added on another PC can appear as streamable entries on the Deck.
These are not necessarily Deck-local shortcuts: do not remove Deck shortcuts or
edit `shortcuts.vdf` to clear remote entries. A [Steam client bug
report](https://github.com/ValveSoftware/steam-for-linux/issues/13141) describes
host shortcuts appearing on other devices, sometimes even with Remote Play
disabled; reports there say hiding or removing entries may not keep them gone.
No reliable filter for _only_ remote non-Steam shortcuts is confirmed.

As a temporary workaround, exit Steam on the host PC, then restart Steam on
the Deck. Users in the bug report found the remote entries disappear until the
clients reconnect or restart. While host Steam is closed, Remote Play from that
PC is unavailable. Keep host shortcuts if you still use them there.

## Decky package bundle

[`software/metadata/decky-packages.json`](../../software/metadata/decky-packages.json)
is the authoritative inventory: nine plugins and eight themes, with exact versions,
upstream attribution/download URLs, SHA-256, selected roots, and theme IDs.
HLTB for Deck 2.0.12, ProtonDB Badges 1.3.4, and CSS Loader 2.1.3 retain the verified
newer releases. Centered Home is excluded from new selections; installed copies and
settings are not removed.

The generated `steamos-decky__bundle.zip` contains `metadata.json`,
`decky_plugin/<name>_v<version>.zip`, and
`decky_css_loader/<name>_v<version>.zip`. Filenames contain no author prefixes,
UUIDs, or checksums. Credit belongs to the upstream authors linked in the inventory.

The standard opt-in installer is `bash run.sh --files=decky-and-css-loader`.
It works alongside comma-separated selections; no preset includes it implicitly.
SteamOS setup delegates to that same path through the self-extracting bootstrap.
See [installation and validation details](../../docs/steamos-decky-installation.md).

Use the repo-local `refresh-steamos-decky-plugins` skill to verify candidates and
update the inventory. ZIPs are generated, not committed. CI builds the bundle on
PRs without release credentials and publishes it only on default-branch pushes.

## Misc — repo root

Files vendored at the repo root of `assets/steamos/`.

| File in this repo    | What it is                                                              | Saved to on the Deck           |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| `sponsporblock.json` | SponsorBlock extension settings export (server, categories, bar colors) | `~/Desktop/sponsporblock.json` |
