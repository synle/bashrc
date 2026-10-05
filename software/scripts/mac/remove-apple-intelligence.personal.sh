#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Disable Apple Intelligence (Siri, Writing Tools, Genmoji, summaries, models, ...) on macOS 27
# ("Golden Gate") only, via RemoveMacAI: https://github.com/omlahore/RemoveMacAI
# Interactive: the tool confirms first and macOS requires approving its configuration profile.
# Usage: bash run.sh --files="mac/remove-apple-intelligence.personal.sh"
# Undo:  curl -fsSL https://raw.githubusercontent.com/omlahore/RemoveMacAI/main/install.sh | bash -s revert

REMOVE_MAC_AI_URL="https://raw.githubusercontent.com/omlahore/RemoveMacAI/main/install.sh"
REMOVE_MAC_AI_TARGET_MAJOR="27"
REMOVE_MAC_AI_MARKER="$HOME/.config/removemacai/applied"

macos_major_version=$(sw_vers -productVersion 2> /dev/null | cut -d. -f1)

if [ "$macos_major_version" != "$REMOVE_MAC_AI_TARGET_MAJOR" ]; then
  echo ">> Skipped RemoveMacAI: macOS $macos_major_version is not macOS $REMOVE_MAC_AI_TARGET_MAJOR (Golden Gate)"
  exit 0
fi

if [ "$(get_native_arch)" != "arm64" ]; then
  echo ">> Skipped RemoveMacAI: Apple Intelligence only runs on Apple silicon"
  exit 0
fi

if ((IS_CI)); then
  echo ">> Skipped RemoveMacAI: requires interactive profile approval, not available in CI"
  exit 0
fi

if [ -f "$REMOVE_MAC_AI_MARKER" ] && ! is_force_refresh_stale "$REMOVE_MAC_AI_MARKER"; then
  echo ">> Skipped RemoveMacAI: already applied ($REMOVE_MAC_AI_MARKER)"
  exit 0
fi

echo ">> Disabling Apple Intelligence on macOS $REMOVE_MAC_AI_TARGET_MAJOR via RemoveMacAI"
if curl -fsSL "$REMOVE_MAC_AI_URL" | bash; then
  safe_mkdir "$(dirname "$REMOVE_MAC_AI_MARKER")"
  safe_touch "$REMOVE_MAC_AI_MARKER"
  echo ">> RemoveMacAI applied"
else
  echo ">> Warning: RemoveMacAI did not complete; re-run to retry"
fi
