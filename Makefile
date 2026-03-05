# Build artifacts and format code (nukes config in CI first)
build:
	@if [ "$$CI" = "true" ]; then $(MAKE) nuke; fi
	bash build.sh
	@if [ "$$CI" != "true" ]; then $(MAKE) format; fi

# Build etc hosts mappings
build_hosts:
	bash build.sh update-hosts

# Run unit tests (CI only) + run all scripts with --force
test:
	@if [ "$$CI" = "true" ]; then npm test; fi
	bash run.sh --force

# Run unit tests (CI only) + run all scripts without --force
dry_run:
	@if [ "$$CI" = "true" ]; then npm test; fi
	bash run.sh

# Bootstrap setup from GitHub (prod)
setup:
	curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --setup

# Bootstrap setup from local files
setup_local:
	bash run.sh --setup

# Format code with Prettier
format:
	bash format.sh

# Run clean.sh
clean:
	bash clean.sh

# Aliases for dry_run
start: dry_run
run: dry_run

# Remove all bashrc config and caches
nuke:
	rm -rf ~/.nvm ~/.bash_syle* ~/.local/share/fnm ~/.hushlogin ~./syle* ~/_extra/
