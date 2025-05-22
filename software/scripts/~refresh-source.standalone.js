/** Refresh SOURCE_BEGIN/SOURCE_END blocks in the bash profile by re-reading referenced source files. */

async function doWork() {
  log(">> Refreshing SOURCE blocks in", BASH_SYLE_PATH);

  // readText resolves SOURCE markers in-memory (expands SOURCE_BEGIN/SOURCE_END with fresh file content)
  let content = await readText`${BASH_SYLE_PATH}`;
  content = cleanupExtraWhitespaces(content);
  await writeText(BASH_SYLE_PATH, content);

  log(">> SOURCE blocks refreshed in", BASH_SYLE_PATH);
}
