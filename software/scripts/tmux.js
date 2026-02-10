async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.tmux.conf');

  console.log('  >> Updating .tmux.conf', consoleLogColor4(targetPath));

  writeText(
    targetPath,
    `
  ## tmux set pane border title
  ## tmux set -g pane-border-status top

  ## not show status bar
  set -g status off

  ## scroll history
  set -g history-limit 30000

  ##  Window options
  set -g monitor-activity off

  ## mouse support
  set -g mouse on

  ## Saner splitting:
  ## https://unix.stackexchange.com/questions/126976/tmux-config-not-retaining-pwd-on-new-window-or-window-split
  bind v split-window -c "#{pane_current_path}" -h
  bind s split-window -c "#{pane_current_path}" -v

  ## Autorename sanely.
  setw -g automatic-rename on

  ## Better name management
  bind c new-window -c "#{pane_current_path}"

  ## https://www.hamvocke.com/blog/a-guide-to-customizing-your-tmux-conf/
  ## switch panes using Alt-arrow without prefix
  bind -n M-Left select-pane -L
  bind -n M-Right select-pane -R
  bind -n M-Up select-pane -U
  bind -n M-Down select-pane -D

  # prefix + d to split
  bind d split-window -h
  # TODO: cannot bind to ' - needs to figure this out
  bind 5 split-window

  # alt d to split
  bind -n M-d split-window -h
      `.trim(),
  );
}
