/**
 * Tests for the `list_prs` CLI (software/scripts/git_pr_list.cjs), its shared
 * installer (software/scripts/git-functions.js), and the two shell entry points
 * (`pr_list_needs_attention` / `pr_list_all_open`) in
 * bash-git-helpers.profile.bash.
 *
 * Three layers, because they fail differently:
 *
 *   1. The CLI holds all the judgement — which check counts as a broken build,
 *      which is a human approval gate that never resolves on a timer, whether a
 *      review thread was opened by a person or a bot, and therefore whether a PR
 *      is still pending at all. Getting that wrong reports a blocked PR as green,
 *      the one failure mode nobody notices. It is driven end to end by running
 *      the real payload with a fake `gh` on PATH against synthetic payloads, so
 *      scope resolution, filtering, classification, and rendering are all the
 *      shipped code.
 *
 *   2. The installer is plumbing — copy the payload to ~/.local/bin and mark it
 *      executable. Checked at the source level (right destination, right source)
 *      plus a `node --check` of the payload so a broken CLI never ships.
 *
 *   3. The shell wrappers are thin delegators — `pr_list_all_open` must add
 *      `--all`, both must forward the rest, and the old aliases must be gone.
 *      Driven by sourcing the real profile with a fake `list_prs` on PATH.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI_PATH = path.join(ROOT_DIR, "software/scripts/git.pr_list.cjs");
const MERGE_CLI_PATH = path.join(ROOT_DIR, "software/scripts/git.pr_merge.cjs");
const INSTALLER_PATH = path.join(ROOT_DIR, "software/scripts/git-functions.js");
const GIT_HELPERS_PROFILE = path.join(ROOT_DIR, "software/scripts/bash-git-helpers.profile.bash");
const COMMON_FUNCTIONS = path.join(ROOT_DIR, "software/bootstrap/common-functions.bash");

const CLI_SOURCE = fs.readFileSync(CLI_PATH, "utf-8");
const MERGE_CLI_SOURCE = fs.readFileSync(MERGE_CLI_PATH, "utf-8");
const INSTALLER_SOURCE = fs.readFileSync(INSTALLER_PATH, "utf-8");
const PROFILE_SOURCE = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");

// /bin/bash is the 3.2 floor on macOS, so the shell half runs on the oldest bash
// present rather than whatever modern build PATH happens to offer.
const BASH = fs.existsSync("/bin/bash") ? "/bin/bash" : "bash";

/** A `gh` stand-in: answers `--version`, then replays canned search / GraphQL payloads. */
const GH_STUB = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FAKE_GH_LOG"
_track_start() {
  while ! mkdir "$FAKE_GH_CONCURRENCY_STATE.lock" 2>/dev/null; do sleep 0.001; done
  _active=0
  [ -f "$FAKE_GH_CONCURRENCY_STATE" ] && _active=\$(command cat "$FAKE_GH_CONCURRENCY_STATE")
  _active=$((_active + 1))
  printf '%s\\n' "$_active" > "$FAKE_GH_CONCURRENCY_STATE"
  _max=0
  [ -f "$FAKE_GH_MAX_CONCURRENCY" ] && _max=\$(command cat "$FAKE_GH_MAX_CONCURRENCY")
  [ "$_active" -gt "$_max" ] && printf '%s\\n' "$_active" > "$FAKE_GH_MAX_CONCURRENCY"
  rmdir "$FAKE_GH_CONCURRENCY_STATE.lock"
}
_track_end() {
  while ! mkdir "$FAKE_GH_CONCURRENCY_STATE.lock" 2>/dev/null; do sleep 0.001; done
  _active=\$(command cat "$FAKE_GH_CONCURRENCY_STATE")
  printf '%s\\n' "$((_active - 1))" > "$FAKE_GH_CONCURRENCY_STATE"
  rmdir "$FAKE_GH_CONCURRENCY_STATE.lock"
}
case "\${1:-}" in
--version) echo "gh version 2.0.0 (stub)"; exit 0 ;;
search) command cat "$FAKE_GH_SEARCH_JSON" ;;
api)
  _number=""
  for _arg in "$@"; do
    case "$_arg" in
    number=*) _number="\${_arg#number=}" ;;
    esac
  done
  _track_start
  [ -n "\${FAKE_GH_DELAY:-}" ] && sleep "$FAKE_GH_DELAY"
  command cat "$FAKE_GH_PR_DIR/$_number.json"
  _status=$?
  _track_end
  exit $_status
  ;;
esac
`;

/**
 * Build a GraphQL pullRequest envelope with sane defaults for everything not under test.
 * @param {object} overrides Fields to override on the pull request node (plus `checks` / `threads`).
 * @returns {object} the `{ data: { repository: { pullRequest } } }` envelope
 */
function pullRequest(overrides = {}) {
  const { checks = [], threads = [], number = 1, ...rest } = overrides;
  return {
    data: {
      repository: {
        pullRequest: {
          url: `https://github.com/acme/api/pull/${number}`,
          number,
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
/** A finished, failed check run. */
const FAILING_CHECK = { __typename: "CheckRun", name: "unit-tests", status: "COMPLETED", conclusion: "FAILURE" };
/** A still-running check run. */
const RUNNING_CHECK = { __typename: "CheckRun", name: "integration", status: "IN_PROGRESS", conclusion: null };

/** A green, approved, comment-free PR — the one the pending filter is meant to hide. */
const READY_TO_MERGE = { checks: [PASSING_CHECK], reviewDecision: "APPROVED" };
/** A green PR nobody has reviewed yet — pending in every mode. */
const AWAITING_REVIEW = { checks: [PASSING_CHECK], reviewDecision: "REVIEW_REQUIRED" };

