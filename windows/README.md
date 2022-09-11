### Special KnownFolders

https://docs.microsoft.com/en-us/windows/desktop/shell/knownfolderid

### User registry for User Shell Folders

```
HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders
```

### Path

##### Home Folder

```
%USERPROFILE%
```

##### App Data

`C:\Users\<user>\AppData\Local`

```
%APPDATA%
```

##### Local App Data

```
%LOCALAPPDATA%
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

Use the UI

```
%APPDATA%\npm
%ProgramFiles%\Git\cmd
%ProgramFiles%\nodejs
%ProgramFiles%\PuTTY
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

#### Downloading and installing WSL2

https://docs.microsoft.com/en-us/windows/wsl/install-manual

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Download kernel
https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi

# Set WSL2 as default
wsl --set-default-version 2
```

## GUI package for WSL (wslG)

https://ubuntu.com/tutorials/install-ubuntu-on-wsl2-on-windows-11-with-gui-support#5-install-and-use-a-gui-package

## Allow SSH into WSL 2

Enable it on port 2222,

Run this commnad iif you have a host error `sshd: no hostkeys available -- exiting`

```
sudo ssh-keygen -A
```

Edit the sshd config

```
sudo vim /etc/ssh/sshd_config
```

Make sure the following is matching

```
Port 2222
ListenAddress 0.0.0.0
```

Optional initially the config is key based auth only, comment this one out to support password auth

```
# PasswordAuthentication no
```

### Open up ports for WSL2

- https://stackoverflow.com/questions/49835559/how-to-access-to-the-web-server-which-running-on-wslwindows-subsystem-for-linux/66890232#66890232

### Open up the SSH Server

- https://www.hanselman.com/blog/how-to-ssh-into-wsl2-on-windows-10-from-an-external-machine

```
#[Ports]
#All the ports you want to forward separated by coma
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

#### TightVNC Java Viewer

Use this VNC viewer for Mac Remote Viewing or Ubuntu

https://www.tightvnc.com/download/2.8.3/tvnjviewer-2.8.3-bin-gnugpl.zip

#### Path for shortcuts

```
C:\ProgramData\Microsoft\Windows\Start Menu\Programs
```

#### Required Services

`msconfig`

```
# Asus
ASUS App Service
ASUS Optimization
```

### WSL2 Image Backup and Restore

https://www.virtualizationhowto.com/2021/01/wsl2-backup-and-restore-images-using-import-and-export/

```bash
wsl --shutdown

# get image name from here
# %userprofile%\AppData\Local\Packages
# Debian Package Name : TheDebianProject.DebianGNULinux_76v4gfsz19hv4

wsl --list
# Debian Image Name: Debian

# export
wsl --export <Image_Name> <Path_To_Backup.tar>
wsl --export Debian ./wsl_backup.tar

# import
wsl --import <Image_Name> <Path_To_Restore_This_WSL.tar> <Path_To_Backup.tar>
wsl --import Debian D:\WSL\Debian ./wsl_backup.tar

# needs to update the registry to set up default users
# Then update DefaultUid to e38 (aka 1000)
# That above Uid can be found with `wsl -d Debian -u syle -e id -u`
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Lxss\{MY-UUID}
```

### Electron App with WSL2

- https://stackoverflow.com/questions/70330023/i-have-not-been-able-to-get-electron-running-within-electron-to-run-in-wsl2-ubun
- https://stackoverflow.com/questions/40402344/advanced-gpu-control-needed-for-browserwindows
- https://www.reddit.com/r/openSUSE/comments/ptqlfu/psa_vscode_and_some_nonpatched_electron/

```bash

sudo apt-get install -y libxcursor1 libnss3 libgdk-pixbuf2.0-0 libgtk-3-0 libxss-dev libnss3-dev libgconf-2-4 libatk1.0-0 libatk-bridge2.0-0 libgbm-dev libasound2
sudo apt-get autoclean -y
sudo apt-get autoremove -y

npm install --platform=win32

./node_modules/.bin/electron --disable-gpu-sandbox .
```

### Allow WSL Firewall Network Interface

```bash
New-NetFirewallRule -DisplayName "_Sy Inbound WSL" -Direction Inbound  -InterfaceAlias "vEthernet (WSL)"  -Action Allow
```

### Forward port WSL to Windows

Source: https://dev.to/vishnumohanrk/wsl-port-forwarding-2e22

```ps
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

### Image / Video extensions

These are extensions to view videos and images from newer iphones and android phones:

- [Raw Image Extension](https://apps.microsoft.com/store/detail/raw-image-extension/9NCTDW2W1BH8)
- [Heif Image Extensions](https://apps.microsoft.com/store/detail/heif-image-extensions/9PMMSR1CGPWG)
- [Hevc Video Extensions from Device Manufacturer](https://apps.microsoft.com/store/detail/hevc-video-extensions-from-device-manufacturer/9n4wgh0z6vhq)
- [MPEG-2 Video Extension](https://apps.microsoft.com/store/detail/mpeg2-video-extension/9N95Q1ZZPMH4)
- [AV1 Video Extension](https://apps.microsoft.com/store/detail/av1-video-extension/9MVZQVXJBQ9V?hl=de-de&gl=DE)
