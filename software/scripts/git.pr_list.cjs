#!/usr/bin/env node
/*
 * list_prs — inventory your open GitHub pull requests, grouped by how much
 * work each one still needs.
 * ===========================================================================
 *
 * This file is a SELF-CONTAINED Node CLI. It is NOT one of the repo's
 * doWork()/undoWork() scripts — the `.mjs` extension keeps it out of
 * script discovery (only `.js` / `.sh` are discovered). The installer
 * `git-functions.js` copies THIS file verbatim to `~/.local/bin/list_prs` and
 * marks it executable, so it runs as a plain `list_prs` on your PATH.
 *
 * WHAT IT DOES
 *   1. Resolves which repos to look at (see SCOPE below).
 *   2. `gh search prs --author=<me> --state=open` to find open PRs.
 *   3. One GraphQL query per PR to enrich it (three at a time).
 *   4. Classifies each PR into a group + a 🔴/🟡/🟢 signal.
 *   5. Prints them oldest-first with WIP entries last, optionally filtered and colored.
 *
 * SCOPE (mutually exclusive, in priority order)
 *   - Explicit `owner/repo` or local-path arguments  → exactly those repos.
 *   - `--cwd`                                         → every git repo found
 *                                                        at/below the current
 *                                                        folder (3 levels deep).
 *   - default (no `--cwd`, no positional args)        → GLOBAL: every open PR
 *                                                        you have anywhere on
 *                                                        GitHub.
 *   When `--cwd` finds nothing, a hint tells you to drop `--cwd` for a global
 *   search.
 *
 * FILTER
 *   By default the fully-clear group (`READY TO MERGE` — green CI, approved, no
 *   conflicts, no open threads) is hidden, because it needs nothing but a merge
 *   button. Pass `--all` to include it. Every other group is always shown,
 *   including `READY TO MERGE (with comments)` (still has threads to resolve).
 *
 * OUTPUT
 *   Human (default): two lines per PR — colored title, then the URL. The title
 *   line leads with a reason icon naming WHY the PR sits where it does
 *   (🗣️ changes requested, ⚔️ conflict, 💥 CI failed, 🔨 build running,
 *   ⏳ awaiting review, 🔄 behind base, 💬 ready but threads open, 🚀 ready,
 *   🛑 draft/WIP). Five of those states add a greppable word form after the
 *   icon: the three that BLOCK a merge print `[rejected]` / `[conflict]` /
 *   `[ci-failed]` in bold red, and the administrative two print `[behind]` /
 *   `[draft]` dim. Only ever ONE of them — "blocked" is a single answer, and
 *   `status` still lists every component. A running build also gets a magenta
 *   trailing … (the one state that resolves itself while you read), and an
 *   armed auto-merge a dim `[auto-merge]` rather than a tenth glyph. Every
 *   text marker prints without color too, so a pipe loses tone, never a fact.
 *   The URL line stays bare — callers parse it.
 *   `--verbose`    : adds a third metadata line (timestamp · signal · status).
 *   `--links`      : just the URLs, one per line — paste-clean for other tools.
 *   `--json`       : the full enriched rows as JSON.
 *   Colors are emitted ONLY to an interactive TTY (and never when `NO_COLOR`
 *   is set), so piped / redirected / `--json` / `--links` output stays plain.
 *   All progress, warnings, and the summary footer go to STDERR, so STDOUT
 *   carries only the PR data — safe to pipe.
 *
 * FLAGS
 *   --all               include the fully-clear READY TO MERGE group
 *   --cwd               scope to git repos at/below the current folder
 *   --verbose, -v       add the per-PR metadata line
 *   --links             print only URLs (implies no color)
 *   --json              print the enriched rows as JSON
 *   --author=<login>    whose PRs to list (default: @me)
 *   --limit=<n>         max PRs to fetch (default: 1000)
 *   owner/repo ...      one or more explicit repos (overrides scope)
 *
 * ENV
 *   NO_COLOR                        disable ANSI color even on a TTY.
 *   BASHRC_PR_GATE_CHECK_PATTERN    regex overriding which check names count as
 *                                   human approval gates (vs real CI).
 */

