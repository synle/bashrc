/** Refresh SOURCE_BEGIN/SOURCE_END blocks in the bash profile by re-reading referenced source files. */

async function doWork() {
  log(">> Refreshing SOURCE blocks in", BASH_SYLE_PATH);

  // Read raw bytes directly. We can't rely on readText's auto-resolve here because
  // ~/.bash_syle has no file extension, so _SOURCE_COMMENT_PREFIXES lookup fails and
  // _resolveSourceIncludes returns content unchanged — SOURCE blocks never get re-fetched.
  const onDisk = fs.existsSync(BASH_SYLE_PATH) ? fs.readFileSync(BASH_SYLE_PATH, "utf8") : "";

  // Force SOURCE resolution by passing a synthetic ".sh" path to _resolveSourceIncludes.
  // The fake extension routes the function to "#" comment-prefix handling; the unique
  // path keeps the recursion guard from clashing with anything else readText is doing.
  let content = await _resolveSourceIncludes(BASH_SYLE_PATH + ".sh", onDisk);
  content = cleanupExtraWhitespaces(content);

  // Bypass writeText: its diff guard reads oldContent via readText, which on a properly-extensioned
  // file would re-resolve SOURCE blocks too — defeating the flush. Compare raw bytes against the
  // resolved content and write via _atomicWrite to guarantee a stale snapshot gets overwritten.
  if (onDisk.trim() === content.trim()) {
    log("<<<< Skipped [NotModified] oldContent=" + onDisk.length + " newContent=" + content.length, BASH_SYLE_PATH);
  } else {
    log("<<<< Updated [SourceRefresh] oldContent=" + onDisk.length + " newContent=" + content.length, BASH_SYLE_PATH);
    await _atomicWrite(BASH_SYLE_PATH, content);
  }

  log(">> SOURCE blocks refreshed in", BASH_SYLE_PATH);
}
