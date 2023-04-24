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

  // write to main gitconfig
  writeText(
    configMain,
    await _getGitConfig({
      email,
      extraCoreConfigs: 'pager=diff-so-fancy | less --tabs=2 -RFX',
      addDefaultCommitTemplate: true,
    }),
  );

  // Windows Only - write to the main gitconfig for windows host
  if (is_os_window) {
    const configWindows = path.join(getWindowUserBaseDir(), '.gitconfig');

    console.log('    >> Installing git Aliases and Configs for Windows', configWindows);
    writeText(configWindows, await _getGitConfig({ email }));
  }
}

async function _getGitConfig({ email, extraCoreConfigs, addDefaultCommitTemplate }) {
  email = email || '';
  extraCoreConfigs = extraCoreConfigs || '';

  let templateGitConfig = '';

  templateGitConfig += (await fetchUrlAsString('software/scripts/git.config'))
    .replace('###EMAIL', email)
    .replace('###EXTRA_CORE_CONFIGS', extraCoreConfigs)
    .trim();

  if (addDefaultCommitTemplate === true) {
    const GIT_DEFAULT_MESSAGE_PATH = `${BASE_HOMEDIR_LINUX}/.gitmessage`;

    templateGitConfig += `
[commit]
  template = ${GIT_DEFAULT_MESSAGE_PATH}
    `;

    touchFile(GIT_DEFAULT_MESSAGE_PATH);
  }

  return templateGitConfig.trim();
}

function _extractEmail(config) {
  try {
    return config.match(/email[ ]*=[ ]*[a-z @.]+/)[0].trim();
  } catch (err) {
    return '';
  }
}
