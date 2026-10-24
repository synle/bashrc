# Windows PowerShell setup and startup diagnostics

## Interactive shell selection

The Windows Terminal installer discovers PowerShell 7 in the conventional
`C:\Program Files\PowerShell\7` folder, the current user's WindowsApps folder,
and then `PATH`. Executable paths containing spaces are quoted. It preserves
unrelated PowerShell Core profiles and creates a dedicated `Powershell v7`
profile only when an installed executable is found. Its stable installer-owned
GUID prevents duplicate managed profiles on redeployment. The profile uses Command
Prompt's explicit color scheme, or the built-in `Campbell` scheme when none is set.

The existing `Windows PowerShell` profile becomes `Powershell v5`; its command
is normalized to `powershell.exe`, including profiles already named `Powershell v5`.
Explicit styling and inherited appearance settings are preserved. This deliberately
replaces custom commands on those two legacy profile names so the fallback does
not depend on a missing `pwsh` or a bare `powershell` command.
PowerShell startup scripts and noninteractive `powershell.exe` automation are not
modified by these Terminal settings changes.

Profiles sort as WSL, `Powershell v7`, `Powershell v5`, Azure, then everything else.
Existing boolean `hidden` values are preserved. Missing values default to visible
for WSL, both PowerShell profiles, and Azure, and hidden for everything else.
The installer leaves `disabledProfileSources` untouched: existing discovery
preferences are preserved, and the setting is not added when absent. Profile
visibility updates use `hidden` without changing which sources are enabled.
The first visible WSL profile with a GUID remains the preferred default, followed
by visible PowerShell and then another visible profile.

New managed modern profiles start at `%USERPROFILE%` without a startup
`Set-Location` command. Existing profiles and shortcuts keep their own startup
folders; managed v7 commands are refreshed when a modern executable is discovered.

## Windows Terminal appearance

The installer uses an underscore cursor and the current `font` object (`face`,
`size`, `weight`) instead of the deprecated flat font settings. Saved per-profile
font overrides are migrated; explicit nested font fields take precedence over
flat fields at the same level. Legacy PowerShell retains its inherited custom
font settings. Ineffective cursor heights are removed, but explicit vintage
cursors retain their heights.

PowerShell 5 keeps its original blue shell icon, and WSL distributions such as
Ubuntu and Debian keep their original icons. Managed PowerShell 7 uses the official
black PowerShell logo, downloaded once from the PowerShell project's public assets
to `LocalState/powershell7.png` beside Terminal settings. The local file allows
offline rendering after deployment; an uncached download failure stops deployment
before changing saved settings. Saved default icons and other profile icons are
preserved. Shell **tab colors** are black
(`#000000`) for managed PowerShell 7, blue (`#012456`) for PowerShell 5, and orange
(`#e95420`) for WSL profiles. These do not set terminal backgrounds or a global
window title-bar color. Other profiles retain their own tab colors.

The old `experimental.rendering.forceFullRepaint` setting is removed even when
already saved. This is a settings cleanup, not a measured speed improvement.
These changes do not modify PowerShell profiles, startup commands, bell behavior,
or scrollbar marks. Native Windows rendering still requires a Windows check.

To update only Windows Terminal, run `./run --files="windows-terminal.js"`.
For broader terminal tooling, use `./run --preset=emulators`.

## Deploy from WSL

Refresh the profiles, Windows Terminal settings, and shared Starship configuration:

```bash
./run --files="software/scripts/windows/_init.js,software/scripts/windows/_only.js,software/scripts/windows/powershell.js,software/scripts/windows-terminal.js,software/scripts/advanced/starship-config.js,software/scripts/windows/~cleanup.js"
```

For broader terminal-emulator and prompt tooling, use
`./run --preset=emulators,prompt`; that preset does not assemble and deploy
the Windows PowerShell profile. The explicit command above includes Windows
initialization and cleanup because a selective `--files` run does not add those
steps automatically. Repeat it to check that profile contents match on the second
run. Windows cleanup finalizes the assembled profile and deploys it to both:

- `<Documents>\PowerShell\Microsoft.PowerShell_profile.ps1` for PowerShell 7.
- `<Documents>\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` for Windows PowerShell 5.1.

Cleanup queries Windows' Documents known folder with `-NoProfile`; redirected
Documents folders are supported when accessible as a drive mounted under
`/mnt/<letter>`. An unresolved, inaccessible, or UNC-only Documents path fails
explicitly instead of writing into a guessed folder. Offline dry-runs build the
artifact without querying Windows or deploying profiles. Existing profiles are
backed up through the normal `.bak_original` / `.bak_latest` helpers.

Starship configuration is also written to the Windows user's
`.config\starship.toml`, not only the WSL home. Existing Windows configuration is
backed up first. A user-set `STARSHIP_CONFIG` still takes precedence in Starship;
inspect that variable if the prompt does not use the deployed configuration.

## Explorer context menus

