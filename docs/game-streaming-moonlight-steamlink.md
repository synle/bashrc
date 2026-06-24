# Game Streaming — Moonlight + Steam Link

Setup notes for streaming games from a Windows host to a Steam Deck, a second
Windows PC, and a Mac.

Two stacks are covered side by side:

- **Moonlight + Sunshine** — open-source replacement for NVIDIA GameStream.
  Works on any GPU (NVIDIA / AMD / Intel). Lower latency, exposes the whole
  desktop, not just Steam games.
- **Steam Link** — Valve's built-in streaming. Zero install on the host (Steam
  is the server). Best for Steam library games; less flexible for non-Steam
  apps.

Run both. They don't conflict — Sunshine listens on its own ports, Steam Link
uses Steam's. Pick per session based on what you're launching.

## TL;DR

| Use case                                  | Pick           |
| ----------------------------------------- | -------------- |
| Steam game, all clients have Steam        | **Steam Link** |
| Non-Steam game, emulator, or full desktop | **Moonlight**  |
| Steam Deck, low latency, HDR              | **Moonlight**  |
| Quickest setup, no extra installs         | **Steam Link** |

## Network prerequisites (do this first)

Both stacks assume host and clients are on the **same LAN**, preferably wired
on the host side.

- Host on Ethernet (or Wi-Fi 6 / 6E at 5 GHz minimum). Wi-Fi on host is the #1
  cause of stutter.
- Clients on 5 GHz Wi-Fi at minimum. Steam Deck supports Wi-Fi 6 on the OLED;
  LCD is Wi-Fi 5.
- Router QoS: prioritize the host's IP if you can. Otherwise just make sure
  nobody else is saturating the uplink during a session.
- Give the host a **static LAN IP** (DHCP reservation on the router). Both
  Moonlight and Steam Link cache the host by IP — it breaks when the lease
  rotates.

Bandwidth rule of thumb:

| Resolution / FPS | Bitrate     |
| ---------------- | ----------- |
| 1080p60          | 20-30 Mbps  |
| 1440p60          | 40-50 Mbps  |
| 4K60             | 80-100 Mbps |
| 1080p120         | 50-60 Mbps  |

---

## Host setup — Windows

### Stack A: Sunshine (for Moonlight clients)

Sunshine is the host-side server. It impersonates an NVIDIA GameStream host so
Moonlight clients connect to it.

1. **Install Sunshine** — download the latest Windows installer from
   <https://github.com/LizardByte/Sunshine/releases>. Pick
   `sunshine-windows-installer.exe`.
2. Run the installer. Accept the Windows service install — Sunshine should
   start at boot so you can wake the host and stream without logging in
   locally.
3. Reboot once after install (the virtual display + input drivers register
   properly only after a reboot).
4. Open the Sunshine Web UI at <https://localhost:47990>. First launch asks
   you to create a username and password. **Save these in a password
   manager — they're needed for every new client pairing.**
5. In the Web UI:
   - **Configuration → General → Sunshine Name**: set to something memorable
     (e.g. `desktop-host`).
   - **Configuration → Audio/Video → Adapter Name**: pick your discrete GPU
     explicitly if you have both iGPU + dGPU. Auto sometimes picks the iGPU.
   - **Configuration → Audio/Video → Display Mode**: leave at `Auto` unless
     you want a forced resolution for headless mode.
   - **Configuration → Network → UPnP**: enable only if you want to stream
     over the internet. Leave off for LAN-only (safer).
6. **Firewall**: the installer adds rules for ports `47984`, `47989`, `47990`,
   `48010`, plus UDP `47998`-`48000` and `48002`. Verify in Windows Defender
   Firewall → Inbound Rules — search for `Sunshine`.
7. **Add a `Desktop` app entry** (Web UI → Applications → Add New). This is
   what lets you stream the whole desktop rather than a specific game.
   Leave Command blank; set Image Path to anything (or leave default).
8. **GPU driver tweaks**:
   - NVIDIA: install the latest Studio or Game Ready driver. No need to
     install GeForce Experience anymore — Sunshine replaces it.
   - AMD: enable `AMD Link` is NOT required. Just install the latest Adrenalin
     driver.
   - Intel Arc: latest Arc driver. Make sure hardware encoding (AV1 / HEVC)
     shows up in Sunshine's Web UI under encoder options.
9. **Auto-start Sunshine at boot**: the Windows service install handles this.
   Confirm in `services.msc` — service name is `SunshineService`, startup type
   `Automatic`.
