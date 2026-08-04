# Screenshot Shortcuts (macOS)

Make `⌘⇧4` and `⌃⌘⇧4` both do the same thing: take an area-selection screenshot, **save it to `~/Desktop/_screenshots/` AND copy it to the clipboard**. Uses macOS native Shortcuts.app — no third-party dependency.

## Why

By default macOS splits the two behaviors:

- `⌘⇧4` → file only
- `⌃⌘⇧4` → clipboard only

This setup binds both combos to a single shell snippet that does both.

## Prerequisite (one-time)

Open **Shortcuts.app** → Settings (`⌘,`) → **Advanced** → toggle on **Allow Running Scripts**.

## Create the Shortcut

1. In Shortcuts.app click **+** (top-right) for a new shortcut.
2. Rename the title (top bar) to: `Screenshot Area to File + Clipboard`.
3. In the right-side action search, find **Run Shell Script** → double-click to add.
4. In that action set:
   - **Shell** = `/bin/bash`
   - **Pass Input** = `no input`
   - **Run as Administrator** = off
5. Paste this as the script body:

   ```bash
   mkdir -p "$HOME/Desktop/_screenshots"
   FILE="$HOME/Desktop/_screenshots/Screen Shot $(date +'%Y-%m-%d at %H.%M.%S').png"
   /usr/sbin/screencapture -i "$FILE"
   [ -s "$FILE" ] && /usr/bin/osascript -e "set the clipboard to (read (POSIX file \"$FILE\") as «class PNGf»)"
   ```

6. Click the **info (ⓘ) icon** (top-right of the shortcut editor) → **Add Keyboard Shortcut** → press `⌘⇧4`.
7. Close — it auto-saves.

## Duplicate for the second hotkey

macOS allows only one keyboard shortcut per Shortcut, so make a copy for `⌃⌘⇧4`.

8. In the Shortcuts library, right-click the shortcut → **Duplicate**.
9. Open the copy → **info (ⓘ)** → remove the old hotkey → **Add Keyboard Shortcut** → press `⌃⌘⇧4`.

## Disable the OS defaults so your Shortcuts take over

10. **System Settings → Keyboard → Keyboard Shortcuts → Screenshots**
11. Uncheck **Save picture of selected area as a file** (`⌘⇧4`).
12. Uncheck **Copy picture of selected area to the clipboard** (`⌃⌘⇧4`).
13. Click **Done**.

## Permission prompt (first run)

macOS will prompt for **Screen Recording** permission for Shortcuts.app — grant it (System Settings → Privacy & Security → Screen Recording) and re-trigger.

## Test

Press `⌘⇧4`, drag-select. You should get:

- The crosshair selector
- A saved PNG in `~/Desktop/_screenshots/`
- The image on the clipboard (paste into Messages/Slack to verify)

`Esc` cancels cleanly — the `[ -s "$FILE" ]` guard skips the clipboard copy when no file was written.

## Notes

- The screenshot folder `~/Desktop/_screenshots` matches the `defaults write com.apple.screencapture location` setting in `software/scripts/mac/_only.sh`.
- The `«class PNGf»` token in the `osascript` line is literal (option-`\` and option-shift-`\` on a US layout) — needed for `read … as` to get the image data type.
- Shortcuts.app adds a ~100–300ms launch delay vs. the native shortcut. If that's a problem, switch to Hammerspoon (Lua) for an instant binding.
