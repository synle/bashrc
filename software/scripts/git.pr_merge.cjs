#!/usr/bin/env node
/*
 * pr_merge - validate pull-request references, then enable GitHub auto-merge.
 *
 * This standalone CommonJS CLI accepts URLs from arguments and/or piped stdin,
 * separated by spaces, commas, pipes, tabs, or newlines. It keeps WIP / DO NOT
 * MERGE / DNM PRs last while preserving oldest-first ordering inside each group.
 * The prompt reads from /dev/tty, so piping input still asks am / dm / ig.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const readline = require("readline");

/**
 * Write a message to stderr.
 * @param {string} message
 * @returns {void}
 */
function info(message) {
  process.stderr.write(`${message}\n`);
}

/**
 * Run gh and return stdout, or an empty string on failure.
 * @param {string[]} args
 * @returns {string}
 */
function gh(args) {
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) return ``;
  return result.stdout.trim();
}

/**
 * Normalize one GitHub pull URL.
 * @param {string} value
 * @returns {{url: string, owner: string, repo: string, number: number}|null}
 */
function parsePullUrl(value) {
  const match = value.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/pull\/([0-9]+)\/?$/i);
  if (!match) return null;
  return {
    url: `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}`,
    owner: match[1],
    repo: match[2],
    number: Number(match[3]),
  };
}

/**
 * Split and deduplicate user input.
 * @param {string[]} values
 * @returns {string[]}
 */
function splitReferences(values) {
  return [
    ...new Set(
      values
        .join(`\n`)
        .split(/[\s,|]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Identify titles that must be treated as WIP.
 * @param {string} title
 * @returns {boolean}
 */
function isWipTitle(title) {
  return /(^|[\s:[(])(WIP|DO NOT MERGE|DNM)(?=$|[\s:)\]])/i.test(title);
}

/**
 * Resolve a free-form answer to one of the three actions.
 * Empty input defaults to "am" (enable auto-merge).
 * @param {string} answer
 * @returns {"am"|"dm"|"ig"|null}
 */
function parseAction(answer) {
  const value = answer.trim().toLowerCase();
  if (!value) return "am";
  if (/^(1|am|a|auto|automerge|auto-merge|y|yes)$/.test(value)) return "am";
  if (/^(2|dm|d|disable|disable-auto|off)$/.test(value)) return "dm";
  if (/^(3|ig|i|ignore|skip|n|no|q|quit)$/.test(value)) return "ig";
  return null;
}

/**
 * Read piped stdin, if any. Returns an empty string on a TTY or unreadable stdin.
 * @returns {string}
 */
function readPipedInput() {
  if (process.stdin.isTTY) return ``;
  try {
    return fs.readFileSync(0, "utf8");
  } catch (error) {
    return ``;
  }
}

/**
 * Ask which action to take for the listed pull requests.
 * Reads from the controlling terminal so piped stdin still gets a prompt.
 * @param {string} prompt
 * @returns {Promise<"am"|"dm"|"ig">}
 */
function askAction(prompt) {
  let source = process.stdin;
  let handle = null;
  if (!process.stdin.isTTY) {
    try {
      handle = fs.openSync("/dev/tty", "r");
      source = fs.createReadStream(``, { fd: handle });
    } catch (error) {
      info("No terminal available for the prompt — defaulting to [ig] ignore.");
      return Promise.resolve("ig");
    }
  }

  const input = readline.createInterface({ input: source, output: process.stderr });
  const ask = () =>
    new Promise((resolve) => {
      input.question(`${prompt} [am] enable auto-merge · [dm] disable auto-merge · [ig] ignore (default: am) `, resolve);
    });
  return (async () => {
    for (;;) {
      const action = parseAction(await ask());
      if (action) {
        input.close();
        if (handle !== null) {
          try {
            fs.closeSync(handle);
          } catch (error) {
            /* already closed by the stream */
          }
        }
        return action;
      }
      info("Enter am, dm, or ig.");
    }
  })();
}

/**
 * Validate a PR and select its merge strategy.
 * @param {{url: string, owner: string, repo: string, number: number}} reference
 * @returns {{url: string, owner: string, repo: string, number: number, title: string, createdAt: string, wip: boolean, strategy: string}|null}
 */
function inspectPullRequest(reference) {
  const query = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){state title createdAt reviewThreads(first:100){nodes{isResolved}}}}}`;
  const raw = gh([
    "api",
    "graphql",
    "-F",
    `owner=${reference.owner}`,
    "-F",
    `name=${reference.repo}`,
    "-F",
    `number=${reference.number}`,
    "-f",
    `query=${query}`,
    "--jq",
    ".data.repository.pullRequest",
  ]);
  if (!raw) return null;

  let pullRequest;
  try {
    pullRequest = JSON.parse(raw);
  } catch (error) {
    return null;
  }
  if (!pullRequest || pullRequest.state !== "OPEN") return null;

  const strategy = gh([
    "repo",
    "view",
    `${reference.owner}/${reference.repo}`,
    "--json",
    "squashMergeAllowed,rebaseMergeAllowed,mergeCommitAllowed",
    "--jq",
    'if .squashMergeAllowed then "--squash" elif .rebaseMergeAllowed then "--rebase" elif .mergeCommitAllowed then "--merge" else empty end',
  ]);
  if (!strategy) return null;

  return {
    ...reference,
    title: pullRequest.title,
    createdAt: pullRequest.createdAt,
    wip: isWipTitle(pullRequest.title),
    unresolved: ((pullRequest.reviewThreads && pullRequest.reviewThreads.nodes) || []).filter((thread) => !thread.isResolved).length,
    strategy,
  };
}

/**
 * Build the gh arguments for one PR and action.
 * @param {{owner: string, repo: string, number: number, strategy: string}} pullRequest
 * @param {"am"|"dm"} action
 * @returns {string[]}
 */
function buildActionArgs(pullRequest, action) {
  const target = ["pr", "merge", String(pullRequest.number)];
  const repo = ["-R", `${pullRequest.owner}/${pullRequest.repo}`];
  if (action === "dm") return [...target, "--disable-auto", ...repo];
  return [...target, "--auto", pullRequest.strategy, ...repo];
}

/**
 * Render a gh invocation as a copy-pasteable command line.
 * @param {string[]} args
 * @returns {string}
 */
function formatCommand(args) {
  return ["gh", ...args].map((arg) => (/^[A-Za-z0-9_./:@=-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`)).join(" ");
}

