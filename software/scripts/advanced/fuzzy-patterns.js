/** Emits bash variables holding fuzzy file picker regex patterns derived from EDITOR_CONFIGS. */

/**
 * Registers a profile block setting `_IGNORED_FOLDER_PATTERNS`,
 * `_IGNORED_FOLDERS_JSON`, `_IGNORED_FILES_JSON`, and
 * `_FUZZY_TEXT_FILES_JSON` from `EDITOR_CONFIGS.{ignoredFoldersRegex,
 * ignoredFilesRegex, textFilesRegex}`. The block sources before
 * `bash-fzf.profile.bash` so the variables are set when `filter_unwanted` and
 * `_fuzzy_list_all` are defined; bash-fzf retains hardcoded fallbacks for
 * standalone-source scenarios (tests, minimal shells). The `_IGNORED_*_JSON`
 * vars (no `FUZZY_` prefix) are general-purpose and consumed by other
 * pipelines too (e.g. pack_text). Text-file allowlist stays under the
 * `_FUZZY_` namespace because it is fuzzy-picker-specific.
 */
async function doWork() {
  log(">> Fuzzy Filter Patterns:");

  const { ignoredFoldersRegex, ignoredFilesRegex, textFilesRegex } = EDITOR_CONFIGS;

  // The `code` tagged template literal calls `text()`, which unescapes `\\` → `\`. Each
  // interpolated value must therefore have its backslashes pre-doubled so the unescape
  // step restores them to the desired bash-source representation.
  const escapeBackslash = (s) => s.replace(/\\/g, "\\\\");

  // bash array literal — one quoted entry per line. Patterns contain `\.` which must be
  // emitted as `\\.` so single-quoted bash literal preserves the regex backslash.
  const folderArrayBody = ignoredFoldersRegex.map((p) => `  "${escapeBackslash(p)}"`).join("\n");

  // JSON literals — `JSON.stringify` already escapes regex `\` to `\\` (valid JSON);
  // pre-double once more so `text()`'s unescape brings the bash literal back to `\\`.
  const foldersJson = escapeBackslash(JSON.stringify(ignoredFoldersRegex));
  const filesJson = escapeBackslash(JSON.stringify(ignoredFilesRegex));
  const textJson = escapeBackslash(JSON.stringify(textFilesRegex));

  registerWithBashSyleProfile(
    "Fuzzy Filter Patterns",
    code`
      # Folder regex patterns — used by filter_unwanted (joined with | for grep -v -E)
      _IGNORED_FOLDER_PATTERNS=(
      ${folderArrayBody}
      )
      # JSON-encoded regex arrays — general-purpose (consumed by _fuzzy_list_all,
      # pack_text, and any other pipeline that needs the centralized exclusions)
      _IGNORED_FOLDERS_JSON='${foldersJson}'
      _IGNORED_FILES_JSON='${filesJson}'
      # Text-file allowlist — fuzzy-picker-specific (text_files mode in _fuzzy_list_all)
      _FUZZY_TEXT_FILES_JSON='${textJson}'
    `,
  );
}
