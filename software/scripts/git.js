/// <reference path="../index.js" />

/**
 * Generates git rebase interactive alias snippets for various commit counts.
 * @returns {string} Git config alias entries for interactive rebase shortcuts.
 */
function _getRebaseInteractiveSnippet() {
  const items = [];
  for (let i = 2; i <= 10; i += 1) items.push(i);
  for (let i = 10; i <= 100; i += 5) items.push(i);
  for (let i = 150; i <= 1000; i += 50) items.push(i);
  return [...new Set(items)]
    .map((n) => `r${n} = rebase -i HEAD~${n}\nr${n}-vscode = !GIT_EDITOR=\\"code --wait\\" git r${n}`)
    .join("\n");
}

/**
 * Builds the full git config content from a template, injecting email, core configs, and rebase aliases.
 * @param {object} options - Configuration options.
 * @param {string} options.email - The git user email to inject.
 * @param {string} [options.extraCoreConfigs] - Additional git core config entries.
 * @param {boolean} [options.addDefaultCommitTemplate] - Whether to add a default commit template.
 * @returns {Promise<string>} The rendered git config content.
 */
async function _getGitConfig({ email, extraCoreConfigs, addDefaultCommitTemplate }) {
  email = (email || "");
  extraCoreConfigs = extraCoreConfigs || "";

  let templateGitConfig = await fetchUrlAsString("software/scripts/git.gitconfig");

  try {
    templateGitConfig = templateGitConfig
      .replace("###SNIPPET_GIT_USER_EMAIL###", email)
      .replace("###SNIPPET_GIT_EXTRA_CORE_CONFIGS###", extraCoreConfigs)
      .replace("###SNIPPET_GIT_REBASE_INTERACTIVE###", _getRebaseInteractiveSnippet())
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
    console.log("Failed to get git config template", err);
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
 * @returns {Promise<string>} The global gitignore content.
 */
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
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s)
    .join("\n");
}

/**
 * Installs git aliases, configs, and global gitignore for the current system and optionally for Windows.
 */
async function doWork() {
  console.log("  >> Installing git Aliases and Configs");

  const configMain = path.join(BASE_HOMEDIR_LINUX, ".gitconfig");
  const configGitIgnoreGlobal = path.join(BASE_HOMEDIR_LINUX, ".gitignore_global");

  // figure out the name
  const oldConfig = readText(configMain);
  const email = _extractEmail(oldConfig);

  console.log(`    >> Installing git Aliases and Configs for Main OS: email=${email}`, configMain);

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
      extraCoreConfigs: "pager=diff-so-fancy | less --tabs=2 -RFX",
      addDefaultCommitTemplate: true,
    }),
  );

  // write to global git ignore
  writeText(configGitIgnoreGlobal, await _getGlobalGitIgnore());

  // Windows Only - write to the main gitconfig for windows host
  if (is_os_window) {
    const configWindows = path.join(getWindowUserBaseDir(), ".gitconfig");

    console.log("    >> Installing git Aliases and Configs for Windows", configWindows);
    writeText(configWindows, await _getGitConfig({ email }));
  }
}
