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
```

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

### App List

- Twinkle Tray (brightness control): https://twinkletray.com/

### Electron App with WSL2

- https://stackoverflow.com/questions/70330023/i-have-not-been-able-to-get-electron-running-within-electron-to-run-in-wsl2-ubun
- https://stackoverflow.com/questions/40402344/advanced-gpu-control-needed-for-browserwindows
- https://www.reddit.com/r/openSUSE/comments/ptqlfu/psa_vscode_and_some_nonpatched_electron/

```

sudo apt-get install -y libxcursor1 libnss3 libgdk-pixbuf2.0-0 libgtk-3-0 libxss-dev libnss3-dev libgconf-2-4 libatk1.0-0 libatk-bridge2.0-0 libgbm-dev libasound2
sudo apt-get autoclean -y
sudo apt-get autoremove -y

npm install --platform=win32

./node_modules/.bin/electron --disable-gpu-sandbox .
```
