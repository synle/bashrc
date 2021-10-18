async function doWork() {
  console.log('  >> Download and installing custom windows registry:');

  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'windows', 'registries.reg');
  console.log('    >> Registries: ', consoleLogColor4(targetPath));
  writeText(
    targetPath,
    `
Windows Registry Editor Version 5.00

; =====================================================================================================================
; BEGIN
; =====================================================================================================================




; >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
; speed up startup delay
;
; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  [HKEY_CURRENT_USER/Software/Microsoft/Windows/CurrentVersion/Explorer/Serialize]
    "StartupDelayInMSec"=dword:00000000


; >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
; no lock screen
;
; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  [HKEY_LOCAL_MACHINE/SOFTWARE/Policies/Microsoft/Windows/Personalization]
  "NoLockScreen"=dword:00000001


; >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
; Disable shaking to min and max windows
;
; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  [HKEY_LOCAL_MACHINE/SOFTWARE/Policies/Microsoft/Windows/Personalization]
  "DisallowShaking"=dword:00000001


; >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
; Use classic menu bar for Windows 11
;
; Source: https://www.howtogeek.com/492003/how-to-disable-the-first-sign-in-animation-on-windows-10/#:~:text=Right%2Dclick%20the%20%E2%80%9CWinlogon%E2%80%9D,now%20close%20the%20registry%20editor.
; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  [HKEY_CURRENT_USER/Software/Classes/CLSID/{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}/InprocServer32]
  @=""


; >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
; Disable windows login
;
; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  [HKEY_LOCAL_MACHINE/SOFTWARE/Microsoft/Windows NT/CurrentVersion/Winlogon]
  "EnableFirstLogonAnimation"=dword:00000000


; >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
; Disable visual effects
; https://superuser.com/questions/1244934/reg-file-to-modify-windows-10-visual-effects
;
; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  ; Required: This is a must - set appearance options to "custom"
  [HKEY_CURRENT_USER/Software/Microsoft/Windows/CurrentVersion/Explorer/VisualEffects]
  "VisualFXSetting"=dword:3

  [HKEY_CURRENT_USER/Software/Microsoft/Windows/CurrentVersion/Explorer/Advanced]
  ; Show thumbnails instead of icons
  "IconsOnly"=dword:1
  ; Show translucent selection rectangle
  "ListviewAlphaSelect"=dword:0
  ; Use drop shadows for icon labels on the desktop
  "ListviewShadow"=dword:0
  ; Animations in the taskbar
  "TaskbarAnimations"=dword:0

  ; Animate windows when minimizing and maximizing
  [HKEY_CURRENT_USER/Control Panel/Desktop/WindowMetrics]
  "MinAnimate"="0"

  ; Enable Peek
  [HKEY_CURRENT_USER/Software/Microsoft/Windows/DWM]
  "EnableAeroPeek"=dword:0

  [HKEY_CURRENT_USER/Control Panel/Desktop]
  ; speed up menu show delay
  "MenuShowDelay"="200"
  ; Show window contents while dragging
  "DragFullWindows"="0"


; >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
; Windows Update in the Context Menu
; https://www.maketecheasier.com/add-check-for-updates-option-context-menu/
;
; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  [HKEY_CLASSES_ROOT/DesktopBackground/Shell/Windows Update]
  "SettingsURI"="ms-settings:windowsupdate-action"
  "Icon"="%SystemRoot%/System32/shell32.dll,-47"

  [HKEY_CLASSES_ROOT/DesktopBackground/Shell/Windows Update/command]
  "DelegateExecute"="{556FF0D6-A1EE-49E5-9FA4-90AE116AD744}"






; =====================================================================================================================
; END
; =====================================================================================================================
    `
    .split('\n')
    .map(s => {
      s = s.trim();

      if(s[0] === '[' && s[s.length - 1] === ']'){
        s = s.replace(/\//g, '\\')
      }

      return s;
    })
    .join('\n').trim(),
  );
}