/**
 * Run one gh action for a PR.
 * @param {{owner: string, repo: string, number: number, strategy: string}} pullRequest
 * @param {"am"|"dm"} action
 * @returns {boolean}
 */
function runAction(pullRequest, action) {
  const result = spawnSync("gh", buildActionArgs(pullRequest, action), { stdio: "inherit" });
  return result.status === 0;
}

/**
 * Run CLI.
 * @returns {Promise<number>}
 */
async function main() {
  const references = splitReferences([...process.argv.slice(2), readPipedInput()]);
  if (references.length === 0) {
    info("Usage: pr_merge <url1> [url2 ...]   (or: command cat urls.txt | pr_merge)");
    return 1;
  }

  const valid = [];
  for (const value of references) {
    const reference = parsePullUrl(value);
    if (!reference) {
      info(`Invalid pull URL: ${value}`);
      continue;
    }
    const pullRequest = inspectPullRequest(reference);
    if (!pullRequest) {
      info(`Could not validate open pull request: ${reference.url}`);
      continue;
    }
    valid.push(pullRequest);
  }

  valid.sort((left, right) => Number(left.wip) - Number(right.wip) || left.createdAt.localeCompare(right.createdAt));
  if (valid.length === 0) {
    info("No valid open pull requests found.");
    return 1;
  }

  info("Pull requests sorted for auto-merge:");
  for (const pullRequest of valid) {
    const label = pullRequest.wip ? "WIP" : "READY";
    const comments = pullRequest.unresolved ? ` · ${pullRequest.unresolved} unresolved comment(s)` : ``;
    info(`  ${label} · ${pullRequest.createdAt.slice(0, 10)} · ${pullRequest.url}${comments}`);
  }

  info("");
  info("Commands to be run:");
  info("  [am] enable auto-merge:");
  for (const pullRequest of valid) {
    info(`    ${formatCommand(buildActionArgs(pullRequest, "am"))}`);
  }
  info("  [dm] disable auto-merge:");
  for (const pullRequest of valid) {
    info(`    ${formatCommand(buildActionArgs(pullRequest, "dm"))}`);
  }
  info("");

  const action = await askAction("Action for these pull requests?");
  if (action === "ig") {
    info("Ignored — nothing changed.");
    return 0;
  }

  let failures = 0;
  for (const pullRequest of valid) {
    info(`+ ${formatCommand(buildActionArgs(pullRequest, action))}`);
    if (!runAction(pullRequest, action)) failures += 1;
  }
  if (failures) {
    info(`Completed with ${failures} failed pull request(s).`);
    return 1;
  }
  info(action === "dm" ? "Auto-merge disabled for all validated pull requests." : "Auto-merge enabled for all validated pull requests.");
  return 0;
}

main().then((status) => {
  process.exitCode = status;
});
