# Use bash for recipes (run.sh requires bash features like [[ ]] and compgen)
# NOTE: use `command -v` (POSIX builtin) instead of `which` — `which` is not installed by
# default in minimal containers (Fedora, Arch) and causes SHELL to resolve empty, breaking all recipes.
SHELL := $(shell command -v bash)
# Run each recipe as a single shell script (allows real newlines instead of \ continuations)
.ONESHELL:
# Ensure all recipes run in UTC
export TZ := UTC
# Disable color output (also covers CI)
export NO_COLOR := 0

# default make `make` => point to `make setup`
.DEFAULT_GOAL := setup

# Shared preamble that sources common environment variables (use: $(_BUILD_ENV) && cmd)
_BUILD_ENV = source software/bootstrap/common-env.sh

################################################################################
# ---- Setup ----
################################################################################

# Install dependencies and prepare workspace
init:
	npm ci || npm install
	mkdir -p .build

# Alias for setup_local_full
setup:
	make setup_local_full

# Bootstrap setup from GitHub (prod)
setup_prod:
	cat software/bootstrap/setup.sh | bash

# Full setup from local files (installs dependencies via _full-setup.sh)
setup_local_full:
	bash run.sh --setup --force

# Refresh profile only from local files (no dependency install)
setup_local_profile:
	bash run.sh

# Conditional: full setup if first run, profile refresh if ~/.bash_syle exists
setup_local_conditional:
	if [ -f "$$HOME/.bash_syle" ] && type -P node &>/dev/null; then
		make setup_local_profile
	else
		make setup_local_full
	fi

################################################################################
# ---- Format ----
################################################################################

# Run all formatting steps
format: format_build_include format_script_indexes format_jsdocs format_spec_cleanup format_shell format_prettier

# Format shell files with shfmt
format_shell:
	if ! type -P shfmt > /dev/null 2>&1; then
	  echo 'shfmt not found. Skipping shell formatting.'
	  exit 0
	fi
	shfmt -w -i 2 -bn -sr \
	  $$(find software/bootstrap software/scripts \( -name '*.sh' -o -name '*.bash' \) ! -name '*.ps1.bash') \
	  ./*.sh

# Process BEGIN/END block markers
format_build_include:
	node software/tools/build-include.js

# Generate script list indexes
format_script_indexes:
	node software/tools/format-script-indexes.js

# Build JSDocs type declarations
format_jsdocs:
	mkdir -p software/types
	node software/tools/format-jsdocs.js

# Trim trailing | and whitespace from autocomplete spec files
format_spec_cleanup:
	for spec_file in software/metadata/autocomplete-complete-spec/*; do
	  [ -f "$$spec_file" ] || continue
	  awk '{
	    sub(/\|[[:space:]]*$$/, "")
	    gsub(/^[[:space:]]+|[[:space:]]+$$/, "")
	    if ($$0 != "") print
	  }' "$$spec_file" > "$$spec_file.tmp" && mv "$$spec_file.tmp" "$$spec_file"
	done

# Format code with Prettier
format_prettier:
	npm run format

################################################################################
# ---- Build ----
################################################################################

# Build all default steps (prebuild-hosts, build-configs, host-mappings, backup-xfce)
build: build_prebuild_hosts build_configs build_host_mappings build_backup_xfce

# All default steps + webapp + postbuild
build_all: build build_webapp build_postbuild

# Prebuild host mappings
build_prebuild_hosts:
	bash run.sh --files="software/metadata/ip-address.config.js"

# Build JSON/config artifacts + autocomplete specs
build_configs:
	CI=true bash run.sh --files="$$(grep -R -l 'writeBuildArtifact' 'software/' | grep -v 'index.js' | grep -v 'software/tests/' | grep -v 'software/scripts/.*/')"
	CI=true bash run.sh --files="$$(ls software/metadata/autocomplete-spec-*.js 2>/dev/null | tr '\n' ' ')"

# Build autocomplete spec files (OS-independent, runs in ci_prep so changes land in the prep patch)
build_autocomplete_specs:
	CI=true bash run.sh --files="$$(ls software/metadata/autocomplete-spec-*.js 2>/dev/null | tr '\n' ' ')"

