#!/usr/bin/env bash
{
####################################################################
# build.sh - Build pipeline with selectable steps
#
# Usage:
#   bash build.sh                                    # Run all steps
#   bash build.sh --steps="jsdocs,webapp"            # Run specific steps (comma-separated)
#   bash build.sh --steps="jsdocs webapp"            # Run specific steps (space-separated)
#   bash build.sh --steps="""                        # Run specific steps (multiline)
#     jsdocs
#     webapp
#   """
#   bash build.sh jsdocs webapp                      # Bare args treated as steps
#
# Available steps:
#   jsdocs          Build JSDocs for JS Code
#   script-indexes  Generate Script List Indexes
#   prebuild-hosts  Prebuild Host Mappings
#   build-configs   Build Raw JSON and Config Artifacts
#   host-mappings   Build Host Mappings (skip in CI)
#   backup-xfce     Backup XFCE Configuration (if applicable)
#   webapp          Build Web App
#   build-include   Update files with BEGIN/END block inclusions
####################################################################

# All valid step names
ALL_STEPS="jsdocs script-indexes prebuild-hosts build-configs host-mappings backup-xfce webapp build-include"

####################################################################
# Parse arguments
####################################################################
_steps_to_run=""
_parsing_into=""

for arg in "$@"; do
  case "$arg" in
    --steps=*|-steps=*)
      _val="${arg#*steps=}"
      if [ -n "$_val" ]; then
        _steps_to_run="${_steps_to_run:+$_steps_to_run,}$_val"
      fi
      _parsing_into="steps"
      ;;
    -*)
      _parsing_into=""
      ;;
    *)
      _target="${_parsing_into:-steps}"
      case "$_target" in
        steps) _steps_to_run="${_steps_to_run:+$_steps_to_run,}$arg" ;;
      esac
      ;;
  esac
done

# Normalize separators (commas, spaces, newlines) and filter invalid steps
_normalized=""
for step in $(echo "$_steps_to_run" | tr ',\n' ' '); do
  step=$(echo "$step" | xargs) # trim whitespace
  [ -z "$step" ] && continue
  case " $ALL_STEPS " in
    *" $step "*) _normalized="${_normalized:+$_normalized }$step" ;;
    *) echo "WARNING: Unknown step '$step', skipping" ;;
  esac
done

# If no steps specified, run all
if [ -z "$_normalized" ]; then
  _normalized="$ALL_STEPS"
fi

# Helper to check if a step should run
should_run() { case " $_normalized " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

echo "Steps to run: $_normalized"

# BEGIN bootstrap/common-env.sh
####################################################################
# common-env.sh - Shared environment setup for run.sh and build.sh
# Sets up repo identifiers, URL exports, OS detection flags,
# and writes ~/.bash_syle_common
####################################################################
export REPO_PATH_IDENTIFIER="synle/bashrc"
export REPO_BRANCH_NAME="master"
export BASH_SYLE='~/.bash_syle'
export BASH_SYLE_AUTOCOMPLETE='~/.bash_syle_autocomplete'
export BASH_SYLE_COMMON='~/.bash_syle_common'
export BASH_SYLE_PATH=$(eval echo $BASH_SYLE)
export BASH_SYLE_AUTOCOMPLETE_PATH=$(eval echo $BASH_SYLE_AUTOCOMPLETE)
export BASH_SYLE_COMMON_PATH=$(eval echo $BASH_SYLE_COMMON)
export BASH_PROFILE_CODE_REPO_RAW_URL="https://raw.githubusercontent.com/$REPO_PATH_IDENTIFIER/$REPO_BRANCH_NAME" # https://raw.githubusercontent.com/synle/bashrc/master

# environment toolings
export NODE_JS_VERSION="24"
export FNM_DIR="$HOME/.local/share/fnm"


# OS detection upfront
is_os_darwin_mac=0 && { [[ "$OSTYPE" == "darwin"* ]] || [ -d /Applications ]; } && is_os_darwin_mac=1
is_os_ubuntu=0 && command grep -Eiq "ID(_LIKE)?=(ubuntu|debian|mint)" /etc/os-release 2>/dev/null && is_os_ubuntu=1
is_os_chromeos=0 && { [ -f /dev/.cros_milestone ] || { command grep -qi "cros" /proc/version 2>/dev/null && ! command grep -qi "microsoft" /proc/version 2>/dev/null; }; } && is_os_chromeos=1
is_os_mingw64=0 && { [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]] || [ -d /mingw64 ]; } && is_os_mingw64=1
is_os_android_termux=0 && { [ -n "$TERMUX_VERSION" ] || [ -d /data/data/com.termux ]; } && is_os_android_termux=1
is_os_arch_linux=0 && command grep -Eiq "ID(_LIKE)?=(arch|steamos)" /etc/os-release 2>/dev/null && is_os_arch_linux=1
is_os_steamdeck=0 && [[ "$is_os_arch_linux" == "1" ]] && command grep -qi "ID=steamos" /etc/os-release 2>/dev/null && is_os_steamdeck=1
is_os_redhat=0 && command grep -Eiq "ID(_LIKE)?=(fedora|rhel|centos|rocky|alma)" /etc/os-release 2>/dev/null && is_os_redhat=1
is_os_window=0 && { [ -d /mnt/c/Windows ] || [ -d /c/Windows ]; } && is_os_window=1
is_os_wsl=0 && { [[ "$is_os_window" == "1" ]] || command grep -qi microsoft /proc/version 2>/dev/null; } && is_os_wsl=1

# Write resolved values to common file
os_flags=""
for var in $(compgen -v | grep '^is_os_'); do
  os_flags="$os_flags
export $var=${!var}"
  unset "$var"
