/**
 * Tests for `list_prs` (and its `list_prs_needs_attention` / `list_prs_all_open`
 * entry points) in bash-git-helpers.profile.bash.
 *
 * Two layers, because the function has two halves that fail differently:
 *
 *   1. The embedded node renderer holds all the judgement — which check counts as
 *      a broken build, which is a human approval gate that never resolves on a
 *      timer, whether a review thread was opened by a person or a bot, and
 *      therefore whether a PR is still pending at all. Getting that wrong reports
 *      a blocked PR as green, which is the one failure mode nobody notices. It is
 *      extracted from the profile and replayed against synthetic GraphQL payloads.
 *
 *   2. The bash half is plumbing — resolve repo scope from --flags, apply the
 *      ready-to-merge filter, fan `gh` calls out. That is driven end to end by
 *      sourcing the real profile with a fake `gh` on PATH, so "does `list_prs --all`
 *      actually keep the ready-to-merge PRs, and does `list_prs acme/api` reach gh
 *      as a --repo flag" are answered by the shipped code.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GIT_HELPERS_PROFILE = path.join(ROOT_DIR, "software/scripts/bash-git-helpers.profile.bash");
const COMMON_FUNCTIONS = path.join(ROOT_DIR, "software/bootstrap/common-functions.bash");
const SOURCE = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");

// /bin/bash is the 3.2 floor on macOS, so the runtime half of these tests runs on
// the oldest bash present rather than whatever modern build PATH happens to offer.
const BASH = fs.existsSync("/bin/bash") ? "/bin/bash" : "bash";

/**
 * Pull the renderer out of its heredoc so the spec runs the shipped code.
 * @returns {string} the node program between the RENDER_JS_EOF markers
 */
function getRenderer() {
  const match = SOURCE.match(/<< 'RENDER_JS_EOF' \|\| true\n([\s\S]*?)\nRENDER_JS_EOF/);
  expect(match, "RENDER_JS_EOF heredoc not found in bash-git-helpers.profile.bash").toBeTruthy();
  return match[1];
}

const RENDERER = getRenderer();

/**
 * Lift one `function <name>() { ... }` definition out of a bash source file.
 * Used so the shell harness gets the real `is_help_arg`, without sourcing
 * common-env.sh (whose top-level battery probe can spawn powershell.exe).
 * @param {string} file Absolute path to the bash file.
 * @param {string} name The function name to extract.
 * @returns {string} the whole function definition
 */
function extractBashFunction(file, name) {
  const source = fs.readFileSync(file, "utf-8");
  const match = source.match(new RegExp(`^function ${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}$`, "m"));
  expect(match, `function ${name}() not found in ${file}`).toBeTruthy();
  return match[0];
}

const IS_HELP_ARG = extractBashFunction(COMMON_FUNCTIONS, "is_help_arg");

/**
 * Build a GraphQL pullRequest payload with sane defaults for everything not under test.
 * @param {object} overrides Fields to override on the pull request node.
 * @returns {object} the `{ data: { repository: { pullRequest } } }` envelope
 */
function pullRequest(overrides = {}) {
  const { checks = [], threads = [], ...rest } = overrides;
  return {
    data: {
      repository: {
        pullRequest: {
          url: "https://github.com/acme/api/pull/1",
          number: 1,
          title: "Retry token refresh on 401",
          isDraft: false,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          headRefName: "syle/retry-token-refresh",
          baseRefName: "main",
          author: { login: "syle" },
          repository: { nameWithOwner: "acme/api" },
          reviewDecision: "APPROVED",
          reviewThreads: { nodes: threads },
          commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS", contexts: { nodes: checks } } } }] },
          ...rest,
        },
      },
    },
  };
}

/** A finished, successful check run. */
const PASSING_CHECK = { __typename: "CheckRun", name: "unit-tests", status: "COMPLETED", conclusion: "SUCCESS" };

/** A green, approved, comment-free PR — the one the pending filter is meant to hide. */
const READY_TO_MERGE = { checks: [PASSING_CHECK], reviewDecision: "APPROVED" };

