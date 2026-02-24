/// <reference path="../base-node-script.js" />

function _getRebaseInteractiveSnippet() {
  const items = [];
  for (let i = 5; i <= 100; i += 5) items.push(i);
  for (let i = 150; i <= 1000; i += 50) items.push(i);
  return items.map((n) => `r${n} = rebase -i HEAD~${n}\nr${n}-vscode = !GIT_EDITOR=\\"code --wait\\" git r${n}`).join('\n');
}

async function _getGitConfig({ email, extraCoreConfigs, addDefaultCommitTemplate }) {
  email = email || '';
  extraCoreConfigs = extraCoreConfigs || '';

  let templateGitConfig = await fetchUrlAsString('software/scripts/git.gitconfig');

  try {
    templateGitConfig = templateGitConfig
      .replace('###SNIPPET_GIT_USER_EMAIL###', email)
      .replace('###SNIPPET_GIT_EXTRA_CORE_CONFIGS###', extraCoreConfigs)
      .replace('###SNIPPET_GIT_REBASE_INTERACTIVE###', _getRebaseInteractiveSnippet())
      .trim();

    if (addDefaultCommitTemplate === true) {
      const GIT_DEFAULT_MESSAGE_PATH = `${BASE_HOMEDIR_LINUX}/.gitmessage`;

      templateGitConfig += `
[commit]
  template = ${GIT_DEFAULT_MESSAGE_PATH}
    `;

      touchFile(GIT_DEFAULT_MESSAGE_PATH);
    }
  } catch (err) {
    console.log('Failed to get git config template', err);
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

async function _getGlobalGitIgnore() {
  return `
      # OS files
      .DS_Store
      *.Identifier

      # Editors & Backups
      *.swp
      *.swo
      *.rej

      # Environments & Dependencies
      venv/
      node_modules/
    `
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s)
    .join('\n');
}

async function doWork() {
  console.log('  >> Installing git Aliases and Configs');

  const configMain = path.join(BASE_HOMEDIR_LINUX, '.gitconfig');
  const configGitIgnoreGlobal = path.join(BASE_HOMEDIR_LINUX, '.gitignore_global');

  // figure out the name
  const oldConfig = readText(configMain);
  const email = _extractEmail(oldConfig);

  console.log(`    >> Installing git Aliases and Configs for Main OS: email=${email}`, configMain);

  // write to build file
  writeToBuildFile([
    { file: 'gitignore_global', data: await _getGlobalGitIgnore() },
    {
      file: 'gitconfig',
      data: await _getGitConfig({
        email: '; email = test_email@gmail.com #update this email',
      }),
      commentStyle: 'bash',
    },
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

  // write to global git ignore
  writeText(configGitIgnoreGlobal, await _getGlobalGitIgnore());

  // Windows Only - write to the main gitconfig for windows host
  if (is_os_window) {
    const configWindows = path.join(getWindowUserBaseDir(), '.gitconfig');

    console.log('    >> Installing git Aliases and Configs for Windows', configWindows);
    writeText(configWindows, await _getGitConfig({ email }));
  }
}
