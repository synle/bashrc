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


# settings to speed up
# https://gist.github.com/kidpixo/78b9a40ab58e026cf9a432573e27ced5
#1. Disable animations when opening and closing windows.
defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false
#2. Disable animations when opening a Quick Look window.
defaults write -g QLPanelAnimationDuration -float 0
#3. Accelerated playback when adjusting the window size (Cocoa applications).
defaults write NSGlobalDomain NSWindowResizeTime -float 0.001
#4. Disable animation when opening the Info window in Finder (cmd⌘ + i).
defaults write com.apple.finder DisableAllAnimations -bool true
#5. Disable animations when you open an application from the Dock.
defaults write com.apple.dock launchanim -bool false
#6. Make all animations faster that are used by Mission Control.
defaults write com.apple.dock expose-animation-duration -float 0.1
#7. Disable the delay when you hide the Dock
defaults write com.apple.Dock autohide-delay -float 0
#Mail applicatie
#8. Disable the animation when you sending and replying an e-mail
defaults write com.apple.mail DisableReplyAnimations -bool true
defaults write com.apple.mail DisableSendAnimations -bool true
#9. Disable the standard delay in rendering a Web page.
defaults write com.apple.Safari WebKitInitialTimedLayoutDelay 0.25


# Add Visual Studio Code (code)
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"

# Mac only alias
alias find='fd'
    `.trim(),
  );
}
