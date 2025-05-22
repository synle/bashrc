#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

################################################################################
# ---- PATH Setup ----
#
# No user-callable functions. Assembles PATH from a candidate list:
# prepend user tools, dedupe (first-seen wins), prune non-existent dirs.
#
# path_candidates array is the single source of truth for binary paths.
# Edit it when adding tools that install to non-standard locations.
################################################################################

# Shared PATH candidates array. Single source of truth for both:
#   - profile-core.sh (inlined via BEGIN/END build-include)
#   - .github/actions/ci-build/action.yml (sourced directly)
# When adding a new tool/package, add its binary path here if
# it installs to a non-standard location (e.g. ~/.tool/bin, /opt/...).
path_candidates=(
  ################################################################################
  # ---- user tools first (take precedence over system packages) ----
  ################################################################################
  ~/.fzf/bin # fzf fuzzy finder
  # ---- node / javascript ----
  ~/.local/share/fnm # fnm (fast node manager)
  ~/.volta/bin       # volta node version manager
  ~/.bun/bin         # bun javascript runtime
  ~/.deno/bin        # deno javascript runtime
  # ---- go ----
  /usr/local/go/bin # go sdk
  ~/go/bin          # go binaries (GOPATH)
  # ---- rust ----
  ~/.cargo/bin # rust / cargo
  # ---- python ----
  ~/miniconda3/bin      # miniconda python
  ~/miniconda3/condabin # conda command
  # ---- cli tools ----
  ~/.claude/bin     # claude cli
  ~/.local/bin      # pip / user-local binaries
  ~/.temporalio/bin # temporal cli
  # ---- mac (before system dirs so homebrew bash/tools take priority) ----
  /opt/homebrew/opt/make/libexec/gnubin                             # gnu make 4+ (mac only, overrides macOS 3.81)
  /opt/homebrew/bin                                                 # homebrew (apple silicon)
  /opt/homebrew/sbin                                                # homebrew admin (apple silicon)
  /opt/homebrew/opt/mysql-client/bin                                # mysql client (homebrew keg-only)
  /usr/local/Homebrew/bin                                           # homebrew (intel mac)
  "/Applications/Visual Studio Code.app/Contents/Resources/app/bin" # vs code (code)
  "/Applications/Sublime Text.app/Contents/SharedSupport/bin"       # sublime text (subl)
  "/Applications/Zed.app/Contents/MacOS"                            # zed editor
  ################################################################################
  # ---- common system (both mac and linux) ----
  ################################################################################
  /usr/local/bin  # user-installed binaries
  /usr/local/sbin # local admin binaries
  /usr/bin        # standard unix binaries
  /usr/sbin       # standard unix admin binaries
  /bin            # core system binaries
  /sbin           # core system admin binaries
  # ---- linux / wsl ----
  /snap/bin        # snap packages
  /usr/games       # linux game binaries
  /usr/local/games # local game binaries
  /usr/lib/wsl/lib # wsl gpu / system libs
)

# build PATH from candidates in order (first entry = highest priority),
# then dedupe and prune non-existent directories — all in one pipeline
export PATH="$(
  {
    for p in "${path_candidates[@]}"; do echo "${p/#\~/$HOME}"; done
    echo "$PATH" | tr ':' '\n'
  } \
    | awk '!seen[$0]++' \
    | while IFS= read -r d; do [ -d "$d" ] && echo "$d"; done \
    | tr '\n' ':' | sed 's/:$//'
)"

unset path_candidates
