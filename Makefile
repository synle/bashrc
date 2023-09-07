setup_full:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh | bash

setup_light:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh | bash

setup_hosts:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-hosts.sh | bash

setup_dependencies:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh | bash

build:
	$(MAKE) format
	sh build.sh

format:
	sh format.sh

list_scripts:
	cat software/metadata/script-list.config

dev:
	npx http-server .

test:
	sh test-full-run.sh

test_full:
	$(MAKE) test

test_dependencies:
	sh test-dependencies.sh

test_setup_hosts:
	sh test-setup-hosts.sh

# test a single file locally with prompt
test_single_run:
	cat software/metadata/script-list.config
	@echo "\n\n==================================\n"
	@read -p "Enter File To Test:" file; \
	echo "sh test.sh $$file"; \
	sh test.sh "$$file"