# Build host mappings (skip in CI)
build_host_mappings:
	[ "$$CI" = "true" ] && exit 0
	bash run.sh --files="software/metadata/hosts-blocked-ads.config.js"

# Backup XFCE configuration (if applicable)
build_backup_xfce:
	if [ -d "$$HOME/.config/xfce4" ]; then
	  mkdir -p ./linux
	  tar -czf ./linux/xfce-config.tar.gz -C "$$HOME/.config" xfce4
	fi

# Build webapp for production
build_webapp:
	$(_BUILD_ENV) && npm run build

# Copy build artifacts to dist
build_postbuild:
	@cp .build/font-preview.html dist/font-preview.html 2>/dev/null || true

# Update /etc/hosts (extra, opt-in)
build_update_hosts:
	bash run.sh --files="software/metadata/hosts-blocked-ads.config.js"

################################################################################
# ---- Test ----
################################################################################

# Run unit tests
test_unit:
	npm test

# Run profile syntax tests
test_profile:
	npm run test:profile

# Run smoke tests against the live site
test_smoke:
	npm run test:smoke

# Run smoke tests against the locally compiled dist
test_smoke_local:
	npm run test:smoke:local

# Run build config shape tests
test_buildconfig:
	npm run test:buildconfig

# Update build config shape inline snapshots
test_buildconfig_update:
	npm run test:buildconfig:update

# Run dry-run setup test (JS scripts only, no file writes or installs)
DRYRUN_MAX_ERRORS ?= 3
test_dryrun:
	bash run.sh --dryrun --setup 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tee /tmp/bashrc_dryrun_test.log
	echo ">> Checking dry run results for errors..."
	error_count=$$(command grep -ci 'error' /tmp/bashrc_dryrun_test.log || true)
	if [ "$$error_count" -gt $(DRYRUN_MAX_ERRORS) ]; then \
	  echo "FAIL: dry run had $$error_count error lines (threshold: $(DRYRUN_MAX_ERRORS))"; \
	  command grep -i 'error' /tmp/bashrc_dryrun_test.log; \
	  exit 1; \
	fi
	echo ">> Dry run test passed"

# Run all test suites (unit, profile, smoke, buildconfig, dryrun)
test_all: test_unit test_profile test_smoke test_buildconfig test_dryrun

test: test_all

################################################################################
# ---- Workflow ----
################################################################################

# Format code + run all tests (automated by PostToolUse hook)
# Always add new test suites here.
# test_profile runs last as warning only — on failure, shows which profile blocks may have errors
validate: format test_unit test_buildconfig build_webapp test_smoke_local test_dryrun
	make test_profile 2>&1 || echo "WARNING: test_profile failed — check profile blocks above for syntax errors"

# Format + build webapp (used by CI workflow)
prep: format build_webapp

# Run unit tests + dry-run all scripts (no file writes)
dry_run: test_unit
	bash run.sh --dryrun --setup

# Alias for dry_run
start: dry_run

# Alias for dry_run
run: dry_run

# Alias for build_update_hosts
build_hosts: build_update_hosts

################################################################################
# ---- CI ----
################################################################################

# CI Phase 1: Format code, build autocomplete specs, build webapp, smoke test local, dry-run test, and download release binaries
ci_prep: clean_artifacts clean_prebuilt_profiles format build_autocomplete_specs build_webapp ci_test_smoke_local test_dryrun ci_download_release_binaries

# Download latest release binaries (url-porter, sqlui-native, display-dj) into assets/binaries/
ci_download_release_binaries:
	bash software/tools/ci-download-release-binaries.sh

# CI Phase 2: Build configs and run scripts with --setup to install dependencies via _full-setup.sh
ci_build: build_prebuild_hosts build_configs build_host_mappings
	CI=true bash run.sh --setup --force --verbose

# CI Phase 3: Run all tests

# Run unit tests (CI, dot reporter)
ci_test_unit:
	npm test -- --reporter=dot

# Run profile syntax tests (CI, dot reporter)
ci_test_profile:
	npm run test:profile -- --reporter=dot

# Run smoke tests against the live site (CI, dot reporter)
ci_test_smoke:
	npm run test:smoke -- --reporter=dot

# Run smoke tests against the locally compiled dist (CI, dot reporter)
ci_test_smoke_local:
	npm run test:smoke:local -- --reporter=dot

