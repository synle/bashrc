async function doWork() {
  console.log('  >> Installing Windows Only - Iterm Dracula Theme');

  if (!is_os_darwin_mac) {
    console.log('    >> Skipped - mac only');
    process.exit();
  }

  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'mac');

  console.log('    >> Iterm Dracula Theme Path', targetPath);

  await downloadFile(
    'https://raw.githubusercontent.com/synle/ubuntu-setup/master/themes/mac/iterm.Dracula.itermcolors',
    path.join(targetPath, 'iterm.Dracula.itermcolors'),
  );

  console.log('    >> Iterm Keymap', targetPath);
  writeText(
    path.join(targetPath, 'iterm.itermkeymap'),
    `
    {
      "Key Mappings": {
        "0xf703-0x300000-0x7c": {
          "Label": "",
          "Action": 19,
          "Text": ""
        },
        "0xf701-0x300000-0x7d": {
          "Label": "",
          "Action": 21,
          "Text": ""
        },
        "0xf700-0x300000-0x7e": {
          "Label": "",
          "Action": 20,
          "Text": ""
        },
        "0xf702-0x300000-0x7b": {
          "Label": "",
          "Action": 18,
          "Text": ""
        }
      },
      "Touch Bar Items": {}
    }
  `.trim(),
  );
}