/** A green PR nobody has reviewed yet — pending in every mode. */
const AWAITING_REVIEW = { checks: [PASSING_CHECK], reviewDecision: "REVIEW_REQUIRED" };

/**
 * Run the extracted renderer over a set of PR payloads.
 * @param {object[]} prs GraphQL envelopes from `pullRequest()`.
 * @param {object} env Extra environment for the renderer.
 * @returns {{ rows: object[], stdout: string, stderr: string }} parsed rows plus raw streams
 */
function render(prs, env = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-spec-"));
  try {
    prs.forEach((pr, index) => {
      fs.writeFileSync(path.join(work, `pr-${index + 1}.json`), JSON.stringify(pr));
    });

    const stderrFile = path.join(work, "stderr.log");
    const stdout = execFileSync(process.execPath, ["-e", RENDERER], {
      encoding: "utf-8",
      env: { ...process.env, _LIST_PRS_WORK: work, _LIST_PRS_JSON: "1", ...env },
      stdio: ["ignore", "pipe", fs.openSync(stderrFile, "w")],
    });

    return {
      rows: JSON.parse(stdout),
      stdout,
      stderr: fs.readFileSync(stderrFile, "utf-8"),
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Render a single PR and hand back its row (or undefined when it was filtered out).
 * @param {object} overrides Fields to override on the pull request node.
 * @param {object} env Extra environment for the renderer.
 * @returns {object|undefined} the single rendered row
 */
function renderOne(overrides, env = {}) {
  return render([pullRequest(overrides)], env).rows[0];
}

/** A `gh` stand-in: logs its argv, then replays canned search / GraphQL payloads. */
const GH_STUB = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FAKE_GH_LOG"
case "\${1:-}" in
search)
  command cat "$FAKE_GH_SEARCH_JSON"
  ;;
api)
  _number=""
  for _arg in "$@"; do
    case "$_arg" in
    number=*) _number="\${_arg#number=}" ;;
    esac
  done
  command cat "$FAKE_GH_PR_DIR/$_number.json"
  ;;
