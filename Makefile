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

# Editor / formatter indent size. Single source of truth in JS is the
# TAB_SIZE constant in software/index.js. KEEP IN SYNC with:
#   - TAB_SIZE in software/index.js (drives EDITOR_CONFIGS.tabSize → vs-code,
#     sublime, zed via editor.tabSize / tab_size)
#   - the `format` script in package.json (Prettier --tab-width / TAB_SIZE env)
# Used below in `shfmt -i $(TAB_SIZE)` so changing one value flows everywhere.
TAB_SIZE := 2

# Banner divider line — a short, plain 15 `=` chars for recipe banners.
DIVIDER := ===============

# RULE: recipes stay plain. Banners use fixed-format printf with DIVIDER and title text.
# No ANSI colors, wrapper macros, or profile functions (hr, br, h1..h7, etc.):
# recipes run in a bare bash that never sources ~/.bash_syle.

# Shared preamble that sources common environment variables (use: $(_BUILD_ENV) && cmd)
_BUILD_ENV = source software/bootstrap/common-env.sh

################################################################################
# ---- Setup ----
################################################################################

# Install dependencies and prepare workspace
init:
	if [ "$${IS_CI:-0}" = "1" ] || [ -n "$${GITHUB_ACTIONS:-}" ]; then npm ci; else npm ci || npm install; fi
	mkdir -p .build

# Alias for setup_local_full
setup:
	make setup_local_full

# Bootstrap setup from GitHub (prod)
setup_prod:
	cat software/bootstrap/setup.sh | bash

# Full setup from local files (installs dependencies via _full-setup.sh)
setup_local_full:
	./run --setup --force

# Refresh profile only from local files (no dependency install)
setup_local_profile:
	./run

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
format: format_build_include format_ci_binaries format_script_indexes format_jsdocs format_spec_cleanup format_shell format_prettier build_autocomplete_specs

# Format shell files with shfmt
format_shell:
	if ! type -P shfmt > /dev/null 2>&1; then
	  printf '%s\n' 'shfmt not found. Skipping shell formatting.'
	  exit 0
	fi
	shfmt -w -i $(TAB_SIZE) -bn -sr \
	  $$(find software/bootstrap software/scripts \( -name '*.sh' -o -name '*.bash' \) ! -name '*.ps1.bash') \
	  ./*.sh

# Process BEGIN/END block markers
format_build_include:
	node software/tools/build-include.js

# Generate CI binary verification list from software/metadata/ci-binaries.json
format_ci_binaries:
	node software/tools/generate-ci-binary-list.js

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

# Lint JS with oxlint (correctness rules; see .oxlintrc.json for disabled-rule rationale)
lint:
	npx oxlint .

################################################################################
# ---- Build ----
################################################################################

# Build all default steps (prebuild-hosts, build-configs, host-mappings)
build: build_prebuild_hosts build_configs build_host_mappings

# All default steps + webapp + postbuild
build_all: build build_webapp build_postbuild

# Prebuild host mappings
build_prebuild_hosts:
	./run --files="software/metadata/ip-address.config.js"

# Build JSON/config artifacts + autocomplete specs
build_configs:
	CI=true ./run --files="$$(grep -R -l 'writeBuildArtifact' 'software/' | grep -v 'index.js' | grep -v 'software/tests/' | grep -v 'software/scripts/.*/')"
	CI=true ./run --files="$$(ls software/metadata/autocomplete-spec-*.js 2>/dev/null | tr '\n' ' ')"

# Build autocomplete spec files (OS-independent, runs in ci_prep so changes land in the prep patch)
build_autocomplete_specs:
	CI=true ./run --files="$$(ls software/metadata/autocomplete-spec-*.js 2>/dev/null | tr '\n' ' ')"

# Build host mappings (skip in CI)
build_host_mappings:
	[ "$$CI" = "true" ] && exit 0
	./run --files="software/metadata/hosts-blocked-ads.config.js"

# Backup XFCE configuration (keyboard shortcuts, theming, panel) to .build/
backup_xcfe:
	bash software/tools/backup-xfce.sh

