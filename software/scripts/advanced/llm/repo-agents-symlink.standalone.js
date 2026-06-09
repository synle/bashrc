/**
 * Drops an `AGENTS.md -> CLAUDE.md` symlink at the root of every git repo under
 * configured repo roots, so non-Claude CLIs (Copilot, Gemini) — which look for
 * `AGENTS.md` at the repo root — see the same per-project rules as Claude. Opencode
 * already falls through to `~/.claude/CLAUDE.md` globally, but per-repo Claude
 * rules still only reach it through this symlink when `AGENTS.md` is absent.
 *
 * Roots: defaults to `$HOME/git`. Override / extend via env var
 * `BASHRC_AGENTS_REPO_ROOTS` (comma-separated, supports `~` and `$HOME`).
 *
 * Idempotent. Never clobbers a regular file or a symlink pointing somewhere else —
 * those are reported and skipped. Use:
 *
 *   bash run.sh --files=repo-agents-symlink.standalone.js
 */

/**
 * Resolves the configured repo-root list. Reads `$BASHRC_AGENTS_REPO_ROOTS`
 * (comma-separated), expanding `~` and `$HOME`. Falls back to `~/git` when the
 * env var is unset / empty. De-duplicates and drops non-existent / non-directory
 * entries — never throws, returns whatever roots are usable.
 *
 * @returns {string[]} Absolute paths to existing directories. Empty array if none usable.
 */
function _resolveRepoRoots() {
  /** @type {string} Raw comma-separated env override, falls back to `~/git`. */
  const raw = (process.env.BASHRC_AGENTS_REPO_ROOTS || "~/git").trim();
  /** @type {string[]} Candidate paths after splitting + expansion. */
  const candidates = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^~(?=$|\/)/, BASE_HOMEDIR_LINUX).replace(/\$HOME/g, BASE_HOMEDIR_LINUX))
    .map((s) => path.resolve(s));

  /** @type {string[]} Filtered to entries that actually exist as directories on disk. */
  const usable = [];
  /** @type {Set<string>} Dedup guard. */
  const seen = new Set();
  for (const c of candidates) {
    if (seen.has(c)) continue;
    seen.add(c);
    try {
      if (fs.statSync(c).isDirectory()) usable.push(c);
      else log(`>> Skipping non-directory repo root: ${c}`);
    } catch {
      log(`>> Skipping missing repo root: ${c}`);
    }
  }
  return usable;
}

/**
 * Lists subdirectory paths inside `root` that look like a git repo (i.e. contain
 * a `.git` entry, file or directory — handles both regular checkouts and
 * worktrees that use a gitfile). Non-directory entries and hidden dotfolders at
 * the top level are skipped.
 *
 * @param {string} root - Absolute path to the repo-root folder to scan.
 * @returns {string[]} Absolute paths of immediate-child folders that contain a `.git`.
 */
function _findGitReposIn(root) {
  /** @type {string[]} Accumulator for matched repo paths. */
  const out = [];
  /** @type {string[]} Direct children of `root`. */
  let entries = [];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    /** @type {string} Absolute path to the child. */
    const full = path.join(root, entry);
    try {
      if (!fs.statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    /** @type {string} Path to the candidate `.git` marker. */
    const gitPath = path.join(full, ".git");
    if (fs.existsSync(gitPath)) out.push(full);
  }
  return out;
}

/**
 * Inspects a single repo and (when applicable) drops an `AGENTS.md` symlink
 * pointing at the existing `CLAUDE.md` next to it. Decision matrix:
 *
 *   - no `CLAUDE.md`                              → skip, no-op
 *   - `AGENTS.md` missing                         → create relative symlink → CLAUDE.md
 *   - `AGENTS.md` is a symlink already → `CLAUDE.md` (relative or absolute) → skip, idempotent
 *   - `AGENTS.md` is a symlink to elsewhere       → skip, report (don't clobber user intent)
 *   - `AGENTS.md` is a regular file               → skip, report (don't clobber user content)
 *
 * Symlink is RELATIVE (`CLAUDE.md`, not absolute) so the link survives a repo
 * move.
 *
 * @param {string} repoPath - Absolute path to the repo root.
 * @returns {"created"|"skipped-no-source"|"skipped-already-linked"|"skipped-foreign-link"|"skipped-regular-file"} Outcome label for the per-root tally.
 */
function _processRepo(repoPath) {
  /** @type {string} */
  const claudePath = path.join(repoPath, "CLAUDE.md");
  /** @type {string} */
  const agentsPath = path.join(repoPath, "AGENTS.md");

  if (!fs.existsSync(claudePath)) return "skipped-no-source";

  /** @type {fs.Stats|null} Lstat of AGENTS.md, null when missing. */
  let agentsStat = null;
  try {
    agentsStat = fs.lstatSync(agentsPath);
  } catch {
    agentsStat = null;
  }

  if (agentsStat === null) {
    fs.symlinkSync("CLAUDE.md", agentsPath);
    log(`   Created: ${agentsPath} -> CLAUDE.md`);
    return "created";
  }

  if (agentsStat.isSymbolicLink()) {
    /** @type {string} Raw link target as stored on disk. */
    const target = fs.readlinkSync(agentsPath);
    /** @type {string} Target resolved to an absolute path (handles both relative + absolute symlinks). */
    const resolved = path.isAbsolute(target) ? target : path.resolve(repoPath, target);
    if (resolved === claudePath) return "skipped-already-linked";
    log(`   Foreign symlink (kept): ${agentsPath} -> ${target}`);
    return "skipped-foreign-link";
  }

  log(`   Existing file (kept): ${agentsPath}`);
  return "skipped-regular-file";
}

/**
 * Walks every configured repo root, locates each git repo inside it, and processes
 * the per-repo symlink decision via `_processRepo`. Prints per-root + grand-total
 * counts so a CI run leaves a clear summary.
 */
async function doWork() {
  /** @type {string[]} Absolute paths of repo-root folders that actually exist. */
  const roots = _resolveRepoRoots();
  if (roots.length === 0) {
    log(">> No usable repo roots — set BASHRC_AGENTS_REPO_ROOTS or create ~/git");
    return;
  }

  log(`>> Scanning for git repos under: ${roots.join(", ")}`);

  /** @type {Record<string, number>} Grand-total tally keyed by outcome label. */
  const grand = {
    created: 0,
    "skipped-no-source": 0,
    "skipped-already-linked": 0,
    "skipped-foreign-link": 0,
    "skipped-regular-file": 0,
  };

  for (const root of roots) {
    /** @type {string[]} */
    const repos = _findGitReposIn(root);
    log(`>> ${root}: ${repos.length} repo(s)`);
    for (const repo of repos) {
      const outcome = _processRepo(repo);
      grand[outcome] = (grand[outcome] || 0) + 1;
    }
  }

  log(
    `>> Done. created=${grand.created} already-linked=${grand["skipped-already-linked"]} ` +
      `no-claude=${grand["skipped-no-source"]} foreign-link=${grand["skipped-foreign-link"]} ` +
      `existing-file=${grand["skipped-regular-file"]}`,
  );
}
