async function doWork() {
  console.log('  >> Installing git Aliases and Configs');

  const configMain = path.join(BASE_HOMEDIR_LINUX, '.gitconfig');

  // figure out the name
  const oldConfig = readText(configMain);
  const email = _extractEmail(oldConfig);

  console.log('    >> Installing git Aliases and Configs for Main OS', configMain);

  // write to build file
  writeToBuildFile([
    [
      'gitconfig',
      await _getGitConfig({
        email: '; email = test_email@gmail.com',
      }),
      false,
    ],
  ]);

  writeText(
    configMain,
    await _getGitConfig({
      email,
      extraCoreConfigs: 'pager=diff-so-fancy | less --tabs=2 -RFX',
    }),
  );

  if (is_os_window) {
    const configWindows = path.join(getWindowUserBaseDir(), '.gitconfig');

    console.log('    >> Installing git Aliases and Configs for Windows', configWindows);
    writeText(configWindows, await _getGitConfig({ email }));
  }
}

async function _getGitConfig({ email, extraCoreConfigs }) {
  email = email || '';
  extraCoreConfigs = extraCoreConfigs || '';

  let templateGitConfig = '';

  templateGitConfig += (await readText('./software/scripts/git.config'))
    .replace('###EMAIL', email)
    .replace('###EXTRA_CORE_CONFIGS', extraCoreConfigs);

  return templateGitConfig.trim();
}

function _extractEmail(config) {
  try {
    return config.match(/email[ ]*=[ ]*[a-z @.]+/)[0].trim();
  } catch (err) {
    return '';
  }
}
