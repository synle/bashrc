/** * Gate check that exits early if the current OS is not macOS. */
async function doWork() {
  const onlyMacProfile = readText('software/scripts/mac/_only-mac-profile').trim();
  console.log('    >> Only Mac profile loaded:', onlyMacProfile.split('\n').length, 'lines');

  // register platform tweaks for mac
  registerPlatformTweaks('Only Mac', '.bash_syle_only_mac', onlyMacProfile);

  // write to build file
  const comments = 'This is a bash only meant for mac';
  writeToBuildFile([{ file: 'only-mac-profile', data: onlyMacProfile, comments, commentStyle: 'bash' }]);
}
