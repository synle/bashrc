# software/scripts/sublime-text-plugins-refresh-on-focus.py
#
# Sublime Text plugin that runs on every tab/window focus:
# 1. Refreshes the sidebar folder list to pick up external file changes.
# 2. Reads .gitignore from the project root and syncs root-level entries into
#    Sublime preferences (folder_exclude_patterns and file_exclude_patterns).
#    - Folder entries (plain names like node_modules, dist, /data) go to folder_exclude_patterns.
#    - File entries (patterns with dots or globs like *.db, *.log) go to file_exclude_patterns.
#    - Entries in FILE_EXCLUDE_EXCEPTIONS (e.g. .env) are kept visible.
#    - A marker separates base preferences from gitignore-derived entries,
#      so they are cleared and rebuilt on each focus without affecting manual settings.

import sublime
import sublime_plugin
import os
import re

GITIGNORE_MARKER = "####### manual entry from .gitignore #######"
FILE_EXCLUDE_EXCEPTIONS = {".env"}


def _get_project_root(window):
    folders = window.folders()
    if folders:
        return folders[0]
    return None


def _parse_gitignore(gitignore_path):
    """Parse .gitignore and return root-level folder names and file patterns."""
    folders = []
    files = []
    if not os.path.isfile(gitignore_path):
        return folders, files
    with open(gitignore_path, "r") as f:
        for line in f:
            line = line.strip()
            # skip empty lines and comments
            if not line or line.startswith("#"):
                continue
            # skip negation patterns
            if line.startswith("!"):
                continue
            # strip leading slash (root-level anchor like /data, /node_modules)
            clean = line.lstrip("/")
            # strip trailing slash for comparison
            clean = clean.rstrip("/")
            # skip patterns with path separators in the middle (not root-level)
            if "/" in clean:
                continue
            # file patterns: contain dots or start with * (e.g. *.log, .env, npm-debug.log*)
            if "." in clean or clean.startswith("*"):
                if clean in FILE_EXCLUDE_EXCEPTIONS:
                    continue
                if clean not in files:
                    files.append(clean)
            else:
                if clean not in folders:
                    folders.append(clean)
    return folders, files


def _sync_patterns(settings, setting_key, gitignore_entries, project_root):
    """Sync gitignore entries into a settings list using the marker for separation."""
    current_patterns = settings.get(setting_key, [])

    # find marker index and keep everything before it
    marker_index = -1
    for i, entry in enumerate(current_patterns):
        if entry == GITIGNORE_MARKER:
            marker_index = i
            break

    if marker_index >= 0:
        base_patterns = current_patterns[:marker_index]
    else:
        base_patterns = list(current_patterns)

    # build new list: base + marker + project path + gitignore entries (deduplicated against base)
    base_set = set(base_patterns)
    new_patterns = list(base_patterns)
    new_patterns.append(GITIGNORE_MARKER)
    new_patterns.append("####### " + project_root + " #######")
    for entry in gitignore_entries:
        if entry not in base_set:
            new_patterns.append(entry)

    if new_patterns != current_patterns:
        settings.set(setting_key, new_patterns)
        return True
    return False


def _sync_gitignore(window):
    """Sync .gitignore root-level entries into folder_exclude_patterns and file_exclude_patterns."""
    project_root = _get_project_root(window)
    if not project_root:
        return

    gitignore_path = os.path.join(project_root, ".gitignore")
    gitignore_folders, gitignore_files = _parse_gitignore(gitignore_path)
    if not gitignore_folders and not gitignore_files:
        return

    settings = sublime.load_settings("Preferences.sublime-settings")
    changed = False

    if gitignore_folders:
        changed = _sync_patterns(settings, "folder_exclude_patterns", gitignore_folders, project_root) or changed

    if gitignore_files:
        changed = _sync_patterns(settings, "file_exclude_patterns", gitignore_files, project_root) or changed

    if changed:
        sublime.save_settings("Preferences.sublime-settings")


class RefreshOnFocusListener(sublime_plugin.EventListener):
    def on_activated_async(self, view):
        # This triggers when a view gains focus (window or tab)
        window = view.window()
        if window:
            window.run_command("refresh_folder_list")
            _sync_gitignore(window)
