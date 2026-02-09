#! /bin/sh
echo '>> Formatting Plain Text (md txt sh ps1 config...)'
PATTERNS=(
  "*.md"
  "*.txt"
  "*.sh"
  "*.ps1"
  "*.config"
  ".gitignore"
  ".prettierignore"
)

# Build the find arguments for file extensions
name_args=()
for i in "${!PATTERNS[@]}"; do
    name_args+=("-name" "${PATTERNS[$i]}")
    if [ $i -lt $((${#PATTERNS[@]} - 1)) ]; then
        name_args+=("-o")
    fi
done

# find .
# -type d \( -path "./node_modules" -o -name ".git" \) -prune : Skips these directories entirely
# -type f \( "${name_args[@]}" \) : Looks for your specific file patterns
find . -type d \( -path "./node_modules" -o -name ".git" \) -prune -o -type f \( "${name_args[@]}" \) -print | while read -r file; do

    # Print the absolute path
    echo "$(readlink -f "$file")"

    # Removes trailing spaces and tabs only.
    # Does NOT delete empty lines or modify leading indentation.
    sed -i 's/[ \t]*$//' "$file"

done
echo '>> DONE Formatting Plain Text (md txt sh ps1 config...)'


echo '>> Formatting JS Scripts'
npm run format
echo '>> DONE Formatting JS Scripts'
