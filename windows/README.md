### Special KnownFolders

https://docs.microsoft.com/en-us/windows/desktop/shell/knownfolderid

### Path

##### Home Folder

```
%USERPROFILE%
```

##### App Data

```
%APPDATA%
```

##### Program Files

###### x86

```
%ProgramFiles% (x86)
```

###### x64

```
%ProgramFiles%
```

#### Windows 10 App Shortcut Path

`%USERPROFILE%\AppData\Local\Microsoft\WindowsApps`
https://www.tenforums.com/tutorials/122655-create-shortcut-directly-open-app-microsoft-store-windows-10-a.html

### Shortcuts

#### CMD Shorcut for Control Panel

https://support.microsoft.com/en-us/help/192806/how-to-run-control-panel-tools-by-typing-a-command

#### CMD Shorcut for New Microsoft Settings Page

https://answers.microsoft.com/en-us/windows/forum/windows_10-other_settings/list-of-specific-settings-commands-in-windows-10/73177baa-fd77-463f-88a0-00595a2e7a32

### Env Vars

```
%APPDATA%\npm
%LOCALAPPDATA%\Android\sdk\platform-tools
%LOCALAPPDATA%\Microsoft\WindowsApps
%ProgramFiles%\Docker\Docker\resources\bin
%ProgramFiles%\Git\cmd
%ProgramFiles%\Microsoft VS Code
%ProgramFiles%\Microsoft VS Code\bin
%ProgramFiles%\nodejs
%ProgramFiles%\PuTTY
C:\Windows
C:\Windows\System32
C:\Windows\System32\OpenSSH
C:\Windows\System32\Wbem
C:\Windows\System32\WindowsPowerShell\v1.0
```

Java SDK

```
%ProgramFiles%\AdoptOpenJDK\jdk-8.0.292.10-hotspot\bin
```

### Remove Apps

#### Remove Windows Apps in Powershell

```
Get-AppxPackage *officehub* | Remove-AppxPackage
Get-AppxPackage *skypeapp* | Remove-AppxPackage
Get-AppxPackage *zunemusic* | Remove-AppxPackage
Get-AppxPackage *windowsmaps* | Remove-AppxPackage
Get-AppxPackage *solitairecollection* | Remove-AppxPackage
Get-AppxPackage *zunevideo* | Remove-AppxPackage
Get-AppxPackage *windowsphone* | Remove-AppxPackage
Get-AppxPackage *xboxapp* | Remove-AppxPackage
Get-AppxPackage *3dbuilder* | Remove-AppxPackage
```

#### Adobe Binary Paths

```
%ProgramFiles%\Adobe\Adobe Lightroom\lightroom.exe
%ProgramFiles%\Adobe\Adobe Photoshop CC 2015\Photoshop.exe
%ProgramFiles%\Adobe\Adobe Premiere Pro CC 2015\Adobe Premiere Pro.exe
%ProgramFiles% (x86)\Common Files\Adobe\OOBE\PDApp\UWA\updaterstartuputility.exe
%ProgramFiles% (x86)\Common Files\Adobe\OOBE\PDApp\UWA\AAM Updates Notifier.exe
```

#### Windows 10 Ultimate Performance

Run powershell for super admin

```
powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61
```

#### Windows Path Env Vars

```
%USERPROFILE%\AppData\Local\Android\sdk\platform-tools
%USERPROFILE%\AppData\Local\Microsoft\WindowsApps
```

#### WSL root fs

WSL can be found at this path `\\wsl$`

Or mount it from command line

```
net use z: \\wsl$\Ubuntu-20.04
```

#### VS Code Extensions Path

```
# Mac or Linux
~/.vscode/extensions

# Windows
%USERPROFILE%\.vscode\extensions
```
