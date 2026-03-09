# software/scripts/sublime-text-plugins-refresh-on-focus.py

import sublime
import sublime_plugin
import os
import re

GITIGNORE_MARKER = "####### manual entry from .gitignore #######"


def _get_project_root(window):
    folders = window.folders()
    if folders:
        return folders[0]
    return None


def _parse_gitignore_folders(gitignore_path):
    """Parse .gitignore and return root-level folder names (ignore file patterns)."""
    folders = []
    if not os.path.isfile(gitignore_path):
        return folders
    with open(gitignore_path, "r") as f:
        for line in f:
            line = line.strip()
            # skip empty lines and comments
            if not line or line.startswith("#"):
                continue
            # skip negation patterns
            if line.startswith("!"):
                continue
            # strip trailing slash for comparison
            clean = line.rstrip("/")
            # skip patterns with path separators in the middle (not root-level)
            if "/" in clean:
                continue
            # skip patterns with dots (likely files like *.log, .env)
            if "." in clean and "*" not in clean:
                continue
            # skip glob patterns that look like file matches (e.g. *.js, *.log)
            if clean.startswith("*"):
                continue
            if clean not in folders:
                folders.append(clean)
    return folders


def _sync_gitignore_folders(window):
    """Sync .gitignore root-level folders into folder_exclude_patterns."""
    project_root = _get_project_root(window)
    if not project_root:
        return

    gitignore_path = os.path.join(project_root, ".gitignore")
    gitignore_folders = _parse_gitignore_folders(gitignore_path)
    if not gitignore_folders:
        return

    settings = sublime.load_settings("Preferences.sublime-settings")
    current_patterns = settings.get("folder_exclude_patterns", [])

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

    # build new list: base + marker + gitignore folders (deduplicated against base)
    base_set = set(base_patterns)
    new_patterns = list(base_patterns)
    new_patterns.append(GITIGNORE_MARKER)
    for folder in gitignore_folders:
        if folder not in base_set:
            new_patterns.append(folder)

    if new_patterns != current_patterns:
        settings.set("folder_exclude_patterns", new_patterns)
        sublime.save_settings("Preferences.sublime-settings")


class RefreshOnFocusListener(sublime_plugin.EventListener):
    def on_activated_async(self, view):
        # This triggers when a view gains focus (window or tab)
        window = view.window()
        if window:
            window.run_command("refresh_folder_list")
            _sync_gitignore_folders(window)
