setup_full:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh | bash

setup_light:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh | bash

setup_hosts:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-hosts.sh | bash

setup_dependencies:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh | bash

build:
	make format
	sh build.sh

format:
	sh format.sh

list_scripts:
	cat software/metadata/script-list.config

test:
	sh test-full-run.sh

test_full:
	make test

test_dependencies:
	sh test-dependencies.sh

test_setup_hosts:
	sh test-setup-hosts.sh

# test a single file locally
# make test_single_run file="software/scripts/sublime-text-keybindings.js"
test_single_run:
	sh test.sh "$(file)"

test_single_run_with_prompt:
	cat software/metadata/script-list.config
	@echo "\n\n==================================\n"
	@read -p "Enter File To Test:" file; \
	sh test.sh "$$file"
