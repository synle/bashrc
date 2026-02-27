/** * Outputs shell commands to create symlinks for node, npm, npx, and yarn in /usr/local/bin. */
async function doWork() {
  console.log(echo(`    >> Symlink for fnm and node executables in /usr/local/bin ${FNM_DEFAULT_NODE_PATH}`));
  console.log(`
    sudo rm -rf "/usr/local/bin/node" "/usr/local/bin/npm" "/usr/local/bin/yarn" "/usr/local/bin/npx"
    echo "      >> /usr/local/bin/node"
    sudo ln -s "${FNM_DEFAULT_NODE_PATH}/bin/node" "/usr/local/bin/node" &>/dev/null
    echo "      >> /usr/local/bin/npm"
    sudo ln -s "${FNM_DEFAULT_NODE_PATH}/bin/npm" "/usr/local/bin/npm" &>/dev/null
    echo "      >> /usr/local/bin/npx"
    sudo ln -s "${FNM_DEFAULT_NODE_PATH}/bin/npx" "/usr/local/bin/npx" &>/dev/null
    echo "      >> /usr/local/bin/yarn"
    sudo ln -s "${FNM_DEFAULT_NODE_PATH}/bin/yarn" "/usr/local/bin/yarn" &>/dev/null
  `);
}
