async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.bash_syle_only_mac');

  console.log('  >> Register Mac Only profile', BASE_BASH_SYLE);
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    'Only Mac - PLATFORM SPECIFIC TWEAKS', // key
    `. ${targetPath}`,
  );
  writeText(BASE_BASH_SYLE, textContent);

  console.log('  >> Installing Mac OSX Only tweaks: ', consoleLogColor4(targetPath));
  writeText(
    targetPath,
    `
# suppress bash legacy warning in Catalina
export BASH_SILENCE_DEPRECATION_WARNING=1

# Add Visual Studio Code (code)
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"

# Mac only alias
alias find2='fd'
alias brave="open /Applications/Brave\ Browser.app/ --args --disable-smooth-scrolling"
alias chrome="open /Applications/Google\ Chrome.app --args --disable-smooth-scrolling"
    `.trim(),
  );
}
