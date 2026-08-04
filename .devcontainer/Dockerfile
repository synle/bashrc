# Use Microsoft devcontainer base image — pre-cached on Codespaces so it's "free" storage-wise.
# Includes vscode user, sudo, git, curl, ca-certificates out of the box.
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Pre-create VS Code server directories and bake in VS Code config (keybindings + settings).
# These must be in the image — VS Code reads them before install.sh runs.
RUN mkdir -p /home/vscode/.vscode-server/data/Machine
COPY --chown=vscode .build/vs-code-keys-combined /home/vscode/.vscode-server/data/Machine/keybindings.json
COPY --chown=vscode .build/vs-code-config /home/vscode/.vscode-server/data/Machine/settings.json
