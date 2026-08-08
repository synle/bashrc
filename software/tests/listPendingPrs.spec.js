/**
 * Classification tests for `list_pending_prs` in bash-git-helpers.profile.bash.
 *
 * The bash half of that function is plumbing — resolve repos, fan `gh` calls out,
 * drop the JSON in a folder. All the judgement lives in the embedded node renderer:
 * which check counts as a broken build, which is a human approval gate that never
 * resolves on a timer, whether a review thread was opened by a person or a bot, and
 * therefore whether a PR is still pending at all. Getting that wrong reports a
 * blocked PR as green, which is the one failure mode nobody notices.
 *
 * The renderer is extracted from the profile and replayed against synthetic
 * GraphQL payloads, so the test drives the real source rather than a copy.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GIT_HELPERS_PROFILE = path.join(ROOT_DIR, "software/scripts/bash-git-helpers.profile.bash");
const SOURCE = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");

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

/**
 * Run the extracted renderer over a set of PR payloads.
 * @param {object[]} prs GraphQL envelopes from `pullRequest()`.
 * @param {object} env Extra environment for the renderer.
 * @returns {{ rows: object[], stdout: string, stderr: string }} parsed rows plus raw streams
 */
function render(prs, env = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "lpp-spec-"));
  try {
    prs.forEach((pr, index) => {
      fs.writeFileSync(path.join(work, `pr-${index + 1}.json`), JSON.stringify(pr));
    });

    const stderrFile = path.join(work, "stderr.log");
    const stdout = execFileSync(process.execPath, ["-e", RENDERER], {
      encoding: "utf-8",
      env: { ...process.env, _PENDING_PRS_WORK: work, _PENDING_PRS_JSON: "1", ...env },
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

describe("list_pending_prs — pending filter", () => {
  it("drops a fully green PR and keeps it with --all", () => {
    const green = { checks: [PASSING_CHECK], reviewDecision: "APPROVED" };

    expect(render([pullRequest(green)]).rows).toHaveLength(0);
    expect(render([pullRequest(green)], { _PENDING_PRS_ALL: "1" }).rows[0].group).toBe("READY TO MERGE");
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

describe("list_pending_prs — check classification", () => {
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
    expect(renderOne(base, { _PENDING_PRS_GATE_PATTERN: "waiting-on-legal" }).ci).toBe("CI PASSED");
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

describe("list_pending_prs — review and merge state", () => {
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

describe("list_pending_prs — review threads", () => {
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

describe("list_pending_prs — draft and WIP", () => {
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

describe("list_pending_prs — rendering", () => {
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

  it("leads the text render with the full URL so a line stays clickable", () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "lpp-spec-"));
    try {
      fs.writeFileSync(path.join(work, "pr-1.json"), JSON.stringify(pullRequest({ checks: [PASSING_CHECK], reviewDecision: null })));
      const stdout = execFileSync(process.execPath, ["-e", RENDERER], {
        encoding: "utf-8",
        env: { ...process.env, _PENDING_PRS_WORK: work, _PENDING_PRS_JSON: "0" },
        stdio: ["ignore", "pipe", "ignore"],
      });

      expect(stdout.split("\n")[0].startsWith("https://github.com/acme/api/pull/1 ")).toBe(true);
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  it("counts a PR whose fetch produced unreadable JSON instead of dropping it silently", () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "lpp-spec-"));
    try {
      fs.writeFileSync(path.join(work, "pr-1.json"), "");
      const stderrFile = path.join(work, "stderr.log");
      execFileSync(process.execPath, ["-e", RENDERER], {
        encoding: "utf-8",
        env: { ...process.env, _PENDING_PRS_WORK: work, _PENDING_PRS_JSON: "1" },
        stdio: ["ignore", "pipe", fs.openSync(stderrFile, "w")],
      });

      expect(fs.readFileSync(stderrFile, "utf-8")).toContain("1 PR(s) could not be fetched");
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });
});

describe("list_pending_prs — shell wiring", () => {
  it("defines the function and its repo resolver exactly once", () => {
    expect(SOURCE.match(/^function list_pending_prs\(\)/gm) || []).toHaveLength(1);
    expect(SOURCE.match(/^function _list_pending_prs_repos\(\)/gm) || []).toHaveLength(1);
  });

  it("offers inline help through is_help_arg", () => {
    expect(SOURCE).toMatch(/function list_pending_prs\(\) \{\n {2}if is_help_arg "\$\{1:-\}"; then/);
  });

  it("keeps every heredoc at top level, never nested inside a command substitution", () => {
    // bash 3.2 keeps counting quotes through a heredoc body nested in $( ... ), so one
    // apostrophe in a JS comment there corrupts the parse of the whole profile.
    ["PAIR_JS_EOF", "RENDER_JS_EOF", "GQL_EOF", "REPO_LIST_EOF"].forEach((marker) => {
      expect(SOURCE).toContain(`<< '${marker}'`.replace("'REPO_LIST_EOF'", "REPO_LIST_EOF"));
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
