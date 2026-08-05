/** Shared helper for font scripts — lists font files from the repo with fallthrough. */

/** Repo-relative folder holding every shipped font file. */
const FONTS_REPO_FOLDER = "assets/fonts";

/**
 * Lists every font (.ttf/.otf) shipped in the repo, as repo-relative paths.
 *
 * A local checkout already has every font on disk, so it is listed straight from
 * `assets/fonts/` — the remote path calls the GitHub trees API with a cache-buster, which
 * costs a network round-trip on every single run and spends one of the 60/hr anonymous
 * rate-limit calls. When that limit is exhausted the API returns an error instead of a
 * tree, `getFonts()` yields an empty list, and the script silently reports
 * "Skipped : No fonts found" — so the remote call is both the slow path and the fragile
 * one. `listRepoDir("local")` cannot serve this: `filterRepoScripts` drops everything
 * outside `software/` and everything that is not `.js`/`.sh`, so fonts never survive it.
 *
 * The sorted local listing is byte-identical to the trees-API ordering, which matters
 * because this list feeds the committed `.build/font.sh` artifact and the font preview
 * HTML — a different order would churn generated output on every run.
 *
 * The remote call is kept as the fallback for the bootstrap case, where the script runs
 * straight from GitHub with no checkout on disk.
 * @returns {Promise<string[]>} Array of font file paths (ttf/otf) from the repo
 */
async function getFonts() {
  if (IS_LOCAL_REPO && fs.existsSync(FONTS_REPO_FOLDER)) {
    return fs
      .readdirSync(FONTS_REPO_FOLDER)
      .filter((f) => f.endsWith(".ttf") || f.endsWith(".otf"))
      .sort()
      .map((f) => `${FONTS_REPO_FOLDER}/${f}`);
  }

  const files = await listRepoDir("remote_api", true);
  return files.filter((f) => f.endsWith(".ttf") || f.endsWith(".otf"));
}
