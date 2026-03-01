.PHONY: build run format clean

build:
	bash build.sh
	@if [ "$$CI" != "true" ]; then bash format.sh; fi

start:
	bash run.sh

run:
	bash run.sh

test:
	bash run.sh --force

format:
	bash format.sh

clean:
	bash clean.sh

nuke:
	rm -rf ~/.bash_sy* ~/.local/share/fnm ~/.hushlogin