Normal Windows provisioning and the complete WSL deployment above now execute
Explorer maintenance during final Windows cleanup, after package installers and
profile deployment. Previously, initialization only copied the helper to the
Desktop; running provisioning alone never applied its registry changes.

Cleanup runs the shared source through inbox Windows PowerShell with `-NoProfile`
and `-NonInteractive`, as the current Windows user without automatic elevation.
Dry-runs neither invoke maintenance nor change registry keys. Maintenance failure
fails cleanup and preserves the working profile for retry; previously deployed
profiles or registry keys are not rolled back.

Initialization still copies `windows-context-menu.ps1` to the Windows user's
Desktop. A selective run that omits `windows/~cleanup.js` does not apply menus.
To apply only menu maintenance after initialization, run this in Windows PowerShell
as the affected user (elevated with the same account when possible):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Desktop\windows-context-menu.ps1"
```

The script exports each existing affected registry key before changing it:

- Removes `git_gui` and `git_shell` from `Directory`, `Directory\Background`,
  `LibraryFolder\Background`, and `Drive` under both HKCU and HKLM `Software\Classes`.
  If deletion is denied, creates a current-user `LegacyDisable` override instead.
  Git and unknown/custom verbs remain installed. A Git update may recreate its menu
  entries; rerun normal provisioning or the copied maintenance script.
- Creates current-user `Powershell` overrides for `Directory`,
  `Directory\Background`, and `Drive`, labeled **Open PowerShell Here**.
  At registry-write time, discovers `pwsh.exe` as an application; if absent, selects `powershell.exe`.
  When `wt.exe` is available, its quoted path launches `new-tab --startingDirectory "%V\."`, followed by the selected shell and `-NoExit`.
  This explicitly requests Windows Terminal hosting instead of relying on Windows' default-terminal delegation.
  Without `wt.exe`, retains direct launch with `-NoExit -WorkingDirectory "%V\."`.
  Rerun maintenance after installing, moving, or removing either executable to refresh its stored command.
  Windows-owned machine PowerShell keys remain unchanged.
- If `wsl.exe` is discoverable as an application, creates per-user `SyWSL` verbs
  in those same three scopes, labeled **Open Linux Shell Here**, with the quoted
  binary path followed by `--cd "%V\."`. WSL uses its default distribution; the
  binary's presence does not prove that a distribution is installed.
  If WSL is later removed, restore or remove only these backed-up `SyWSL` keys; absence does not delete prior entries.
  Both labels explicitly set `MUIVerb` as well as the default value so an inherited
  machine label cannot override the requested text.
- Hides built-in `WSL` verbs using current-user `LegacyDisable` overrides in `Directory`, `Directory\Background`, `LibraryFolder\Background`, and `Drive`.
  This keeps one managed Linux entry without deleting Windows' registrations.
  Unknown third-party WSL verbs remain untouched; inspect their registry identities if another duplicate persists.
- Hides **Open in Terminal** for this user by blocking the stable and Preview Explorer shell extensions.
  Their identifiers are `{9f156763-7844-4dc4-b2b1-901f640f5155}` and `{02db545a-3e20-46de-83a5-1329b1e88b6b}`.
  Values live under `HKCU\Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Blocked`.
  Terminal itself and unrelated menus, including Zed, remain installed.
- Does not invoke `last_folder`. Windows shell tweaks also no longer invoke that
  helper automatically; it remains available manually. Existing shell sessions
  need a profile reload or restart to pick up the startup change.

The affected machine's registry showed `powershell.exe -noexit -WorkingDirectory
"%V"` on all three PowerShell verbs. For a drive root, substitution produces
`"D:\"`. Windows native argument parsing can consume the final quote after the
backslash, consistent with the reported `D:"` error. The replacement produces
`"D:\\."`: the final dot prevents that trailing-backslash ambiguity. Folder names
remain arguments, not interpolated PowerShell code. The exact original Explorer
failure and the repaired menu still require an affected-host check.

### Recovery and verification

Backups live in `%LOCALAPPDATA%\Sy\ContextMenuBackup`. Each `.reg` contains the
original key; `.reg.absent` records a key that did not exist. Successful backups
are never overwritten; failed exports remain `.pending` and stop that key's change.
The script is not transactional: an error can leave earlier keys changed.

To undo, inspect the backup folder and export any later manual edits first.
For a `.reg.absent` marker, remove only the corresponding key created by this
script. For an existing original key, remove only that exact affected key, then
use `reg.exe import "<exact backup file>.reg"` to restore it. This removes added
`MUIVerb` / `LegacyDisable` values before restoration; importing alone merges
values and cannot restore an exact original key. Restore machine backups in an
elevated shell. Never bulk-delete `Software\Classes`, `shell`, or unrelated verbs.
Restoring a first-run backup replaces later edits to that key; preserve those
separately before deleting it.

