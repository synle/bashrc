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

const COMMON_ENV = path.join(ROOT_DIR, "software/bootstrap/common-env.sh");

const CLI_SOURCE = fs.readFileSync(CLI_PATH, "utf-8");

const MERGE_CLI_SOURCE = fs.readFileSync(MERGE_CLI_PATH, "utf-8");

const INSTALLER_SOURCE = fs.readFileSync(INSTALLER_PATH, "utf-8");

const PROFILE_SOURCE = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");

const BASH = fs.existsSync("/bin/bash") ? "/bin/bash" : "bash";

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
api)
  if [ "\${2:-}" = "user" ]; then printf '%s\\n' "\${FAKE_GH_LOGIN:-syle}"; exit 0; fi
  ;;
esac
case "\${1:-}" in
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

const PASSING_CHECK = { __typename: "CheckRun", name: "unit-tests", status: "COMPLETED", conclusion: "SUCCESS" };

const FAILING_CHECK = { __typename: "CheckRun", name: "unit-tests", status: "COMPLETED", conclusion: "FAILURE" };

const RUNNING_CHECK = { __typename: "CheckRun", name: "integration", status: "IN_PROGRESS", conclusion: null };

const READY_TO_MERGE = { checks: [PASSING_CHECK], reviewDecision: "APPROVED" };

const AWAITING_REVIEW = { checks: [PASSING_CHECK], reviewDecision: "REVIEW_REQUIRED" };

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
          ...opts.env,
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

function rowsFor(prs, extraArgs = []) {
  const { stdout } = runCli(["--me=1", "--json", ...extraArgs], prs);
  return JSON.parse(stdout);
}

function rowFor(overrides, extraArgs = []) {
  return rowsFor([pullRequest(overrides)], extraArgs)[0];
}

function extractBashFunction(file, name) {
  const source = fs.readFileSync(file, "utf-8");
  const match = source.match(new RegExp(`^function ${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}$`, "m"));
  expect(match, `function ${name}() not found in ${file}`).toBeTruthy();
  return match[0];
}

const IS_HELP_ARG = extractBashFunction(COMMON_FUNCTIONS, "is_help_arg");

const IS_TRUTHY = extractBashFunction(COMMON_ENV, "is_truthy");

function runWrapper(command) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "list-prs-wrap-"));
  try {
    const bin = path.join(work, "bin");
    fs.mkdirSync(bin);
    const log = path.join(work, "list_prs.log");
    fs.writeFileSync(log, "");
    fs.writeFileSync(path.join(bin, "list_prs"), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${log}"\n`, { mode: 0o755 });

    // expand_aliases is off in a non-interactive shell, and `pr_list` is an alias.
    const script = ["shopt -s expand_aliases", IS_HELP_ARG, IS_TRUTHY, `source ${JSON.stringify(GIT_HELPERS_PROFILE)}`, command].join("\n");

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

describe("list_prs — output shape", () => {
  it("prints title then URL, two lines, and keeps STDOUT free of progress noise", () => {
    const { stdout, stderr } = runCli(["--me=1"], [pullRequest(AWAITING_REVIEW)]);
    const lines = stdout.split("\n").filter(Boolean);
    expect(lines[0]).toBe("⏳ syle/retry-token-refresh · Retry token refresh on 401");
    expect(lines[1]).toBe("https://github.com/acme/api/pull/1");
    expect(lines).toHaveLength(2);
    expect(stdout).not.toContain(">>>");
    expect(stderr).toContain(">>>"); // the scan/footer lines live on stderr
  });

  it("adds a metadata line only with --verbose", () => {
    const plain = runCli(["--me=1"], [pullRequest(AWAITING_REVIEW)]).stdout;
    expect(plain).not.toContain("· 🟡");
    const verbose = runCli(["--me=1", "--verbose"], [pullRequest(AWAITING_REVIEW)]).stdout;
    const ageDays = Math.floor((Date.now() - Date.parse("2026-01-01T00:00:00Z")) / 86400000);
    expect(verbose).toContain(`(${ageDays}d) · 🟡 CI PASSED · AWAITING REVIEW`);
  });

  it("prints only URLs with --links", () => {
    const { stdout } = runCli(["--me=1", "--links"], [pullRequest(AWAITING_REVIEW), pullRequest({ ...AWAITING_REVIEW, number: 2 })]);
    expect(stdout.split("\n").filter(Boolean)).toEqual(["https://github.com/acme/api/pull/1", "https://github.com/acme/api/pull/2"]);
  });

  it("prints a [draft] tag on the title line", () => {
    const { stdout } = runCli(["--me=1"], [pullRequest({ isDraft: true, checks: [PASSING_CHECK] })]);
    expect(stdout).toContain("🛑 [draft] syle/retry-token-refresh · Retry token refresh on 401");
  });

  it("prints the head branch between the tags and the title, and never on the URL line", () => {
    // The branch is the handle every local command wants (worktree, checkout, log), so
    // it leads the title — but the URL line stays machine-readable and bare.
    const lines = runCli(["--me=1"], [pullRequest(AWAITING_REVIEW)])
      .stdout.split("\n")
      .filter(Boolean);
    expect(lines[0]).toBe("⏳ syle/retry-token-refresh · Retry token refresh on 401");
    expect(lines[1]).toBe("https://github.com/acme/api/pull/1");
    expect(runCli(["--me=1", "--links"], [pullRequest(AWAITING_REVIEW)]).stdout).not.toContain("syle/retry-token-refresh");
  });

  it("keeps the branch out of the JSON title field", () => {
    const row = rowFor(AWAITING_REVIEW);
    expect(row.title).toBe("Retry token refresh on 401");
    expect(row.headRefName).toBe("syle/retry-token-refresh");
  });

  it("emits no ANSI escapes when NO_COLOR / piped", () => {
    const { stdout } = runCli(["--me=1"], [pullRequest(AWAITING_REVIEW)]);
    // eslint-disable-next-line no-control-regex
    expect(stdout).not.toMatch(/\x1b\[/);
  });

  it("sorts oldest first", () => {
    const older = pullRequest({ ...AWAITING_REVIEW, number: 1, createdAt: "2026-01-01T00:00:00Z" });
    const newer = pullRequest({ ...AWAITING_REVIEW, number: 2, createdAt: "2026-02-01T00:00:00Z" });
    const rows = rowsFor([newer, older]);
    expect(rows.map((r) => r.number)).toEqual([1, 2]);
  });
});
