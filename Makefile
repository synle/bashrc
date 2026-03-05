.PHONY: build run format clean

build:
	bash build.sh
	@if [ "$$CI" != "true" ]; then bash format.sh; fi

build_hosts:
	bash build.sh update-hosts

start:
	bash run.sh

run:
	bash run.sh

test:
	@if [ "$$CI" = "true" ]; then npm test; fi
	bash run.sh --force

format:
	bash format.sh

clean:
	bash clean.sh

nuke:
	rm -rf ~/.nvm ~/.bash_syle* ~/.local/share/fnm ~/.hushlogin ~./syle* ~/_extra/