10. **Wake-on-LAN** (optional but recommended for Steam Deck use): enable WoL
    in the host's BIOS and in the network adapter properties (Device Manager →
    NIC → Power Management → "Allow this device to wake the computer" +
    "Magic packet only").

### Stack B: Steam Link (host side)

Steam itself is the server. Almost nothing to configure beyond turning it on.

1. Install Steam from <https://store.steampowered.com> if not already
   installed.
2. Sign in.
3. **Steam → Settings → Remote Play** → check **Enable Remote Play**.
4. Optional: **Advanced Host Options** → enable **Hardware encoding** (NVENC /
   AMF / QuickSync depending on GPU). This drops CPU usage massively.
5. Leave Steam running. Steam Link clients discover the host via mDNS on the
   LAN.
6. **Firewall**: Steam adds its own rules during install. If streaming fails,
   confirm UDP `27031`, `27036`, TCP `27036`, `27037` are open inbound.
7. For non-Steam games, **add them as Non-Steam Games** (Library → Add a Game
   → Add a Non-Steam Game). Steam Link can only stream what Steam can launch.

### Host extras worth doing once

- **Disable Windows sleep on AC power**: `powercfg /change standby-timeout-ac
  0`. Hibernation can stay on; sleep kills streaming.
- **Disable display auto-off**: `powercfg /change monitor-timeout-ac 0`.
  Sunshine's virtual display avoids this issue if you configure it, but
  belt-and-suspenders.
- **Install a virtual display dongle or driver** if the host runs headless
  (monitor off / unplugged). Options:
  - Physical: a $5 HDMI dummy plug.
  - Software: Sunshine ships with `Sunshine Virtual Display` — enable in the
    Web UI under Configuration → Audio/Video → Display Device.
