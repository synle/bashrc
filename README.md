# synle/bashrc

This is my personal bash profile

## Using this URL to install:

https://synle.github.io/app/setup-bash-profile.html

## Supported Platforms

- OSX
- Ubuntu / Debian
- Windows Sub Linux System (WSL) - Debian based only

## Installation

#### Install Dependencies

Run this first to get dependencies

```

. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh?$(date +%s))"

```

#### Install Profile for Full OS's / Systems

Run this on full system - eg, Mac OSX, Ubuntu or Windows Sublinux System (WSL)

```

. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh?$(date +%s))"

```

#### Install Lightweight Profile for Git Bash on Windows

```

. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh?$(date +%s))"

```

#### Other minor script to run

##### Install etc hosts

```

curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-hosts.sh | sudo bash

```

##### Test a single script live

```

export TEST_SCRIPT_FILES="git.js" \
&& curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-live.sh | bash

```
