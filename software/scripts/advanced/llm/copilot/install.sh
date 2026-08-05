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
    # Most common failure is a broken install ("GitHub Copilot CLI: no platform package
    # found") — npm skipped the platform-specific optional dependency, so the launcher has
    # no binary to update and stays broken until someone notices.
    #
    # Options considered:
    #   1. Delete the launcher, then reinstall via npm   <-- CHOSEN
    #      Exactly what the error message instructs, and self-heals without user action.
    #      The delete is required: npm_install_global's freshness gate would otherwise skip
    #      the reinstall, since the (broken) binary is still recent on disk.
    #   2. Keep the original `echo 'Error (non-fatal)'`. Rejected: it reported a permanently
    #      broken CLI as a transient blip, and every later run repeated the same message.
    #   3. Call the private _npm_install_global with always_latest=false. Rejected: it hits
    #      the same freshness gate, so it would no-op without the delete anyway.
    echo 'Error — reinstalling from npm'
    rm -rf "$HOME/.local/bin/copilot" "$HOME/.local/share/copilot"
    npm_install_global @github/copilot copilot
  fi
fi
