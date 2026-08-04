#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install GitHub Copilot CLI - https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli
#
# Uses npm_install_global (not the curl|bash native installer at gh.io/copilot-install)
# so that on WSL we get a side-by-side install on both the Linux side and the
# Windows host — `npm_install_global` auto-mirrors via `cmd.exe /c npm install -g`.
# A curl|bash install would only land on the current OS, forcing a separate winget
# step for the Windows side. Trade-off: lose the native installer's winget routing;
# refresh comes from `bash run.sh --force-refresh --files=copilot` instead.
echo '> Installing GitHub Copilot CLI'
npm_install_global @github/copilot copilot

# Self-update on top of the npm install. `npm_install_global` no-ops when the binary
# already exists (unless --force-refresh), so a normal run would never pick up point
# releases. `copilot update` pulls the latest stable build in-place and is a cheap
# no-op when already current ("You are running the latest version.").
#
# Trade-off: this can leave the on-disk binary newer than what npm's metadata records
# for @github/copilot. Harmless — the next `--force-refresh` npm install overwrites it.
#
# Skipped in CI: the runner installs fresh every build, and Copilot disables its own
# auto-update under CI anyway. `< /dev/null` keeps it from consuming the bundling
# heredoc's stdin; the if/else swallows the exit code so a network or registry hiccup
# can't fail the surrounding bundled install script.
if ! ((IS_CI)) && has_persistent_binary copilot > /dev/null; then
  echo -n '>> copilot >> Updating to latest stable >> '
  if copilot update < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
    echo 'Success'
  else
    echo 'Error (non-fatal)'
  fi
fi
