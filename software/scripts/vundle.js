async function doWork() {
  const targetPath = "~/.vim/bundle/Vundle.vim";
  console.log("  >> Installing Vundle Plugins", targetPath);
  console.log("    >> Installing Vundle Binary");

  await execBashSilent(`
    rm -rf ${targetPath};
    git clone https://github.com/VundleVim/Vundle.vim.git ${targetPath};
  `);

  console.log("      >> Installing Vundle Plugins");
  await execBashSilent(`vim +PluginInstall +qall &>/dev/null;`);
}
