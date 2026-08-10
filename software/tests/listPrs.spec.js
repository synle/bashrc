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
    expect(lines[0]).toBe("Retry token refresh on 401");
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

  it("prints a [Draft] tag on the title line", () => {
    const { stdout } = runCli([], [pullRequest({ isDraft: true, checks: [PASSING_CHECK] })]);
    expect(stdout).toContain("[Draft] Retry token refresh on 401");
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
    expect(MERGE_CLI_SOURCE).toContain("split(/[,|\\t\\n]+/");
    expect(PROFILE_SOURCE).toContain('add_bookmark "pr_list_all_open"');
    expect(PROFILE_SOURCE).toContain('add_bookmark "pr_merge"');
  });

  it("checks unresolved review threads before auto-merge", () => {
    expect(MERGE_CLI_SOURCE).toContain("reviewThreads(first:100)");
    expect(MERGE_CLI_SOURCE).toContain("isWipTitle");
    expect(MERGE_CLI_SOURCE).toContain("Number(left.wip) - Number(right.wip)");
  });
});