# Restore XFCE config from .build/tar-xcfe-config.tar.gz (dry-run unless ARGS=--apply)
restore_xcfe:
	node software/tools/restore-xfce-config.js $(RESTORE_ARGS)

# Build webapp for production
build_webapp:
	$(_BUILD_ENV) && npm run build

# Build the self-extracting single-file installer (.build/install-bashrc.sh).
# Bundles run + run.sh + software/{index.js,common.js,bootstrap,scripts,metadata}
# into one bash script with a base64-encoded tarball payload. CI mirrors
# the output to the binary-cache rolling release as
# bashrc-installer__install-bashrc.sh — end users can curl|bash a single URL
# with zero raw.githubusercontent.com fetches at runtime.
build_installer:
	node software/tools/build-installer.js

# Build the single-file, offline text-server (.build/_text-server/text-server): the Node
# server with its UI page embedded and every CDN stylesheet/script/CodeMirror mode inlined.
# Run it with `./text-server <folder> [<port>] [<allow_cd 0|1>]`. CI mirrors it to the
# binary-cache rolling release as text-server__text-server.
build_text_server:
	node software/tools/build-text-server.js

# Build pinned Decky plugins/themes from upstream, including provenance metadata.
# CI overrides output into RUNNER_TEMP; never commit the generated ZIP.
DECKY_BUNDLE_OUTPUT ?= .build/steamos-decky__bundle.zip
build_decky_bundle:
	node software/tools/decky-bundle.js "$(DECKY_BUNDLE_OUTPUT)"

# Render every generated editor theme into .build/_theme-preview.{html,png}.
# The unit tests assert contrast floors for the pairs someone listed; this
# renders the surfaces where two colors sit side by side, so a collision no
# assertion covers is still obvious on sight. Pass --html to skip puppeteer.
preview_themes:
	node software/tools/preview-themes.js

# Copy build artifacts to dist
build_postbuild:
	@cp .build/font-preview.html dist/font-preview.html 2>/dev/null || true

# Update /etc/hosts (extra, opt-in)
build_update_hosts:
	./run --files="software/metadata/hosts-blocked-ads.config.js"

################################################################################
# ---- Test ----
################################################################################

# Run unit tests
test_unit:
	npm test

# Run unit tests with istanbul coverage. Outputs ./coverage (HTML + JSON summary +
# coverage-final.json) and prints a text + text-summary table. Gates against the
# baseline thresholds defined in vitest.config.js — CI uses this to fail the
# build if coverage regresses, and the job summary step reads coverage-summary.json
# to render the Coverage section.
test_coverage:
	npm test -- --coverage

# Benchmark interactive shell startup (bash -i -c exit); fails when the median
# exceeds the budget. Override with: make bench_profile BENCH_ARGS="--runs=20 --budget-ms=300"
bench_profile:
	node software/tools/bench-profile.js $(BENCH_ARGS)

# Run profile syntax tests
test_profile:
	npm run test:profile

# Run integration tests against the live site
test_integration:
	npm run test:integration

# Run integration tests against the locally compiled dist
test_integration_local:
	npm run test:integration:local

# Run build config shape tests
test_buildconfig:
	npm run test:buildconfig

# Update build config shape inline snapshots
test_buildconfig_update:
	npm run test:buildconfig:update

# Run dry-run setup test (JS scripts only, no file writes or installs).
# Gates on run.sh's exit code plus per-script "error" statuses in run_timing.json
# (software/tools/check-dryrun-results.js), not on grepping log text.
# Temp roots mirror run.sh `_resolve_temp_root` (/tmp, else mktemp parent, else $HOME/tmp) + synle/bashrc.
test_dryrun:
	dryrun_log=$$(mktemp -t bashrc_dryrun_test.XXXXXX)
	dryrun_start_ms=$$(node -e 'process.stdout.write(String(Date.now()))')
	./run --dryrun --setup 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tee "$$dryrun_log"
	run_status=$${PIPESTATUS[0]}
	if [ "$$run_status" -ne 0 ]; then printf '%s\n' "FAIL: ./run --dryrun exited $$run_status (log: $$dryrun_log)"; exit 1; fi
	printf '%s\n' ">> Checking dry run results for errors..."
	probe_folder=$$(mktemp -d); rmdir "$$probe_folder"
	node software/tools/check-dryrun-results.js "$$dryrun_start_ms" /tmp/synle/bashrc "$$(dirname "$$probe_folder")/synle/bashrc" "$$HOME/tmp/synle/bashrc" || exit 1
	printf '%s\n' ">> Dry run test passed"

