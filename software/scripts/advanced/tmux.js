/** Installs tmux plugin manager (tpm) and writes tmux configuration. */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".tmux.conf");
  const tpmPath = path.join(BASE_HOMEDIR_LINUX, ".tmux", "plugins", "tpm");

  // install tpm (tmux plugin manager)
  if (isForceRefreshStale(tpmPath)) {
    await deleteFolder(tpmPath);
  }

  if (!fs.existsSync(tpmPath)) {
    log(">> Installing tmux plugin manager (tpm)", tpmPath);
    gitClone("https://github.com/tmux-plugins/tpm.git", tpmPath);
  } else {
    log(">> tpm already installed", tpmPath);
  }

  // write tmux config
  log(">> Updating .tmux.conf", targetPath);
  const content = await readText`software/scripts/advanced/tmux.config`;
  await writeText(targetPath, content);
}