After applying, open a new Explorer window. Check a folder icon, folder background,
a drive icon, and a library background: Git entries should be absent. Launch
**Open PowerShell Here** at `D:\` and in an existing folder containing spaces,
apostrophes, or brackets. `Get-Location` must match the chosen folder with no
startup path error; `$PSVersionTable.PSEdition` should be `Core` when `pwsh.exe`
was discovered, otherwise `Desktop`. With `wt.exe` available, verify that the shell opens as a Terminal tab.
Confirm **Open in Terminal** and the built-in WSL entry are absent, including in the extended menu.
Check **Open Linux Shell Here** with `pwd` in a configured default distribution.
It should match the chosen Windows folder's WSL mount, except System32 startup redirects to home as described below.
Repeat after rerunning with `pwsh.exe` unavailable to verify the fallback selection.
Run the maintenance script twice; the second run must retain the first backups
and leave the same effective menu configuration. PowerShell tests on macOS execute
the script with registry boundary fixtures when those tests are run; they do not
prove Explorer behavior, Windows registry merging, or Windows PowerShell 5.1
argument parsing. The automatic cleanup change still needs verification on the
affected Windows host; a source-only review is not proof that its live menu disappeared.

## Windows Terminal window and tab preferences

`software/scripts/windows-terminal.js` applies these global preferences to both live settings and the portable artifact:

| Setting                                                                                 | JSON value                              |
| --------------------------------------------------------------------------------------- | --------------------------------------- |
| New instance behavior: attach to the most recently used window, across virtual desktops | `"windowingBehavior": "useAnyExisting"` |
| Tab switcher interface: separate window, in tab strip order                             | `"tabSwitcherMode": "inOrder"`          |
| Show tabs in full screen                                                                | `"showTabsFullscreen": true`            |
| Position of newly created tab: after the current tab                                    | `"newTabPosition": "afterCurrentTab"`   |

These managed values override previous choices when provisioning runs.
They do not change the default-terminal application registration or force a specific Terminal launch mode for context-menu tabs.
A recent Terminal version is required for the fullscreen-tab option.
Verify the four controls in Terminal settings, then test a second invocation, tab switching, fullscreen, and tab creation.

## WSL System32 startup folder

WSL platform tweaks redirect `/mnt/c/WINDOWS/system32` to `$HOME` during startup, including ASCII case variants.
The check runs once per shell, not on every prompt or profile reload.
A non-exported sentinel lets each child shell perform its own startup check.
Other folders, nested System32 folders, other drives, and non-WSL shells retain their launch folder.
After startup, an explicit `cd` into System32 remains there.
Restart the shell after deployment to exercise the new startup check.

## Diagnose remaining `E:"` startup errors on Windows

The shared profile does not issue a startup `Set-Location`. The maintenance script
repairs only the standard Explorer verbs, not external shortcuts or user-authored
profile files.
On the affected Windows machine, compare these launches from an existing shell:

```powershell
pwsh.exe -NoLogo -NoProfile
pwsh.exe -NoLogo
```

Inside the new shell, inspect the engine, profile paths, and actual launch command:

```powershell
$PSVersionTable
$PROFILE | Select-Object *
(Get-CimInstance Win32_Process -Filter "ProcessId = $PID").CommandLine
Get-Location
```

If only the profile-enabled launch fails, inspect every existing profile listed
by `$PROFILE`, not just the current-user profile. If the clean launch works but
opening the usual shortcut fails, inspect the shortcut target, its **Start in**
folder, and the selected Windows Terminal profile's `commandline` and
`startingDirectory`. Do not add literal quote characters inside a folder value.

For a manual PowerShell directory change, use a literal path:

```powershell
Set-Location -LiteralPath 'E:/'
```

A launcher command can avoid a trailing backslash immediately before a double
quote by using this form, provided `E:/` exists:

```text
pwsh.exe -NoLogo -NoExit -Command "Set-Location -LiteralPath 'E:/'"
```

Do not automatically replace arbitrary `E:"` strings or force every interactive
shell into that drive; first identify the command that produced the error.

## Startup time and Starship warnings

Deploying the shared configuration does not prove a startup speed improvement or
eliminate slow-folder scans. The shared configuration keeps `scan_timeout = 100`
and `command_timeout = 1000`, with unused language modules disabled. Increasing
those values can lengthen prompt stalls; do not raise them without a measurement
on the affected folder.

Measure profile startup separately from prompt rendering on the Windows host:

```powershell
Measure-Command { pwsh.exe -NoLogo -NoProfile -NonInteractive -Command 'exit' }
Measure-Command { pwsh.exe -NoLogo -NonInteractive -Command 'exit' }
$env:STARSHIP_CONFIG
starship timings
```

The original malformed-path failure, Windows Terminal process argument parsing,
Windows PowerShell 5.1 runtime behavior, and startup timings require validation on
Windows. PowerShell 7 parsing and Starship rendering on another OS do not prove
those Windows behaviors.
