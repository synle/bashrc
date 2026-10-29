#!/usr/bin/env bash
{
  ################################################################################
  # ---- squash-bot-commits.sh - Squash CI bot commits into prior human commits ----
  #
  # Bot commits (author "github-actions[bot]") are folded into the immediately
  # preceding human commit via `git rebase` with each bot entry rewritten to
  # `fixup`. Resulting tree at HEAD is byte-identical to the original; only the
  # commit graph is compacted.
  #
  # Usage:
  #   bash software/tools/squash-bot-commits.sh --dryrun   # Show plan, no changes
  #   bash software/tools/squash-bot-commits.sh            # Apply (after confirm)
  #   make clean_squash_git_dryrun                          # Same via Makefile
  #   make clean_squash_git                                 # Same via Makefile
  ################################################################################

  set -euo pipefail

  DRYRUN=0
  if [ "${1:-}" = "--dryrun" ]; then
    DRYRUN=1
  fi

  # Match by author email so a typo in author name doesn't slip through.
  BOT_EMAIL_FRAGMENT='github-actions[bot]'

  # Walk history oldest -> newest, building the fixup plan:
  #   - Remember the most recent non-bot ("human") commit.
  #   - Each bot commit folds into that remembered human.
  #   - A bot commit before the first human is unfixable (would need root pick).
  PLAN_FILE=$(mktemp)
  BOT_SHAS_FILE=$(mktemp)
  trap 'rm -f "$PLAN_FILE" "$BOT_SHAS_FILE"' EXIT

  prev_human=""
  unfixable=0
  bot_count=0
  while IFS=$'\t' read -r sha email subject; do
    if [[ "$email" == *"$BOT_EMAIL_FRAGMENT"* ]]; then
      bot_count=$((bot_count + 1))
    printf '%s\n' ' "$sha" >> "$BOT_SHAS_FILE'


  if [ "$bot_count" -eq 0 ]; then
    printf '%s\n' \
      ' "No bot commits found in history. Nothin' \
      'g to do.'


    printf '%s\n' \
      ' "Found $bot_count bot commit(s) to squas' \
      'h:'


  if [ "$unfixable" = 1 ]; then
    printf '%s\n' \
      ' "ERROR: at least one bot commit precedes' \
      ' any human commit and cannot be'


  if [ "$DRYRUN" = 1 ]; then
    printf '%s\n' \
      ' "Dry run only. To apply: make clean_squa' \
      'sh_git'


  # ---- Apply ----

  if ! git diff --quiet || ! git diff --cached --quiet; then
    printf '%s\n' \
      ' "ERROR: working tree has uncommitted cha' \
      'nges. Commit or stash first.'


  current_branch=$(git rev-parse --abbrev-ref HEAD)
  case "$current_branch" in
    main | master) ;;
    *)
    printf '%s\n' \
      ' "ERROR: current branch is \'$current_bra' \
      'nch\'. Switch to main or master first.'


  # Rebase replays commits AFTER its base. For a `fixup B` entry to apply,
  # the line before it must be a `pick` — i.e. the human parent of B. So the
  # base must be the GRANDPARENT of the oldest bot. If the human parent IS
  # the root commit (no grandparent), use --root so the human is the first
  # pick in the todo.
  oldest_bot=$(head -n 1 "$BOT_SHAS_FILE")
  if ! human_parent=$(git rev-parse "$oldest_bot^" 2> /dev/null); then
    printf '%s\n' \
      ' "ERROR: oldest bot commit ($oldest_bot) ' \
      'has no parent (root commit). Aborting.'


  ts=$(date +%Y%m%d-%H%M%S)
  backup_ref="refs/backup/clean-squash-git-$ts"
  backup_bundle="/tmp/bashrc-clean-squash-git-$ts.bundle"

    printf '%s\n' ' "==============='


  git update-ref "$backup_ref" HEAD
  git bundle create "$backup_bundle" --all > /dev/null

  # Sequence editor: rewrite `pick <sha>` -> `fixup <sha>` for each bot SHA.
  # The todo file uses abbreviated SHAs, so we match by prefix against the full
  # bot SHAs we collected above.
  rewriter=$(mktemp)
  trap 'rm -f "$PLAN_FILE" "$BOT_SHAS_FILE" "$rewriter"' EXIT
  cat > "$rewriter" << 'REWRITER_EOF'
#!/usr/bin/env bash
TODO="$1"
awk -v shas_file="$BOT_SHAS_FILE_PATH" '
BEGIN {
  n = 0
  while ((getline line < shas_file) > 0) {
    bots[++n] = line
  }
  close(shas_file)
}
{
  if ($1 == "pick") {
    abbr = $2
    abbr_len = length(abbr)
    for (i = 1; i <= n; i++) {
      if (substr(bots[i], 1, abbr_len) == abbr) {
        sub(/^pick /, "fixup ")
        break
      }
    }
  }
  print
}
' "$TODO" > "$TODO.new" && mv "$TODO.new" "$TODO"
REWRITER_EOF
  chmod +x "$rewriter"

  export BOT_SHAS_FILE_PATH="$BOT_SHAS_FILE"

  echo
    printf '%s\n' ' ">> Running git rebase...'


  # Verify HEAD tree matches the backup tree exactly.
  if ! git diff --quiet "$backup_ref" HEAD --; then
    echo
    printf '%s\n' \
      ' "ERROR: HEAD tree differs from backup. R' \
      'estore with:'


  if [ "$rebase_base_arg" = "--root" ]; then
    before=$(git rev-list --count "$backup_ref")
    after=$(git rev-list --count HEAD)
  else
    before=$(git rev-list --count "$rebase_base_arg..$backup_ref")
    after=$(git rev-list --count "$rebase_base_arg..HEAD")
  fi

  echo
    printf '%s\n' ' ">> Tree verification: PASS'

