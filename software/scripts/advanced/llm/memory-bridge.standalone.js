/**
 * Bridges Claude Code's auto-memory layer (`~/.claude/projects/<encoded-cwd>/
 * memory/MEMORY.md` + linked records) into a single managed "Persistent
 * Context" appendix that gets upserted into Copilot's, Gemini's, and
 * OpenCode's user-level instructions files. Lets non-Claude CLIs start with
 * the same persistent facts Claude already loads on every turn.
 *
 * Standalone — runs on demand, NOT on every `bash run.sh --preset=llm`. The
 * snapshot is a point-in-time copy; re-run after meaningful memory edits.
 *
 *   bash run.sh --files=memory-bridge.standalone.js
 *
 * Source:  $HOME/.claude/projects/<encoded-cwd>/memory/MEMORY.md (index)
 *          plus every linked `.md` next to it.
 * Targets: $HOME/.copilot/AGENTS.md, $HOME/.gemini/GEMINI.md,
 *          $HOME/.config/opencode/AGENTS.md  (Claude reads memory natively, so
 *          we skip ~/.claude/CLAUDE.md to avoid double-loading.)
 *
 * Block markers wrap the appendix so a re-run replaces the same span; user
 * content outside the markers is preserved. Targets that don't exist yet are
 * skipped with a hint to run the CLI's `setup.js` first.
 */

/**
 * Marker key used to wrap the managed "Persistent Context" appendix. Distinct
 * from the engineering-principles marker (`LLM_INSTRUCTIONS_MARKER`) so both
 * blocks coexist in the same file without `replaceBlock` clobbering each other.
 * @type {string}
 */
const MEMORY_BRIDGE_MARKER = "synle/bashrc | software/scripts/advanced/llm/memory-bridge";

/**
 * Best-effort decoder for Claude's project-folder encoding. Claude replaces
 * every `/` in an absolute cwd with `-`, which is LOSSY when path segments
 * already contain `-` (e.g. `display-dj` becomes `-display-dj` and round-trips
 * to `/display/dj`). To preserve real-folder names when possible, this helper
 * tries the longest segment-suffix joins against `$HOME/git/<name>` and
 * returns the actual matching directory if one is found; otherwise falls back
 * to the naive decode (caller should treat the result as display-only).
 *
 * @param {string} encoded - Folder name under `~/.claude/projects/` (e.g. `-Users-syle-git-display-dj`).
 * @returns {string} Display path (e.g. `~/git/display-dj` or the naive `/Users/.../display/dj` fallback).
 */
function _decodeProjectPath(encoded) {
  /** @type {string} Naive decode — works only when no segment contains a `-`. */
  const naive = "/" + encoded.replace(/^-/, "").replace(/-/g, "/");

  // Heuristic: if the path starts with `$HOME/git/`, ask the filesystem which
  // tail-join matches. Walk from longest joined tail backwards so multi-`-`
  // repo names (display-dj, skiff-files) win over the over-eager naive split.
  const home = BASE_HOMEDIR_LINUX || "";
  const gitRoot = path.join(home, "git");
  /** @type {string[]} Encoded segments without the leading empty + the standard prefix `Users/<u>/git/`. */
  let trailingSegments = [];
  if (naive.startsWith(home + "/git/")) {
    trailingSegments = naive
      .slice((home + "/git/").length)
      .split("/")
      .filter(Boolean);
  }

  for (let take = trailingSegments.length; take >= 1; take--) {
    /** @type {string} Candidate repo name (last `take` segments rejoined with `-`). */
    const candidate = trailingSegments.slice(-take).join("-");
    /** @type {string} Absolute candidate path under `~/git/`. */
    const candidatePath = path.join(gitRoot, candidate);
    try {
      if (fs.statSync(candidatePath).isDirectory()) {
        return `~/git/${candidate}`;
      }
    } catch {
      // candidate path doesn't exist — keep trying shorter tail joins
    }
  }

  return naive;
}

/**
 * Reads the per-project memory index (`MEMORY.md`) and every `.md` it links
 * to (relative paths next to the index). Returns a snapshot bundle the caller
 * can render into the managed block.
 *
 * @param {string} memoryDir - Absolute path to a `<project>/memory/` directory.
 * @returns {{ indexContent: string, linkedFiles: Array<{ file: string, content: string }> }|null} `null` when `MEMORY.md` is absent.
 */
function _readProjectMemory(memoryDir) {
  /** @type {string} */
  const indexPath = path.join(memoryDir, "MEMORY.md");
  /** @type {string} */
  let indexContent;
  try {
    indexContent = fs.readFileSync(indexPath, "utf-8");
  } catch {
    return null;
  }

  /** @type {Array<{ file: string, content: string }>} Linked .md files in the order they appear in MEMORY.md. */
  const linkedFiles = [];
  /** @type {Set<string>} Dedup guard — MEMORY.md occasionally points at the same record twice. */
  const seen = new Set();
  for (const line of indexContent.split("\n")) {
    /** @type {RegExpMatchArray|null} Captures the `file.md` part of `- [Title](file.md) — desc`. */
    const m = line.match(/^\s*-\s*\[.*?\]\(([^)]+\.md)\)/);
    if (!m) continue;
    /** @type {string} */
    const linkedName = m[1];
    if (seen.has(linkedName)) continue;
    seen.add(linkedName);
    /** @type {string} */
    const linkedPath = path.join(memoryDir, linkedName);
    try {
      linkedFiles.push({ file: linkedName, content: fs.readFileSync(linkedPath, "utf-8") });
    } catch {
      // linked file missing — surface in the rendered block so the gap is visible
      linkedFiles.push({ file: linkedName, content: `_(file missing on disk: ${linkedPath})_` });
    }
  }
  return { indexContent, linkedFiles };
}

