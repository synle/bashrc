# Windows Notes

## Windows Tweaks

### Windows 11 Debloat

<https://github.com/Raphire/Win11Debloat>

- Download the script and unzip, and execute `run.bat` - <https://github.com/Raphire/Win11Debloat/archive/master.zip>

### Setting up Personal Folders

```ps1
# ==========================================
# Move Desktop, Documents, Downloads, Pictures
# to D:\Desktop, D:\Documents, D:\Downloads, D:\Pictures
# ==========================================

# Known Folder GUIDs → New Paths
$folders = @{
    '{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}' = 'D:\Desktop'     # Desktop
    '{FDD39AD0-238F-46AF-ADB4-6C85480369C7}' = 'D:\Documents'   # Documents
    '{374DE290-123F-4565-9164-39C4925E467B}' = 'D:\Downloads'   # Downloads
    '{33E28130-4E1E-4676-835A-98395C3BC3BB}' = 'D:\Pictures'    # Pictures
}

# Registry locations
$userShellFolders = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
$shellFolders     = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"

foreach ($guid in $folders.Keys) {

    $target = $folders[$guid]

    # Ensure the new target folder exists
    if (-not (Test-Path $target)) {
        Write-Host "Creating: $target"
        New-Item -ItemType Directory -Path $target -Force | Out-Null
    }

    # Determine current folder path
    switch ($guid) {
        '{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}' { $current = "$HOME\Desktop" }
        '{FDD39AD0-238F-46AF-ADB4-6C85480369C7}' { $current = "$HOME\Documents" }
        '{374DE290-123F-4565-9164-39C4925E467B}' { $current = "$HOME\Downloads" }
        '{33E28130-4E1E-4676-835A-98395C3BC3BB}' { $current = "$HOME\Pictures" }
    }

    # Move documents if source exists
    if (Test-Path $current) {
        Write-Host "Moving: $current → $target"
        robocopy $current $target /MOVE /E | Out-Null
    } else {
        Write-Host "Skipping (missing): $current"
    }

    # Update the registry mappings
    Set-ItemProperty -Path $userShellFolders -Name $guid -Value $target
    Set-ItemProperty -Path $shellFolders     -Name $guid -Value $target

    Write-Host "Updated location for: $guid → $target"
}

Write-Host "`nDone! Please sign out and back in for full effect."
```

### User Registry for User Shell Folders

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Invoke-WebRequest -Uri "https://github.com/synle/bashrc/raw/master/.build/windows-registry.ps1" -OutFile ".\minimal-registry.ps1"
.\minimal-registry.ps1
```

Registry path:

```
HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders
```

Special KnownFolders reference: <https://docs.microsoft.com/en-us/windows/desktop/shell/knownfolderid>

### Windows Paths

#### Home Folder

```
%USERPROFILE%
```

#### App Data

`C:\Users\<user>\AppData\Local`

```
%APPDATA%
```

#### Local App Data

```
%LOCALAPPDATA%
```

#### Program Files (x86)

```
%ProgramFiles% (x86)
```

#### Program Files (x64)

```
%ProgramFiles%
```

### Windows 10 App Shortcut Path

`%USERPROFILE%\AppData\Local\Microsoft\WindowsApps`

Reference: <https://www.tenforums.com/tutorials/122655-create-shortcut-directly-open-app-microsoft-store-windows-10-a.html>

### Shortcuts

#### CMD Shortcut for Control Panel

<https://support.microsoft.com/en-us/help/192806/how-to-run-control-panel-tools-by-typing-a-command>

#### CMD Shortcut for New Microsoft Settings Page

<https://answers.microsoft.com/en-us/windows/forum/windows_10-other_settings/list-of-specific-settings-commands-in-windows-10/73177baa-fd77-463f-88a0-00595a2e7a32>

#### Path for Start Menu Shortcuts

```
C:\ProgramData\Microsoft\Windows\Start Menu\Programs
```

### Environment Variables

```
C:\Program Files\Java\jdk-11.0.1\bin
%USERPROFILE%\AppData\Local\Android\sdk\platform-tools
%APPDATA%\npm
%ProgramFiles%\Git\cmd
%ProgramFiles%\nodejs
%ProgramFiles%\PuTTY
```

### Disable Internet Search in Start Menu

```powershell
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" `
    -Name "BingSearchEnabled" -Value 0 -Type DWord

Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" `
    -Name "CortanaConsent" -Value 0 -Type DWord
