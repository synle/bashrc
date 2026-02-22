async function doWork() {
  let targetPath = path.join(BASE_HOMEDIR_LINUX, '.config/terminator');
  await mkdir(targetPath);

  targetPath = path.join(targetPath, 'config');
  console.log('  >> Download Terminator Config - ChromeOS ', targetPath);

  const content = await fetchUrlAsString('software/scripts/terminator.config');

  writeToBuildFile([
    {
      file: 'terminator-config',
      data: `
# ~/.config/terminator/config

${content}
  `.trim(),
    },
  ]);

  if (is_os_window || is_os_darwin_mac || is_os_arch_linux) {
    console.log('    >> Skipped');
    return;
  }

  writeText(targetPath, content);
}