# Run build config shape tests (CI, dot reporter)
ci_test_buildconfig:
	npm run test:buildconfig -- --reporter=dot

# Run all CI test suites
ci_test: ci_test_unit ci_test_profile ci_test_smoke ci_test_buildconfig

################################################################################
# ---- Clean ----
################################################################################

# Clean prebuilt profiles, autogen notes, BEGIN/END inclusions, and build artifacts
clean: clean_prebuilt_profiles clean_autogen_notes clean_include clean_artifacts

# Clean old prebuilt bash profiles
clean_prebuilt_profiles:
	rm -rf .build/profile_*

# Clean auto-generated file notes from build output files
clean_autogen_notes:
	git ls-files | while read -r file; do
	  [ "$$file" = "software/index.js" ] && continue
	  head -1 "$$file" | grep -q 'NOTE: STOP - do not edit by hand - this file is auto-generated' || continue
	  prefix=$$(head -1 "$$file" | grep -o '^[/#]*')
	  tail -n +2 "$$file" > "$$file.tmp" && mv "$$file.tmp" "$$file"
	  while head -1 "$$file" | grep -qx "$$prefix[[:space:]]*"; do
	    tail -n +2 "$$file" > "$$file.tmp" && mv "$$file.tmp" "$$file"
	  done
	  echo "  >> Cleaned autogen note from $$file"
	done

# Clean BEGIN/END block inclusions from source files
clean_include:
	node software/tools/build-include.js --clean

