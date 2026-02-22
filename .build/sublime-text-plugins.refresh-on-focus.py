import sublime
import sublime_plugin

class RefreshOnFocusListener(sublime_plugin.EventListener):
    def on_activated_async(self, view):
        # This triggers when a view gains focus (window or tab)
        view.window().run_command("refresh_folder_list")