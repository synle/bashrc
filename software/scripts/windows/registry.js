async function doWork() {
  console.log('  >> Download and installing custom windows registry:');

  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'windows', 'registries.reg');
  console.log('    >> Registries: ', consoleLogColor4(targetPath));
  writeText(
    targetPath,
    `
Windows Registry Editor Version 5.00
; no lock screen
[HKEY_LOCAL_MACHINE/SOFTWARE/Policies/Microsoft/Windows/Personalization]
"NoLockScreen"=dword:00000001

; speed up menu show delay
[HKEY_CURRENT_USER/Control Panel/Desktop]
"MenuShowDelay"="250"

; Disable shaking to min and max windows
[HKEY_LOCAL_MACHINE/SOFTWARE/Policies/Microsoft/Windows/Personalization]
"DisallowShaking"=dword:00000001

; Use classic menu bar for Windows 11
[HKEY_CURRENT_USER/Software/Classes/CLSID/{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}/InprocServer32]
@=""

; Disable internet search in start menu
[HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Explorer]
"DisableSearchBoxSuggestions"=dword:00000001
    `
      .trim()
      .replace(/\//g, '\\'),
  );
}
