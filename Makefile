.PHONY: build run format clean

build:
	bash build.sh

run:
	bash run.sh

test:
	bash run.sh

format:
	bash format.sh

clean:
	bash clean.sh

nuke:
	rm -rf ~/.bash_sy* ~/.local/share/fnm ~/.hushlogin
