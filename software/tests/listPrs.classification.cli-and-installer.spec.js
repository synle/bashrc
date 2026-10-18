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
