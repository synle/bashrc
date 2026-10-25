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

[`software/metadata/decky-packages.json`](../../software/metadata/decky-packages.json) owns the exact Loader version and all nine plugin/nine theme selections.
Compact entries require only `path`, `name`, and `version`.
Their hand-picked ZIPs live in [`decky_loader_plugins/`](decky_loader_plugins/); the shared runtime derives trusted hashes, native roots, kinds, and theme IDs.
Rich HTTPS/hash entries remain supported. Selection and version authority stays in JSON, not this attribution section.

The generated `steamos-decky__bundle.zip` contains `metadata.json`, `decky_plugin/<name>_v<version>.zip`, and `decky_css_loader/<name>_v<version>.zip`.
The self-extracting installer also includes repository ZIPs. Generated bundles are not committed.
Filenames contain no author prefixes, UUIDs, or checksums.

The standard opt-in installer is `bash run.sh --files=decky-and-css-loader`.
SteamOS setup delegates to the same path; no preset includes it implicitly.
Every rerun reapplies selected files, restarts Decky, and verifies active state, preserving unrelated plugins, extra files, and settings.
See [installation and validation details](../../docs/steamos-decky-installation.md).

For verified upstream updates, use the repo-local [refresh workflow](../../.agents/skills/refresh-steamos-decky-plugins/SKILL.md).
Building alone does not change hand-picked versions. CI builds without release credentials on PRs and publishes only on default-branch pushes.

### Upstream attribution

These links preserve provenance only; they do not define another package-selection list or version registry.

- [Centered Home](https://deckthemes.com/themes/view?themeId=865407ae-fb14-4db7-b123-61f6995ed757)
- [Clean Gameview](https://deckthemes.com/themes/view?themeId=a9776f60-2724-4ff0-824b-e1f82a04688e)
- [Faster Transition Animations](https://deckthemes.com/themes/view?themeId=921a7ec8-b355-4799-b23f-73f4b9c713b8)
- [Mini Carousel](https://deckthemes.com/themes/view?themeId=4788b3d9-f4f3-40f2-ae0e-a80afa9fce5b)
- [No Home Edge Fade](https://deckthemes.com/themes/view?themeId=2dab90ab-2cf3-480f-adce-f6c67caadd67)
- [No Home Recent Text](https://deckthemes.com/themes/view?themeId=95c4e310-0770-4e1f-9f9d-cbe444e9bb17)
- [No Home Text](https://deckthemes.com/themes/view?themeId=0e8a208f-136f-4f26-b0e1-344bcd186ed9)
- [Obsidian](https://deckthemes.com/themes/view?themeId=f16cf40d-7ccc-4981-95bf-77b28e8d101e)
- [Round](https://deckthemes.com/themes/view?themeId=c6844008-a809-41f6-b140-7aa76f2a62ad)
- [EmuDecky](https://github.com/EmuDeck/EmuDecky)
- [ProtonDB Badges](https://github.com/bschelst/protondb-decky)
- [SteamGridDB](https://github.com/SteamGridDB/decky-steamgriddb)
- [HueSync](https://github.com/honjow/HueSync)
- [HLTB for Deck](https://github.com/morwy/hltb-for-deck)
- [AutoFlatpaks](https://github.com/jurassicplayer/decky-autoflatpaks)
- [Volume Boost](https://github.com/saumya-banthia/volume-boost)
- [CSS Loader](https://github.com/DeckThemes/SDH-CssLoader)
- [Decky LSFG-VK](https://github.com/xXJSONDeruloXx/decky-lsfg-vk)

## Misc — repo root

Files vendored at the repo root of `assets/steamos/`.

| File in this repo    | What it is                                                              | Saved to on the Deck           |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| `sponsporblock.json` | SponsorBlock extension settings export (server, categories, bar colors) | `~/Desktop/sponsporblock.json` |
