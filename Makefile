# setup
setup_full:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh | bash

setup_light:
	sh run.sh --files="_bash-rc-bootstrap.js,git.js,vim-configurations.js,vim-vundle.sh,bash-inputrc.js,bash-autocomplete.js,bash-syle-content.js" --prod

setup_hosts:
	sh run.sh --files="software/scripts/etc-hosts.su.js" --prod

setup_dependencies:
	sh run.sh --run-only-prescripts --pre-scripts="setup-dependencies.sh" --prod

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
	sh run.sh --run-only-prescripts --pre-scripts="setup-dependencies.sh"

test_setup_hosts:
	sh run.sh --files="software/scripts/etc-hosts.su.js"

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

