#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Final wrapup - profile sourcing

echo '
# Source .bash_syle
[ -f ~/.bash_syle ] && . ~/.bash_syle
'

# Final cleanup - macOS Finder junk (.DS_Store, ._* AppleDouble sidecars) inside the
# config folders this repo writes to. Finder drops a .DS_Store into any folder it is
# pointed at, and these folders get opened by hand often enough (skills, commands,
# instructions) that the junk accumulates and shows up as noise in `ls` and in any
# folder-scanning deploy loop. clean_junk_macosx_files no-ops off mac and on a missing
# folder, so no is_os_mac guard is needed here.
for junk_folder in \
	"$HOME/.claude" \
	"$HOME/.copilot" \
	"$HOME/.gemini" \
	"$HOME/.config/opencode" \
	"$HOME/.agents" \
	"${LLM_ROOT_FOLDER}"; do
	clean_junk_macosx_files "$junk_folder"
done

# TODO: remove me - one-time migration of Sy-owned state into $SY_ROOT_FOLDER.
# Everything below moves the legacy home-folder locations into the personal root and
# is a one-shot deal, not a recurring source. Delete this whole block once every
# machine has run setup at least once.
if [ -n "${SY_ROOT_FOLDER:-}" ]; then
	safe_mkdir "$SY_ROOT_FOLDER"

	# 1. Bookmarks - ~/.syle_bookmark (and the older ~/.<user>_bookmark) into
	# $SY_ROOT_FOLDER/.syle_bookmark. Both are line lists, so the merge is a
	# concat + sort -u rather than a copy.
	new_bookmark="$SY_ROOT_FOLDER/.syle_bookmark"
	for old_bookmark in "$HOME/.syle_bookmark" "$HOME/.${USER}_bookmark"; do
		[ -f "$old_bookmark" ] || continue
		[ "$old_bookmark" = "$new_bookmark" ] && continue
		echo "Migrating bookmarks: $old_bookmark -> $new_bookmark"
		merged=$({
			command cat "$old_bookmark"
			command cat "$new_bookmark" 2>/dev/null
		} | sort -u)
		echo "$merged" >"$new_bookmark"
		command mv -f "$old_bookmark" "$old_bookmark.migrated"
	done

	# 2. Curl HAR cache - ~/.syle-curl_cache into $SY_ROOT_FOLDER/.curl_cache. Full
	# folder copy (per-day .har files), not a concat.
	old_curl_cache="$HOME/.syle-curl_cache"
	new_curl_cache="$SY_ROOT_FOLDER/.curl_cache"
	if [ -d "$old_curl_cache" ]; then
		echo "Migrating curl cache: $old_curl_cache -> $new_curl_cache"
		safe_mkdir "$new_curl_cache"
		command cp -Rn "$old_curl_cache/." "$new_curl_cache/" 2>/dev/null
		command mv -f "$old_curl_cache" "$old_curl_cache.migrated"
	fi

	# 3. History backups - ~/.bash_history_backups into
	# $SY_ROOT_FOLDER/.bash_history_backups. Full folder copy, same as above.
	old_history_backups="$HOME/.bash_history_backups"
	new_history_backups="$SY_ROOT_FOLDER/.bash_history_backups"
	if [ -d "$old_history_backups" ]; then
		echo "Migrating history backups: $old_history_backups -> $new_history_backups"
		safe_mkdir "$new_history_backups"
		command cp -Rn "$old_history_backups/." "$new_history_backups/" 2>/dev/null
		command mv -f "$old_history_backups" "$old_history_backups.migrated"
	fi
fi

# dump fullsetup log in CI for debugging package install errors
if ((IS_CI)) && [ -f "$BASHRC_TEMP_DIR/fullsetup.log" ]; then
	echo ">> fullsetup.log ($BASHRC_TEMP_DIR/fullsetup.log)"
	cat "$BASHRC_TEMP_DIR/fullsetup.log"
fi
