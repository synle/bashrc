/**
 * Generates numbered git alias snippets for interactive rebase and patch operations.
 * @returns {string} Git config alias entries for r{N}, r{N}-vscode, patch-get{N}, patch-view{N}, and patch-download{N}.
 */
function _getNumberedAliasSnippet() {
  const items = [];
  for (let i = 1; i <= 10; i += 1) items.push(i);
  for (let i = 10; i <= 100; i += 5) items.push(i);
  for (let i = 150; i <= 1000; i += 50) items.push(i);
  return [...new Set(items)]
    .map((n) =>
      trimLeftSpaces(`
          r${n} = "!git rn ${n}"
          r${n}-vscode = "!git rn-code ${n}"
          patch-get${n} = "!git patch-getn ${n}"
          patch-view${n} = "!git patch-viewn ${n}"
          patch-download${n} = "!git patch-downloadn ${n}"
        `),
    )
    .join("\n");
}

/**
 * Builds the full git config content from a template, injecting email, core configs, and numbered aliases.
 * @param {object} options - Configuration options.
 * @param {string} options.email - The git user email to inject.
 * @param {string} [options.extraCoreConfigs] - Additional git core config entries.
 * @param {boolean} [options.addDefaultCommitTemplate] - Whether to add a default commit template.
 * @returns {Promise<string>} The rendered git config content.
 */
async function _getGitConfig({ email, extraCoreConfigs, addDefaultCommitTemplate }) {
  email = email || "";
  extraCoreConfigs = extraCoreConfigs || "";

  let templateGitConfig = await fetchUrlAsString("software/scripts/git.gitconfig");

  try {
    templateGitConfig = appendTextBlock(templateGitConfig, "GIT_USER_EMAIL", email);
    templateGitConfig = appendTextBlock(templateGitConfig, "GIT_EXTRA_CORE_CONFIGS", extraCoreConfigs);
    templateGitConfig = appendTextBlock(templateGitConfig, "GIT_NUMBERED_ALIASES", _getNumberedAliasSnippet());
    templateGitConfig = templateGitConfig.trim();

    if (addDefaultCommitTemplate === true) {
      const GIT_DEFAULT_MESSAGE_PATH = `${BASE_HOMEDIR_LINUX}/.gitmessage`;

      templateGitConfig += `
[commit]
  template = ${GIT_DEFAULT_MESSAGE_PATH}
    `;

      touchFile(GIT_DEFAULT_MESSAGE_PATH);
    }
  } catch (err) {
    log("Failed to get git config template", err);
  }

  return templateGitConfig.trim();
}

/**
 * Extracts the email address from an existing git config string.
 * @param {string} config - Raw git config file content.
 * @returns {string} The extracted email line, or empty string if not found.
 */
function _extractEmail(config) {
  try {
    return config.match(/email\s*=\s*.*/i)[0].trim();
  } catch (err) {
    return "";
  }
}

/**
 * Returns the content for the global gitignore file with common OS and editor exclusions.
 * @returns {string} The global gitignore content.
 */
function _getGlobalGitIgnore() {
  return trimLeftSpaces(`
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
  `).trim();
}

/**
 * Installs git aliases, configs, and global gitignore for the current system and optionally for Windows.
 */
async function doWork() {
  log(">> Installing git Aliases and Configs");

  const configMain = path.join(BASE_HOMEDIR_LINUX, ".gitconfig");
  const configGitIgnoreGlobal = path.join(BASE_HOMEDIR_LINUX, ".gitignore_global");

  // figure out the name
  const oldConfig = readText(configMain);
  const email = _extractEmail(oldConfig);

  log(`>>> Installing git Aliases and Configs for Main OS`, email, configMain);

  // write to build file
  writeToBuildFile([
    { file: "gitignore_global", data: await _getGlobalGitIgnore() },
    {
      file: "gitconfig",
      data: await _getGitConfig({
        email: "; email = test_email@gmail.com #update this email",
      }),
      commentStyle: "bash",
    },
  ]);

  // write to main gitconfig
  writeText(
    configMain,
    await _getGitConfig({
      email,
      extraCoreConfigs: trimLeftSpaces(`
        pager = delta

        [delta]
        navigate = true
        side-by-side = true
        line-numbers = true
        syntax-theme = Dracula
      `),
      addDefaultCommitTemplate: true,
    }),
  );

  // write to global git ignore
  writeText(configGitIgnoreGlobal, await _getGlobalGitIgnore());

  // Windows Only - write to the main gitconfig for windows host
  if (is_os_windows) {
    const configWindows = path.join(getWindowUserBaseDir(), ".gitconfig");

    log(">>> Installing git Aliases and Configs for Windows", configWindows);
    writeText(configWindows, await _getGitConfig({ email }));
  }
}
