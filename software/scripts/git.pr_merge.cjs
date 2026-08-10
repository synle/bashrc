#!/usr/bin/env node
/*
 * pr_merge - validate pull-request references, then enable GitHub auto-merge.
 *
 * This standalone CommonJS CLI accepts URLs separated by spaces, commas, tabs,
 * or newlines. It keeps WIP / DO NOT MERGE / DNM PRs last while preserving
 * oldest-first ordering inside each group.
 */

const { spawnSync } = require("child_process");
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
        .split(/[,|\t\n]+/)
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
 * Read one yes/no answer from an interactive terminal.
 * @param {string} prompt
 * @returns {Promise<boolean>}
 */
function askYesNo(prompt) {
  const input = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    input.question(`${prompt} [y/N] `, (answer) => {
      input.close();
      resolve(/^(y|yes)$/i.test(answer.trim()));
    });
  });
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
 * Enable auto-merge for one PR.
 * @param {{owner: string, repo: string, number: number, strategy: string}} pullRequest
 * @returns {boolean}
 */
function enableAutoMerge(pullRequest) {
  const result = spawnSync(
    "gh",
    ["pr", "merge", String(pullRequest.number), "--auto", pullRequest.strategy, "-R", `${pullRequest.owner}/${pullRequest.repo}`],
    { stdio: "inherit" },
  );
  return result.status === 0;
}

/**
 * Run CLI.
 * @returns {Promise<number>}
 */
async function main() {
  const references = splitReferences(process.argv.slice(2));
  if (references.length === 0) {
    info("Usage: pr_merge <url1> [url2 ...]");
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

  if (!(await askYesNo("Set auto-merge for these pull requests?"))) return 0;

  let failures = 0;
  for (const pullRequest of valid) {
    info(`Enabling auto-merge for ${pullRequest.url}`);
    if (!enableAutoMerge(pullRequest)) failures += 1;
  }
  if (failures) {
    info(`Completed with ${failures} failed pull request(s).`);
    return 1;
  }
  info("Auto-merge enabled for all validated pull requests.");
  return 0;
}

main().then((status) => {
  process.exitCode = status;
});
