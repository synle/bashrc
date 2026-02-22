# setup
setup_full:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh | bash

setup_light:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh | bash

setup_hosts:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-hosts.sh | bash

setup_dependencies:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh | bash

# build
build:
	$(MAKE) format
	bash build.sh

format:
	bash format.sh

dev:
	npm install
	npm run dev

# test
test:
	sh run.sh

test_dependencies:
	sh test-dependencies.sh

test_setup_hosts:
	sh test-setup-hosts.sh

# test a single file locally
# usage: make test_single_run file=git  (also accepts f= or files=)
test_single_run:
	@FILE="$(or $(file),$(f),$(files))"; \
	if [ -n "$$FILE" ]; then \
		sh run.sh --files="$$FILE"; \
	else \
		cat software/metadata/script-list.config; \
		echo "\n\n==================================\n"; \
		read -p "Enter File To Test:" FILE; \
		echo "sh run.sh --files=$$FILE"; \
		sh run.sh --files="$$FILE"; \
	fi

# info
list_scripts:
	cat software/metadata/script-list.config