```

### Make Password Never Expire

```powershell
Set-ADUser -Identity "Sy Le" -PasswordNeverExpires $true
Set-ADUser -Identity "syle" -PasswordNeverExpires $true
```

### Game Bar Registry Hacks

```ps1
# ================================
#  DISABLE XBOX GAME BAR
# ================================
Write-Host "`nDisabling Xbox Game Bar..." -ForegroundColor Cyan

$gameBarKeys = @(
    "HKCU:\Software\Microsoft\GameBar",
    "HKCU:\System\GameConfigStore",
    "HKLM:\Software\Microsoft\GameBar",
    "HKLM:\System\GameConfigStore"
)

foreach ($key in $gameBarKeys) {
    if (-not (Test-Path $key)) {
        New-Item -Path $key -Force | Out-Null
    }

    # Disable Game Bar
    Set-ItemProperty -Path $key -Name AllowGameBar -Value 0 -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $key -Name AutoGameModeEnabled -Value 0 -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $key -Name GameDVR_Enabled -Value 0 -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $key -Name GameDVR_EnabledForGameBar -Value 0 -Force -ErrorAction SilentlyContinue
}

# Disable Game Bar service if present
$svc = Get-Service -Name "XblGameSave" -ErrorAction SilentlyContinue
if ($svc) {
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Set-Service $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

# Fix ms-gamebar URL handler annoyance (AveYo)
reg add HKCR\ms-gamebar /f /ve /d "URL:ms-gamebar" >'' 2>&1
reg add HKCR\ms-gamebar /f /v "URL Protocol" /d "" >'' 2>&1
reg add HKCR\ms-gamebar /f /v "NoOpenWith" /d "" >'' 2>&1
reg add HKCR\ms-gamebar\shell\open\command /f /ve /d "`"$env:SystemRoot\System32\systray.exe`"" >'' 2>&1

reg add HKCR\ms-gamebarservices /f /ve /d "URL:ms-gamebarservices" >'' 2>&1
reg add HKCR\ms-gamebarservices /f /v "URL Protocol" /d "" >'' 2>&1
reg add HKCR\ms-gamebarservices /f /v "NoOpenWith" /d "" >'' 2>&1
reg add HKCR\ms-gamebarservices\shell\open\command /f /ve /d "`"$env:SystemRoot\System32\systray.exe`"" >'' 2>&1

Write-Host "`nXbox Game Bar disabled successfully." -ForegroundColor Green
```

### Windows 10 Ultimate Performance

Run PowerShell as super admin:

```powershell
powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61
```

### Remove Windows Apps in PowerShell

```powershell
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

### Adobe Binary Paths

```
%ProgramFiles%\Adobe\Adobe Lightroom\lightroom.exe
%ProgramFiles%\Adobe\Adobe Photoshop CC 2015\Photoshop.exe
%ProgramFiles%\Adobe\Adobe Premiere Pro CC 2015\Adobe Premiere Pro.exe
%ProgramFiles% (x86)\Common Files\Adobe\OOBE\PDApp\UWA\updaterstartuputility.exe
%ProgramFiles% (x86)\Common Files\Adobe\OOBE\PDApp\UWA\AAM Updates Notifier.exe
```

### Image / Video Extensions

These are extensions to view videos and images from newer iPhones and Android phones:

- [Raw Image Extension](https://apps.microsoft.com/store/detail/raw-image-extension/9nctdw2w1bh8) - `ms-windows-store://pdp/?ProductId=9nctdw2w1bh8`
- [HEIF Image Extension](https://apps.microsoft.com/store/detail/heif-image-extensions/9pmmsr1cgpwg) - `ms-windows-store://pdp/?ProductId=9pmmsr1cgpwg`
- [HEVC Video Extension from Device Manufacturer](https://apps.microsoft.com/store/detail/hevc-video-extensions-from-device-manufacturer/9n4wgh0z6vhq) - `ms-windows-store://pdp/?ProductId=9n4wgh0z6vhq`
- [MPEG-2 Video Extension](https://apps.microsoft.com/store/detail/mpeg2-video-extension/9n95q1zzpmh4) - `ms-windows-store://pdp/?ProductId=9n95q1zzpmh4`
- [AV1 Video Extension](https://apps.microsoft.com/store/detail/av1-video-extension/9mvzqvxjbq9v) - `ms-windows-store://pdp/?ProductId=9mvzqvxjbq9v`

### X-Input Emulator

Use these to map generic controllers for Windows:

- <https://hardwaretester.com/gamepad> (For testing gamepad)

#### x360ce

- <https://github.com/x360ce/x360ce>

#### Dependencies

- <https://learn.microsoft.com/en-GB/cpp/windows/latest-supported-vc-redist?view=msvc-170#visual-studio-2015-2017-2019-and-2022>
- <https://aka.ms/vs/17/release/vc_redist.x86.exe>
- <https://aka.ms/vs/17/release/vc_redist.x64.exe>
- <https://aka.ms/highdpimfc2013x64enu>
- <https://download.microsoft.com/download/1/6/B/16B06F60-3B20-4FF2-B699-5E9B7962F9AE/VSU_4/vcredist_x64.exe>

### Mount SFTP as a Drive

- <https://github.com/winfsp/sshfs-win>
- <https://github.com/winfsp/winfsp/releases/tag/v2.0>
- <https://github.com/winfsp/sshfs-win/releases>

```
\\sshfs\syle@127.0.0.1
```

### Ramdisk

Software for Windows is called ImDisk.

### 7-Zip

#### Path for Temp

```
R:\
```

#### Other Settings

Viewer:

```
"C:\Program Files\Sublime Text\subl.exe" -n -w
```

### Required Services

`msconfig`

```
# Asus
ASUS App Service
ASUS Optimization
```

### TightVNC Java Viewer

Use this VNC viewer for Mac Remote Viewing or Ubuntu:

<https://www.tightvnc.com/download/2.8.3/tvnjviewer-2.8.3-bin-gnugpl.zip>

### PowerShell Profiles

```powershell
New-Item $profile -Type File -Force
subl $profile
```

### PuTTY

#### Generate Key in Windows with PuTTY

Download puttygen (putty):

- Save public key
- Save private key `.ppk`

Also can use puttygen to convert AWS key to `.ppk`.

#### Connect with PuTTY Private Key

Connection > Auth > Choose private key `.ppk`

---

## WSL Notes

### Installing WSL2

<https://docs.microsoft.com/en-us/windows/wsl/install-manual>

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Download WSL kernel
# https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi

# Set WSL2 as default
wsl --set-default-version 2

wsl --update
```

### WSL Root Filesystem

WSL can be found at this path `\\wsl$`

Or mount it from command line:

```powershell
net use z: \\wsl$\Ubuntu-20.04
```

### WSL Not Loading

Error: `0x800703fa Illegal operation attempted on a registry key that has been marked for deletion`

```bash
sc stop lxssmanager
sc start lxssmanager
```

### WSL2 Image Backup and Restore

<https://www.virtualizationhowto.com/2021/01/wsl2-backup-and-restore-images-using-import-and-export/>

```bash
wsl --shutdown

# get image name from here
# %userprofile%\AppData\Local\Packages
# Debian Package Name: TheDebianProject.DebianGNULinux_76v4gfsz19hv4

wsl --list
# Debian Image Name: Debian

# export
wsl --export <Image_Name> <Path_To_Backup.tar>
wsl --export Debian ./wsl_backup.tar

# import
wsl --import <Image_Name> <Path_To_Restore_This_WSL.tar> <Path_To_Backup.tar>
wsl --import Debian D:\WSL\Debian ./wsl_backup.tar
```

### Set Default WSL User

Use regedit and update `DefaultUid` to `3e8` (decimal 1000).

Find the UID with: `wsl -d Debian -u syle -e id -u`

```
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Lxss\{MY-UUID}
```

### GUI Package for WSL (wslG)

<https://ubuntu.com/tutorials/install-ubuntu-on-wsl2-on-windows-11-with-gui-support#5-install-and-use-a-gui-package>

### WSL Terminal Tweaks

Reference: <https://blog.ropnop.com/configuring-a-pretty-and-usable-terminal-emulator-for-wsl/>

xming - <https://sourceforge.net/projects/xming/>

```bash
dbus-uuidgen > /tmp/machine-id && sudo mv /tmp/machine-id /etc/machine-id

sudo apt-get install terminator dbus-x11

DISPLAY=:0 terminator &

args = "-c" & " -l " & """DISPLAY=:0 terminator"""
WScript.CreateObject("Shell.Application").ShellExecute "bash", args, "", "open", 0

C:\Windows\System32\wscript.exe %HOMEPATH%\startTerminator.vbs
%USERPROFILE%
```

### Allow SSH into WSL 2

Enable it on port 2222.

Run this command if you have a host error `sshd: no hostkeys available -- exiting`:

```bash
sudo ssh-keygen -A
```

Edit the sshd config:

```bash
sudo vim /etc/ssh/sshd_config
```

Make sure the following is matching:

```
Port 2222
ListenAddress 0.0.0.0
```

Optional: initially the config is key based auth only, comment this one out to support password auth:

```
# PasswordAuthentication no
```

### Open Up Ports for WSL2

- <https://stackoverflow.com/questions/49835559/how-to-access-to-the-web-server-which-running-on-wslwindows-subsystem-for-linux/66890232#66890232>
- <https://www.hanselman.com/blog/how-to-ssh-into-wsl2-on-windows-10-from-an-external-machine>

```powershell
#[Ports]
#All the ports you want to forward separated by comma
$ports=@(80,443,2222,3000,4000,8080,9000);

$remoteport = bash.exe -c "ifconfig eth0 | grep 'inet '"
$found = $remoteport -match '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}';

if( $found ){
  $remoteport = $matches[0];
} else{
  echo "The Script Exited, the ip address of WSL 2 cannot be found";
  exit;
}

#[Static ip]
#You can change the addr to your ip config to listen to a specific address
$addr='0.0.0.0';
$ports_a = $ports -join ",";

#Remove Firewall Exception Rules
iex "Remove-NetFireWallRule -DisplayName '_Sy Dev Port Unlocked' ";

#adding Exception Rules for inbound and outbound Rules
iex "New-NetFireWallRule -DisplayName '_Sy Dev Port Unlocked' -Direction Outbound -LocalPort $ports_a -Action Allow -Protocol TCP";
iex "New-NetFireWallRule -DisplayName '_Sy Dev Port Unlocked' -Direction Inbound -LocalPort $ports_a -Action Allow -Protocol TCP";

for( $i = 0; $i -lt $ports.length; $i++ ){
  $port = $ports[$i];
  iex "netsh interface portproxy delete v4tov4 listenport=$port listenaddress=$addr";
  iex "netsh interface portproxy add v4tov4 listenport=$port listenaddress=$addr connectport=$port connectaddress=$remoteport";
}
```

### Allow WSL Firewall Network Interface

```powershell
New-NetFirewallRule -DisplayName "_Sy Inbound WSL" -Direction Inbound -InterfaceAlias "vEthernet (WSL)" -Action Allow
```

### Forward Port WSL to Windows

Source: <https://dev.to/vishnumohanrk/wsl-port-forwarding-2e22>

```powershell
$ports = @(3000, 8080, 5000, 5001, 19000, 19001);

If (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
  $arguments = "& '" + $myinvocation.mycommand.definition + "'"
  Start-Process powershell -Verb runAs -ArgumentList $arguments
  Break
}

$remoteport = bash.exe -c "ifconfig eth0 | grep 'inet '"
$found = $remoteport -match '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}';

if ($found) {
  $remoteport = $matches[0];
}
else {
  Write-Output "IP address could not be found";
  exit;
}

for ($i = 0; $i -lt $ports.length; $i++) {
  $port = $ports[$i];
  Invoke-Expression "netsh interface portproxy delete v4tov4 listenport=$port";
  Invoke-Expression "netsh advfirewall firewall delete rule name=$port";

  Invoke-Expression "netsh interface portproxy add v4tov4 listenport=$port connectport=$port connectaddress=$remoteport";
  Invoke-Expression "netsh advfirewall firewall add rule name=$port dir=in action=allow protocol=TCP localport=$port";
}

Invoke-Expression "netsh interface portproxy show v4tov4";
```

### Electron App with WSL2

- <https://stackoverflow.com/questions/70330023/i-have-not-been-able-to-get-electron-running-within-electron-to-run-in-wsl2-ubun>
- <https://stackoverflow.com/questions/40402344/advanced-gpu-control-needed-for-browserwindows>
- <https://www.reddit.com/r/openSUSE/comments/ptqlfu/psa_vscode_and_some_nonpatched_electron/>

```bash
sudo apt-get install -y libxcursor1 libnss3 libgdk-pixbuf2.0-0 libgtk-3-0 libxss-dev libnss3-dev libgconf-2-4 libatk1.0-0 libatk-bridge2.0-0 libgbm-dev libasound2
sudo apt-get autoclean -y
sudo apt-get autoremove -y

npm install --platform=win32

./node_modules/.bin/electron --disable-gpu-sandbox .
```

### VS Code Extensions Path

```bash
# Mac or Linux
~/.vscode/extensions

# Windows
%USERPROFILE%\.vscode\extensions
```

---

## General Development Notes

### SSH

#### Register SSH Key

```bash
sudo crontab -e
*/20 * * * * /opt/cron_pull_code.sh
```

Script:

```bash
eval $(ssh-agent);
ssh-add ~/.ssh/id_rsa;

cd your_app
git pull
```

#### Copy SSH Keys

```bash
ssh-copy-id syle@sy-macpro
```

#### Connect to SSH with Private Key

```bash
ssh -i .ssh/id_rsa
```

#### SSH Config File

`~/.ssh/config`

```
Host sy-macpro
  User syle
  HostName 192.168.5.2
  IdentityFile ~/.ssh/id_rsa
```

#### SSH Connection Keep Alive

`sudo vim /etc/ssh/ssh_config`

```
Host *
  ClientAliveInterval 120
  ClientAliveCountMax 720
```

### Port Forwarding

Reference: <https://www.booleanworld.com/guide-ssh-port-forwarding-tunnelling/>

#### Local Port Forwarding

From SSH Server to localhost:

```bash
ssh -L 443:localhost:443 -L 3000:localhost:3000 -L 9000:localhost:9000 -L 3306:localhost:3306 sy-macpro
```

If you do not need to start a session, you can add `-N`:

```bash
ssh -L 443:localhost:443 -L 3000:localhost:3000 -L 9000:localhost:9000 -L 3306:localhost:3306 -N sy-macpro
```

#### Remote Port Forwarding

From localhost to SSH Server:

```bash
ssh -R 7000:127.0.0.1:8000 user@example.com
```

### Self-Signed Certificates

Reference: <https://letsencrypt.org/docs/certificates-for-localhost/>

```bash
openssl req -x509 -out localhost.crt -keyout localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```

### Chrome Flags

Source: <https://www.maketecheasier.com/chrome-flags-better-browsing-experience/>

```
Enable picture in picture
Omnibox UI Vertical Layout - SHOW Title
Automatic Tab Discarding - DISCARD
Smooth Scrolling - OFF
Tab audio muting UI control - MUTE TAB
Fast tab/window close - QUICK TAB CLOSE
```

### ESLint and Prettier Config

```json
"lint": "./node_modules/.bin/eslint --ignore-pattern \"*.spec.js\" --max-warnings 200 src/**/**/*.js",
"format": "./node_modules/.bin/prettier --config ./.prettierrc --write src/**/**/*{js,jsx}"
```

```json
{
  "printWidth": 100,
  "parser": "flow",
  "semi": true,
  "useTabs": false,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true,
  "jsxBracketSameLine": true,
  "jsxSingleQuote": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Shell Utilities

#### xargs and sed

```bash
find src -name "*.bak" | xargs rm && find src -name "*.DS_Store" | xargs rm
find src -type f -name "*.js" -exec sed -i'.bak' -e 's/allowTotalAmountChangedSelectors/allowTotalAmountChanged/g' {} \;
```

#### awk Cheatsheet

```bash
awk '{print $1 $2}' contacts.txt

# print number of fields, then whole line ($0)
awk '{print NF $0}' contacts.txt

# only print those lines that match 'Bob'
awk '/Bob/{print $1 $2}' contacts.txt

# only print those lines with 3 fields
awk 'NF==3{print $0}' contacts.txt

# only print those lines with 3 fields
awk '/up/{print "UP:" $0}' '/down/{print "DOWN:" $0}' contacts.txt

# from command file
awk -f filename contacts.txt

# use space as field separator here we separate by \t
awk -F '\t' '{print $2}' contacts.txt

# csv to tsv
awk 'BEGIN{FS=","; OFS="\t"}{print $1, $2, $3}' contacts.csv
```

### MySQL

#### Datetime and Timezone

```sql
SHOW VARIABLES LIKE '%time_zone%'

SET time_zone = '+00:00';
SELECT NOW(); -- with respect to server timezone
SELECT UTC_TIMESTAMP();
```

```sql
-- TIMESTAMP type is obsolete and will stop working in year 2038
update_current_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### Enum Type

Using Enum:

```sql
...
city ENUM ('SF', 'LA', 'NY')
...

INSERT INTO test (...) VALUES ('SF');
INSERT INTO test (...) VALUES ('1');
```

Using Set (bitmap position):

```sql
...
city SET ('SF', 'LA', 'NY')
...

INSERT INTO test (...) VALUES ('SF,LA');
INSERT INTO test (...) VALUES ('1');
```

#### Serial Data Type

```sql
id SERIAL
...
id INT UNSIGNED UNIQUE AUTO_INCREMENT PRIMARY KEY
```

#### Describe / Show Create Table

```sql
DESCRIBE test
SHOW CREATE TABLE test
```

#### Numeric Data Types

Use DECIMAL for precision:

```sql
DECIMAL(9,2) -- 1234567.89
DECIMAL(10,0) -- 1234567890
```

Not precise:

```
FLOAT - 24 bits and 7 precision - about 7 digits
DOUBLE - 53 bits and 16 precision - about 16 digits
```

### VS Code - Remote Development

Reference: <https://code.visualstudio.com/docs/remote/ssh>
