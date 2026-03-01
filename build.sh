#!/usr/bin/env bash
{
################################################################################
# ---- build.sh - Build pipeline with selectable steps ----
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
################################################################################

# All valid step names
ALL_STEPS="jsdocs script-indexes prebuild-hosts build-configs host-mappings backup-xfce webapp"

################################################################################
# ---- Parse arguments ----
################################################################################
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
function should_run() { case " $_normalized " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

echo "Steps to run: $_normalized"

# BEGIN bootstrap/common-env.sh

# END bootstrap/common-env.sh


# build.sh always runs locally
export IS_TEST_SCRIPT_MODE=1

install_fnm_node

echo '< build.sh'
############################################################################################
# ---- step: jsdocs - Build JSDocs for JS Code ----
############################################################################################
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

############################################################################################
# ---- step: script-indexes - Generate Script List Indexes ----
############################################################################################
if should_run script-indexes; then
echo '> Generate Script List Indexes'
export SCRIPT_INDEX_CONFIG_FILE="software/metadata/script-list.config" && \
run_files "software/metadata/script-list.js"
cat $SCRIPT_INDEX_CONFIG_FILE
fi

############################################################################################
# ---- step: prebuild-hosts - Prebuild Host Mappings ----
############################################################################################
if should_run prebuild-hosts; then
echo '> Prebuilding Host Mappings'
run_files "software/metadata/ip-address.config.js"
fi

############################################################################################
# ---- step: build-configs - Build Raw JSON and Config Artifacts ----
# Compile common configs used for sublime and vscode keybindings.
# Only process files containing the method "writeToBuildFile".
############################################################################################
if should_run build-configs; then
echo '> Build raw JSON and raw JSON configs'
CONFIG_BUILD_PATH="./.build"
mkdir -p $CONFIG_BUILD_PATH
export DEBUG_WRITE_TO_DIR="$CONFIG_BUILD_PATH" && \
run_files "$(grep -R -l 'writeToBuildFile' 'software/' | grep -v 'index.js')"
echo '>> Built Configs:'
find $CONFIG_BUILD_PATH
unset DEBUG_WRITE_TO_DIR DEBUG_WRITE_TO_DIR
fi

############################################################################################
# ---- step: host-mappings - Build Host Mappings (skip in CI) ----
############################################################################################
if should_run host-mappings && [ "$CI" != "true" ]; then
echo '> Build Host Mappings'
run_files "software/metadata/hosts-blocked-ads.config.js"
fi

############################################################################################
# ---- step: backup-xfce - Backup XFCE Configuration (if applicable) ----
############################################################################################
if should_run backup-xfce && [ -d "$HOME/.config/xfce4" ]; then
  echo "Backing up XFCE configuration..."
  mkdir -p ./linux
  tar -czf ./linux/xfce-config.tar.gz \
    -C "$HOME/.config" xfce4
  echo "Backup complete: ./linux/xfce-config.tar.gz"
fi

############################################################################################
# ---- step: webapp - Build Web App ----
############################################################################################
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

exit
}
