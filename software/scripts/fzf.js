/** Clones, installs, and registers fzf (fuzzy finder) with bashrc and bookmark aliases. */
async function doWork() {
  log(">> Setting up fzf and fzf-tab-completion");

  // fzf binary: installed via git clone + install script to get the latest version on all
  // platforms. Package managers (apt, dnf, pacman) lag behind and miss newer flags like
  // --info-command. The install script downloads the binary only (no shell config changes).
  // Custom keybindings are handled in _init.js and fzf-tab-completion handles Tab completion.
  const fzfPath = path.join(BASE_HOMEDIR_LINUX, ".fzf");

  if (isForceRefreshStale(fzfPath)) {
    await deleteFolder(fzfPath);
  }

  if (!fs.existsSync(fzfPath)) {
    log(">> Download and installing fzf:", fzfPath);
    await gitClone("https://github.com/junegunn/fzf.git", fzfPath);
    await execBash(`${fzfPath}/install --no-key-bindings --no-completion --no-update-rc &>/dev/null`);
  }

  const fzfTabCompletionPath = path.join(BASE_HOMEDIR_LINUX, ".fzf-tab-completion");
  if (isForceRefreshStale(fzfTabCompletionPath)) {
    await deleteFolder(fzfTabCompletionPath);
  }

  if (!fs.existsSync(fzfTabCompletionPath)) {
    log(">> Download and installing fzf-tab-completion:", fzfTabCompletionPath);
    gitClone("https://github.com/lincheney/fzf-tab-completion.git", fzfTabCompletionPath);
  }
}