done
unset var

echo """
####################################################################
# Auto-generated by common-env.sh (https://github.com/$REPO_PATH_IDENTIFIER/blob/$REPO_BRANCH_NAME/bootstrap/common-env.sh)
# Do not edit by hand as it will be overridden
####################################################################
$os_flags

export REPO_PATH_IDENTIFIER='$REPO_PATH_IDENTIFIER'
export REPO_BRANCH_NAME='$REPO_BRANCH_NAME'
export BASH_PROFILE_CODE_REPO_RAW_URL='$BASH_PROFILE_CODE_REPO_RAW_URL'
export BASH_SYLE='$BASH_SYLE'
export BASH_SYLE_AUTOCOMPLETE='$BASH_SYLE_AUTOCOMPLETE'
export BASH_SYLE_COMMON='$BASH_SYLE_COMMON'

alias osflags=\"env | grep '^is_os_.*=1' | awk -F= '{print \$1}'\"
""" > "$BASH_SYLE_COMMON_PATH"
[ -f "$BASH_SYLE_COMMON_PATH" ] && . "$BASH_SYLE_COMMON_PATH"


unset os_flags



### specific to CI mode - override echo to emit GitHub Actions groups
if [ "$CI" = "true" ]; then
    echo() {
        case "$*" in
            ">"*|"<"*)
                command echo "::endgroup::"
                local icons="" remainder="$*"
                while case "$remainder" in ">"*) icons="${icons}🚀" remainder="${remainder#?}" ;; *) false ;; esac; do :; done
                while case "$remainder" in "<"*) icons="${icons}⭐" remainder="${remainder#?}" ;; *) false ;; esac; do :; done
                command echo "::group::${icons}${remainder}"
                ;;
            *) command echo "$@" ;;
        esac
    }
fi
# END bootstrap/common-env.sh


echo '< build.sh'
##########################################################
# step: jsdocs - Build JSDocs for JS Code
##########################################################
if should_run jsdocs; then
echo '> Build JSDocs for JS Code'
# Generate .d.ts: preprocess index.js to strip require() calls, then run tsc
node -e '
const fs = require("fs");
let src = fs.readFileSync("software/index.js", "utf8");
src = src.replace(/^const (\w+) = require\("(\w+)"\);$/gm, (_, n, m) =>
  `/** @type {typeof import("${m}")} */\nconst ${n} = /** @type {any} */ (null);`);
src = src.replace(/^const (\w+) = require\("[^"]+"\)\.\w+\(\);?$/gm, (_, n) =>
  `const ${n} = "";`);
src = src.replace(/require\("[^"]+"\)/g, "({})");
fs.writeFileSync("/tmp/_index-for-tsc.js", src);
'
npx tsc /tmp/_index-for-tsc.js --declaration --allowJs --emitDeclarationOnly \
  --outDir /tmp/_dts-out --lib esnext --skipLibCheck --target esnext
cp /tmp/_dts-out/_index-for-tsc.d.ts software/index.d.ts
rm -rf /tmp/_index-for-tsc.js /tmp/_dts-out
fi

##########################################################
# step: script-indexes - Generate Script List Indexes
##########################################################
if should_run script-indexes; then
echo '> Generate Script List Indexes'
export SCRIPT_INDEX_CONFIG_FILE="software/metadata/script-list.config" && \
bash run.sh --files="software/metadata/script-list.js"
cat $SCRIPT_INDEX_CONFIG_FILE
fi

##########################################################
# step: prebuild-hosts - Prebuild Host Mappings
##########################################################
if should_run prebuild-hosts; then
echo '> Prebuilding Host Mappings'
bash run.sh --files="software/metadata/ip-address.config.js"
fi

##########################################################
# step: build-configs - Build Raw JSON and Config Artifacts
# Compile common configs used for sublime and vscode keybindings.
# Only process files containing the method "writeToBuildFile".
##########################################################
if should_run build-configs; then
echo '> Build raw JSON and raw JSON configs'
CONFIG_BUILD_PATH="./.build"
mkdir -p $CONFIG_BUILD_PATH
export DEBUG_WRITE_TO_DIR="$CONFIG_BUILD_PATH" && \
bash run.sh --files="$(grep -R -l 'writeToBuildFile' 'software/' | grep -v 'index.js')"
echo '>> Built Configs:'
find $CONFIG_BUILD_PATH
unset DEBUG_WRITE_TO_DIR DEBUG_WRITE_TO_DIR
fi

##########################################################
# step: host-mappings - Build Host Mappings (skip in CI)
##########################################################
if should_run host-mappings && [ "$CI" != "true" ]; then
echo '> Build Host Mappings'
bash run.sh --files="software/metadata/hosts-blocked-ads.config.js"
fi

##########################################################
# step: backup-xfce - Backup XFCE Configuration (if applicable)
##########################################################
if should_run backup-xfce && [ -d "$HOME/.config/xfce4" ]; then
  echo "Backing up XFCE configuration..."
  mkdir -p ./linux
  tar -czf ./linux/xfce-config.tar.gz \
    -C "$HOME/.config" xfce4
  echo "Backup complete: ./linux/xfce-config.tar.gz"
fi

##########################################################
# step: webapp - Build Web App
##########################################################
if should_run webapp; then
echo '> Building webapp'
echo '>> Installing npm dependencies'
npm install
echo '>> Building webapp with Vite'
npm run build
echo '>> Built webapp artifacts:'
find dist
echo '> DONE Building'
fi

##########################################################
# step: build-include - Update files with BEGIN/END block inclusions
##########################################################
if should_run build-include; then
echo '> Running build-include substitutions'
node software/build-include.cjs
fi

exit
}
