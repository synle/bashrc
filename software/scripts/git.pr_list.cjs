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
 *   3. One GraphQL query per PR to enrich it (CI, reviews, threads, conflicts).
 *   4. Classifies each PR into a group + a 🔴/🟡/🟢 signal.
 *   5. Prints them oldest-first, optionally filtered and colored.
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
 *   Human (default): two lines per PR — colored title, then the URL.
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

const { execSync, spawnSync } = require("child_process");
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
  const wip = /(^|[^a-z])(wip|do not merge)([^a-z]|$)/i.test(rawTitle);
  const draft = pr.isDraft === true;

  const slug = (pr.repository || {}).nameWithOwner || ``;
  // Strip a leading `[repo]` tag that just repeats this PR's own repo name.
  const title = rawTitle.replace(/\[([^\]]+)\]\s*/g, (match, inner) => (inner === slug.split(`/`).pop() ? `` : match));

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
 * Enrich each search hit with a per-PR GraphQL query.
 *
 * NOTE: calls are sequential. `spawnSync` blocks, so true parallelism would
 * mean rewriting this in async `spawn` + a bounded pool — deliberately not done
 * (YAGNI): correctness and readability over speed until a large PR count proves
 * it matters. A progress line keeps long runs from looking hung.
 * @param {Array<{number:number, repository:{nameWithOwner:string}}>} hits
 * @returns {{rows: Row[], unreadable: number}}
 */
function enrich(hits) {
  const rows = [];
  let unreadable = 0;

  hits.forEach((pr, idx) => {
    const [owner, repo] = pr.repository.nameWithOwner.split(`/`);
    process.stderr.write(`\r>>> enriching ${idx + 1}/${hits.length}`);
    const res = spawnSync(
      `gh`,
      [`api`, `graphql`, `-f`, `owner=${owner}`, `-f`, `repo=${repo}`, `-F`, `number=${pr.number}`, `-f`, `query=${PR_QUERY}`],
      { encoding: `utf-8` },
    );
    if (res.status !== 0) {
      unreadable += 1;
      return;
    }
    let row = null;
    try {
      row = classify(JSON.parse(res.stdout));
    } catch {
      row = null;
    }
    if (row) rows.push(row);
    else unreadable += 1;
  });

  if (hits.length > 0) process.stderr.write(`\r\x1b[K`); // clear the progress line
  return { rows, unreadable };
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
    const tag = row.isDraft ? `[Draft] ` : ``;
    const title = color ? `${titleColorFor(row.signal)}${tag}${row.title}${ANSI.reset}` : `${tag}${row.title}`;

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

function main() {
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

  const { rows, unreadable } = enrich(hits);

  // Default view hides the fully-clear group; --all keeps it.
  const filtered = opts.keepReady ? rows : rows.filter((r) => r.group !== `READY TO MERGE`);
  filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && !opts.asJson && !opts.linksOnly;
  render(filtered, opts, color);

  info(
    `>>> ${rows.length} open · ${filtered.length} listed · oldest first${unreadable > 0 ? ` · ${unreadable} PR(s) could not be fetched` : ``}`,
  );
}

main();
