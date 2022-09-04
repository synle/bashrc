async function doWork() {
  console.log('  >> Download and installing custom windows registry:');

  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'windows', 'registries.reg');
  console.log('    >> Registries: ', consoleLogColor4(targetPath));
  writeText(
    targetPath,
    `
Windows Registry Editor Version 5.00
; Disable internet search in start menu in windows 11
[HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Explorer]
"DisableSearchBoxSuggestions"=dword:00000001
    `
      .trim()
      .replace(/\//g, '\\'),
  );
}
