const BASE_REMOTE_CONNECTIONS_PATH = path.join(
  globalThis.BASE_SY_CUSTOM_TWEAKS_DIR,
  "remote-connections"
);

const DEFAULT_CONNECTION_USER = "syle";

async function doWork() {
  await mkdir(BASE_REMOTE_CONNECTIONS_PATH);

  doWorkVnc();
  doWorkRdp();
}

async function doWorkRdp() {
  console.log("  >> Setting up Remote Desktop (RDP) Connections");

  const windowsPcNames = convertTextToList(`
    sy-alienware-15
    sy-asus-g15
    sy-asus-g14
  `);

  const hosts = HOME_HOST_NAMES.filter(([hostName, hostIp]) =>
    windowsPcNames.includes(hostName)
  );

  for (const [hostName, hostIp] of hosts) {
    const targetPath = path.join(
      BASE_REMOTE_CONNECTIONS_PATH,
      hostName + ".rdp"
    );

    console.log("    >> RDP: ", targetPath);

    const content = `
use multimon:i:0
compression:i:1
keyboardhook:i:2
audiocapturemode:i:0
videoplaybackmode:i:1
connection type:i:7
networkautodetect:i:1
bandwidthautodetect:i:1
displayconnectionbar:i:1
enableworkspacereconnect:i:0
disable wallpaper:i:0
allow font smoothing:i:0
allow desktop composition:i:0
disable full window drag:i:1
disable menu anims:i:1
disable themes:i:0
disable cursor setting:i:0
bitmapcachepersistenable:i:1
full address:s:${hostName}
audiomode:i:0
redirectprinters:i:1
redirectcomports:i:0
redirectsmartcards:i:1
redirectclipboard:i:1
redirectposdevices:i:0
autoreconnection enabled:i:1
authentication level:i:2
prompt for credentials:i:0
negotiate security layer:i:1
remoteapplicationmode:i:0
alternate shell:s:
shell working directory:s:
gatewayhostname:s:
gatewayusagemethod:i:4
gatewaycredentialssource:i:4
gatewayprofileusagemethod:i:0
promptcredentialonce:i:0
gatewaybrokeringtype:i:0
use redirection server name:i:0
rdgiskdcproxy:i:0
kdcproxyname:s:
    `;

    writeText(targetPath, content);
  }
}

async function doWorkVnc() {
  console.log("  >> Setting up VNC Connections");

  const windowsPcNames = convertTextToList(`
    sy-macpro
  `);

  const hosts = HOME_HOST_NAMES.filter(([hostName, hostIp]) =>
    windowsPcNames.includes(hostName)
  );

  for (const [hostName, hostIp] of hosts) {
    const targetPath = path.join(
      BASE_REMOTE_CONNECTIONS_PATH,
      hostName + ".vnc"
    );

    console.log("    >> VNC: ", targetPath);

    const content = `
AuthCertificate=
FriendlyName=${hostName}
Host=${hostIp}
FullScreen=0
RelativePtr=0
Scaling=FitAutoAspect
SingleSignOn=0
UpdateScreenshot=0
UserName=${DEFAULT_CONNECTION_USER}
    `;

    writeText(targetPath, content);
  }
}
