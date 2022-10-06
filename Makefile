setup:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh | bash
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh | bash

setup_full:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh | bash

setup_light:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh | bash

setup_hosts:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-hosts.sh | bash

setup_key_bindings:
	 sh test.sh "software/scripts/sublime-text-keybindings.js,software/scripts/vs-code-keybindings.js,software/scripts/windows/powertoys-keyboard-remap.js,software/scripts/windows/terminal.js"

prebuild:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh | bash

build:
	sh format.sh
	sh build.sh

format:
	sh format.sh

test:
	sh test-dependencies.sh
	sh test-full-run.sh

test_full:
	sh test-full-run.sh

test_dependencies:
	sh test-dependencies.sh

test_full_run_live:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-full-run-live.sh | bash

test_full_run_local:
	sh test-full-run.sh

# test a single file locally
# make test_single_run_local file="software/scripts/sublime-text-keybindings.js"
test_single_run_local:
	sh test.sh "$(file)"

list_scripts:
	cat software/metadata/script-list.config