# Run all test suites (unit, profile, integration, buildconfig, dryrun, shellcheck)
test_all: test_unit test_profile test_integration test_buildconfig test_dryrun ci_test_shellcheck

test: test_all

################################################################################
# ---- Workflow ----
################################################################################

# Quiet local agent gate; keep other diagnostics and npm's failure status intact.
precommit: lint
	npm test -- --reporter=dot --silent=passed-only 2> >(command grep -v '^>>> Decky ' >&2)

# Optional shell portability checks run after required validation and never gate this target.
# Set VALIDATE_SHELL_AGNOSTIC=0 to skip this step.
VALIDATE_SHELL_AGNOSTIC ?= 1

# Verbose full local/CI gate; do not inherit precommit's quiet reporter overrides.
validate: format lint test_unit test_buildconfig build_webapp test_integration_local test_dryrun ci_test_shellcheck
	case "$(VALIDATE_SHELL_AGNOSTIC)" in
	  1) $(MAKE) --no-print-directory validate_shell_agnostic_best_effort || printf '%s\n' '>> Optional shell portability step failed; continuing validation.' ;;
	  0) printf '%s\n' '>> Optional shell portability step skipped.' ;;
	  *) printf '%s\n' 'ERROR: VALIDATE_SHELL_AGNOSTIC must be 0 or 1.' >&2; exit 2 ;;
	esac
	make test_profile 2>&1 || { printf '%s\n' "FAIL: test_profile failed — check profile blocks above for syntax errors"; exit 1; }

# Optional static checks; omitted files uses the saved collector list.
# Explicit files is one literal path or a JSON array. The validate wrapper keeps each failure visible and continues.
# These checks are not part of precommit, test_all, or CI.
.PHONY: collect_shell_agnostic_files validate_shell_prep validate_shell_agnostic_best_effort validate_shell_agnostic _shell_agnostic_force
collect_shell_agnostic_files:
	node software/tools/collect-shell-agnostic-files.js

validate_shell_prep: collect_shell_agnostic_files

validate_shell_agnostic_best_effort:
	@$(MAKE) --no-print-directory validate_shell_prep || { printf '%s\n' '>> Shell source preparation failed; skipping checks and continuing.'; exit 0; }
	for rule in printf quoting options syntax; do
	  printf '>> Optional shell portability check: %s\n' "$$rule"
	  if ! $(MAKE) --no-print-directory "validate_shell_agnostic_$$rule"; then
	    printf '%s\n' ">> Shell portability $$rule check failed; continuing. Diagnostics remain above."
	  fi
	done

_shell_agnostic_force:

validate_shell_agnostic: export SHELL_AGNOSTIC_FILES = $(files)
validate_shell_agnostic:
	node software/tools/validate-shell-agnostic.js all

# Rule names are validated by the tool; env transport avoids shell interpolation.
validate_shell_agnostic_%: export SHELL_AGNOSTIC_FILES = $(files)
validate_shell_agnostic_%: export SHELL_AGNOSTIC_RULE = $*
validate_shell_agnostic_%: _shell_agnostic_force
	node software/tools/validate-shell-agnostic.js

# Format + build webapp (used by CI workflow)
prep: format build_webapp

# Run unit tests + dry-run all scripts (no file writes)
dry_run: test_unit
	./run --dryrun --setup

# Alias for dry_run
start: dry_run

# Alias for dry_run
run: dry_run

# Alias for build_update_hosts
build_hosts: build_update_hosts

################################################################################
# ---- CI ----
################################################################################

