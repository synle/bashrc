async function doWork() {
  console.log('  >> Installing Windows Only - Iterm Dracula Theme');

  if (!is_os_darwin_mac) {
    console.log('    >> Skipped - mac only');
    return process.exit();
  }

  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'mac');

  console.log('    >> Iterm Dracula Theme Path', consoleLogColor4(targetPath));

  writeText(
    path.join(targetPath, 'iterm.Dracula.itermcolors'),
    `
<?xml version="1.0" encoding="UTF-8"?>

<!-- Dracula Theme v1.2.5
#
# https://github.com/dracula/iterm
#
# Copyright 2013-present, All rights reserved
#
# Code licensed under the MIT license
#
# @author Zeno Rocha <hi@zenorocha.com>
-->

<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Ansi 0 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.0</real>
    <key>Green Component</key>
    <real>0.0</real>
    <key>Red Component</key>
    <real>0.0</real>
  </dict>
  <key>Ansi 1 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.3333333432674408</real>
    <key>Green Component</key>
    <real>0.3333333432674408</real>
    <key>Red Component</key>
    <real>1</real>
  </dict>
  <key>Ansi 10 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.4823529411764706</real>
    <key>Green Component</key>
    <real>0.98039215686274506</real>
    <key>Red Component</key>
    <real>0.31372549019607843</real>
  </dict>
  <key>Ansi 11 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.5490196078431373</real>
    <key>Green Component</key>
    <real>0.98039215686274506</real>
    <key>Red Component</key>
    <real>0.94509803921568625</real>
  </dict>
  <key>Ansi 12 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.97647058823529409</real>
    <key>Green Component</key>
    <real>0.57647058823529407</real>
    <key>Red Component</key>
    <real>0.74117647058823533</real>
  </dict>
  <key>Ansi 13 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.77647058823529413</real>
    <key>Green Component</key>
    <real>0.47450980392156861</real>
    <key>Red Component</key>
    <real>1</real>
  </dict>
  <key>Ansi 14 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.99215686274509807</real>
    <key>Green Component</key>
    <real>0.9137254901960784</real>
    <key>Red Component</key>
    <real>0.54509803921568623</real>
  </dict>
  <key>Ansi 15 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>1</real>
    <key>Green Component</key>
    <real>1</real>
    <key>Red Component</key>
    <real>1</real>
  </dict>
  <key>Ansi 2 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.4823529411764706</real>
    <key>Green Component</key>
    <real>0.98039215686274506</real>
    <key>Red Component</key>
    <real>0.31372549019607843</real>
  </dict>
  <key>Ansi 3 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.5490196078431373</real>
    <key>Green Component</key>
    <real>0.98039215686274506</real>
    <key>Red Component</key>
    <real>0.94509803921568625</real>
  </dict>
  <key>Ansi 4 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.97647058823529409</real>
    <key>Green Component</key>
    <real>0.57647058823529407</real>
    <key>Red Component</key>
    <real>0.74117647058823533</real>
  </dict>
  <key>Ansi 5 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.77647058823529413</real>
    <key>Green Component</key>
    <real>0.47450980392156861</real>
    <key>Red Component</key>
    <real>1</real>
  </dict>
  <key>Ansi 6 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.99215686274509807</real>
    <key>Green Component</key>
    <real>0.9137254901960784</real>
    <key>Red Component</key>
    <real>0.54509803921568623</real>
  </dict>
  <key>Ansi 7 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.73333334922790527</real>
    <key>Green Component</key>
    <real>0.73333334922790527</real>
    <key>Red Component</key>
    <real>0.73333334922790527</real>
  </dict>
  <key>Ansi 8 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.33333333333333331</real>
    <key>Green Component</key>
    <real>0.33333333333333331</real>
    <key>Red Component</key>
    <real>0.33333333333333331</real>
  </dict>
  <key>Ansi 9 Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.33333333333333331</real>
    <key>Green Component</key>
    <real>0.33333333333333331</real>
    <key>Red Component</key>
    <real>1</real>
  </dict>
  <key>Background Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.15977837145328522</real>
    <key>Green Component</key>
    <real>0.12215272337198257</real>
    <key>Red Component</key>
    <real>0.11765811592340469</real>
  </dict>
  <key>Bold Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.90237069129943848</real>
    <key>Green Component</key>
    <real>0.90237069129943848</real>
    <key>Red Component</key>
    <real>0.90237069129943848</real>
  </dict>
  <key>Cursor Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.73333334922790527</real>
    <key>Green Component</key>
    <real>0.73333334922790527</real>
    <key>Red Component</key>
    <real>0.73333334922790527</real>
  </dict>
  <key>Cursor Text Color</key>
  <dict>
    <key>Blue Component</key>
    <real>1</real>
    <key>Green Component</key>
    <real>1</real>
    <key>Red Component</key>
    <real>1</real>
  </dict>
  <key>Foreground Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.90032327175140381</real>
    <key>Green Component</key>
    <real>0.90032327175140381</real>
    <key>Red Component</key>
    <real>0.90032327175140381</real>
  </dict>
  <key>Selected Text Color</key>
  <dict>
    <key>Blue Component</key>
    <real>1</real>
    <key>Green Component</key>
    <real>1</real>
    <key>Red Component</key>
    <real>1</real>
  </dict>
  <key>Selection Color</key>
  <dict>
    <key>Blue Component</key>
    <real>0.35294118523597717</real>
    <key>Green Component</key>
    <real>0.27843138575553894</real>
    <key>Red Component</key>
    <real>0.26666668057441711</real>
  </dict>
</dict>
</plist>
  `.trim(),


  console.log('    >> Iterm Keymap', consoleLogColor4(targetPath));
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