const { execSync, spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Small logging helpers. STDOUT is reserved for PR data (so it can be piped);
// everything else — progress, warnings, errors, the footer — goes to STDERR.
// ---------------------------------------------------------------------------

/**
 * Write a diagnostic line to STDERR.
 * @param {string} [msg] Message to print (blank line if omitted).
 * @returns {void}
 */
function info(msg = ``) {
  process.stderr.write(`${msg}\n`);
}

/**
 * Print an error to STDERR and exit non-zero.
 * @param {string} msg Error message.
 * @returns {never}
 */
function die(msg) {
  process.stderr.write(`list_prs: ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Argument parsing.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Options
 * @property {boolean} keepReady   Include the fully-clear READY TO MERGE group.
 * @property {boolean} useCwd      Scope to repos at/below the current folder.
 * @property {boolean} asJson      Emit JSON instead of the human layout.
 * @property {boolean} linksOnly   Emit only URLs.
 * @property {boolean} verbose     Add the per-PR metadata line.
 * @property {string}  author      Whose PRs to list.
 * @property {number}  limit       Max PRs to fetch.
 * @property {string[]} repoSpecs  Explicit `owner/repo` or local paths.
 */

/**
 * Parse `process.argv` into an {@link Options} object. Unknown `--flags` are a
 * hard error so typos fail loudly rather than silently doing the wrong thing.
 * @param {string[]} argv Arguments after the node script name.
 * @returns {Options}
 */
function parseArgs(argv) {
  /** @type {Options} */
  const opts = {
    keepReady: false,
    useCwd: false,
    asJson: false,
    linksOnly: false,
    verbose: false,
    author: `@me`,
    limit: 1000,
    repoSpecs: [],
  };

  for (const arg of argv) {
    const lower = arg.toLowerCase();

    if (arg.startsWith(`--author=`)) {
      opts.author = arg.slice(`--author=`.length) || `@me`;
    } else if (arg.startsWith(`--limit=`)) {
      opts.limit = parseInt(arg.slice(`--limit=`.length), 10) || 1000;
    } else if (lower === `--all`) {
      opts.keepReady = true;
    } else if (lower === `--cwd`) {
      opts.useCwd = true;
    } else if (lower === `--json`) {
      opts.asJson = true;
    } else if (lower === `--links`) {
      opts.linksOnly = true;
    } else if (lower === `--verbose` || lower === `-v`) {
      opts.verbose = true;
    } else if (lower === `--quiet` || lower === `-q` || lower === `--no-verbose`) {
      opts.verbose = false;
    } else if (arg.startsWith(`-`)) {
      die(`unknown option '${arg}'`);
    } else {
      opts.repoSpecs.push(arg);
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// ANSI color. Emitted only to an interactive TTY, never under NO_COLOR, and
// never for --json / --links (both of which are meant to be machine-consumed).
// ---------------------------------------------------------------------------

const ANSI = {
  reset: `\x1b[0m`,
  red: `\x1b[31m`,
  green: `\x1b[32m`,
  yellow: `\x1b[33m`,
  blue: `\x1b[34m`,
  // Bright magenta is the one noticeable color left: red/yellow/green are spoken for
  // by the roll-up signal and blue by the URL line, so an in-progress marker in any of
  // those would read as a status it is not.
  magenta: `\x1b[95m`,
  // Bold bright red for a blocked tag. Plain red would be red-on-red — the title of a
  // blocked PR is already red — so the weight, not the hue, is what makes it readable.
  blockedTag: `\x1b[1;91m`,
  // Dim is the opposite job — a non-blocking tag is context, not a finding, and must
  // sit quieter than the title it prefixes.
  dim: `\x1b[2m`,
  underline: `\x1b[4m`,
};

/**
 * Map a PR's 🔴/🟡/🟢 signal to a title color.
 * @param {"🔴"|"🟡"|"🟢"} signal
 * @returns {string} ANSI color escape.
 */
function titleColorFor(signal) {
  if (signal === `🔴`) return ANSI.red;
  if (signal === `🟢`) return ANSI.green;
  return ANSI.yellow;
}

/**
 * Render a URL. On a color-capable TTY it becomes a blue, underlined OSC-8
 * hyperlink (clickable in modern terminals); otherwise it is the plain URL so
 * piped output stays greppable.
 * @param {string} url
 * @param {boolean} color Whether color/hyperlink escapes are allowed.
 * @returns {string}
 */
function formatLink(url, color) {
  if (!color) return url;
  return `\x1b]8;;${url}\x1b\\${ANSI.blue}${ANSI.underline}${url}${ANSI.reset}\x1b]8;;\x1b\\`;
}

// ---------------------------------------------------------------------------
// Repo discovery.
// ---------------------------------------------------------------------------

/**
 * Resolve a git checkout to its `owner/repo` slug via the `origin` remote.
 * The folder name is never authoritative (a `~/git/foo` checkout can be
 * `acme/bar`), so we always read the remote.
 * @param {string} [dir] Working directory (default: process cwd).
 * @returns {string|null} `owner/repo`, or null if not a resolvable checkout.
 */
function repoSlugFromGit(dir) {
  try {
    const origin = execSync(`git remote get-url origin`, {
      cwd: dir,
      encoding: `utf-8`,
      stdio: [`ignore`, `pipe`, `ignore`],
    }).trim();
    const match = origin.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Recursively find git checkouts at/below `dir` (up to `maxDepth` levels) and
 * collect their `owner/repo` slugs. Skips the usual heavy / hidden folders.
 * @param {string} dir Folder to search.
 * @param {Set<string>} results Accumulator of slugs.
 * @param {number} [depth] Current recursion depth.
 * @param {number} [maxDepth] Deepest level to descend.
 * @returns {Set<string>}
 */
function findGitRepos(dir, results, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return results;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  if (fs.existsSync(path.join(dir, `.git`))) {
    const slug = repoSlugFromGit(dir);
    if (slug) results.add(slug);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith(`.`) || name === `node_modules` || name === `dist` || name === `build` || name === `vendor`) {
      continue;
    }
    findGitRepos(path.join(dir, name), results, depth + 1, maxDepth);
  }

  return results;
}

/**
 * Resolve the set of repos to query from the parsed options.
 *   - explicit specs win (each resolved to a slug),
 *   - else `--cwd` walks the current folder tree,
 *   - else `[]` meaning a GLOBAL search (no `--repo` restriction).
 * @param {Options} opts
 * @returns {string[]} `owner/repo` slugs, or `[]` for a global search.
 */
function resolveRepos(opts) {
  if (opts.repoSpecs.length > 0) {
    return opts.repoSpecs.map((spec) => (spec.includes(`/`) && !fs.existsSync(spec) ? spec : repoSlugFromGit(spec))).filter(Boolean);
  }
  if (opts.useCwd) {
    return [...findGitRepos(process.cwd(), new Set())];
  }
  return [];
}

// ---------------------------------------------------------------------------
// PR classification.
// ---------------------------------------------------------------------------

/** Check conclusions/states that mean a real CI failure. */
const FAILED = [`FAILURE`, `ERROR`, `TIMED_OUT`, `STARTUP_FAILURE`];
/** Check statuses/states that mean a check is still running. */
const UNFINISHED = [`QUEUED`, `IN_PROGRESS`, `WAITING`, `PENDING`, `REQUESTED`, `EXPECTED`];
/** Maximum number of GitHub enrichment processes allowed at once. */
const MAX_ENRICH_CONCURRENCY = 3;

/** GraphQL: everything needed to classify one PR. */
const PR_QUERY = `
query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      url number title isDraft createdAt updatedAt mergeable mergeStateStatus
      headRefName baseRefName
      author{ login }
      repository{ nameWithOwner }
      reviewDecision
      autoMergeRequest{ enabledAt mergeMethod }
      reviewThreads(first:100){ nodes{ isResolved comments(first:1){ nodes{ author{ login __typename } } } } }
      commits(last:1){ nodes{ commit{ statusCheckRollup{ state contexts(first:100){ nodes{
        __typename
        ... on CheckRun{ name status conclusion }
        ... on StatusContext{ context state }
      } } } } } }
    }
  }
}
`;

/**
 * Regex matching check names that are HUMAN approval gates (they sit pending by
 * design until a person clicks) rather than self-resolving CI. Overridable via
 * `BASHRC_PR_GATE_CHECK_PATTERN`.
 * @type {RegExp}
 */
const GATE_RE = new RegExp(
  process.env.BASHRC_PR_GATE_CHECK_PATTERN || `approval|approve|reviewer|review required|sign-?off|codeowner|changes ?resolution|\\bcla\\b`,
  `i`,
);

/**
 * Whole-day age of an ISO timestamp.
 * @param {string} iso
 * @returns {number}
 */
function ageInDays(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/**
 * The reason icon vocabulary — one glyph naming WHY a PR is in the state it is in.
 *
 * The 🔴/🟡/🟢 signal answers "how bad is it"; three different problems all render 🔴
 * and a reader has to open the PR to find out which. These name the cause at a glance,
 * so a wall of red resolves into "one conflict, two failing builds" without a click.
 *
 * Deliberately distinct silhouettes rather than a themed set — these are scanned in a
 * column, so 💥 vs ⚔️ vs 🗣️ has to be readable at a glance and in a small terminal font.
 *
 * Two encoding rules, both learned the hard way and both checkable against the official
 * Unicode `emoji-test.txt`: prefer a glyph with NO `U+FE0F` variation selector (a VS16
 * pair renders narrow in several terminals and knocks the whole column out of
 * alignment), and prefer the oldest emoji version that says the right thing (a recent
 * codepoint is tofu on an older font). That is why build-in-progress is 🔨 `U+1F528`
 * ("hammer", E0.6, no VS16) rather than 🏗️ `U+1F3D7 U+FE0F` ("building construction",
 * E0.7, VS16). Unicode has no traffic-cone emoji to prefer over either.
 *
 * A glyph also has to survive being read out of context, which is what retired the two
 * cutest ones. 👀 for awaiting-review read as "look at this" — an attention grab on the
 * one row that wants nothing from you, since it is the REVIEWER who is being waited on;
 * ⏳ says "waiting on a person" and matches the ⏳ the status line already uses for a
 * pending approval gate. 🐌 for behind-base editorialized ("slow", "neglected") about a
 * branch that is merely out of date; 🔄 says the actual remedy, which is a sync.
 *
 * Every state keeps an icon even where the wording alone might do, because these are
 * read as a column: drop the glyph from one row and its title starts a character
 * earlier than the other eight, which is exactly the ragged edge the column exists to
 * avoid. In-progress carries an extra ELLIPSIS suffix on the title (see
 * {@link RUNNING_SUFFIX}) — the icon says which state, the trailing … says it is still
 * moving on its own.
 * @type {Record<string, string>}
 */
const REASON_ICONS = {
  // Red — something is wrong, in Work-owed tier order (a blocked human outranks
  // broken machinery, which outranks a stale branch).
  CHANGES_REQUESTED: `🗣️`,
  MERGE_CONFLICT: `⚔️`,
  CI_FAILED: `💥`,
  // Yellow — nothing wrong, not yet clear.
  BUILD_RUNNING: `🔨`,
  AWAITING_REVIEW: `⏳`,
  BEHIND_BASE: `🔄`,
  // Green — clear to merge.
  READY: `🚀`,
  READY_WITH_COMMENTS: `💬`,
  // Not in play. 🛑 rather than a construction glyph: a draft is not mid-build, it is
  // explicitly "do not merge this", and that is the one thing a stop sign says.
  DRAFT: `🛑`,
  UNKNOWN: `❓`,
};

/**
 * The word form of {@link REASON_ICONS} — same keys, same first-match-wins precedence,
 * so a row can never show an icon and a tag that disagree.
 *
 * An icon is a glance; a tag is a word you can grep, paste into Slack, or read on a
 * terminal that renders the glyph as tofu. Only the states where that precision is
 * worth a few columns carry one: the three ways a PR is BLOCKED (a reviewer said no,
 * the branches disagree, the build broke) plus the two administrative states. The
 * settled and in-flight states (awaiting review, building, ready, ready-with-threads)
 * stay bare — their icon plus the trailing … already says everything a tag would, and
 * tagging all nine would put a bracket on every row and mean nothing.
 *
 * Exactly one of these can appear on a row, because the key is chosen once by
 * {@link reasonKeyFor}. That is the point: "blocked" is a single answer, not a
 * checklist, and the `status` field is where the full component list already lives.
 * @type {Record<string, string>}
 */
const REASON_TAGS = {
  // Blocked — one of these three, never two, in the same precedence as the icons.
  CHANGES_REQUESTED: `[rejected]`,
  MERGE_CONFLICT: `[conflict]`,
  CI_FAILED: `[ci-failed]`,
  // Out of date. Not blocked — nothing is wrong, the branch just needs a sync.
  BEHIND_BASE: `[behind]`,
  // Administrative.
  DRAFT: `[draft]`,
};

/**
 * Trailing marker for a PR whose build is still running.
 *
 * A build is the only state on this list that resolves itself while you read the
 * output — everything else waits on a person. The trailing … says "still moving, come
 * back" in the punctuation every reader already knows, and on a color terminal it is
 * printed in magenta: red, yellow, and green all already mean a roll-up severity here,
 * and blue is the URL line, so any of those would read as a status this is not.
 * @type {string}
 */
const RUNNING_SUFFIX = `…`;

/**
 * Marker for an armed auto-merge.
 *
 * Auto-merge is NOT an icon — GitHub landing the PR itself is a property of the row,
 * not a tenth reason it is stuck, and giving it a glyph made two unrelated facts
 * compete for the same glance in the reason column. It is a literal word instead, and a
 * dim one: it qualifies the title rather than announcing a finding, so it must sit
 * quieter than the text it prefixes. Being plain text it also survives `--links`, a
 * pipe, `NO_COLOR`, and a redirect, where an escape-based treatment would vanish.
 * @type {string}
 */
const AUTO_MERGE_TAG = `[auto-merge]`;

/**
 * The three states that BLOCK a merge outright — a reviewer said no, the branches
 * disagree, or the build broke. Kept as a key list rather than a list of tag strings so
 * the tag text can be renamed in {@link REASON_TAGS} alone; nothing here restates it.
 *
 * These read in bold red rather than the dim of every other tag. The title is already
 * red for all three (that is exactly the `red` roll-up), so a plain-red tag would be
 * red-on-red and disappear into it — bold + bright is what survives the collision.
 * @type {string[]}
 */
const BLOCKED_REASON_KEYS = [`CHANGES_REQUESTED`, `MERGE_CONFLICT`, `CI_FAILED`];

/** @type {Set<string>} The rendered tag text of {@link BLOCKED_REASON_KEYS}. */
const BLOCKED_TAGS = new Set(BLOCKED_REASON_KEYS.map((key) => REASON_TAGS[key]));

/**
 * Pick the single reason KEY for a classified PR — first match wins.
 *
 * Returns the key rather than the glyph so the icon and the word form can never drift:
 * {@link REASON_ICONS} and {@link REASON_TAGS} are both looked up with this one answer,
 * so there is exactly one precedence list in the file instead of two that agree today.
 *
 * Order is the Work-owed ranking's, not the status string's: a blocked human (P1)
 * outranks broken machinery (P2), which outranks a stale branch (P3). So a PR that is
 * both conflicting and has changes requested reads 🗣️ `[rejected]` — the human is the
 * bigger deal, and the `status` field still lists every component for anyone who needs
 * all of them. "Blocked" is one answer, never a checklist.
 *
 * @param {Object} state Classified booleans/counters for one PR.
 * @param {boolean} state.draft Draft or WIP-titled.
 * @param {boolean} state.conflicted `mergeable === "CONFLICTING"`.
 * @param {boolean} state.changesRequested `reviewDecision === "CHANGES_REQUESTED"`.
 * @param {boolean} state.ciFailed A check finished with a failing conclusion.
 * @param {number} state.running Self-resolving checks still in flight.
 * @param {boolean} state.approved `reviewDecision === "APPROVED"`.
 * @param {boolean} state.behind Head branch is behind its base.
 * @param {number} state.openThreads Unresolved review threads.
 * @returns {string} A key of {@link REASON_ICONS}.
 */
function reasonKeyFor(state) {
  if (state.draft) return `DRAFT`;
  if (state.changesRequested) return `CHANGES_REQUESTED`;
  if (state.conflicted) return `MERGE_CONFLICT`;
  if (state.ciFailed) return `CI_FAILED`;
  if (state.running > 0) return `BUILD_RUNNING`;
  if (!state.approved) return `AWAITING_REVIEW`;
  if (state.behind) return `BEHIND_BASE`;
  if (state.openThreads > 0) return `READY_WITH_COMMENTS`;
  return `READY`;
}

/**
 * @typedef {Object} Row
 * @property {string} url
 * @property {string} repo
 * @property {number} number
 * @property {string} title
 * @property {string} author
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} ageDays
 * @property {string} headRefName  PR branch (not returnable by `gh search prs`).
 * @property {string} baseRefName  Target branch.
 * @property {boolean} isDraft
 * @property {boolean} isWip       Title looks like WIP / do-not-merge.
 * @property {string} group        Classification bucket.
 * @property {"🔴"|"🟡"|"🟢"} signal
 * @property {"🔴"|"🟡"|"🟢"} color  Alias of `signal` (roll-up emoji).
 * @property {string} reasonIcon   Single glyph naming WHY (see REASON_ICONS).
 * @property {string} reasonTag    Greppable word form of the same state, or "" when
 *                                 that state carries no tag (see REASON_TAGS).
 * @property {boolean} autoMerge   Auto-merge is armed on this PR.
 * @property {string} autoMergeMethod `SQUASH` / `MERGE` / `REBASE`, or "".
 * @property {string} ci           `CI PASSED` / `CI FAILED — <name>` / `BUILD IN PROGRESS (<n> running)`.
 * @property {string} review       `APPROVED` / `CHANGES REQUESTED` / `AWAITING REVIEW`.
 * @property {string} failedCheck  Name of the first failing check, or "".
 * @property {number} runningChecks
 * @property {number} approvalGates Pending human approval gates (excluded from CI).
 * @property {string} mergeable
 * @property {string} mergeStateStatus
 * @property {number} openThreads
 * @property {number} openHumanThreads
 * @property {number} openBotThreads
 * @property {number} resolvedThreads
 * @property {string} status       Human status summary (`CI PASSED · APPROVED · …`).
 */

/**
 * Turn one enriched GraphQL response into a {@link Row}, or null if unreadable.
 * @param {any} raw Parsed `gh api graphql` JSON.
 * @returns {Row|null}
 */
function classify(raw) {
  const pr = raw && raw.data && raw.data.repository && raw.data.repository.pullRequest;
  if (!pr) return null;

  const commit = ((pr.commits || {}).nodes || [])[0] || {};
  const rollup = (commit.commit || {}).statusCheckRollup || {};
  const contexts = (rollup.contexts || {}).nodes || [];

  let failedCheck = ``;
  let running = 0;
  let gates = 0;

  contexts.forEach((check) => {
    const name = check.name || check.context || `check`;
    const verdict = check.conclusion || check.state || ``;
    const unfinished = UNFINISHED.includes(check.status || ``) || UNFINISHED.includes(verdict);

    if (GATE_RE.test(name)) {
      // Human approval gate: pending-by-design, so it never counts as running CI.
      if (unfinished || FAILED.includes(verdict)) gates += 1;
      return;
    }
    if (unfinished) {
      running += 1;
      return;
    }
    if (FAILED.includes(verdict) && failedCheck === ``) failedCheck = name;
  });

  let openHuman = 0;
  let openBot = 0;
  let resolvedThreads = 0;
  ((pr.reviewThreads || {}).nodes || []).forEach((thread) => {
    if (thread.isResolved) {
      resolvedThreads += 1;
      return;
    }
    const first = ((thread.comments || {}).nodes || [])[0] || {};
    if ((first.author || {}).__typename === `Bot`) openBot += 1;
    else openHuman += 1;
  });
  const openThreads = openHuman + openBot;

  const decision = pr.reviewDecision || ``;
  const conflicted = pr.mergeable === `CONFLICTING`;
  const rawTitle = pr.title || ``;
  const draft = pr.isDraft === true;

  const slug = (pr.repository || {}).nameWithOwner || ``;
  // Strip a leading `[repo]` tag that just repeats this PR's own repo name.
  let title = rawTitle.replace(/\[([^\]]+)\]\s*/g, (match, inner) => (inner === slug.split(`/`).pop() ? `` : match));
  const wip = isWipTitle(title);
  if (wip) title = normalizeWipTitle(title);

  const red = failedCheck !== `` || decision === `CHANGES_REQUESTED` || conflicted;
  const green = failedCheck === `` && running === 0 && decision === `APPROVED` && !conflicted;

  let group = `NEED APPROVAL`;
  if (draft || wip) group = `NOT READY / WIP / DRAFT`;
  else if (red) group = `NEEDS ATTENTION`;
  else if (green) group = openThreads > 0 ? `READY TO MERGE (with comments)` : `READY TO MERGE`;

  const ci = failedCheck !== `` ? `CI FAILED — ${failedCheck}` : running > 0 ? `BUILD IN PROGRESS (${running} running)` : `CI PASSED`;
  const review = decision === `APPROVED` ? `APPROVED` : decision === `CHANGES_REQUESTED` ? `CHANGES REQUESTED` : `AWAITING REVIEW`;

  const status = [ci, review];
  if (conflicted) status.push(`MERGE CONFLICT`);
  if (openThreads > 0) status.push(`💬 ${openThreads} open${openBot > 0 ? ` (${openHuman} human, ${openBot} bot)` : ``}`);
  if (gates > 0) status.push(`⏳ ${gates} approval gate${gates > 1 ? `s` : ``}`);
  if (pr.mergeStateStatus === `BEHIND`) status.push(`BEHIND ${pr.baseRefName || `base`}`);

  const signal = red ? `🔴` : green ? `🟢` : `🟡`;

  /** @type {boolean} GitHub will merge this itself once the gates clear. */
  const autoMerge = Boolean(pr.autoMergeRequest && pr.autoMergeRequest.enabledAt);
  /** @type {string} `SQUASH` / `MERGE` / `REBASE`, or "" when auto-merge is off. */
  const autoMergeMethod = autoMerge ? (pr.autoMergeRequest || {}).mergeMethod || `` : ``;
  if (autoMerge) status.push(`AUTO-MERGE${autoMergeMethod ? ` (${autoMergeMethod.toLowerCase()})` : ``}`);

  /** @type {string} The one state key naming why this PR sits where it does. */
  const reasonKey = reasonKeyFor({
    draft: draft || wip,
    conflicted,
    changesRequested: decision === `CHANGES_REQUESTED`,
    ciFailed: failedCheck !== ``,
    running,
    approved: decision === `APPROVED`,
    behind: pr.mergeStateStatus === `BEHIND`,
    openThreads,
  });
  /** @type {string} Single glyph naming that state. */
  const reasonIcon = REASON_ICONS[reasonKey] || REASON_ICONS.UNKNOWN;
  /** @type {string} Greppable word form of that state, or "" where a tag adds nothing. */
  const reasonTag = REASON_TAGS[reasonKey] || ``;

  // The row is the machine contract consumed by /sy-list-prs and /sy-babysit-prs.
  // The human renderer uses only url/title/signal/status/ageDays/isDraft; the rest
  // exist so a JSON consumer never has to fall back to a per-PR `gh pr view` —
  // notably headRefName/baseRefName (which `gh search prs` cannot return) and the
  // resolved / human-vs-bot thread split (which `gh pr view --json` cannot return).
  return {
    url: pr.url,
    repo: slug,
    number: pr.number,
    title,
    author: (pr.author || {}).login || ``,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    ageDays: ageInDays(pr.createdAt),
    headRefName: pr.headRefName || ``,
    baseRefName: pr.baseRefName || ``,
    isDraft: draft,
    isWip: wip,
    group,
    signal,
    color: signal,
    reasonIcon,
    reasonTag,
    autoMerge,
    autoMergeMethod,
    ci,
    review,
    failedCheck,
    runningChecks: running,
    approvalGates: gates,
    mergeable: pr.mergeable || ``,
    mergeStateStatus: pr.mergeStateStatus || ``,
    openThreads,
    openHumanThreads: openHuman,
    openBotThreads: openBot,
    resolvedThreads,
    status: status.join(` · `),
  };
}

/**
 * Detect WIP markers that make a PR not ready.
 * @param {string} title
 * @returns {boolean}
 */
function isWipTitle(title) {
  return /(^|[^a-z])(wip|do not merge|dnm)([^a-z]|$)/i.test(title);
}

/**
 * Normalize leading WIP markers without dropping the title's meaningful text.
 * @param {string} title
 * @returns {string}
 */
function normalizeWipTitle(title) {
  const body = title.replace(/^(?:\s*(?:\[\s*(?:wip|do not merge|dnm)\s*\]|wip|do not merge|dnm)\s*:?\s*(?:[—–-]\s*)?)+/i, ``).trim();
  return `WIP: ${body}`;
}

// ---------------------------------------------------------------------------
// gh calls.
// ---------------------------------------------------------------------------

/**
 * Search open PRs for `author` across the given repos (or all of GitHub when
 * `repos` is empty).
 * @param {string} author
 * @param {number} limit
 * @param {string[]} repos
 * @returns {Array<{number:number, repository:{nameWithOwner:string}, url:string}>}
 */
function searchPrs(author, limit, repos) {
  const repoFlags = repos.flatMap((r) => [`--repo`, r]);
  const res = spawnSync(
    `gh`,
    [`search`, `prs`, `--author=${author}`, `--state=open`, `--limit=${limit}`, ...repoFlags, `--json`, `number,repository,url`],
    { encoding: `utf-8` },
  );
  if (res.status !== 0) die(`GitHub search failed:\n${res.stderr || ``}`);
  try {
    return JSON.parse(res.stdout);
  } catch {
    die(`could not parse GitHub search output`);
  }
}

/**
 * Enrich one search hit with a per-PR GraphQL query.
 * @param {{number:number, repository:{nameWithOwner:string}}} pr
 * @returns {Promise<string|null>} Raw JSON, or null when GitHub rejects the request.
 */
function queryPr(pr) {
  const [owner, repo] = pr.repository.nameWithOwner.split(`/`);
  return new Promise((resolve) => {
    const child = spawn(
      `gh`,
      [`api`, `graphql`, `-f`, `owner=${owner}`, `-f`, `repo=${repo}`, `-F`, `number=${pr.number}`, `-f`, `query=${PR_QUERY}`],
      { stdio: [`ignore`, `pipe`, `ignore`] },
    );
    let stdout = ``;
    child.stdout.on(`data`, (chunk) => {
      stdout += chunk;
    });
    child.on(`error`, () => resolve(null));
    child.on(`close`, (status) => resolve(status === 0 ? stdout : null));
  });
}

/**
 * Enrich search hits with a bounded pool of per-PR GraphQL queries.
 * @param {Array<{number:number, repository:{nameWithOwner:string}}>} hits
 * @returns {Promise<{rows: Row[], unreadable: number}>}
 */
async function enrich(hits) {
  const rows = new Array(hits.length);
  let unreadable = 0;
  let nextIndex = 0;
  let completed = 0;

  const worker = async () => {
    while (nextIndex < hits.length) {
      const index = nextIndex;
      nextIndex += 1;
      const raw = await queryPr(hits[index]);
      let row = null;
      if (raw !== null) {
        try {
          row = classify(JSON.parse(raw));
        } catch {
          row = null;
        }
      }
      if (row) rows[index] = row;
      else unreadable += 1;
      completed += 1;
      process.stderr.write(`\r>>> enriching ${completed}/${hits.length}`);
    }
  };

  const workerCount = Math.min(MAX_ENRICH_CONCURRENCY, hits.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  if (hits.length > 0) process.stderr.write(`\r\x1b[K`); // clear the progress line
  return { rows: rows.filter(Boolean), unreadable };
}

// ---------------------------------------------------------------------------
// Rendering.
// ---------------------------------------------------------------------------

/**
 * Print the resolved rows in the requested format.
 * @param {Row[]} rows Already filtered + sorted.
 * @param {Options} opts
 * @param {boolean} color Whether ANSI color is allowed.
 * @returns {void}
 */
function render(rows, opts, color) {
  if (opts.asJson) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }

  if (opts.linksOnly) {
    rows.forEach((row) => process.stdout.write(`${row.url}\n`));
    return;
  }

  rows.forEach((row, idx) => {
    // Icons lead the TITLE line only. The URL line stays bare on purpose — callers
    // read it as machine input, and a prefix there breaks every one of them.
    //
    // Three independent facts, three treatments, so none competes with another:
    //   reason icon  — WHICH state, one glyph, always present so the column stays flush
    //   reason tag   — the same state as a greppable word; BOLD RED when it blocks the
    //                  merge (a blocked title is already red, so weight is what reads),
    //                  dim when it is merely administrative like [draft] / [behind]
    //   [auto-merge] — dim, because it qualifies the row rather than diagnosing it
    //   trailing …   — magenta, only while a build is actually running
    // At most ONE reason tag ever appears: the key is chosen once, so "blocked" is a
    // single answer rather than a checklist. Only styling is conditional on color —
    // every text part prints either way, so a piped render loses tone, never a fact.
    const paint = (text, style) => (color ? `${style}${text}${ANSI.reset}${titleColorFor(row.signal)}` : text);
    const parts = [row.reasonIcon];
    if (row.reasonTag) parts.push(paint(row.reasonTag, BLOCKED_TAGS.has(row.reasonTag) ? ANSI.blockedTag : ANSI.dim));
    if (row.autoMerge) parts.push(paint(AUTO_MERGE_TAG, ANSI.dim));
    parts.push(row.title);

    const running = row.runningChecks > 0 ? (color ? `${ANSI.magenta}${RUNNING_SUFFIX}${ANSI.reset}` : RUNNING_SUFFIX) : ``;
    const body = parts.join(` `);
    const title = color ? `${titleColorFor(row.signal)}${body}${ANSI.reset}${running}` : `${body}${running}`;

    const lines = [title, formatLink(row.url, color)];
    if (opts.verbose) {
      const when = `${row.createdAt.replace(`T`, ` `).replace(`Z`, ``).slice(0, 16)}`;
      lines.push(`${when} (${row.ageDays}d) · ${row.signal} ${row.status}`);
    }
    process.stdout.write(`${lines.join(`\n`)}\n`);
    if (idx < rows.length - 1) process.stdout.write(`\n`);
  });
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  try {
    execSync(`gh --version`, { stdio: `ignore` });
  } catch {
    die(`gh is not installed. Install it and run 'gh auth login'.`);
  }

  const repos = resolveRepos(opts);
  const explicitScope = opts.repoSpecs.length > 0 || opts.useCwd;

  // --cwd (or explicit paths) that resolved to nothing: nudge toward a global run.
  if (explicitScope && repos.length === 0) {
    if (opts.useCwd) info(`list_prs: no git repos found at/below this folder — drop --cwd to search all your repos on GitHub.`);
    else die(`no repos resolved from the given arguments.`);
    return;
  }

  const scopeLabel = repos.length > 0 ? `${repos.length} repo(s)` : `all of GitHub`;
  info(`>>> scanning ${scopeLabel} for open ${opts.author} PRs`);

  const hits = searchPrs(opts.author, opts.limit, repos);
  if (hits.length === 0) {
    if (opts.useCwd) info(`>>> no open ${opts.author} PRs here — drop --cwd to search all your repos on GitHub.`);
    else info(`>>> no open ${opts.author} PRs found.`);
    if (opts.asJson) process.stdout.write(`[]\n`);
    return;
  }
  if (hits.length >= opts.limit) info(`>>> WARNING: hit --limit=${opts.limit}; results may be truncated.`);

  const { rows, unreadable } = await enrich(hits);

  // Default view hides the fully-clear group; --all keeps it.
  const filtered = opts.keepReady ? rows : rows.filter((r) => r.group !== `READY TO MERGE`);
  filtered.sort((a, b) => Number(a.isWip) - Number(b.isWip) || a.createdAt.localeCompare(b.createdAt));

  const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && !opts.asJson && !opts.linksOnly;
  render(filtered, opts, color);

  info(
    `>>> ${rows.length} open · ${filtered.length} listed · oldest first, WIP last${unreadable > 0 ? ` · ${unreadable} PR(s) could not be fetched` : ``}`,
  );
}

main();
