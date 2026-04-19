/** Removes the legacy synle-make-component tool and its artifacts. TODO: remove this script once rollout is complete. */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, `.${CURRENT_USER}_make_component`);

  log(">> Removing legacy synle-make-component:", targetPath);

  await deleteFolder(targetPath);

  registerWithBashSyleProfile("Sy Make Component", `: # no-op`);
}
