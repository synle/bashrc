async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.config/terminator');

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1('    >> Skipped : Target path not found'));
    process.exit();
  }

  // setting up the config
  const terminatorConfigPath = path.join(targetPath, 'config');
  console.log('    >> Updating Terminator', terminatorConfigPath);

  // write if there are change
  writeText(
    terminatorConfigPath,
    `
[global_config]
window_state = maximise
handle_size = 0
title_hide_sizetext = True
title_transmit_fg_color = "#bd93f9"
title_inactive_fg_color = "#f8f8f2"
title_receive_bg_color = "#282a36"
title_transmit_bg_color = "#282a36"
title_receive_fg_color = "#8be9fd"
tab_position = hidden
title_inactive_bg_color = "#282a36"
[keybindings]
[profiles]
[[default]]
scrollbar_position = hidden
palette = "#000000:#ff5555:#50fa7b:#f1fa8c:#bd93f9:#ff79c6:#8be9fd:#bbbbbb:#555555:#ff5555:#50fa7b:#f1fa8c:#bd93f9:#ff79c6:#8be9fd:#ffffff"
background_image = None
cursor_shape = underline
cursor_color = "#bbbbbb"
foreground_color = "#f8f8f2"
update_records = False
login_shell = True
copy_on_selection = True
background_color = "#1e1f29"
cursor_blink = False
show_titlebar = False
antialias = False
[layouts]
[[default]]
[[[child1]]]
type = Terminal
parent = window0
profile = default
command = ""
[[[window0]]]
type = Window
parent = ""
[plugins]
    `.trim(),
  );
}
