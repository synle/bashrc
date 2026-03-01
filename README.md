# synle/bashrc

Personal bash profile and dotfiles management system. Automates shell configuration, editor settings, fonts, Git config, and OS-specific tweaks.

## Demo

https://synle.github.io/bashrc/

## Supported Platforms

- macOS
- Ubuntu / Debian / Mint
- Windows Subsystem for Linux (WSL)
- Android Termux
- Arch Linux / Steam Deck
- ChromeOS

## Installation

<!-- BEGIN software/bootstrap/setup.sh -->
```bash
curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --files="""
  software/bootstrap/profile-core.sh
  software/bootstrap/dependencies/mac.sh
  software/bootstrap/dependencies/ubuntu.sh
  software/bootstrap/dependencies/windows.sh
  software/bootstrap/dependencies/chrome_os_linux.sh
  software/bootstrap/dependencies/android_termux.sh
  software/bootstrap/dependencies/arch_linux.sh
  software/bootstrap/dependencies/steamos.sh
"""
```
<!-- END software/bootstrap/setup.sh -->

## Usage

```bash
make test              # Run all scripts locally
make build             # Build artifacts and format code
make format            # Run build-include + format code
make clean             # Clean up
```

### run.sh

```bash
bash run.sh                          # Full local run
bash run.sh --prod                   # Full run from GitHub
bash run.sh --files="git.js"         # Run specific file(s)
bash run.sh git.js vim-config.js     # Bare args as files
bash run.sh --debug                  # Keep temp files, show retry commands
bash run.sh --force-refresh          # Reinstall fnm/Node
```

### build.sh

```bash
bash build.sh                         # Run all build steps
bash build.sh --steps="jsdocs,webapp"  # Run specific steps
```

## Fun Facts

### Current Equipment

#### Legion Go Deck

Upgraded to 2TB 2280 NVMe with an adapter. Installed SteamOS.

#### Laptop (Asus ROG G14)

- AMD 7940S
- GeForce 4060
- Upgraded to 40GB RAM
- Upgraded to 2TB NVMe
- Dual boot Windows 11 / Linux Mint

#### AI Workstation (HP Omen 40L)

- Intel Core Ultra 9 285K
- 64GB Kingston FURY DDR5-5600
- NVIDIA GeForce RTX 5090 (32GB GDDR7)
- Dual boot Windows 11 / Linux Mint

### Past Equipment

#### Steam Deck

Upgraded from 64GB eMMC to 1TB 2230 NVMe.

#### Laptop (Gigabyte Aero 16)

- Intel Core i7-12700H
- GeForce 3070 Ti
- Upgraded to 64GB RAM, 2TB NVMe
- Windows 10 with WSL 2 / Debian

#### macOS Laptop (MacBook Pro 14" M1 - 16GB / 512GB)

#### Chromebook (Samsung - 8GB / 128GB)

- ChromeOS with Ubuntu container

#### Desktop (Lenovo P520)

- Intel Xeon W-2145
- Upgraded to 128GB RAM
- 2x2TB NVMe, 8TB HDD
- Gigabyte Eagle 3090
- Custom fan mods (2x120mm intake, 120mm exhaust)
- Dual boot Windows 10 / Ubuntu 22.04