# Clean dist, type declarations, and build artifacts
clean_artifacts:
	rm -rf ./dist ./software/types/* ./.build/*

# Remove all bashrc config (~/.bash_sy*, fnm, hushlogin) and all repo-generated artifacts
nuke:
	if [ -f ~/.bash_syle ]; then
	  touch -r ~/.bash_syle /tmp/.bash_syle_ts
	  > ~/.bash_syle
	  touch -r /tmp/.bash_syle_ts ~/.bash_syle
	  rm -f /tmp/.bash_syle_ts
	fi
	rm -rf \
	  ~/.nvm \
	  ~/.bash_syle_* \
	  ~/.bash_syle_common \
	  ~/.local/share/fnm \
	  ~/.hushlogin \
	  ~/.syle* \
	  ~/_extra/ \
	  ~/.fzf \
	  ~/.fzf.bash \
	  ~/.powershell_syle
	$(MAKE) clean
	rm -rf \
	  ./node_modules \
	  ./webapp/node_modules \
	  ./.prettier-cache \
	  ./coverage \
	  ./.nyc_output \
	  ./unit-test-output.txt

# Paths stripped from history by clean_git_history. Includes pre-rename locations
# (assets/display-dj/, assets/sqlui-native/, assets/url-porter/) so the blobs are
# removed from commits made before the move to assets/binaries/.
HISTORY_CLEANUP_PATHS := \
	.build/ \
	assets/binaries/ \
	assets/display-dj/ \
	assets/sqlui-native/ \
	assets/url-porter/

# Show what would be removed from git history. Non-destructive.
clean_git_history_dryrun:
	if ! command -v git-filter-repo > /dev/null 2>&1; then
	  echo "ERROR: git-filter-repo is not installed."
	  echo "Install with:  brew install git-filter-repo   (macOS)"
	  echo "          or:  pip install git-filter-repo    (cross-platform)"
	  exit 1
	fi
	echo "============================================================"
	echo "git filter-repo DRY RUN — no changes will be made"
	echo "============================================================"
	echo ">> Current .git size:  $$(du -sh .git | cut -f1)"
	echo ""
	echo ">> Paths targeted for removal:"
	for p in $(HISTORY_CLEANUP_PATHS); do
	  echo "     - $$p"
	done
	echo ""
	echo ">> Per-path totals across ALL history (files + bytes):"
	blobs=$$(mktemp)
	git rev-list --objects --all \
	  | git cat-file --batch-check='%(objectname) %(objecttype) %(objectsize) %(rest)' \
	  | awk '$$2 == "blob" && $$4 != "" {print $$3, $$4}' > "$$blobs"
	for p in $(HISTORY_CLEANUP_PATHS); do
	  awk -v prefix="$$p" '$$2 ~ "^" prefix {sum+=$$1; cnt++} END {printf "     %-28s %5d files   %8.1f MB\n", prefix, cnt, sum/1048576}' "$$blobs"
	done
	rm -f "$$blobs"
	echo ""
	echo ">> To perform the rewrite:  make clean_git_history"

# Rewrite git history to remove HISTORY_CLEANUP_PATHS. DESTRUCTIVE.
# Backs up to a git bundle under /tmp/ first, then prompts for explicit confirmation.
# After the rewrite you must manually:  git remote add origin <url>  +  git push --force-with-lease --all --tags
clean_git_history:
	if ! command -v git-filter-repo > /dev/null 2>&1; then
	  echo "ERROR: git-filter-repo is not installed."
	  echo "Install with:  brew install git-filter-repo   (macOS)"
	  echo "          or:  pip install git-filter-repo    (cross-platform)"
	  exit 1
	fi
	if ! git diff --quiet || ! git diff --cached --quiet; then
	  echo "ERROR: working tree has uncommitted changes. Commit or stash first."
	  exit 1
	fi
	remote_url=$$(git remote get-url origin 2> /dev/null || true)
	backup="/tmp/bashrc-history-backup-$$(date +%Y%m%d-%H%M%S).bundle"
	echo "============================================================"
	echo "DESTRUCTIVE: about to rewrite git history"
	echo "============================================================"
	echo ">> Backup bundle:        $$backup"
	echo ">> Current .git size:    $$(du -sh .git | cut -f1)"
	echo ">> Origin URL (saved):   $$remote_url"
	echo ">> Paths to strip:"
	for p in $(HISTORY_CLEANUP_PATHS); do
	  echo "     - $$p"
	done
	echo ""
	printf "Type 'rewrite' to confirm: "
	read ans
	[ "$$ans" = "rewrite" ] || { echo "Aborted."; exit 1; }
	echo ">> Creating backup bundle..."
	git bundle create "$$backup" --all
	echo ">> Running git-filter-repo..."
	git filter-repo --force --invert-paths $(foreach p,$(HISTORY_CLEANUP_PATHS),--path $(p))
	echo ">> Aggressive gc..."
	git reflog expire --expire=now --all
	git gc --prune=now --aggressive
	echo ""
	echo ">> Done. New .git size:  $$(du -sh .git | cut -f1)"
	echo ""
	echo ">> NEXT STEPS (filter-repo removed the remote as a safety measure):"
	if [ -n "$$remote_url" ]; then
	  echo "   1. Re-add origin:      git remote add origin $$remote_url"
	else
	  echo "   1. Re-add origin:      git remote add origin <url>"
	fi
	echo "   2. Force-push main:    git push --force-with-lease --all"
	echo "   3. Force-push tags:    git push --force-with-lease --tags"
	echo "   4. Backup bundle:      $$backup  (restore with 'git clone <bundle> restored')"

# Show which CI bot commits would be squashed into the prior human commit. Non-destructive.
clean_squash_git_dryrun:
	bash software/tools/squash-bot-commits.sh --dryrun

# Squash CI bot commits ("github-actions[bot]") into the prior human commit via
# git rebase fixup. Tree at HEAD is preserved byte-for-byte; only the commit
# graph is compacted. DESTRUCTIVE — backs up to a ref + bundle and requires
# explicit confirmation. After success, manually:
#   git push --force-with-lease origin <branch>
clean_squash_git:
	bash software/tools/squash-bot-commits.sh

################################################################################
# ---- Misc ----
################################################################################

# Start webapp dev server
dev: build_all format
	$(_BUILD_ENV) && npm run dev

# Run diagnostics to check for common issues
doctor:
	bash software/tools/doctor.sh

# Scaffold a new script file (usage: make new-script name=my-tool [os=mac] [type=sh])
new-script:
	bash software/tools/new-script.sh name=$(name) os=$(os) type=$(type)

# Restore ~/.bash_syle from backup
rollback:
	if [ ! -f ~/.bash_syle.bak ]; then
	  echo "No backup found at ~/.bash_syle.bak"
	  exit 1
	fi
	cp ~/.bash_syle.bak ~/.bash_syle
	echo "Restored ~/.bash_syle from backup. Run 'source ~/.bash_syle' to reload."
