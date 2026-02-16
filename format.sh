FORMAT_SCRIPT_URL=https://raw.githubusercontent.com/synle/gha-workflow/refs/heads/main/format.sh
echo ">> formatting script: $FORMAT_SCRIPT_URL"
curl -s "$FORMAT_SCRIPT_URL" | bash - > /dev/null 2>&1
