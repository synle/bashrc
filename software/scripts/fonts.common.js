/** Shared helper for font scripts — lists font files from the repo with fallthrough. */
/** @returns {Promise<string[]>} Array of font file paths (ttf/otf) from the repo */
async function getFonts() {
  const files = await listRepoDir("remote_api", true);
  return files.filter((f) => f.endsWith(".ttf") || f.endsWith(".otf"));
}
