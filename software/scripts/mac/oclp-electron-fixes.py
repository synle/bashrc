# sources:
# https://gist.github.com/trulow/d5c69fa07231718bbe4b3a5154dd1f44
# https://gist.github.com/khronokernel/122dc28114d3a3b1673fa0423b5a9b39

"""
electron_patcher.py: Enforce 'use-angle@1' in Chrome and Electron applications

This script patches Chromium-based applications (including Electron apps and Chrome)
to enforce the use of OpenGL rendering through the 'use-angle@1' setting.

Features:
- macOS only: Optimized for macOS Electron applications
- Auto-detection: Automatically finds Electron applications in standard locations
- Specific apps: Has special handling for common apps like Spotify, Discord, VSCode, Microsoft Teams
- Command-line options: Can scan custom directories or patch specific applications
- Deep scanning: Can recursively search for Local State files
- Network mount protection: Avoids scanning network-mounted volumes

Usage examples:
  python electron_patcher.py                      # Patch all detected applications
  python electron_patcher.py --list-only          # Just list applications without patching
  python electron_patcher.py --scan-dir ~/Apps    # Scan a custom directory
  python electron_patcher.py --app-path ~/path/to/app/Local\ State --app-name "My App"
  python electron_patcher.py --deep-scan          # Perform deep scan of user's home directory

Version 2.1.1 (2025-03-06)
"""

import enum
import json
import os
import subprocess

# macOS-only script
import platform

if platform.system().lower() != "darwin":
    print("Error: This script only works on macOS")
    sys.exit(1)
import sys

from pathlib import Path


class ChromiumSettingsPatcher:
    class AngleVariant(enum.Enum):
        Default = "0"
        OpenGL = "1"
        Metal = "2"

    def __init__(self, state_file: str) -> None:
        self._local_state_file = Path(state_file).expanduser()

    def patch(self) -> None:
        """
        Ensure 'use-angle@1' is set in Chrome's experimental settings
        """
        _desired_key = "use-angle"
        _desired_value = self.AngleVariant.OpenGL.value

        if not self._local_state_file.exists():
            print("  Local State missing, creating...")
            self._local_state_file.parent.mkdir(parents=True, exist_ok=True)
            state_data = {}
        else:
            print("  Parsing Local State file")
            state_data = json.loads(self._local_state_file.read_bytes())

        if "browser" not in state_data:
            state_data["browser"] = {}
        if "enabled_labs_experiments" not in state_data["browser"]:
            state_data["browser"]["enabled_labs_experiments"] = []

        for key in state_data["browser"]["enabled_labs_experiments"]:
            if "@" not in key:
                continue

            key_pair = key.split("@")
            if len(key_pair) < 2:
                continue
            if key_pair[0] != _desired_key:
                continue
            if key_pair[1] == _desired_value:
                print(f"  {_desired_key}@{_desired_value} is already set")
                break

            index = state_data["browser"]["enabled_labs_experiments"].index(key)
            state_data["browser"]["enabled_labs_experiments"][index] = f"{_desired_key}@{_desired_value}"
            print(f"  Updated {_desired_key}@{_desired_value}")

        if f"{_desired_key}@{_desired_value}" not in state_data["browser"]["enabled_labs_experiments"]:
            state_data["browser"]["enabled_labs_experiments"].append(f"{_desired_key}@{_desired_value}")
            print(f"  Added {_desired_key}@{_desired_value}")

        print("  Writing to Local State file")
        self._local_state_file.write_text(json.dumps(state_data, indent=4))


def is_electron_app(directory):
    """
    Check if a directory contains an Electron application
    """
    # Check for Local State file (most common indicator)
    if (directory / "Local State").exists():
        return True

    # Check for other common Electron app indicators
    electron_indicators = ["electron.asar", "app.asar", "electron-main.js", "electron.dll", "Electron Framework.framework"]

    # Look up to 3 levels deep for electron indicators
    for level in range(1, 4):
        for indicator in electron_indicators:
            # Use recursive glob with max depth
            matches = list(directory.glob(f"{'*/' * (level - 1)}{indicator}"))
            if matches:
                return True

    return False


def get_network_mounts():
    """
    Get a list of network mounted volumes on macOS

    Returns:
        List of paths to mounted network volumes
    """
    try:
        # Use macOS 'mount' command to list all mounts
        result = subprocess.run(["mount"], capture_output=True, text=True)

        network_mounts = []
        # Look for common network filesystem types
        for line in result.stdout.splitlines():
            # Common network filesystems on macOS
            if any(fs in line for fs in ["nfs", "smbfs", "afpfs", "cifs", "webdav"]):
                parts = line.split(" on ")
                if len(parts) > 1:
                    mount_point = parts[1].split(" ")[0]
                    network_mounts.append(mount_point)

        return network_mounts
    except Exception as e:
        print(f"Warning: Error detecting network mounts: {e}")
        return []