# CI Phase 1: Format code, build autocomplete specs, build webapp, integration test local, dry-run test, build installer + text-server bundle, and download release binaries
ci_prep: clean_artifacts clean_prebuilt_profiles format build_autocomplete_specs build_webapp ci_test_integration_local test_dryrun build_installer build_text_server ci_download_release_binaries

# Mirror latest release binaries (url-porter, sqlui-native, display-dj, skiff-files, proxie)
# into the binary-cache rolling release on synle/bashrc. No local files are written —
# downloadAssetWithFallback() in software/index.js fetches the cache from that release URL.
ci_download_release_binaries:
	bash software/tools/ci-download-release-binaries.sh

# CI Phase 2: Build configs and run scripts with --setup to install dependencies via _full-setup.sh
ci_build: build_prebuild_hosts build_configs build_host_mappings
	CI=true ./run --setup --force --verbose

# CI Phase 3: Run all tests

# Run unit tests (CI, dot reporter)
ci_test_unit:
	npm test -- --reporter=dot

# Run profile syntax tests (CI, dot reporter)
ci_test_profile:
	npm run test:profile -- --reporter=dot

# Run integration tests against the live site (CI, dot reporter)
ci_test_integration:
	npm run test:integration -- --reporter=dot

# Run integration tests against the locally compiled dist (CI, dot reporter)
ci_test_integration_local:
	npm run test:integration:local -- --reporter=dot

# Run build config shape tests (CI, dot reporter)
ci_test_buildconfig:
	npm run test:buildconfig -- --reporter=dot

# Run unit tests with coverage (CI, dot reporter). Same gate as `make test_coverage`
# but quieter — feeds `coverage/coverage-summary.json` into the CI job summary step.
ci_test_coverage:
	npm test -- --coverage --reporter=dot