esac
`;

/**
 * Source the real profile with a fake `gh` on PATH and run one shell command.
 * @param {string} command The shell command to run (e.g. `list_prs --all acme/api`).
 * @param {object[]} prs GraphQL envelopes the fake `gh api graphql` should return.
 * @returns {{ status: number, stdout: string, stderr: string, ghArgs: string[] }} the run
 */
function runShell(command, prs = []) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-shell-"));
  try {
    const bin = path.join(work, "bin");
    const prFolder = path.join(work, "prs");
    fs.mkdirSync(bin);
    fs.mkdirSync(prFolder);

    const search = prs.map((envelope) => {
      const pr = envelope.data.repository.pullRequest;
      fs.writeFileSync(path.join(prFolder, `${pr.number}.json`), JSON.stringify(envelope));
      return { number: pr.number, repository: pr.repository, url: pr.url };
    });
    const searchFile = path.join(work, "search.json");
    const ghLog = path.join(work, "gh.log");
    fs.writeFileSync(searchFile, JSON.stringify(search));
    fs.writeFileSync(ghLog, "");
    fs.writeFileSync(path.join(bin, "gh"), GH_STUB, { mode: 0o755 });
    // `type -P node` has to resolve even when vitest was launched through a shim.
    fs.symlinkSync(process.execPath, path.join(bin, "node"));

    const script = [IS_HELP_ARG, `source ${JSON.stringify(GIT_HELPERS_PROFILE)}`, command].join("\n");

    const result = execFileSync(BASH, ["-c", script], {
      encoding: "utf-8",
      cwd: work,
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        FAKE_GH_LOG: ghLog,
        FAKE_GH_SEARCH_JSON: searchFile,
        FAKE_GH_PR_DIR: prFolder,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    return {
      status: 0,
      stdout: result,
      stderr: "",
      ghArgs: fs.readFileSync(ghLog, "utf-8").split("\n").filter(Boolean),
    };
  } catch (err) {
    return {
      status: err.status,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      ghArgs: [],
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

describe("list_prs — ready-to-merge filter", () => {
  it("hides the fully green PR by default and keeps it when --all is set", () => {
    const green = { checks: [PASSING_CHECK], reviewDecision: "APPROVED" };

    expect(render([pullRequest(green)]).rows).toHaveLength(0);
    expect(render([pullRequest(green)], { _LIST_PRS_ALL: "1" }).rows[0].group).toBe("READY TO MERGE");
  });

  it("keeps an approved, green PR that still has an open thread", () => {
    const row = renderOne({
      checks: [PASSING_CHECK],
      threads: [{ isResolved: false, comments: { nodes: [{ author: { login: "alice", __typename: "User" } }] } }],
    });

    // Green + approved is not enough — an open thread is unfinished business.
    expect(row.group).toBe("READY TO MERGE (with comments)");
    expect(row.color).toBe("🟢");
  });
});

describe("list_prs — check classification", () => {
  it("reports a finished failing check as CI FAILED and names it", () => {
    const row = renderOne({
      checks: [PASSING_CHECK, { __typename: "CheckRun", name: "lint", status: "COMPLETED", conclusion: "FAILURE" }],
    });

    expect(row.ci).toBe("CI FAILED — lint");
    expect(row.color).toBe("🔴");
    expect(row.group).toBe("NEEDS ATTENTION");
  });

  it("reads a legacy StatusContext failure too", () => {
    // StatusContext carries `state` and has no `conclusion` at all — reading only
    // CheckRun.conclusion silently misses every repo whose CI posts commit statuses.
    const row = renderOne({ checks: [{ __typename: "StatusContext", context: "jenkins", state: "ERROR" }] });

    expect(row.ci).toBe("CI FAILED — jenkins");
    expect(row.failedCheck).toBe("jenkins");
  });

  it("counts an unfinished build as running, not failed", () => {
    const row = renderOne({
      checks: [{ __typename: "CheckRun", name: "build", status: "IN_PROGRESS", conclusion: null }],
    });

    expect(row.ci).toBe("BUILD IN PROGRESS (1 running)");
    expect(row.failedCheck).toBe("");
    expect(row.color).toBe("🟡");
  });

  it("never counts a pending human approval gate as a running build", () => {
    // Real payload shape: an approval gate sits IN_PROGRESS by design until a person
    // clicks. Counting it as a running build makes every PR look mid-CI forever.
    const row = renderOne({
      checks: [PASSING_CHECK, { __typename: "CheckRun", name: "Owner Approval", status: "IN_PROGRESS", conclusion: null }],
      reviewDecision: "REVIEW_REQUIRED",
    });

    expect(row.ci).toBe("CI PASSED");
    expect(row.runningChecks).toBe(0);
    expect(row.approvalGates).toBe(1);
    expect(row.review).toBe("AWAITING REVIEW");
  });

  it("never counts a failing review gate as a broken build", () => {
    // "Changes Resolution" reports FAILURE while threads are unresolved. That is a
    // review signal, not CI — scoring it red-for-CI sends someone chasing a build.
    const row = renderOne({
      checks: [PASSING_CHECK, { __typename: "CheckRun", name: "Changes Resolution", status: "COMPLETED", conclusion: "FAILURE" }],
      reviewDecision: "REVIEW_REQUIRED",
    });

    expect(row.ci).toBe("CI PASSED");
    expect(row.failedCheck).toBe("");
    expect(row.approvalGates).toBe(1);
  });

  it("lets BASHRC_PR_GATE_CHECK_PATTERN override which names are gates", () => {
    const checks = [{ __typename: "CheckRun", name: "waiting-on-legal", status: "IN_PROGRESS", conclusion: null }];
    const base = { checks, reviewDecision: "REVIEW_REQUIRED" };

    expect(renderOne(base).ci).toBe("BUILD IN PROGRESS (1 running)");
    expect(renderOne(base, { _LIST_PRS_GATE_PATTERN: "waiting-on-legal" }).ci).toBe("CI PASSED");
  });

  it("treats neutral and skipped conclusions as fine", () => {
    const row = renderOne({
      checks: [
        { __typename: "CheckRun", name: "flaky", status: "COMPLETED", conclusion: "SKIPPED" },
        { __typename: "CheckRun", name: "advisory", status: "COMPLETED", conclusion: "NEUTRAL" },
      ],
      reviewDecision: "REVIEW_REQUIRED",
    });

    expect(row.ci).toBe("CI PASSED");
  });
});

describe("list_prs — review and merge state", () => {
  it("marks changes requested red even when CI is green", () => {
    const row = renderOne({ checks: [PASSING_CHECK], reviewDecision: "CHANGES_REQUESTED" });

    expect(row.color).toBe("🔴");
    expect(row.review).toBe("CHANGES REQUESTED");
    expect(row.group).toBe("NEEDS ATTENTION");
  });

  it("marks a conflicting PR red and says so in the status", () => {
    const row = renderOne({ checks: [PASSING_CHECK], mergeable: "CONFLICTING" });

    expect(row.color).toBe("🔴");
    expect(row.status).toContain("MERGE CONFLICT");
  });

  it("reports a null reviewDecision as awaiting review, never approved", () => {
    const row = renderOne({ checks: [PASSING_CHECK], reviewDecision: null });

    expect(row.review).toBe("AWAITING REVIEW");
    expect(row.color).toBe("🟡");
    expect(row.group).toBe("NEED APPROVAL");
  });

  it("flags a branch that is behind its base", () => {
    const row = renderOne({ checks: [PASSING_CHECK], mergeStateStatus: "BEHIND", reviewDecision: "REVIEW_REQUIRED" });

    expect(row.status).toContain("BEHIND main");
  });
});

describe("list_prs — review threads", () => {
  it("splits human threads from bot threads on __typename, not a login suffix", () => {
    // Review bots post under plain-looking logins, so a `[bot]` suffix match reads a
    // bot nit as a human blocker — the difference between P1 and P4 work.
    const row = renderOne({
      checks: [PASSING_CHECK],
      reviewDecision: "REVIEW_REQUIRED",
      threads: [
        { isResolved: false, comments: { nodes: [{ author: { login: "copilot-pull-request-reviewer", __typename: "Bot" } }] } },
        { isResolved: false, comments: { nodes: [{ author: { login: "alice", __typename: "User" } }] } },
        { isResolved: true, comments: { nodes: [{ author: { login: "alice", __typename: "User" } }] } },
      ],
    });

    expect(row.openThreads).toBe(2);
    expect(row.openHumanThreads).toBe(1);
    expect(row.openBotThreads).toBe(1);
    expect(row.resolvedThreads).toBe(1);
    expect(row.status).toContain("2 open (1 human, 1 bot)");
  });
});

describe("list_prs — draft and WIP", () => {
  it("classifies a draft as NOT READY", () => {
    const row = renderOne({ checks: [PASSING_CHECK], isDraft: true, reviewDecision: "REVIEW_REQUIRED" });

    expect(row.group).toBe("NOT READY / WIP / DRAFT");
    expect(row.isDraft).toBe(true);
  });

  it("classifies a WIP / DO NOT MERGE title as NOT READY", () => {
    const row = renderOne({
      checks: [PASSING_CHECK],
      reviewDecision: "REVIEW_REQUIRED",
      title: "WIP: DO NOT MERGE — [api] Hoist the fabric config",
    });

    expect(row.group).toBe("NOT READY / WIP / DRAFT");
    expect(row.isWip).toBe(true);
  });

  it("does not read an innocent word containing wip as a WIP marker", () => {
    const row = renderOne({ checks: [PASSING_CHECK], reviewDecision: "REVIEW_REQUIRED", title: "Fix swiped-card telemetry" });

    expect(row.isWip).toBe(false);
    expect(row.group).toBe("NEED APPROVAL");
  });
});

describe("list_prs — rendering", () => {
  it("sorts oldest first so the most-forgotten PR leads", () => {
    const { rows } = render([
      pullRequest({ url: "https://github.com/acme/api/pull/3", createdAt: "2026-03-01T00:00:00Z", reviewDecision: null }),
      pullRequest({ url: "https://github.com/acme/api/pull/1", createdAt: "2026-01-01T00:00:00Z", reviewDecision: null }),
      pullRequest({ url: "https://github.com/acme/api/pull/2", createdAt: "2026-02-01T00:00:00Z", reviewDecision: null }),
    ]);

    expect(rows.map((row) => row.url.split("/").pop())).toEqual(["1", "2", "3"]);
  });

  it("strips the [<repo>] title prefix the URL already carries", () => {
    const row = renderOne({
      checks: [PASSING_CHECK],
      reviewDecision: null,
      title: "[api] Retry token refresh on 401",
    });

    expect(row.title).toBe("Retry token refresh on 401");
  });

  it("keeps a bracketed prefix that is not the repo name", () => {
    const row = renderOne({ checks: [PASSING_CHECK], reviewDecision: null, title: "[merge 1/4] Publish the proto" });

    expect(row.title).toBe("[merge 1/4] Publish the proto");
  });

  it("prints title on its own line, then the URL, and no metadata without --verbose", () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-spec-"));
    try {
      fs.writeFileSync(
        path.join(work, "pr-1.json"),
        JSON.stringify(pullRequest({ ...AWAITING_REVIEW, title: "Retry token refresh on 401" })),
      );
      const stdout = execFileSync(process.execPath, ["-e", RENDERER], {
        encoding: "utf-8",
        env: { ...process.env, _LIST_PRS_WORK: work, _LIST_PRS_JSON: "0" },
        stdio: ["ignore", "pipe", "ignore"],
      });

      const lines = stdout.split("\n");
      // Three-line entry: title, then the URL on its own click-and-copy line. Piped
      // output (not a TTY) carries no ANSI escapes, so the strings compare cleanly.
      expect(lines[0]).toBe("Retry token refresh on 401");
      expect(lines[1]).toBe("https://github.com/acme/api/pull/1");
      // No leading indent, and no metadata line unless --verbose is set.
      expect(lines[2]).toBe("");
      expect(stdout).not.toContain("CI PASSED");
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  it("adds the metadata line only under --verbose", () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-spec-"));
    try {
      fs.writeFileSync(
        path.join(work, "pr-1.json"),
        JSON.stringify(pullRequest({ ...AWAITING_REVIEW, title: "Retry token refresh on 401" })),
      );
      const stdout = execFileSync(process.execPath, ["-e", RENDERER], {
        encoding: "utf-8",
        env: { ...process.env, _LIST_PRS_WORK: work, _LIST_PRS_JSON: "0", _LIST_PRS_VERBOSE: "1" },
        stdio: ["ignore", "pipe", "ignore"],
      });

      const lines = stdout.split("\n");
      expect(lines[0]).toBe("Retry token refresh on 401");
      expect(lines[1]).toBe("https://github.com/acme/api/pull/1");
      expect(lines[2].startsWith("2026-01-01 00:00 (")).toBe(true);
      expect(lines[2]).toContain("· 🟡 CI PASSED · AWAITING REVIEW");
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  it("colorizes title and URL only when stdout is a TTY", () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-spec-"));
    try {
      fs.writeFileSync(path.join(work, "pr-1.json"), JSON.stringify(pullRequest(AWAITING_REVIEW)));
      const stdout = execFileSync(process.execPath, ["-e", RENDERER], {
        encoding: "utf-8",
        env: { ...process.env, _LIST_PRS_WORK: work, _LIST_PRS_JSON: "0" },
        stdio: ["ignore", "pipe", "ignore"],
      });

      // Piped (non-TTY) output must stay escape-free so an agent or file never has to
      // strip ANSI. The TTY path is exercised by the renderer's isTTY branch directly.
      expect(stdout).not.toContain("\u001b[");
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  it("keeps the [Draft] tag ahead of the title on the title line", () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-spec-"));
    try {
      fs.writeFileSync(path.join(work, "pr-1.json"), JSON.stringify(pullRequest({ ...AWAITING_REVIEW, isDraft: true })));
      const stdout = execFileSync(process.execPath, ["-e", RENDERER], {
        encoding: "utf-8",
        env: { ...process.env, _LIST_PRS_WORK: work, _LIST_PRS_JSON: "0" },
        stdio: ["ignore", "pipe", "ignore"],
      });

      expect(stdout.split("\n")[0]).toBe("[Draft] Retry token refresh on 401");
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  it("counts a PR whose fetch produced unreadable JSON instead of dropping it silently", () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-spec-"));
    try {
      fs.writeFileSync(path.join(work, "pr-1.json"), "");
      const stderrFile = path.join(work, "stderr.log");
      execFileSync(process.execPath, ["-e", RENDERER], {
        encoding: "utf-8",
        env: { ...process.env, _LIST_PRS_WORK: work, _LIST_PRS_JSON: "1" },
        stdio: ["ignore", "pipe", fs.openSync(stderrFile, "w")],
      });

      expect(fs.readFileSync(stderrFile, "utf-8")).toContain("1 PR(s) could not be fetched");
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });
});

describe("list_prs — shell behavior", () => {
  const prs = [
    pullRequest({ ...READY_TO_MERGE, number: 1, url: "https://github.com/acme/api/pull/1", title: "Ready to merge" }),
    pullRequest({ ...AWAITING_REVIEW, number: 2, url: "https://github.com/acme/api/pull/2", title: "Still waiting" }),
  ];

  it("hides the ready-to-merge PR by default", () => {
    const run = runShell("list_prs acme/api", prs);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("https://github.com/acme/api/pull/2");
    expect(run.stdout).not.toContain("https://github.com/acme/api/pull/1");
  });

  it("keeps the ready-to-merge PR with --all", () => {
    const run = runShell("list_prs --all acme/api", prs);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("https://github.com/acme/api/pull/1");
    expect(run.stdout).toContain("https://github.com/acme/api/pull/2");
  });

  it("passes an explicit repo slug to gh as a --repo flag", () => {
    const run = runShell("list_prs acme/api", prs);

    expect(run.status).toBe(0);
    expect(run.ghArgs[0]).toContain("--repo acme/api");

    const json = runShell("list_prs --json acme/api", prs);
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout).map((row) => row.number)).toEqual([2]);
  });

  it("searches every repo globally when neither a repo nor --cwd is given", () => {
    // Default scope is global — no repo argument reaches gh, so the search spans
    // every repo the author has a PR in rather than the current folder.
    const run = runShell("list_prs --all", prs);

    expect(run.status).toBe(0);
    expect(run.ghArgs[0]).not.toContain("--repo");
    expect(run.stdout).toContain("/pull/1");
    expect(run.stdout).toContain("/pull/2");
  });

  it("adds the metadata line only when --verbose is passed", () => {
    const plain = runShell("list_prs --all acme/api", prs);
    expect(plain.stdout).not.toContain("CI PASSED");
    expect(plain.stdout).not.toContain("AWAITING REVIEW");

    const verbose = runShell("list_prs --all --verbose acme/api", prs);
    expect(verbose.stdout).toContain("AWAITING REVIEW");
  });

  it("list_prs_needs_attention hides the ready PR and list_prs_all_open keeps it", () => {
    const attention = runShell("list_prs_needs_attention acme/api", prs);
    const all = runShell("list_prs_all_open acme/api", prs);

    expect(attention.stdout).not.toContain("/pull/1");
    expect(attention.stdout).toContain("/pull/2");
    expect(all.stdout).toContain("/pull/1");
    expect(all.stdout).toContain("/pull/2");
  });

  it("passes options through the wrappers untouched", () => {
    const run = runShell("list_prs_all_open --json --author=alice acme/api", prs);

    expect(run.status).toBe(0);
    expect(
      JSON.parse(run.stdout)
        .map((row) => row.number)
        .sort(),
    ).toEqual([1, 2]);
    expect(run.ghArgs[0]).toContain("--author=alice");
  });

  it("rejects an unknown option instead of treating it as a repo", () => {
    const run = runShell("list_prs --nope acme/api", prs);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("unknown option '--nope'");
  });

  it("prints inline help for every entry point", () => {
    ["list_prs", "list_prs_needs_attention", "list_prs_all_open"].forEach((name) => {
      const run = runShell(`${name} --help`, prs);

      // Inline help is the source of truth, and returns 1 like every other helper here.
      expect(run.status).toBe(1);
      expect(run.stdout).toContain(`${name}: `);
    });
  });
});

describe("list_prs — shell wiring", () => {
  it("defines each entry point and the repo resolver exactly once", () => {
    ["list_prs", "list_prs_needs_attention", "list_prs_all_open", "_list_prs_repos"].forEach((name) => {
      expect(SOURCE.match(new RegExp(`^function ${name}\\(\\)`, "gm")) || [], name).toHaveLength(1);
    });
  });

  it("keeps the wrappers as functions, not aliases, so non-interactive shells can call them", () => {
    // Aliases are not expanded in a non-interactive bash, and the agent commands call
    // `list_prs_all_open --json` from exactly that kind of shell.
    expect(SOURCE).not.toMatch(/^alias list_prs/m);
    // The old positional/alias entry points are gone — every reading is a --flag now.
    expect(SOURCE).not.toMatch(/\blist_pending_prs\b/);
    expect(SOURCE).not.toMatch(/\blist_open_prs\b/);
    expect(SOURCE).toMatch(/^ {2}list_prs "\$@"$/m);
    expect(SOURCE).toMatch(/^ {2}list_prs --all "\$@"$/m);
  });

  it("offers inline help through is_help_arg on every entry point", () => {
    ["list_prs", "list_prs_needs_attention", "list_prs_all_open"].forEach((name) => {
      expect(SOURCE).toMatch(new RegExp(`function ${name}\\(\\) \\{\\n {2}if is_help_arg "\\$\\{1:-\\}"; then`));
    });
  });

  it("drives every reading off --flags, with no positional toggle left", () => {
    // The ready-to-merge filter and repo scope are both --flags now; nothing reads a
    // leading 0/1 or runs it through is_truthy.
    expect(SOURCE).toMatch(/--all\) keep_ready=1 ;;/);
    expect(SOURCE).toMatch(/--cwd\) use_cwd=1 ;;/);
    expect(SOURCE).toMatch(/--verbose\) verbose=1 ;;/);
    expect(SOURCE).not.toContain("is_truthy");
  });

  it("keeps every heredoc at top level, never nested inside a command substitution", () => {
    // bash 3.2 keeps counting quotes through a heredoc body nested in $( ... ), so one
    // apostrophe in a JS comment there corrupts the parse of the whole profile.
    ["PAIR_JS_EOF", "RENDER_JS_EOF", "GQL_EOF"].forEach((marker) => {
      expect(SOURCE).toContain(`<< '${marker}'`);
    });
    expect(SOURCE).toMatch(/IFS= read -r -d '' render_js << 'RENDER_JS_EOF'/);
  });

  it("resolves owner/repo from the remote, never from the folder name", () => {
    expect(SOURCE).toContain('git -C "$spec" remote get-url origin');
    expect(SOURCE).not.toMatch(/basename "\$\(pwd\)"/);
  });

  it("strips every GitHub remote form its repos can arrive in", () => {
    // ssh://<org-alias>@github.com/, <org-alias>@github.com:, and https:// all appear
    // in the wild on the same machine — a git@-only strip silently loses repos.
    expect(SOURCE).toContain("s#^ssh://[^/]*@github\\.com/##");
    expect(SOURCE).toContain("s#^[^/]*@github\\.com:##");
    expect(SOURCE).toContain("s#^https://[^/]*github\\.com/##");
  });

  it("passes an explicit --limit so gh search cannot silently truncate at 30", () => {
    expect(SOURCE).toMatch(/gh search prs .*--limit "\$limit"/);
    expect(SOURCE).toContain("possibly truncated");
  });

  it("cleans up its work folder on every exit path", () => {
    expect((SOURCE.match(/command rm -rf "\$work"/g) || []).length).toBeGreaterThanOrEqual(4);
  });
});
