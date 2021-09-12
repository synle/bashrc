setup:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh | bash

setup_full:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh | bash

setup_light:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh | bash

setup_hosts:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-hosts.sh | bash

prebuild:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh | bash

build:
	sh format.sh
	sh build.sh

format:
	sh format.sh

test:
	sh test-full-run.sh

test_full_run_live:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-full-run-live.sh | bash

test_full_run_local:
	sh test-full-run.sh