# Run shellcheck on all shell scripts + bash-3.2 runtime compatibility lint.
# bash -n (profileSyntax.spec.js) catches parse errors ([[ -v VAR ]], ${var,,},
# declare -A, coproc, ${var@Q}) — these already fail in test_profile.
# mapfile/readarray (bash 4.0+) and wait -n (bash 4.3+) parse fine on bash 3.2
# but fail at runtime, so we catch them separately here. `&>>` (bash 4.0+) is a
# hard PARSE error on 3.2 — it is listed here rather than left to bash -n because
# CI Linux runners have no bash 3.2 to check against, so the textual ban is the
# only guard that actually runs everywhere. Use `>> "$log" 2>&1` instead.
# Comments are stripped before matching so that prose mentioning `mapfile`
# (e.g. "portable equivalent of mapfile") is not flagged.
#
# shellcheck is ADVISORY (|| true) — it reports but never fails the build. There
# is a pre-existing backlog of error-level findings that are intentional:
# dynamic test operators (`[ "$flag" "$entry" ]`), template/skeleton files that
# aren't valid bash on their own, and deliberate `$@` splatting in the
# installXxxPackage helpers. Clearing that backlog is the prerequisite for
# promoting this to a gating check. The bash-3.2 lint below IS gating.
ci_test_shellcheck:
	if type -P shellcheck > /dev/null 2>&1; then \
	  shellcheck -s bash -e SC1090,SC1091,SC2154,SC2086,SC2016 \
	    $$(find software/bootstrap software/scripts \( -name '*.sh' -o -name '*.bash' \) ! -name '*.ps1.bash') \
	    ./*.sh || printf '%s\n' ">> shellcheck reported findings (advisory, not gating)"; \
	else \
	  printf '%s\n' 'shellcheck not found. Skipping shellcheck.'; \
	fi
	violations=""; \
	for f in $$(find software/bootstrap/ software/scripts/ \( -name '*.sh' -o -name '*.bash' \)); do \
	  if sed 's/#.*//' "$$f" | command grep -qE '(^|[^A-Za-z0-9_.`-])(mapfile|readarray)([^A-Za-z0-9_-]|$$)|wait[[:space:]]+-n([^A-Za-z0-9_-]|$$)|&>>'; then \
	    violations="$$violations$$f\n"; \
	  fi; \
	done; \
	if [ -n "$$violations" ]; then \
	  printf '%s\n' "ERROR: bash-3.2 runtime-incompatible feature found in:"; \
	  printf '%b' "$$violations"; \
	  exit 1; \
	fi; \
	printf '%s\n' "bash-3.2 runtime lint: PASS"

# Run all CI test suites
ci_test_all: ci_test_unit ci_test_profile ci_test_integration ci_test_buildconfig ci_test_shellcheck

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
	  printf '%s\n' "  >> Cleaned autogen note from $$file"
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
	  ~/.fzf \
	  ~/.fzf.bash \
	  ~/.powershell_syle \
	  ~/.bashrc.bak* \
	  ~/.bash_history_backups* \
	  ~/.bash_history.tmp.* \
	  ~/.gitconfig.bak_* \
	  ~/.gitignore_global.bak_* \
	  ~/.inputrc.bak_* \
	  ~/.vimrc.bak_* \
	  ~/.deno \
	  ~/.fzf-tab-completion \
	  && printf '%s\n' 'Done cleaning up folders'
	# ~/.bash_syle_* above also sweeps the legacy pre-_extra locations
	# ~/.bash_syle_paths.* and ~/.bash_syle_recent_files.* left by the one-time
	# migration to $SY_ROOT_FOLDER. The live copies live under ~/_extra and are spared.
	# Config-backup pairs (<file>.bak_original / .bak_latest for .gitconfig, .vimrc,
	# .inputrc, …) are left in place: backupConfigFile() already drops a redundant
	# .bak_latest on each run, and the .bak_original is the pristine pre-setup
	# snapshot worth keeping for a restore.
	# ~/_extra is deliberately NOT nuked: it is the personal root (SY_ROOT_FOLDER),
	# and ai_llm/plans holds authored plan files no re-run can regenerate.
	# Wipe every pulled Ollama model (the multi-GB blobs) via the recipe documented in
	# llm-common.js; ollama.exe covers WSL, where models live on the Windows host.
	# The binary itself stays. No daemon / no binary → nothing to remove.
	for _ollama in ollama ollama.exe; do
	  type -P "$$_ollama" > /dev/null || continue
	  "$$_ollama" list 2> /dev/null | tr -d '\r' | awk 'NR > 1 { print $$1 }' | while IFS= read -r _model; do
	    printf '%s\n' ">> Removing Ollama model: $$_model"
	    "$$_ollama" rm "$$_model" > /dev/null || printf '%s\n' ">> Failed to remove Ollama model: $$_model"
	  done
	done
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
	  printf '%s\n' "ERROR: git-filter-repo is not installed."
	  printf '%s\n' "Install with:  brew install git-filter-repo   (macOS)"
	  printf '%s\n' "          or:  pip install git-filter-repo    (cross-platform)"
	  exit 1
	fi
	printf '%s\n' "$(DIVIDER)"
	printf '%s\n' "git filter-repo DRY RUN — no changes will be made"
	printf '%s\n' "$(DIVIDER)"
	printf '%s\n' ">> Current .git size:  $$(du -sh .git | cut -f1)"
	printf '%s\n' ""
	printf '%s\n' ">> Paths targeted for removal:"
	for p in $(HISTORY_CLEANUP_PATHS); do
	  printf '%s\n' "     - $$p"
	done
	printf '%s\n' ""
	printf '%s\n' ">> Per-path totals across ALL history (files + bytes):"
	blobs=$$(mktemp)
	git rev-list --objects --all \
	  | git cat-file --batch-check='%(objectname) %(objecttype) %(objectsize) %(rest)' \
	  | awk '$$2 == "blob" && $$4 != "" {print $$3, $$4}' > "$$blobs"
	for p in $(HISTORY_CLEANUP_PATHS); do
	  awk -v prefix="$$p" '$$2 ~ "^" prefix {sum+=$$1; cnt++} END {printf "     %-28s %5d files   %8.1f MB\n", prefix, cnt, sum/1048576}' "$$blobs"
	done
	rm -f "$$blobs"
	printf '%s\n' ""
	printf '%s\n' ">> GitHub releases that will be deleted:"
	if command -v gh > /dev/null 2>&1; then
	  gh release list --limit 1000 | awk '{print "     - " $$1}'
	else
	  printf '%s\n' "     (gh CLI not found — skipping release cleanup)"
	fi
	printf '%s\n' ""
	printf '%s\n' ">> To perform the rewrite:  make clean_git_history"

# Rewrite git history to remove HISTORY_CLEANUP_PATHS. DESTRUCTIVE.
# Backs up to a git bundle under /tmp/ first, then prompts for explicit confirmation.
# After the rewrite you must manually:  git remote add origin <url>  +  git push --force-with-lease --all --tags
clean_git_history:
	if ! command -v git-filter-repo > /dev/null 2>&1; then
	  printf '%s\n' "ERROR: git-filter-repo is not installed."
	  printf '%s\n' "Install with:  brew install git-filter-repo   (macOS)"
	  printf '%s\n' "          or:  pip install git-filter-repo    (cross-platform)"
	  exit 1
	fi
	if ! git diff --quiet || ! git diff --cached --quiet; then
	  printf '%s\n' "ERROR: working tree has uncommitted changes. Commit or stash first."
	  exit 1
	fi
	remote_url=$$(git remote get-url origin 2> /dev/null || true)
	backup="/tmp/bashrc-history-backup-$$(date +%Y%m%d-%H%M%S).bundle"
	printf '%s\n' "$(DIVIDER)"
	printf '%s\n' "DESTRUCTIVE: about to rewrite git history"
	printf '%s\n' "$(DIVIDER)"
	printf '%s\n' ">> Backup bundle:        $$backup"
	printf '%s\n' ">> Current .git size:    $$(du -sh .git | cut -f1)"
	printf '%s\n' ">> Origin URL (saved):   $$remote_url"
	printf '%s\n' ">> Paths to strip:"
	for p in $(HISTORY_CLEANUP_PATHS); do
	  printf '%s\n' "     - $$p"
	done
	printf '%s\n' ""
	printf "Type 'rewrite' to confirm: "
	read ans
	[ "$$ans" = "rewrite" ] || { printf '%s\n' "Aborted."; exit 1; }
	printf '%s\n' ">> Creating backup bundle..."
	git bundle create "$$backup" --all
	printf '%s\n' ">> Running git-filter-repo..."
	git filter-repo --force --invert-paths $(foreach p,$(HISTORY_CLEANUP_PATHS),--path $(p))
	printf '%s\n' ">> Aggressive gc..."
	git reflog expire --expire=now --all
	git gc --prune=now --aggressive
	printf '%s\n' ""
	printf '%s\n' ">> Deleting remote releases and tags..."
	if command -v gh > /dev/null 2>&1; then
	  for tag in $$(gh release list --limit 1000 | awk '{print $$1}'); do
	    printf '%s\n' "   Deleting release and tag: $$tag"
	    gh release delete "$$tag" --cleanup-tag --yes
	  done
	else
	  printf '%s\n' "   gh CLI not found — skipping release cleanup"
	fi
	printf '%s\n' ""
	printf '%s\n' ">> Done. New .git size:  $$(du -sh .git | cut -f1)"
	printf '%s\n' ""
	printf '%s\n' ">> NEXT STEPS (filter-repo removed the remote as a safety measure):"
	if [ -n "$$remote_url" ]; then
	  printf '%s\n' "   1. Re-add origin:      git remote add origin $$remote_url"
	else
	  printf '%s\n' "   1. Re-add origin:      git remote add origin <url>"
	fi
	printf '%s\n' "   2. Force-push main:    git push --force-with-lease --all"
	printf '%s\n' "   3. Force-push tags:    git push --force-with-lease --tags"
	printf '%s\n' "   4. Backup bundle:      $$backup  (restore with 'git clone <bundle> restored')"

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
	  printf '%s\n' "No backup found at ~/.bash_syle.bak"
	  exit 1
	fi
	cp ~/.bash_syle.bak ~/.bash_syle
	printf '%s\n' "Restored ~/.bash_syle from backup. Run 'source ~/.bash_syle' to reload."