/**
 * Renders the full managed appendix from a list of per-project snapshots.
 * Output is a Markdown body (no BEGIN/END markers — `replaceBlock` adds those).
 *
 * Layout:
 *
 *     # Persistent Context (auto-memory bridge from Claude Code)
 *
 *     _Snapshot of `~/.claude/projects/<...>/memory/` — re-run
 *     `bash run.sh --files=memory-bridge.standalone.js` to refresh._
 *
 *     ## Project: ~/git/<repo>  (`<encoded-cwd>`)
 *
 *     <index body verbatim>
 *
 *     ### <linked-file-name.md>
 *
 *     <linked file body verbatim>
 *
 * @param {Array<{ projectName: string, displayName: string, indexContent: string, linkedFiles: Array<{ file: string, content: string }> }>} snapshots
 * @returns {string} Rendered Markdown body for the managed block.
 */
function _renderMemoryBlock(snapshots) {
  /** @type {string[]} Output line accumulator. */
  const lines = [];
  lines.push("# Persistent Context (auto-memory bridge from Claude Code)");
  lines.push("");
  lines.push(
    "_Snapshot of `~/.claude/projects/<encoded-cwd>/memory/` — re-run `bash run.sh --files=memory-bridge.standalone.js` to refresh._",
  );
  lines.push("");

  for (const snap of snapshots) {
    lines.push(`## Project: ${snap.displayName}  (\`${snap.projectName}\`)`);
    lines.push("");
    lines.push(snap.indexContent.trim());
    lines.push("");
    for (const linked of snap.linkedFiles) {
      lines.push(`### \`${linked.file}\``);
      lines.push("");
      lines.push(linked.content.trim());
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}

/**
 * Target files we deploy the appendix into. Skips Claude itself — Claude Code
 * loads `~/.claude/projects/.../memory/` natively on every turn, so writing
 * the snapshot into `~/.claude/CLAUDE.md` would double-load the same facts.
 * @type {string[]} Absolute paths.
 */
function _getTargets() {
  return [
    path.join(BASE_HOMEDIR_LINUX, ".copilot/AGENTS.md"),
    path.join(BASE_HOMEDIR_LINUX, ".gemini/GEMINI.md"),
    path.join(BASE_HOMEDIR_LINUX, ".config/opencode/AGENTS.md"),
  ];
}

/**
 * Orchestrator. Walks each `~/.claude/projects/<encoded>/memory/` folder,
 * builds one managed "Persistent Context" appendix from every project's
 * MEMORY.md + linked records, and upserts it into each non-Claude CLI's
 * instructions file via `replaceBlock`. Idempotent — running twice in a row
 * converges to the same file state.
 */
async function doWork() {
  /** @type {string} */
  const projectsDir = path.join(BASE_HOMEDIR_LINUX, ".claude/projects");
  if (!fs.existsSync(projectsDir)) {
    log(">> No ~/.claude/projects/ — nothing to bridge");
    return;
  }

  /** @type {Array<{ projectName: string, displayName: string, indexContent: string, linkedFiles: Array<{ file: string, content: string }> }>} */
  const snapshots = [];
  for (const entry of fs.readdirSync(projectsDir).sort()) {
    /** @type {string} */
    const memoryDir = path.join(projectsDir, entry, "memory");
    /** @type {ReturnType<typeof _readProjectMemory>} */
    const snap = _readProjectMemory(memoryDir);
    if (!snap) continue;
    snapshots.push({
      projectName: entry,
      displayName: _decodeProjectPath(entry),
      indexContent: snap.indexContent,
      linkedFiles: snap.linkedFiles,
    });
  }

  if (snapshots.length === 0) {
    log(">> No per-project Claude memory found — nothing to bridge");
    return;
  }

  log(`>> Found memory in ${snapshots.length} project(s) — building appendix`);
  /** @type {string} */
  const block = _renderMemoryBlock(snapshots);

  for (const targetPath of _getTargets()) {
    if (!fs.existsSync(targetPath)) {
      log(`>> Skipping ${targetPath} — not present (run the CLI's setup.js first)`);
      continue;
    }

    /** @type {string} */
    const existing = fs.readFileSync(targetPath, "utf-8");
    /** @type {string} */
    const merged = replaceBlock(existing, MEMORY_BRIDGE_MARKER, block, "<!--", " -->", "append").trim() + "\n";

    await backupConfigFile(targetPath);
    await writeText(targetPath, merged);
    log(`>> Updated: ${targetPath}`);
  }
}
