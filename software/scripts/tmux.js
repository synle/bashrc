/** * Writes the tmux configuration file with split, navigation, and mouse settings. */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".tmux.conf");

  log(">> Updating .tmux.conf", targetPath);

  const content = await fetchUrlAsString("software/scripts/tmux.config");
  writeText(targetPath, content);
}