- **Controller**: install ViGEmBus if Sunshine didn't auto-install it
  (<https://github.com/ViGEm/ViGEmBus/releases>). Required for Moonlight
  controller input to appear as an Xbox 360 pad on the host.

---

## Client setup — Steam Deck

The Deck runs SteamOS (Arch-based). Both clients are available.

### Moonlight on Steam Deck

1. **Switch to Desktop Mode** (Steam button → Power → Switch to Desktop).
2. Open **Discover** (the bag icon in the taskbar).
3. Search for **Moonlight Game Streaming** → Install.
4. Launch Moonlight from the application launcher. It should auto-discover
   the host on the LAN. If not, click `Add Host Manually` and enter the
   host's static IP.
5. Click the host tile. Moonlight shows a 4-digit PIN.
6. On the host, open the Sunshine Web UI at `https://localhost:47990`, sign
   in, go to **PIN**, enter the PIN, and click `Send`.
7. Pairing is one-time per client. Apps appear as tiles.
8. **Add Moonlight to Game Mode (Steam UI)**:
   - In Desktop Mode: right-click Moonlight in the launcher → `Add to Steam`.
   - Switch back to Game Mode. Moonlight is now in your Non-Steam library and
     launches with full controller support.
9. **Controller config**: in Game Mode, open Moonlight's controller config
   and pick the community layout `Moonlight — Touch + Gyro` (search the
   community templates). The default template leaves the right trackpad
   unmapped.
10. **Recommended Moonlight settings** (gear icon):
    - Resolution: `1280x800` (Deck native) or `1920x1080` if you have a dock.
    - FPS: `60` (LCD) or `90` (OLED — supports 90 Hz).
    - Bitrate: 30-40 Mbps for 1080p60.
    - Video codec: `HEVC` (better quality at same bitrate). `AV1` if the host
      GPU supports it (Arc, RTX 40-series, RX 7000+).
    - HDR: on if both host and Deck OLED support it.
    - Audio: `Stereo` unless you have a 5.1 setup wired to the Deck dock.

### Steam Link on Steam Deck

Already built in — no install.

1. In Game Mode, the host shows up under the Steam UI's **Remote Play**
   section once both ends are signed into the same Steam account.
2. Pick a game in your library; Steam shows `Stream from <host>` instead of
   `Play`.
3. **Settings → Remote Play → Advanced Client Options**: enable hardware
   decoding, set bitrate to `Automatic` or pin to 30 Mbps.

Steam Link generally has higher input latency than Moonlight + Sunshine on
the Deck but needs zero pairing and works with Steam Input out of the box.

---

## Client setup — second Windows PC

### Moonlight on Windows

1. Download Moonlight from <https://moonlight-stream.org> → Windows installer
   (`Moonlight-X.X.X.exe`).
2. Install + launch.
3. Host auto-discovers on LAN. Click tile → PIN appears.
4. On the host: Sunshine Web UI → PIN → enter → Send.
5. Settings worth changing:
   - Resolution: match the client display.
   - FPS: 60 or 120 if both host GPU and client display support it.
   - Bitrate: 50 Mbps for 1440p60, 80+ for 4K60.
   - Video decoder: `Automatic` (uses D3D11VA hardware decode).
   - HDR: on if the client monitor is HDR-capable AND the host has it
     enabled in Windows display settings.

### Steam Link on Windows

1. Install Steam Link from the Microsoft Store, or download the standalone
   `Steam Link` app from <https://store.steampowered.com/steamlink>.
2. Sign in to the same Steam account as the host.
3. Host appears under `Computers` → pair with the on-screen PIN shown on the
   host.
4. Pick a game from the streamed Big Picture overlay.

---

## Client setup — Mac

### Moonlight on Mac

1. Install via Homebrew: `brew install --cask moonlight`.
   - Or download the `.dmg` from <https://moonlight-stream.org>.
2. Launch Moonlight. macOS will prompt for **Local Network** access on first
   launch (System Settings → Privacy & Security → Local Network) — allow it,
   otherwise host discovery silently fails.
3. Host tile appears. Click → PIN → pair on the host's Sunshine Web UI as
   above.
4. **Apple Silicon notes**:
   - HEVC decode is hardware-accelerated. Leave video codec on `HEVC`.
   - AV1 hardware decode requires M3 or later. Fall back to HEVC on M1/M2.
   - HDR streaming is supported on M-series MacBooks with XDR displays.
5. **Controller**: Xbox or PS5 controllers pair via Bluetooth (System
   Settings → Bluetooth). Moonlight maps them automatically.
6. **Keyboard / mouse capture**: hit `Ctrl + Option + Shift + Q` to release
   capture (default Moonlight hotkey on Mac). Useful if input gets stuck.

### Steam Link on Mac

Valve discontinued the standalone Steam Link app for macOS. Two options:

1. **Use the desktop Steam client's Remote Play** — install Steam on the Mac,
   sign in, your host appears under `Remote Play`. Same UX as Steam Link.
2. **Steam Link app on iOS/iPadOS** if you have an iPad nearby — still
   maintained, available on the App Store.

For Mac, **Moonlight is the recommended path**. Lower latency and actively
maintained.

---

## Quick troubleshooting

| Symptom                                    | Likely cause                                  | Fix                                                                                                                                 |
| ------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Host not discovered                        | Different subnet / VLAN / mDNS blocked        | Add host manually by IP. Check router AP isolation / "guest network" setting.                                                       |
| Pairing PIN never accepted                 | Sunshine service not running                  | `services.msc` → `SunshineService` → Start. Web UI must load at <https://localhost:47990>.                                          |
| Black screen after connecting              | No display attached / sleep                   | Plug in a dummy HDMI plug or enable Sunshine Virtual Display.                                                                       |
| Stutter / frame drops                      | Wi-Fi congestion or bitrate too high          | Drop bitrate by 30%. Move client to 5 GHz. Check host CPU usage during encode.                                                      |
| Controller works on Deck but not in game   | Game expects XInput, Moonlight sends DirectIn | Ensure ViGEmBus is installed on host. Restart Sunshine after install.                                                               |
| Audio out of sync                          | Host using software encoder fallback          | Sunshine Web UI → Configuration → Audio/Video → confirm `NVENC` / `AMF` / `QuickSync` is selected, not `software`.                  |
| Steam Link works, Moonlight doesn't        | Sunshine firewall rule missing                | Re-run Sunshine installer as admin; it re-adds firewall rules.                                                                      |
| Cursor stuck / can't move on Mac client    | Local Network permission not granted          | System Settings → Privacy & Security → Local Network → enable Moonlight. Restart the app.                                           |
| Deck OLED HDR streaming washed out         | Host not in HDR mode                          | Windows → Settings → Display → enable HDR on the streamed display. Sunshine then forwards the HDR signal.                           |

## Related

- Sunshine docs: <https://docs.lizardbyte.dev/projects/sunshine/latest/>
- Moonlight wiki: <https://github.com/moonlight-stream/moonlight-docs/wiki>
- Steam Remote Play FAQ: <https://help.steampowered.com/en/faqs/view/0689-74B8-92AC-10F2>