/**
 * Run the real CLI with a fake `gh` on PATH.
 * @param {string[]} argv CLI arguments (e.g. `["--all", "--json"]`).
 * @param {object[]} prs GraphQL envelopes the fake `gh api graphql` should return.
 * @param {object} [opts]
 * @param {string} [opts.cwd] Working directory to run in (defaults to the temp work dir).
 * @param {object} [opts.env] Extra environment variables for the CLI.
 * @returns {{ status: number, stdout: string, stderr: string, ghArgs: string[], ghMaxConcurrency: number }}
 */
function runCli(argv = [], prs = [], opts = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-cli-"));
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
    const ghConcurrencyState = path.join(work, "gh.active");
    const ghMaxConcurrency = path.join(work, "gh.max");
    const stderrFile = path.join(work, "stderr.log");
    fs.writeFileSync(searchFile, JSON.stringify(search));
    fs.writeFileSync(ghLog, "");
    fs.writeFileSync(ghConcurrencyState, "0");
    fs.writeFileSync(ghMaxConcurrency, "0");
    fs.writeFileSync(path.join(bin, "gh"), GH_STUB, { mode: 0o755 });

    // execFileSync only returns stdout; capture stderr to a file so it survives a
    // clean (status 0) exit too.
    const stderrFd = fs.openSync(stderrFile, "w");
    let status = 0;
    let stdout = "";
    try {
      stdout = execFileSync(process.execPath, [CLI_PATH, ...argv], {
        encoding: "utf-8",
        cwd: opts.cwd || work,
        env: {
          ...process.env,
          NO_COLOR: "1",
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          FAKE_GH_LOG: ghLog,
          FAKE_GH_SEARCH_JSON: searchFile,
          FAKE_GH_PR_DIR: prFolder,
          FAKE_GH_CONCURRENCY_STATE: ghConcurrencyState,
          FAKE_GH_MAX_CONCURRENCY: ghMaxConcurrency,
          ...(opts.env || {}),
        },
        stdio: ["ignore", "pipe", stderrFd],
      });
    } catch (err) {
      status = err.status ?? 1;
      stdout = err.stdout || "";
    } finally {
      fs.closeSync(stderrFd);
    }

    return {
      status,
      stdout,
      stderr: fs.readFileSync(stderrFile, "utf-8"),
      ghArgs: fs.readFileSync(ghLog, "utf-8").split("\n").filter(Boolean),
      ghMaxConcurrency: Number(fs.readFileSync(ghMaxConcurrency, "utf-8").trim()),
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Run the CLI and parse its `--json` stdout into rows.
 * @param {object[]} prs GraphQL envelopes.
 * @param {string[]} [extraArgs] Additional CLI flags.
 * @returns {object[]} the parsed rows
 */
function rowsFor(prs, extraArgs = []) {
  const { stdout } = runCli(["--json", ...extraArgs], prs);
  return JSON.parse(stdout);
}

/**
 * Run a single PR through the CLI and hand back its row (or undefined when filtered out).
 * @param {object} overrides Fields to override on the pull request node.
 * @param {string[]} [extraArgs] Additional CLI flags.
 * @returns {object|undefined}
 */
function rowFor(overrides, extraArgs = []) {
  return rowsFor([pullRequest(overrides)], extraArgs)[0];
}

// ---------------------------------------------------------------------------

describe("list_prs — ready-to-merge filter", () => {
  it("hides the fully green PR by default and keeps it when --all is set", () => {
    expect(rowsFor([pullRequest(READY_TO_MERGE)])).toHaveLength(0);
    expect(rowsFor([pullRequest(READY_TO_MERGE)], ["--all"])).toHaveLength(1);
  });

  it("keeps a green PR that still has open threads even without --all", () => {
    const withThread = {
      checks: [PASSING_CHECK],
      reviewDecision: "APPROVED",
      threads: [{ isResolved: false, comments: { nodes: [{ author: { login: "carol", __typename: "User" } }] } }],
    };
    const row = rowFor(withThread);
    expect(row.group).toBe("READY TO MERGE (with comments)");
  });

  it("always keeps a PR still awaiting review", () => {
    expect(rowFor(AWAITING_REVIEW).group).toBe("NEED APPROVAL");
  });
});

describe("list_prs — classification", () => {
  it("flags a failed check red with the check name", () => {
    const row = rowFor({ checks: [FAILING_CHECK], reviewDecision: "APPROVED" });
    expect(row.signal).toBe("🔴");
    expect(row.group).toBe("NEEDS ATTENTION");
    expect(row.status).toContain("CI FAILED — unit-tests");
  });

  it("counts a still-running check as a build in progress, not a failure", () => {
    const row = rowFor({ checks: [RUNNING_CHECK], reviewDecision: "REVIEW_REQUIRED" });
    expect(row.signal).toBe("🟡");
    expect(row.status).toContain("BUILD IN PROGRESS (1 running)");
  });

  it("treats a pending approval-gate check as a gate, never as running CI", () => {
    const gate = { __typename: "StatusContext", context: "codeowner-approval", state: "PENDING" };
    const row = rowFor({ checks: [PASSING_CHECK, gate], reviewDecision: "REVIEW_REQUIRED" });
    expect(row.status).toContain("CI PASSED");
    expect(row.status).toContain("⏳ 1 approval gate");
  });

  it("honors BASHRC_PR_GATE_CHECK_PATTERN for what counts as a gate", () => {
    const custom = { __typename: "StatusContext", context: "waiting-on-legal", state: "PENDING" };
    const { stdout } = runCli(["--json"], [pullRequest({ checks: [PASSING_CHECK, custom], reviewDecision: "REVIEW_REQUIRED" })], {
      env: { BASHRC_PR_GATE_CHECK_PATTERN: "waiting-on-legal" },
    });
    const row = JSON.parse(stdout)[0];
    expect(row.status).toContain("CI PASSED");
    expect(row.status).toContain("⏳ 1 approval gate");
  });

  it("marks changes-requested red", () => {
    const row = rowFor({ checks: [PASSING_CHECK], reviewDecision: "CHANGES_REQUESTED" });
    expect(row.signal).toBe("🔴");
    expect(row.status).toContain("CHANGES REQUESTED");
  });

  it("surfaces a merge conflict", () => {
    const row = rowFor({ checks: [PASSING_CHECK], reviewDecision: "APPROVED", mergeable: "CONFLICTING" });
    expect(row.signal).toBe("🔴");
    expect(row.status).toContain("MERGE CONFLICT");
  });

  it("separates human from bot review threads", () => {
    const threads = [
      { isResolved: false, comments: { nodes: [{ author: { login: "carol", __typename: "User" } }] } },
      { isResolved: false, comments: { nodes: [{ author: { login: "dependabot", __typename: "Bot" } }] } },
      { isResolved: true, comments: { nodes: [{ author: { login: "carol", __typename: "User" } }] } },
    ];
    const row = rowFor({ checks: [PASSING_CHECK], reviewDecision: "REVIEW_REQUIRED", threads });
    expect(row.status).toContain("💬 2 open (1 human, 1 bot)");
  });

  it("classifies a WIP/draft title into the not-ready group", () => {
    expect(rowFor({ isDraft: true, checks: [PASSING_CHECK] }).group).toBe("NOT READY / WIP / DRAFT");
    expect(rowFor({ title: "WIP: refactor auth", checks: [PASSING_CHECK] }).group).toBe("NOT READY / WIP / DRAFT");
  });

  it("detects DNM and normalizes leading WIP markers to one prefix", () => {
    const row = rowFor({
      title: "WIP: DO NOT MERGE — Repoint -default LCD pipeline to stage-only (Phase 2: cutover)",
      reviewDecision: "REVIEW_REQUIRED",
    });
    expect(row.isWip).toBe(true);
    expect(row.title).toBe("WIP: Repoint -default LCD pipeline to stage-only (Phase 2: cutover)");

    const dnm = rowFor({ title: "DNM Add production-only LCD pipeline", reviewDecision: "REVIEW_REQUIRED" });
    expect(dnm.title).toBe("WIP: Add production-only LCD pipeline");
  });

  it("strips a leading [repo] tag that just repeats the PR's own repo", () => {
    expect(rowFor({ title: "[api] Retry token refresh", reviewDecision: "REVIEW_REQUIRED" }).title).toBe("Retry token refresh");
    expect(rowFor({ title: "[infra] Retry token refresh", reviewDecision: "REVIEW_REQUIRED" }).title).toBe("[infra] Retry token refresh");
  });

  it("flags a BEHIND base branch", () => {
    const row = rowFor({ checks: [PASSING_CHECK], reviewDecision: "REVIEW_REQUIRED", mergeStateStatus: "BEHIND", baseRefName: "main" });
    expect(row.status).toContain("BEHIND main");
  });
});

describe("list_prs — scope resolution", () => {
  it("searches all of GitHub by default (no --repo flags)", () => {
    const { ghArgs } = runCli([], [pullRequest(AWAITING_REVIEW)]);
    const searchLine = ghArgs.find((line) => line.startsWith("search prs"));
    expect(searchLine).toBeTruthy();
    expect(searchLine).not.toContain("--repo");
  });

  it("passes explicit repos through as --repo flags", () => {
    const { ghArgs } = runCli(["acme/api", "acme/web"], [pullRequest(AWAITING_REVIEW)]);
    const searchLine = ghArgs.find((line) => line.startsWith("search prs"));
    expect(searchLine).toContain("--repo acme/api");
    expect(searchLine).toContain("--repo acme/web");
  });

  it("prints the drop---cwd hint and never calls search when --cwd finds nothing", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-empty-"));
    try {
      const { stderr, stdout, ghArgs } = runCli(["--cwd"], [], { cwd: empty });
      expect(stderr).toContain("drop --cwd");
      expect(stdout).toBe("");
      expect(ghArgs.some((line) => line.startsWith("search prs"))).toBe(false);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it("forwards --author and --limit to gh search", () => {
    const { ghArgs } = runCli(["--author=alice", "--limit=5"], [pullRequest(AWAITING_REVIEW)]);
    const searchLine = ghArgs.find((line) => line.startsWith("search prs"));
    expect(searchLine).toContain("--author=alice");
    expect(searchLine).toContain("--limit=5");
  });

  it("exits non-zero on an unknown flag", () => {
    const { status, stderr } = runCli(["--nope"], []);
    expect(status).not.toBe(0);
    expect(stderr).toContain("unknown option");
  });
});

describe("list_prs — output shape", () => {
  it("prints title then URL, two lines, and keeps STDOUT free of progress noise", () => {
    const { stdout, stderr } = runCli([], [pullRequest(AWAITING_REVIEW)]);
    const lines = stdout.split("\n").filter(Boolean);
    expect(lines[0]).toBe("⏳ syle/retry-token-refresh : Retry token refresh on 401");
    expect(lines[1]).toBe("https://github.com/acme/api/pull/1");
    expect(lines).toHaveLength(2);
    expect(stdout).not.toContain(">>>");
    expect(stderr).toContain(">>>"); // the scan/footer lines live on stderr
  });

  it("adds a metadata line only with --verbose", () => {
    const plain = runCli([], [pullRequest(AWAITING_REVIEW)]).stdout;
    expect(plain).not.toContain("· 🟡");
    const verbose = runCli(["--verbose"], [pullRequest(AWAITING_REVIEW)]).stdout;
    const ageDays = Math.floor((Date.now() - Date.parse("2026-01-01T00:00:00Z")) / 86400000);
    expect(verbose).toContain(`(${ageDays}d) · 🟡 CI PASSED · AWAITING REVIEW`);
  });

  it("prints only URLs with --links", () => {
    const { stdout } = runCli(["--links"], [pullRequest(AWAITING_REVIEW), pullRequest({ ...AWAITING_REVIEW, number: 2 })]);
    expect(stdout.split("\n").filter(Boolean)).toEqual(["https://github.com/acme/api/pull/1", "https://github.com/acme/api/pull/2"]);
  });

  it("prints a [draft] tag on the title line", () => {
    const { stdout } = runCli([], [pullRequest({ isDraft: true, checks: [PASSING_CHECK] })]);
    expect(stdout).toContain("🛑 [draft] syle/retry-token-refresh : Retry token refresh on 401");
  });

  it("prints the head branch between the tags and the title, and never on the URL line", () => {
    // The branch is the handle every local command wants (worktree, checkout, log), so
    // it leads the title — but the URL line stays machine-readable and bare.
    const lines = runCli([], [pullRequest(AWAITING_REVIEW)])
      .stdout.split("\n")
      .filter(Boolean);
    expect(lines[0]).toBe("⏳ syle/retry-token-refresh : Retry token refresh on 401");
    expect(lines[1]).toBe("https://github.com/acme/api/pull/1");
    expect(runCli(["--links"], [pullRequest(AWAITING_REVIEW)]).stdout).not.toContain("syle/retry-token-refresh");
  });

  it("keeps the branch out of the JSON title field", () => {
    const row = rowFor(AWAITING_REVIEW);
    expect(row.title).toBe("Retry token refresh on 401");
    expect(row.headRefName).toBe("syle/retry-token-refresh");
  });

  it("emits no ANSI escapes when NO_COLOR / piped", () => {
    const { stdout } = runCli([], [pullRequest(AWAITING_REVIEW)]);
    // eslint-disable-next-line no-control-regex
    expect(stdout).not.toMatch(/\x1b\[/);
  });

  it("sorts oldest first", () => {
    const older = pullRequest({ ...AWAITING_REVIEW, number: 1, createdAt: "2026-01-01T00:00:00Z" });
    const newer = pullRequest({ ...AWAITING_REVIEW, number: 2, createdAt: "2026-02-01T00:00:00Z" });
    const rows = rowsFor([newer, older]);
    expect(rows.map((r) => r.number)).toEqual([1, 2]);
  });

  it("places WIP entries after non-WIP entries regardless of age", () => {
    const ready = pullRequest({ ...AWAITING_REVIEW, number: 1, createdAt: "2026-02-01T00:00:00Z" });
    const wip = pullRequest({
      ...AWAITING_REVIEW,
      number: 2,
      title: "DO NOT MERGE — older migration",
      createdAt: "2026-01-01T00:00:00Z",
    });
    expect(rowsFor([wip, ready]).map((row) => row.number)).toEqual([1, 2]);
  });

  it("enriches at most three PRs at once", () => {
    const prs = Array.from({ length: 7 }, (_, index) =>
      pullRequest({
        ...AWAITING_REVIEW,
        number: index + 1,
      }),
    );
    const result = runCli(["--json"], prs, { env: { FAKE_GH_DELAY: "0.05" } });
    expect(result.ghMaxConcurrency).toBe(3);
  });

  it("emits the full documented JSON contract per row", () => {
    const row = rowFor(AWAITING_REVIEW);
    // Fields /sy-list-prs and /sy-babysit-prs read off the fast path.
    for (const field of [
      "url",
      "repo",
      "number",
      "title",
      "author",
      "createdAt",
      "updatedAt",
      "ageDays",
      "headRefName",
      "baseRefName",
      "isDraft",
      "isWip",
      "group",
      "signal",
      "color",
      "reasonIcon",
      "autoMerge",
      "autoMergeMethod",
      "ci",
      "review",
      "failedCheck",
      "runningChecks",
      "approvalGates",
      "mergeable",
      "mergeStateStatus",
      "openThreads",
      "openHumanThreads",
      "openBotThreads",
      "resolvedThreads",
      "status",
    ]) {
      expect(row, `row.${field} missing`).toHaveProperty(field);
    }
    // headRefName / baseRefName are exactly the pair `gh search prs` cannot return.
    expect(row.headRefName).toBe("syle/retry-token-refresh");
    expect(row.baseRefName).toBe("main");
    expect(row.color).toBe(row.signal);
  });
});

describe("list_prs — reason icons and auto-merge", () => {
  // The roll-up signal says how bad; the reason icon says WHY. Three different
  // problems all render 🔴, so without these a wall of red needs a click each.
  const CASES = [
    ["🗣️", "changes requested", { checks: [PASSING_CHECK], reviewDecision: "CHANGES_REQUESTED" }],
    ["⚔️", "merge conflict", { checks: [PASSING_CHECK], reviewDecision: "APPROVED", mergeable: "CONFLICTING" }],
    ["💥", "CI failed", { checks: [FAILING_CHECK], reviewDecision: "APPROVED" }],
    ["🔨", "build running", { checks: [RUNNING_CHECK], reviewDecision: "APPROVED" }],
    ["⏳", "awaiting review", AWAITING_REVIEW],
    ["🔄", "behind base", { checks: [PASSING_CHECK], reviewDecision: "APPROVED", mergeStateStatus: "BEHIND" }],
    ["🚀", "ready to merge", READY_TO_MERGE],
    ["🛑", "draft", { checks: [PASSING_CHECK], reviewDecision: "APPROVED", isDraft: true }],
  ];

  for (const [icon, label, overrides] of CASES) {
    it(`uses ${icon} for ${label}`, () => {
      expect(rowFor(overrides, ["--all"]).reasonIcon).toBe(icon);
    });
  }

  it("uses 💬 for a green PR that still has open threads", () => {
    const threads = [{ isResolved: false, comments: { nodes: [{ author: { login: "carol", __typename: "User" } }] } }];
    expect(rowFor({ ...READY_TO_MERGE, threads }).reasonIcon).toBe("💬");
  });

  it("ranks a blocked human above broken machinery when both apply", () => {
    // Work-owed ranking order: P1 (someone waiting on a reply) outranks P2
    // (broken and ours to fix), so 🗣️ wins over ⚔️ and 💥 on the same PR.
    const row = rowFor({ checks: [FAILING_CHECK], reviewDecision: "CHANGES_REQUESTED", mergeable: "CONFLICTING" }, ["--all"]);
    expect(row.reasonIcon).toBe("🗣️");
    // …and the status string still names every component, so nothing is lost.
    expect(row.status).toContain("CI FAILED");
    expect(row.status).toContain("CHANGES REQUESTED");
    expect(row.status).toContain("MERGE CONFLICT");
  });

  it("flags an armed auto-merge with its method, and leaves it off otherwise", () => {
    const armed = rowFor({ ...AWAITING_REVIEW, autoMergeRequest: { enabledAt: "2026-01-02T00:00:00Z", mergeMethod: "SQUASH" } });
    expect(armed.autoMerge).toBe(true);
    expect(armed.autoMergeMethod).toBe("SQUASH");
    expect(armed.status).toContain("AUTO-MERGE (squash)");

    const plain = rowFor(AWAITING_REVIEW);
    expect(plain.autoMerge).toBe(false);
    expect(plain.autoMergeMethod).toBe("");
    expect(plain.status).not.toContain("AUTO-MERGE");
  });

  it("treats a null autoMergeRequest as disarmed", () => {
    // GitHub returns the field as null rather than omitting it — a truthiness check
    // on the object alone would be fine, but enabledAt is the actual arming signal.
    expect(rowFor({ ...AWAITING_REVIEW, autoMergeRequest: null }).autoMerge).toBe(false);
  });

  it("prefixes the title line with the reason icon and the auto-merge tag", () => {
    // runCli pipes stdout, so there is no TTY and no ANSI. The tag is plain text
    // rather than styling precisely so it survives this render intact.
    const { stdout } = runCli(
      [],
      [pullRequest({ ...AWAITING_REVIEW, autoMergeRequest: { enabledAt: "2026-01-02T00:00:00Z", mergeMethod: "SQUASH" } })],
    );
    const lines = stdout.split("\n").filter(Boolean);
    expect(lines[0]).toBe("⏳ [auto-merge] syle/retry-token-refresh : Retry token refresh on 401");
  });

  it("leaves the auto-merge tag off a disarmed PR", () => {
    const lines = runCli([], [pullRequest(AWAITING_REVIEW)])
      .stdout.split("\n")
      .filter(Boolean);
    expect(lines[0]).toBe("⏳ syle/retry-token-refresh : Retry token refresh on 401");
    expect(lines[0]).not.toContain("auto-merge");
  });

  it("spends no reason-column glyph on auto-merge", () => {
    // The regression this guards: auto-merge used to render as a 🪄 competing with the
    // reason icon, so two unrelated facts fought for the same glance. It is a word now.
    const armed = { ...AWAITING_REVIEW, autoMergeRequest: { enabledAt: "2026-01-02T00:00:00Z", mergeMethod: "SQUASH" } };
    const firstLine = runCli([], [pullRequest(armed)])
      .stdout.split("\n")
      .filter(Boolean)[0];
    expect(firstLine).not.toContain("🪄");
    expect(rowFor(armed).status).not.toContain("🪄");
  });

  it("suffixes a running build with … and nothing else with it", () => {
    // A build is the only state that resolves itself while you read the output, so it
    // is the only one that earns the "still moving" marker.
    const running = runCli(["--all"], [pullRequest({ checks: [RUNNING_CHECK], reviewDecision: "APPROVED" })])
      .stdout.split("\n")
      .filter(Boolean)[0];
    expect(running).toBe("🔨 syle/retry-token-refresh : Retry token refresh on 401…");

    const settled = runCli(["--all"], [pullRequest(READY_TO_MERGE)])
      .stdout.split("\n")
      .filter(Boolean)[0];
    expect(settled).toBe("🚀 syle/retry-token-refresh : Retry token refresh on 401");
    expect(settled).not.toContain("…");
  });

  it("keeps the … out of the machine-readable fields", () => {
    // The suffix is a render flourish. A JSON consumer diffing titles or matching a PR
    // by name must never see it, and runningChecks already carries the same fact.
    const row = rowFor({ checks: [RUNNING_CHECK], reviewDecision: "APPROVED" }, ["--all"]);
    expect(row.title).toBe("Retry token refresh on 401");
    expect(row.title).not.toContain("…");
    expect(row.runningChecks).toBeGreaterThan(0);
  });

  it("renders both markers together on one row", () => {
    const both = {
      checks: [RUNNING_CHECK],
      reviewDecision: "APPROVED",
      autoMergeRequest: { enabledAt: "2026-01-02T00:00:00Z", mergeMethod: "SQUASH" },
    };
    const line = runCli(["--all"], [pullRequest(both)])
      .stdout.split("\n")
      .filter(Boolean)[0];
    expect(line).toBe("🔨 [auto-merge] syle/retry-token-refresh : Retry token refresh on 401…");
  });
  it("never decorates the URL line — callers parse it", () => {
    const armed = { ...AWAITING_REVIEW, autoMergeRequest: { enabledAt: "2026-01-02T00:00:00Z", mergeMethod: "SQUASH" } };
    expect(
      runCli([], [pullRequest(armed)])
        .stdout.split("\n")
        .filter(Boolean)[1],
    ).toBe("https://github.com/acme/api/pull/1");
    expect(runCli(["--links"], [pullRequest(armed)]).stdout.trim()).toBe("https://github.com/acme/api/pull/1");
  });
});

describe("list_prs — reason tags", () => {
  // The icon is a glance; the tag is a word you can grep, paste, or read on a terminal
  // that renders the glyph as tofu. Only five states carry one.
  const TAGGED = [
    ["[rejected]", "🗣️", { checks: [PASSING_CHECK], reviewDecision: "CHANGES_REQUESTED" }],
    ["[conflict]", "⚔️", { checks: [PASSING_CHECK], reviewDecision: "APPROVED", mergeable: "CONFLICTING" }],
    ["[ci-failed]", "💥", { checks: [FAILING_CHECK], reviewDecision: "APPROVED" }],
    ["[behind]", "🔄", { checks: [PASSING_CHECK], reviewDecision: "APPROVED", mergeStateStatus: "BEHIND" }],
    ["[draft]", "🛑", { checks: [PASSING_CHECK], reviewDecision: "APPROVED", isDraft: true }],
  ];

  for (const [tag, icon, overrides] of TAGGED) {
    it(`pairs ${icon} with ${tag}`, () => {
      const row = rowFor(overrides, ["--all"]);
      expect(row.reasonTag).toBe(tag);
      expect(row.reasonIcon).toBe(icon);
      const line = runCli(["--all"], [pullRequest(overrides)])
        .stdout.split("\n")
        .filter(Boolean)[0];
      expect(line.startsWith(`${icon} ${tag} `)).toBe(true);
    });
  }

  const UNTAGGED = [
    ["awaiting review", AWAITING_REVIEW],
    ["build running", { checks: [RUNNING_CHECK], reviewDecision: "APPROVED" }],
    ["ready to merge", READY_TO_MERGE],
  ];

  for (const [label, overrides] of UNTAGGED) {
    it(`leaves ${label} untagged — the icon already says it`, () => {
      const row = rowFor(overrides, ["--all"]);
      expect(row.reasonTag).toBe("");
      const line = runCli(["--all"], [pullRequest(overrides)])
        .stdout.split("\n")
        .filter(Boolean)[0];
      expect(line).not.toMatch(/\[(rejected|conflict|ci-failed|behind|draft)\]/);
    });
  }

  it("never shows two reason tags at once", () => {
    // "Blocked" is one answer, not a checklist — the key is picked once, so a PR that
    // is conflicting AND rejected AND red says only the highest-ranked of the three.
    const row = rowFor({ checks: [FAILING_CHECK], reviewDecision: "CHANGES_REQUESTED", mergeable: "CONFLICTING" }, ["--all"]);
    expect(row.reasonTag).toBe("[rejected]");

    const line = runCli(
      ["--all"],
      [pullRequest({ checks: [FAILING_CHECK], reviewDecision: "CHANGES_REQUESTED", mergeable: "CONFLICTING" })],
    )
      .stdout.split("\n")
      .filter(Boolean)[0];
    expect(line.match(/\[[a-z-]+\]/g)).toEqual(["[rejected]"]);
    // …while status still carries every component, so nothing is lost by picking one.
    expect(row.status).toContain("CI FAILED");
    expect(row.status).toContain("MERGE CONFLICT");
  });

  it("keeps the tag and the icon in lockstep for every state", () => {
    // Both come from one key, so a rename can never leave a row showing an icon and a
    // word that disagree — the failure the two-map version invited.
    const iconTable = CLI_SOURCE.slice(CLI_SOURCE.indexOf("const REASON_ICONS"), CLI_SOURCE.indexOf("const REASON_TAGS"));
    const tagTable = CLI_SOURCE.slice(CLI_SOURCE.indexOf("const REASON_TAGS"), CLI_SOURCE.indexOf("const RUNNING_SUFFIX"));
    const keysOf = (src) => [...src.matchAll(/^\s*([A-Z_]+):\s*`/gm)].map((m) => m[1]);
    expect(keysOf(tagTable).every((k) => keysOf(iconTable).includes(k))).toBe(true);
    expect(CLI_SOURCE).toContain("function reasonKeyFor");
    expect(CLI_SOURCE).not.toContain("function reasonIconFor");
  });

  it("styles a blocking tag bold-red and a non-blocking one dim", () => {
    // A blocked PR's title is already red, so a plain-red tag would vanish into it.
    const blocked = CLI_SOURCE.slice(CLI_SOURCE.indexOf("const BLOCKED_REASON_KEYS"));
    expect(blocked).toContain("CHANGES_REQUESTED");
    expect(blocked).toContain("MERGE_CONFLICT");
    expect(blocked).toContain("CI_FAILED");
    // [behind] and [draft] are deliberately NOT blocking — nothing is wrong with them.
    expect(CLI_SOURCE.slice(CLI_SOURCE.indexOf("const BLOCKED_REASON_KEYS"), CLI_SOURCE.indexOf("BLOCKED_TAGS"))).not.toContain(
      "BEHIND_BASE",
    );
    // Bold + bright, not plain red — weight is what survives red-on-red.
    expect(CLI_SOURCE).toContain("blockedTag: `\\x1b[1;91m`");
    expect(CLI_SOURCE).toContain("dim: `\\x1b[2m`");
  });
});

describe("list_prs — reason icon encoding hygiene", () => {
  // These glyphs are scanned in a column, so encoding is not cosmetic. A U+FE0F
  // variation selector renders narrow in several terminals and knocks every title
  // out of alignment; a recent codepoint is tofu on an older font. Both rules are
  // checkable here, and both were the reason for the 🏗️→🚧 / 🚧→🛑 swap.
  const codepoints = (glyph) => [...glyph].map((c) => c.codePointAt(0));

  it("uses no variation selector for build-in-progress or draft", () => {
    for (const [glyph, slot] of [
      ["🔨", "build in progress"],
      ["🛑", "draft"],
      ["⏳", "awaiting review"],
      ["🔄", "behind base"],
    ]) {
      expect(codepoints(glyph), `${slot} must stay VS16-free`).not.toContain(0xfe0f);
      expect(codepoints(glyph).length, `${slot} must be a single codepoint`).toBe(1);
    }
  });

  it("pins each replaced glyph to the codepoint it was chosen for", () => {
    // Named against Unicode's own list: U+1F528 "hammer" (E0.6), U+1F6D1 "stop sign"
    // (E3.0), U+23F3 "hourglass not done" (E0.6), U+1F504 "counterclockwise arrows"
    // (E1.0). There is no traffic-cone emoji to prefer over any of them.
    expect(codepoints("🔨")[0]).toBe(0x1f528);
    expect(codepoints("🛑")[0]).toBe(0x1f6d1);
    expect(codepoints("⏳")[0]).toBe(0x23f3);
    expect(codepoints("🔄")[0]).toBe(0x1f504);
  });

  it("retired the two glyphs that read as the wrong instruction", () => {
    // 👀 said "look at me" on the one row that wants nothing from you (the REVIEWER is
    // the one being waited on), and 🐌 editorialized about a branch that is merely out
    // of date. Both survive only in the comment explaining why they went.
    const iconTable = CLI_SOURCE.slice(CLI_SOURCE.indexOf("const REASON_ICONS"), CLI_SOURCE.indexOf("const REASON_TAGS"));
    expect(iconTable).not.toContain("👀");
    expect(iconTable).not.toContain("🐌");
  });

  it("no longer ships the VS16 building glyph or the E13.0 magic wand as icons", () => {
    // 🏗️ survives only inside the comment explaining why it was rejected, so assert
    // on the icon table itself rather than the whole file.
    const iconTable = CLI_SOURCE.slice(CLI_SOURCE.indexOf("const REASON_ICONS"), CLI_SOURCE.indexOf("UNKNOWN:"));
    expect(iconTable).not.toContain("🏗");
    expect(iconTable).not.toContain("🪄");
    expect(CLI_SOURCE).not.toContain("AUTO_MERGE_ICON");
  });

  it("keeps every reason icon distinct", () => {
    // The swap moved 🚧 from draft to build-in-progress; leaving it in both slots
    // would silently collapse two different states onto one glyph.
    const table = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf("const REASON_ICONS"),
      CLI_SOURCE.indexOf("};", CLI_SOURCE.indexOf("const REASON_ICONS")),
    );
    const glyphs = [...table.matchAll(/^\s*[A-Z_]+:\s*`(.+?)`,/gm)].map((m) => m[1]);
    expect(glyphs.length).toBeGreaterThanOrEqual(9);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});

describe("list_prs — CLI hygiene", () => {
  it("starts with a node shebang so the installed file is executable", () => {
    expect(CLI_SOURCE.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("is syntactically valid node", () => {
    const tmp = path.join(os.tmpdir(), `list-prs-check-${process.pid}.js`);
    fs.writeFileSync(tmp, CLI_SOURCE);
    try {
      execFileSync(process.execPath, ["--check", tmp], { stdio: "ignore" });
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

  it("never writes progress or debug output to STDOUT", () => {
    // Every user-facing diagnostic must go through info()/die() (stderr); stdout
    // is the data channel only.
    expect(CLI_SOURCE).not.toMatch(/console\.log\(/);
  });
});

describe("list_prs — installer", () => {
  it("installs to ~/.local/bin/list_prs from the CommonJS payload", () => {
    expect(INSTALLER_SOURCE).toContain("software/scripts/git.pr_list.cjs");
    expect(INSTALLER_SOURCE).toMatch(/\.local`?,?\s*`?bin/);
    expect(INSTALLER_SOURCE).toContain("list_prs");
    expect(INSTALLER_SOURCE).toContain("chmodSync");
  });

  it("defines doWork and undoWork", () => {
    expect(INSTALLER_SOURCE).toMatch(/async function doWork\(\)/);
    expect(INSTALLER_SOURCE).toMatch(/async function undoWork\(\)/);
  });
});

// ---------------------------------------------------------------------------
// Shell wrapper wiring.
// ---------------------------------------------------------------------------

/**
 * Lift one `function <name>() { ... }` definition out of a bash source file.
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
 * Source the real profile with a fake `list_prs` on PATH and run one wrapper.
 * The fake `list_prs` just logs its argv, so we can assert what the wrapper forwarded.
 * @param {string} command The shell command (e.g. `pr_list_all_open --cwd`).
 * @returns {{ status: number, stdout: string, stderr: string, forwarded: string[] }}
 */
function runWrapper(command) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-wrap-"));
  try {
    const bin = path.join(work, "bin");
    fs.mkdirSync(bin);
    const log = path.join(work, "list_prs.log");
    fs.writeFileSync(log, "");
    fs.writeFileSync(path.join(bin, "list_prs"), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${log}"\n`, { mode: 0o755 });

    const script = [IS_HELP_ARG, `source ${JSON.stringify(GIT_HELPERS_PROFILE)}`, command].join("\n");

    let status = 0;
    let stdout = "";
    let stderr = "";
    try {
      stdout = execFileSync(BASH, ["-c", script], {
        encoding: "utf-8",
        cwd: work,
        env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      status = err.status ?? 1;
      stdout = err.stdout || "";
      stderr = err.stderr || "";
    }

    return { status, stdout, stderr, forwarded: fs.readFileSync(log, "utf-8").split("\n").filter(Boolean) };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

describe("list_prs — shell wrappers", () => {
  it("pr_list_needs_attention forwards args to list_prs verbatim", () => {
    const { forwarded } = runWrapper("pr_list_needs_attention --cwd --verbose");
    expect(forwarded).toEqual(["--cwd --verbose"]);
  });

  it("pr_list_all_open prepends --all", () => {
    const { forwarded } = runWrapper("pr_list_all_open --cwd");
    expect(forwarded).toEqual(["--all --cwd"]);
  });

  it("both wrappers answer --help without calling list_prs", () => {
    const needs = runWrapper("pr_list_needs_attention --help");
    expect(needs.stdout).toContain("pr_list_needs_attention:");
    expect(needs.forwarded).toEqual([]);
    const all = runWrapper("pr_list_all_open --help");
    expect(all.stdout).toContain("pr_list_all_open:");
    expect(all.forwarded).toEqual([]);
  });

  it("dropped every old list_prs alias / internal", () => {
    ["list_pending_prs", "list_open_prs", "_list_prs_repos"].forEach((name) => {
      expect(PROFILE_SOURCE, `${name} should be gone from the profile`).not.toMatch(new RegExp(`\\b${name}\\b`));
    });
    // The full renderer must no longer be embedded in the profile — it lives in the CLI now.
    ["RENDER_JS_EOF", "PAIR_JS_EOF", "GQL_EOF"].forEach((marker) => {
      expect(PROFILE_SOURCE).not.toContain(marker);
    });
  });

  it("keeps no bash list_prs implementation, only the two wrappers", () => {
    expect(PROFILE_SOURCE).not.toMatch(/^function list_prs\(\)/m);
    expect(PROFILE_SOURCE).toMatch(/^function pr_list_needs_attention\(\)/m);
    expect(PROFILE_SOURCE).toMatch(/^function pr_list_all_open\(\)/m);
    expect(PROFILE_SOURCE).not.toMatch(/^function list_prs_(needs_attention|all_open)\(\)/m);
  });

  it("uses shared confirmation and seeds the requested bookmarks", () => {
    expect(PROFILE_SOURCE).toContain('command pr_merge "$@"');
    expect(INSTALLER_SOURCE).toContain("git.pr_merge.cjs");
    expect(MERGE_CLI_SOURCE).toContain("split(/[\\s,|]+/");
    expect(PROFILE_SOURCE).toContain('add_bookmark "pr_list_all_open"');
    expect(PROFILE_SOURCE).toContain('add_bookmark "pr_merge"');
  });

  it("checks unresolved review threads before auto-merge", () => {
    expect(MERGE_CLI_SOURCE).toContain("reviewThreads(first:100)");
    expect(MERGE_CLI_SOURCE).toContain("isWipTitle");
    expect(MERGE_CLI_SOURCE).toContain("Number(left.wip) - Number(right.wip)");
  });

  it("accepts piped stdin and still prompts on the controlling terminal", () => {
    expect(MERGE_CLI_SOURCE).toContain("function readPipedInput()");
    expect(MERGE_CLI_SOURCE).toContain("readPipedInput()");
    expect(MERGE_CLI_SOURCE).toContain('fs.openSync("/dev/tty", "r")');
    expect(PROFILE_SOURCE).toContain("command cat mypr_list | pr_merge");
  });

  it("offers am / dm / ig with am as the default and prints the gh commands first", () => {
    expect(MERGE_CLI_SOURCE).toContain("function parseAction(");
    expect(MERGE_CLI_SOURCE).toContain('if (!value) return "am"');
    expect(MERGE_CLI_SOURCE).toContain("[am] enable auto-merge · [dm] disable auto-merge · [ig] ignore (default: am)");
    expect(MERGE_CLI_SOURCE).toContain("--disable-auto");
    expect(MERGE_CLI_SOURCE).toContain("Commands to be run:");
    expect(MERGE_CLI_SOURCE).toContain("function formatCommand(");
  });
});
