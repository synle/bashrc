#!/usr/bin/env bash
####################################################################
# clean.sh - Clean build artifacts from source files
#
# Cleans:
#   - Auto-generated file notes from build output files
#   - JSDoc reference tags from JS files
#   - BEGIN/END block inclusions from sh/md files
#
# Usage:
#   bash clean.sh                        # Clean all
#   bash clean.sh build.sh run.sh        # Clean specific files (inclusions only)
####################################################################

echo '> Running clean-autogen-notes'
git ls-files | while read -r file; do
  [ "$file" = "software/index.js" ] && continue
  head -1 "$file" | grep -q 'NOTE: STOP - do not edit by hand - this file is auto-generated' || continue

  # detect comment prefix from the note line (// or #)
  prefix=$(head -1 "$file" | grep -o '^[/#]*')

  # remove the note line
  tail -n +2 "$file" > "$file.tmp" && mv "$file.tmp" "$file"

  # remove leading lines that are just the comment prefix (empty comment lines)
  while head -1 "$file" | grep -qx "$prefix[[:space:]]*"; do
    tail -n +2 "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  done

  echo "  >> Cleaned autogen note from $file"
done

echo '> Running clean-jsdocs'
node software/build-jsdocs.cjs --clean

echo '> Running clean-include'
node software/build-include.cjs --clean "$@"
