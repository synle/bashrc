# Windows PowerShell setup and startup diagnostics

## Interactive shell selection

The Windows Terminal installer discovers PowerShell 7 in the conventional
`C:\Program Files\PowerShell\7` folder, the current user's WindowsApps folder,
and then `PATH`. Executable paths containing spaces are quoted. It preserves
existing PowerShell Core profiles and adds a `PowerShell 7` profile only when
an installed executable is found and no modern profile already exists.

WSL remains the preferred Terminal default when a WSL profile exists. Otherwise,
PowerShell Core takes precedence over Windows PowerShell 5.1. Legacy profiles
remain available; noninteractive `powershell.exe` automation is not globally
rewritten because the inbox shell is available before PowerShell 7 installation.
The managed modern profile starts at `%USERPROFILE%` without a startup
`Set-Location` command. Existing profiles and shortcuts keep their own startup
commands and folders.

## Deploy from WSL

Refresh the profiles, Windows Terminal settings, and shared Starship configuration:

```bash
bash run.sh --files="software/scripts/windows/_init.js,software/scripts/windows/powershell.js,software/scripts/windows-terminal.js,software/scripts/advanced/starship-config.js,software/scripts/windows/~cleanup.js"
```

For broader terminal-emulator and prompt tooling, use
`bash run.sh --preset=emulators,prompt`; that preset does not assemble and deploy
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

## Diagnose `E:"` startup errors on Windows

The shared profile does not issue a startup `Set-Location`. These repository
changes do not repair external shortcuts or user-authored profile files.
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
