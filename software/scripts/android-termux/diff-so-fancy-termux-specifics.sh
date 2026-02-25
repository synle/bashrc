#!/usr/bin/env bash
DIFF_SO_FANCY_PATH="/data/data/com.termux/files/usr/bin/diff-so-fancy"
curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/binaries/diff-so-fancy" > "$DIFF_SO_FANCY_PATH"
chmod +x $DIFF_SO_FANCY_PATH