def find_local_state_files(start_dir=None):
    """
    Walk through directories to find all Local State files on macOS

    Args:
        start_dir: Directory to start searching from (defaults to user home)

    Returns:
        List of (path, relative_app_name) tuples for found Local State files
    """
    if start_dir is None:
        start_dir = os.path.expanduser("~")
    else:
        start_dir = os.path.expanduser(start_dir)

    results = []
    print(f"Scanning for Local State files in {start_dir}...")

    # Skip these directories to avoid excessive scanning
    skip_dirs = [
        ".Trash",
        "node_modules",
        "Library/Developer",
        "Library/Caches/Homebrew",
        "Library/Logs",
        "Library/Saved Application State",
    ]

    # Get network mounts to skip
    network_mounts = get_network_mounts()
    print(f"Detected network mounts that will be skipped: {network_mounts}")

    for root, dirs, files in os.walk(start_dir):
        # Skip directories that match any in skip_dirs
        dirs[:] = [d for d in dirs if not any(skip_path in os.path.join(root, d) for skip_path in skip_dirs)]

        # Skip network mounts
        dirs[:] = [d for d in dirs if not any(os.path.join(root, d).startswith(mount) for mount in network_mounts)]

        # Skip hidden directories (start with .)
        dirs[:] = [d for d in dirs if not d.startswith(".")]

        if "Local State" in files:
            path = os.path.join(root, "Local State")
            # Get a reasonable app name from the path
            relative_path = os.path.relpath(root, start_dir)
            parts = relative_path.split(os.sep)
            # Use the last non-generic directory name as the app name
            app_name = next((p for p in reversed(parts) if p not in ["EBWebView", "User Data", "Default"]), parts[-1])

            results.append((path, app_name))
            print(f"Found Local State: {path} (app: {app_name})")

    return results


def patch_directory(directory_path, name=None, list_only=False):
    """
    Patch all Chromium-based applications in the given directory
    """
    path = Path(directory_path).expanduser()

    if not path.exists():
        return

    # If it's a specific file path
    if not path.is_dir():
        if path.name == "Local State":
            app_name = name or path.parent.name
            if list_only:
                print(f"Found {app_name}")
            else:
                print(f"Patching {app_name}")
                patcher = ChromiumSettingsPatcher(path)
                patcher.patch()
        return

    # If it's a directory containing apps
    for directory in path.iterdir():
        if not directory.is_dir():
            continue

        # Check for direct Local State file
        state_file = directory / "Local State"
        if state_file.exists():
            if list_only:
                print(f"Found {directory.name}")
            else:
                print(f"Patching {directory.name}")
                patcher = ChromiumSettingsPatcher(state_file)
                patcher.patch()
            continue

        # For large directories like Application Support, do deeper scanning
        if is_electron_app(directory):
            # Find the Local State file
            state_files = list(directory.glob("**/Local State"))
            for state_file in state_files:
                if list_only:
                    print(f"Found {directory.name} (in {state_file.relative_to(directory).parent})")
                else:
                    print(f"Patching {directory.name} (in {state_file.relative_to(directory).parent})")
                    patcher = ChromiumSettingsPatcher(state_file)
                    patcher.patch()


def get_macos_directories():
    """
    Return a list of standard macOS directories to scan for Electron applications
    """
    return ["~/Library/Application Support", "~/Library/Caches", "~/Library/Preferences", "~/Library/Containers"]


def main(list_only=False, deep_scan=False):
    # Deep scan option uses find_local_state_files to scan from home directory
    if deep_scan:
        print("Performing deep scan for Local State files...")
        found_files = find_local_state_files()
        for state_file_path, app_name in found_files:
            if list_only:
                print(f"Found {app_name}")
            else:
                print(f"Patching {app_name}")
                patcher = ChromiumSettingsPatcher(state_file_path)
                patcher.patch()
        return

    # Otherwise use the regular directory scanning approach
    electron_dirs = get_macos_directories()

    # Patch all Electron applications in standard macOS directories
    print("Scanning for Electron applications on macOS...")
    for directory in electron_dirs:
        patch_directory(directory, list_only=list_only)

    # Patch Chrome
    chrome_path = "~/Library/Application Support/Google"
    print("Scanning for Chrome variants...")
    patch_directory(chrome_path, list_only=list_only)

    # Specific applications with non-standard locations
    specific_apps = {
        "Spotify": "~/Library/Caches/com.spotify.client/Local State",
        "Discord": "~/Library/Application Support/discord/Local State",
        "VSCode": "~/Library/Application Support/Code/Local State",
        "Slack": "~/Library/Application Support/Slack/Local State",
        "Microsoft Teams": "~/Library/Containers/com.microsoft.teams2/Data/Library/Application Support/Microsoft/MSTeams/EBWebView/Local State",
    }

    print("Checking specific applications...")
    for app_name, state_path in specific_apps.items():
        patch_directory(state_path, app_name, list_only=list_only)


def parse_arguments():
    """
    Parse command-line arguments
    """
    import argparse

    parser = argparse.ArgumentParser(description="Patch Electron and Chrome applications to use OpenGL rendering")

    parser.add_argument("--app-path", help="Path to a specific application's Local State file")

    parser.add_argument("--app-name", help="Name of the application (used with --app-path)")

    parser.add_argument("--scan-dir", help="Additional directory to scan for Electron applications")

    parser.add_argument("--list-only", action="store_true", help="Only list found applications without patching")

    parser.add_argument("--deep-scan", action="store_true", help="Perform a deep scan of the user's home directory for Local State files")

    return parser.parse_args()


if __name__ == "__main__":
    # This script only works on macOS
    if platform.system().lower() != "darwin":
        print("Error: This script only works on macOS")
        sys.exit(1)

    args = parse_arguments()

    if args.app_path:
        # Patch a specific application
        app_name = args.app_name or "Custom application"
        patch_directory(args.app_path, app_name, list_only=args.list_only)
    elif args.scan_dir:
        # Scan a specific directory
        print(f"Scanning custom directory: {args.scan_dir}")
        if args.deep_scan:
            found_files = find_local_state_files(args.scan_dir)
            for state_file_path, app_name in found_files:
                if args.list_only:
                    print(f"Found {app_name}")
                else:
                    print(f"Patching {app_name}")
                    patcher = ChromiumSettingsPatcher(state_file_path)
                    patcher.patch()
        else:
            patch_directory(args.scan_dir, list_only=args.list_only)
    else:
        # Run the normal patching process
        main(list_only=args.list_only, deep_scan=args.deep_scan)
