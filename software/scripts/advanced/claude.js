/** Claude Code setup: settings, keybindings, and telemetry opt-out. Run: `bash run.sh --files="claude.js"` */
// SOURCE software/scripts/advanced/editor.common.js

////// Keybindings //////

/** @type {string} Claude Code OS modifier key on macOS (meta = cmd in terminals). */
const CLAUDE_MAC_OS_KEY = "meta";

/** @type {object[]} Common keybindings loaded from JSONC. */
let CLAUDE_COMMON_KEY_BINDINGS;
/** @type {object[]} Windows/Linux-only keybindings loaded from JSONC. */
let CLAUDE_WINDOWS_ONLY_KEY_BINDINGS;

/**
 * Replaces OS_KEY placeholders in Claude Code keybinding context groups with the actual OS-specific modifier key.
 * Claude Code bindings use { context, bindings: { key: action } } format where OS_KEY appears in object keys.
 * @param {object[]} contextGroups - Array of { context, bindings } objects.
 * @param {string} osKeyToUse - The OS-specific modifier key to substitute (e.g. "alt", "meta").
 * @returns {object[]} Context groups with resolved binding keys.
 */
function _formatClaudeKeybindings(contextGroups, osKeyToUse) {
  contextGroups = clone(contextGroups);

  for (const group of contextGroups) {
    /** @type {Record<string, string>} Resolved bindings with OS_KEY replaced in keys. */
    const resolved = {};
    for (const [key, action] of Object.entries(group.bindings)) {
      resolved[key.replace(/OS_KEY/g, osKeyToUse)] = action;
    }
    group.bindings = resolved;
  }

  return contextGroups;
}

/**
 * Merges multiple arrays of Claude Code keybinding context groups, combining bindings for the same context.
 * @param  {...object[]} arrays - Arrays of { context, bindings } objects to merge.
 * @returns {object[]} Merged context groups with combined bindings.
 */
function _mergeContextGroups(...arrays) {
  /** @type {Map<string, object>} Map of context name to merged bindings. */
  const map = new Map();

  for (const arr of arrays) {
    for (const group of arr) {
      if (map.has(group.context)) {
        Object.assign(map.get(group.context).bindings, group.bindings);
      } else {
        map.set(group.context, clone(group));
      }
    }
  }

  return [...map.values()];
}

/**
 * Returns the merged and resolved keybinding config for the given OS.
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {object} Full Claude Code keybindings config with schema metadata.
 */
function _getKeyConfig(isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  const osKey = isMac ? CLAUDE_MAC_OS_KEY : EDITOR_WINDOWS_OS_KEY;

  /** @type {object[]} Platform-specific bindings merged with common. */
  const merged = isMac
    ? _mergeContextGroups(CLAUDE_COMMON_KEY_BINDINGS)
    : _mergeContextGroups(CLAUDE_COMMON_KEY_BINDINGS, CLAUDE_WINDOWS_ONLY_KEY_BINDINGS);

  return {
    $schema: "https://www.schemastore.org/claude-code-keybindings.json",
    $docs: "https://code.claude.com/docs/en/keybindings",
    bindings: _formatClaudeKeybindings(merged, osKey),
  };
}

/**
 * Loads keybinding configs, writes prebuilt configs per platform, and deploys to ~/.claude/keybindings.json.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doKeysWork(targetDir) {
  const targetPath = path.join(targetDir, "keybindings.json");

  log(">> Claude Code Keybindings:", targetPath);

  CLAUDE_COMMON_KEY_BINDINGS = (await readJson`software/scripts/advanced/claude-keys.common.jsonc`) || [];
  CLAUDE_WINDOWS_ONLY_KEY_BINDINGS = (await readJson`software/scripts/advanced/claude-keys.windows.jsonc`) || [];

  // write to build file (one per platform)
  const comments = "Claude Code Keybindings";
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/claude-keys`,
      data: _getKeyConfig(false),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/claude-keys-mac`,
      data: _getKeyConfig(true),
      isJson: true,
      comments,
      commentStyle: "json",
    },
  ]);

  // deploy to local system — merge with existing, our managed bindings always override
  /** @type {object[]} Existing user keybinding context groups (empty if file missing or invalid). */
  let existingBindings = [];
  try {
    const data = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
    if (data && Array.isArray(data.bindings)) existingBindings = data.bindings;
  } catch (e) {}

  const ourConfig = _getKeyConfig();
  // existing first, then ours on top — Object.assign in _mergeContextGroups means later wins
  ourConfig.bindings = _mergeContextGroups(existingBindings, ourConfig.bindings);

  await backupConfigFile(targetPath);
  await writeJson(targetPath, ourConfig);
}

////// Settings //////

/**
 * Managed settings to merge into ~/.claude/settings.json.
 * Only these keys are touched — all other user settings are preserved.
 * @type {Record<string, any>}
 */
const CLAUDE_MANAGED_SETTINGS = {
  // default model for all claude code sessions. tradeoff: higher cost. risk: none
  model: "claude-opus-4-7[1m]",
  // skip confirmation prompt before entering bypass permissions mode. tradeoff: no safety prompt. risk: medium
  skipDangerousModePermissionPrompt: true,
  // auto-delete session files older than 30 days. tradeoff: lose old history. risk: low
  cleanupPeriodDays: 30,
  // hide tips in the loading spinner. tradeoff: miss occasional tips. risk: none
  spinnerTipsEnabled: false,
  // reduce UI animations for cleaner output. tradeoff: less visual feedback. risk: none
  prefersReducedMotion: true,
  // show more detail in transcript by default. tradeoff: noisier output. risk: none
  viewMode: "verbose",
  // enable extended thinking by default for better quality. tradeoff: more tokens, slightly slower. risk: low
  alwaysThinkingEnabled: true,
};

/**
 * Merges managed settings into ~/.claude/settings.json, preserving existing user settings.
 * Only keys in CLAUDE_MANAGED_SETTINGS are written — other keys are left untouched.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doSettingsWork(targetDir) {
  const targetPath = path.join(targetDir, "settings.json");

  log(">> Claude Code Settings:", targetPath);

  /** @type {object} Existing user settings (empty object if file missing or invalid). */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  // merge: managed settings are applied as defaults, existing user overrides are preserved
  const merged = { ...CLAUDE_MANAGED_SETTINGS, ...existing };

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

////// Instructions (User-Level CLAUDE.md) //////

/**
 * Marker key used to wrap the managed engineering principles block inside ~/.claude/CLAUDE.md.
 * Anything outside the BEGIN/END markers is preserved as user-owned content.
 * @type {string}
 */
const CLAUDE_INSTRUCTIONS_MARKER = "managed-rules";

/**
 * Deploys stack-agnostic engineering principles into ~/.claude/CLAUDE.md between BEGIN/END markers.
 * The markdown source uses backticks for inline code; readText returns the file content verbatim
 * (only the path argument is a template literal), and the content flows into replaceBlock as a
 * plain string — no re-templating, so backticks are safe here.
 * Existing user content outside the marker block is preserved.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doInstructionsWork(targetDir) {
  const targetPath = path.join(targetDir, "CLAUDE.md");

  log(">> Claude Code Instructions:", targetPath);

  /** @type {string} The markdown source for the managed engineering principles block. */
  const sourceContent = (await readText`software/scripts/advanced/claude-instructions.md`).trim();

  /** @type {string} Existing CLAUDE.md content (empty if file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // Upsert the managed block between <!-- BEGIN managed-rules --> / <!-- END managed-rules -->.
  // insertMode: "append" creates the block when CLAUDE.md is brand new or the markers are missing.
  const merged = replaceBlock(existing, CLAUDE_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append").trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

////// Commands (Custom Slash Commands) //////

/**
 * Shared "Resolving the author" block used by /list-prs and /slack-prs.
 * Describes how to turn $ARGUMENTS (empty / handle / full name) into a GitHub author filter.
 * @param {string} verb - Action verb for the ambiguous-name prompt, e.g. "list" or "share".
 * @returns {string} Markdown section to embed under a "## Resolving the author" heading.
 */
function _resolveAuthorBlock(verb) {
  return code`
    1. If \`$ARGUMENTS\` is empty, whitespace, or one of \`me\`/\`mine\`/\`self\`, filter by the current user (\`--author=@me\`) — this is the default.
    2. If \`$ARGUMENTS\` is a clear GitHub handle (single token, no spaces), use it directly (\`--author=<handle>\`).
    3. If \`$ARGUMENTS\` is ambiguous (e.g. a full name with spaces, or unclear), ask the user: "Whose PRs should I ${verb}? Please provide a GitHub username or a full name." Then resolve:
       - If the user gives a handle, use it directly.
       - If the user gives a full name, try \`gh api "search/users?q=<name>" --jq '.items[0].login'\` to resolve to a handle, and confirm the match with the user before proceeding.
  `;
}

/**
 * Shared PR classification rule used by /list-prs and /slack-prs.
 * Splits PRs into READY (reviewable) and WIP / DRAFT groups based on title markers and draft flag.
 * @type {string}
 */
const _CLASSIFY_PRS_BLOCK = code`
  - **READY** — title does NOT contain \`WIP\` or \`DO NOT MERGE\` AND \`isDraft\` is false. These are ready for review.
  - **WIP / DRAFT** — title contains \`WIP\` or \`DO NOT MERGE\`, OR \`isDraft\` is true. Still in progress.
`;

/**
 * Shared PR sort order used by /list-prs and /slack-prs.
 * Sort tiebreakers: repo name → dependency order → createdAt ascending.
 * @type {string}
 */
const _SORT_PRS_BLOCK = code`
  a. Repo name (alphabetical).
  b. Dependency order — if PR A must merge before PR B (e.g. B's branch is based on A's branch, or B's description references A), put A first.
  c. \`createdAt\` ascending — oldest PR first, newest last.
`;

/**
 * Shared final step for /create-pr and /draft-pr that offers to babysit the newly-created PR.
 * @type {string}
 */
const _OFFER_BABYSIT_BLOCK = code`
  Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"
  - If yes: run \`/babysit-pr\` with the new PR URL.
  - If no: stop.
`;

/**
 * Shared body for the official-release slash commands.
 * Used by /release-official, /release-main, and /release-master — all three are aliases
 * for the same action: trigger an official release from the repo's default branch.
 * Must never trigger a beta / prerelease / canary / nightly workflow.
 * @type {string}
 */
const _RELEASE_OFFICIAL_BODY = code`
  Trigger an OFFICIAL release from the repo's default branch (main / master).

  This command triggers **ONLY** the official / stable release workflow.
  It must NEVER trigger a beta, prerelease, canary, nightly, or unofficial release.
  Aliases: /release-official, /release-main, /release-master — all three do the same thing.

  Argument: $ARGUMENTS (optional — repo in owner/repo format. If empty, use the current repo.)

  ## Steps

  1. Determine the repo:
     - If \`$ARGUMENTS\` is provided, use it as the repo.
     - Otherwise, run \`git remote get-url origin\` to detect the current repo.
  2. Identify the default branch (\`main\` or \`master\`): \`gh repo view <owner/repo> --json defaultBranchRef --jq '.defaultBranchRef.name'\`
  3. List release workflows: \`gh workflow list --repo <owner/repo>\`.
     - **Select** the official release workflow — names containing \`release-official\`, \`release official\`, \`official-release\`, \`publish\`, or a bare \`release\` with no modifier.
     - **Reject** any workflow whose name contains \`beta\`, \`prerelease\`, \`pre-release\`, \`canary\`, \`nightly\`, \`rc\`, \`alpha\`, \`dev\`, \`snapshot\`, \`draft\`, or \`unofficial\`. If the only matches are these, stop and report "no official release workflow found — aborting".
     - If multiple candidates remain after filtering, ask the user which one to trigger. Never guess.
  4. Confirm with the user: "About to trigger OFFICIAL release \`<workflow name>\` on \`<default branch>\` in \`<owner/repo>\`. This is NOT a beta. Proceed? (yes/no)"
     - If no: stop.
  5. Trigger: \`gh workflow run <workflow-id> --repo <owner/repo> --ref <default-branch>\`
  6. Wait a few seconds, then find the new run: \`gh run list --repo <owner/repo> --workflow=<workflow-id> --limit 1 --json databaseId,status,url\`
  7. Report the run URL and status to the user.

  ## Rules

  - Official release only. If you cannot find a non-beta workflow, stop and tell the user.
  - Always run on the repo's **default branch** (main or master). Do not accept a SHA or non-default ref — that's what \`/release-beta\` is for.
`;

/**
 * Inline definitions for user-level Claude Code slash commands.
 * Each entry becomes a /<name-without-.md> command available across all projects.
 * Keeping these inline (rather than in a sibling folder of .md files) means the
 * source of truth lives with the deploy logic and moves with the repo.
 * @type {Record<string, string>}
 */
const CLAUDE_COMMANDS = {
  "babysit-pr.md": code`
    Sync a pull request branch with its base (main/master), address review comments, run local checks, fix failing builds, and wait until CI passes.

    Argument: $ARGUMENTS (optional — a PR URL or PR number. If empty, use the current branch's PR.)

    ## Steps

    1. **Determine which PR to babysit:**
       - If \`$ARGUMENTS\` is provided (a PR URL like \`https://github.com/org/repo/pull/123\` or a PR number), use that.
       - If \`$ARGUMENTS\` is empty, detect from the current working directory:
         - \`git remote get-url origin\` to determine the repo.
         - \`git branch --show-current\` to get the current branch.
         - \`gh pr view --json number,title,url,headRefName,baseRefName\` to find the PR for the current branch.
         - If no PR exists for the current branch, tell the user and stop.

    2. **Announce:** Tell the user which repo and PR you are babysitting (repo name, PR number, title, URL).

    3. **Step 0 — Skip if CI is currently running.** Before any other check, fetch state:
       \`gh pr view <number> --repo <owner/repo> --json statusCheckRollup\`
       - If **any check is in progress / pending / queued** (statuses like \`IN_PROGRESS\`, \`PENDING\`, \`QUEUED\`, \`WAITING\`, or \`statusCheckRollup\` entries with \`status\` !== \`COMPLETED\`): report "PR build is currently running — skipping" and **stop**. Do not run any other checks, do not merge, do not address comments, do not push. Take no action.
       - Only proceed past this step when CI is idle (every check has \`status: COMPLETED\` or there are no checks).

    4. **Step 1 — Early-exit check.** Fetch state:
       \`gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable,baseRefName,headRefName\`
       - If **all CI checks are passing** AND \`reviewDecision\` is \`APPROVED\`: report "PR is already green + approved — nothing to do" and **stop**. Skip all remaining steps.

    5. **Step 2 — Merge base into the PR branch AND RESOLVE CONFLICTS** (NEVER rebase, must not rewrite history).
       **The whole point of this step is to surface and fix merge conflicts before CI does.** If \`git merge\` reports conflicts, you MUST resolve them — do not skip, do not abort, do not leave the branch in a conflicted state.
       a. Check out the PR branch: \`gh pr checkout <number> --repo <owner/repo>\`.
       b. Fetch and pull the latest base: \`git fetch origin <baseRefName>\`.
       c. Merge (regular merge commit — do NOT use \`--rebase\` and do NOT use \`--squash\`):
          \`git merge origin/<baseRefName> --no-edit\`
       d. **If merge conflicts occur, resolve them — this is the primary goal of step 1:**
          - Run \`git status\` to list conflicted files.
          - For each conflicted file: read both sides of the conflict markers (\`<<<<<<<\` / \`=======\` / \`>>>>>>>\`), understand what each side is doing, and produce a correct merged result. Remove all conflict markers.
          - Lockfiles / generated files (\`package-lock.json\`, \`yarn.lock\`, \`Cargo.lock\`, \`.build/\` artifacts, etc.): regenerate them after accepting the base version (e.g. re-run \`npm install\`, \`cargo build\`, \`make build\`) rather than hand-editing.
          - Non-overlapping edits, obvious either/or choices: resolve directly.
          - Only stop and ask the user if the resolution requires judgment you don't have (conflicting semantics, diverging feature logic, unclear intent). Never force a resolution you are not confident in, but don't bail out on conflicts you CAN reason through.
          - After resolving every file: \`git add <files>\` and \`git commit --no-edit\`.
          - Verify the merge is complete: \`git status\` should show a clean working tree with no "unmerged paths".
       e. Push the updated branch: \`git push\`.
       f. Note: this creates a regular merge commit on the PR branch. The eventual PR-level merge into main must still be a **squash merge** per repo policy.

    6. **Step 3 — Address reviewer comments from human (NON-BOT) users:**
       - Fetch review comments: \`gh api repos/<owner>/<repo>/pulls/<number>/comments\` and issue comments: \`gh api repos/<owner>/<repo>/issues/<number>/comments\`.
       - **Filter to humans first.** For each comment, check \`user.type\` (skip when \`Bot\`) and \`user.login\` — separate out anything matching known bot patterns (\`*[bot]\`, \`coderabbitai*\`, \`copilot*\`, \`dependabot*\`, \`sonarcloud*\`, \`github-actions*\`, \`renovate*\`, etc.) for step 4. This step is humans only.
       - For every remaining (human) unresolved, substantive comment: read the referenced code, apply the fix (or reply explaining why not), and commit.
       - Skip comments already marked resolved / outdated / on stale SHAs.

    7. **Step 4 — Address ONLY trivial / minor bot comments:**
       - From the bot-authored comments separated out in step 3, address **only the small, low-risk ones**: typo fixes, obvious lint one-liners, missing semicolons / trailing commas, simple rename suggestions, doc/comment wording tweaks, dead-import removal, and similar one-line nits.
       - **Do NOT redesign or refactor based on bot suggestions.** Skip anything that asks for: architectural changes, API redesigns, new abstractions, broad renames, restructured control flow, added error handling beyond a one-liner, new tests, performance rewrites, or anything requiring judgment about intent.
       - When in doubt, skip. Bots over-suggest — their job is to flag, yours is to triage. Err on the side of leaving the bot comment unaddressed.
       - Commit any trivial fixes you apply.

    8. **Step 5 — Add / update tests to cover the changes from steps 3 and 4:**
       - For every code change introduced while addressing human comments (step 3) and trivial bot fixes (step 4), check whether existing tests cover the new behavior. If not, **add a new test or extend an existing one**. This is language-agnostic — unit tests, integration tests, snapshot tests, table-driven tests, doctests, whatever the repo uses.
       - Look for gaps: new branches / conditions, new error paths, renamed / relocated APIs, edge cases the comment specifically called out, regression coverage for the bug a reviewer flagged.
       - Place tests in the repo's existing test folder / file convention (e.g. \`software/tests/\`, \`__tests__/\`, \`tests/\`, \`*_test.go\`, \`spec/\`, etc.). Don't invent a new test framework — reuse what's already there.
       - If a comment was a pure doc / typo fix with no behavior change, skip — no test needed.
       - Skip if the change is genuinely untestable (e.g. CI YAML, formatting-only). Note it in the final report.
       - Commit the new/updated tests.

    9. **Step 6 — Pull current CI state and pre-emptively fix any visible failures (language-agnostic):**
       - Before running local checks, fetch the latest CI status: \`gh pr view <number> --repo <owner/repo> --json statusCheckRollup\`.
       - For any check already failing (lint, test, type-check, build, config validation, security scan, custom step — any language), pull the logs: \`gh run view <run-id> --repo <owner/repo> --log-failed\`.
       - Fix what you can locally: lint / format violations, syntax errors, type errors, broken config (\`tsconfig.json\`, \`pyproject.toml\`, \`Cargo.toml\`, \`.golangci.yml\`, etc.), simple test failures. Same generic posture as step 8 — diagnose by category, not by language.
       - If a failure is clearly infra / flaky / approval-gated (network timeout, missing secret, queued runner), note it for the final report and move on.
       - Commit any fixes here so they get re-validated by the local checks in the next step.

    10. **Step 7 — Run local checks before pushing any new commit (language-agnostic):**
       - Detect project type from repo files and run whatever the repo defines. Order of preference:
         1. **Repo-defined entrypoints first** — \`make validate\` / \`make test\` / \`make lint\` / \`make check\` (Makefile), \`just test\`, \`pre-commit run --all-files\`, scripts in \`package.json\` / \`pyproject.toml\` / \`Cargo.toml\` / \`go.mod\`, or whatever \`README\` / \`CLAUDE.md\` / \`CONTRIBUTING.md\` says to run.
         2. **Otherwise fall back to language-native tooling**, e.g.:
            - Node/TS: \`npm test\` (or \`yarn\`/\`pnpm\`), \`npx tsc --noEmit\`, \`npx prettier --check .\`, \`npx eslint .\`
            - Python: \`pytest\`, \`ruff check .\`, \`ruff format --check .\`, \`mypy .\`
            - Rust: \`cargo test\`, \`cargo fmt --check\`, \`cargo clippy\`
            - Go: \`go test ./...\`, \`gofmt -l .\`, \`go vet ./...\`
            - Shell: \`shellcheck\`, \`shfmt -d\`, \`bash -n\`
            - Config: \`tsc --noEmit\` for \`tsconfig.json\`, \`yamllint\`, \`jsonlint\`, \`cargo check\`, etc.
       - If any fail, **fix them before pushing** — including lint/format violations, syntax errors, type errors, broken config (\`tsconfig.json\`, \`pyproject.toml\`, \`Cargo.toml\`, etc.), and unit/integration test failures. Re-run until green locally.
       - Commit and push the fixes.

    11. **Step 8 — Monitor CI and fix any failure (language-agnostic)** — poll every **60 seconds**: \`gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable\`.
        - If all checks pass: go back to **step 1 (early-exit)** to confirm green + approved.
        - If checks are still pending: keep polling.
        - If any check is failing (test job, lint job, type-check job, build job, security scan, custom CI step — anything):
          a. Get failing run IDs from \`statusCheckRollup\`.
          b. Examine logs: \`gh run view <run-id> --repo <owner/repo> --log-failed\`.
          c. Diagnose the failure regardless of category — could be a test failure, a lint/format violation, a syntax error, a type error, a misconfigured \`tsconfig.json\` / \`pyproject.toml\` / \`Cargo.toml\` / similar, a missing dependency, or a build error in any language. Read the relevant code/config, fix it, and re-run the matching local check from step 7 to confirm.
          d. Commit and push.
          e. **Go back to step 0** — re-run the full loop: skip-if-running → early-exit → merge → human comments → bot trivia → tests → pre-emptive CI fix → local checks → CI monitor.

    12. **Final report:** Summarize what happened — sync result, comments addressed (human + trivial bot), tests added / updated, pre-emptive CI fixes, local checks run, CI fixes applied, and whether the PR is now green + approved.

    ## Rules

    - **Step 0 (skip if CI is running) is the very first check — before everything.** If CI is in progress / pending / queued, stop immediately and take no action. Never merge, comment, or push while a build is still running.
    - **Always sync with the base branch (step 2) BEFORE addressing comments or fixing anything.** Get the latest from \`master\`/\`main\` first so subsequent fixes apply on top of up-to-date code.
    - The loop is: step 0 skip-if-running → step 1 early-exit → step 2 merge base → step 3 human comments → step 4 trivial bot comments → step 5 add/update tests → step 6 pre-emptive CI fix → step 7 local checks → step 8 CI monitor → (on failure) back to step 0.
    - Never rebase to sync — always use \`git merge\` so history is not rewritten. Never use \`--squash\` when merging main into the branch.
    - Never skip local checks before pushing — it wastes CI cycles.
    - **Bot comments: only trivial / minor fixes** (typos, single-line lint nits, doc wording). Never let a bot drive a refactor or redesign — skip anything non-trivial.
    - **Every behavior-changing fix from step 3 or 4 needs test coverage in step 5.** Doc/typo/format-only changes are exempt.
    - Fix CI failures of every kind (tests, lint, type-check, build, config) regardless of language — do not assume JS/Node.
    - Poll CI every 60s; do not spam \`gh\` calls.
  `,

  "babysit-prs.md": code`
    Run \`/babysit-pr\` on EVERY open PR. This command is a fan-out wrapper — it finds all your open PRs and delegates the full per-PR loop (sync, comments, local checks, CI monitor) to \`/babysit-pr\` for each one.

    ## Steps

    1. Run \`gh search prs --author=@me --state=open --json number,title,repository,isDraft,url,headRefName,baseRefName\` to find all open PRs.

    2. **Announce:** Tell the user how many open PRs were found and list them (repo, PR number, title).

    3. **For each PR, delegate to \`/babysit-pr <PR-URL>\`.** That command owns the full per-PR behavior:
       - step 0: early-exit if already green + approved (skipped PRs cost nothing),
       - step 1: merge base + resolve conflicts (always sync first),
       - step 2: address comments from human (non-bot) users,
       - step 3: address ONLY trivial / minor bot comments (typos, one-line nits — never redesign),
       - step 4: add / update tests to cover gaps from steps 2 and 3,
       - step 5: pull current CI state and pre-emptively fix any visible failures (lint, type, test, etc.),
       - step 6: run local tests / format / type checks / build (language-agnostic), fix before pushing,
       - step 7: monitor CI every 60s, fix any failing check (any language), loop back to step 0 on failure.
       Do NOT duplicate any of that logic here — if the per-PR flow needs to change, edit \`/babysit-pr\`.

    4. **Periodic status snapshot:** At the end of every 60-second polling cycle (across all PRs), run \`/list-prs\` to render the current readiness table. This is the single source of truth for status output — do not hand-roll a separate table. Between snapshots, keep log lines terse (one line per action).

    5. Repeat — delegate, wait 60s, render \`/list-prs\` — until all PRs are green + approved or the remaining issues require human intervention (flaky infra, missing secrets, approval-gated checks). Report those clearly.

    6. **Final report:** one last \`/list-prs\` render plus a short summary of which PRs were skipped (already green), which were processed, and which need human attention.

    ## Rules

    - This command is a dispatcher. The per-PR loop lives in \`/babysit-pr\` — do not re-implement it here.
    - Poll \`/list-prs\` every 60s; do not spam \`gh\` calls.
  `,

  "sync-and-groom-repo.md": code`
    Sync a single git repo with its remote and groom it: fetch + prune, drop dead branches and worktrees, fast-forward the default branch, and merge the default branch into every other local branch (resolving conflicts as we go) so nothing is left stale.

    Argument: \$ARGUMENTS (optional — a path to a git repo. If empty, use the current working directory.)

    ## Steps

    1. **Resolve the target repo:**
       - If \`\$ARGUMENTS\` is provided, treat it as a path and \`cd\` there.
       - If \`\$ARGUMENTS\` is empty, use \`\$PWD\`.
       - Verify it's a git repo via \`git rev-parse --show-toplevel\`. If not, report and stop.
       - \`cd\` to the repo root for the rest of the run.

    2. **Announce:** Repo path, current branch (or "detached HEAD"), and whether the working tree is clean (\`git status --porcelain=v2 -b\`).

    3. **Stash dirty work — only if dirty:**
       - If \`git status --porcelain\` is non-empty, run \`git stash push -u -m "sync-and-groom-repo: auto-stash <ISO timestamp>"\` and remember that we stashed.
       - If clean, skip stash entirely. Do NOT stash unconditionally — popping an empty stash later would surprise the user.

    4. **Detect the default branch:**
       - Try \`git symbolic-ref refs/remotes/origin/HEAD\` and strip the \`refs/remotes/origin/\` prefix.
       - If that fails, try \`git rev-parse --verify origin/main\` then \`origin/master\`. First match wins.
       - If still nothing, report "could not determine default branch" and stop. Do not guess.

    5. **Fetch everything and prune:**
       - First check whether any local tags are NOT on origin: \`comm -23 <(git tag | sort) <(git ls-remote --tags origin | awk '{print \\\$2}' | sed 's|refs/tags/||;s|\\^{}\\\$||' | sort -u)\`. If non-empty, list them and skip \`--prune-tags\` to protect hand-made local tags.
       - Run \`git fetch --all --prune\` (add \`--prune-tags\` only when the previous check found no local-only tags).

    6. **Prune stale worktrees:**
       - Run \`git worktree list\` for the report.
       - Run \`git worktree prune\` — removes bookkeeping entries for worktree directories that no longer exist on disk. Do NOT delete any live worktree directory; that's a manual decision.

    7. **Drop local branches whose remote tracking branch is gone:**
       - \`git branch -vv | awk '/: gone\\]/ {print \\\$1}' | xargs -r git branch -D\`
       - These are typically squash-merged branches whose commits have different SHAs from \`main\` — \`git branch -d\` would refuse, so \`-D\` is correct here.
       - Report which branches were deleted; reflog still has them for ~90 days if recovery is needed.

    8. **Switch to the default branch and update it:**
       - \`git checkout <default>\` (skip if already on it).
       - \`git pull --rebase\` — fast-forward, or rebase any rare local commits.
       - If pull fails (diverged in a way rebase can't auto-resolve): stop and report. Never force-push the default branch.

    9. **Merge the default into every remaining local branch — the main grooming loop:**

       For each local branch B where B != default:

       a. Skip if B is already up to date — \`git merge-base --is-ancestor <default> B\` returns 0.

       b. Otherwise: \`git checkout B\`.

       c. Merge the default in (regular merge commit — NEVER rebase, never \`--squash\`):
          \`git merge <default> --no-edit\`

       d. **If conflicts occur, resolve them. This is the primary value of the skill** — the whole reason we run this is to surface and fix drift before it becomes someone else's problem.
          - \`git status\` to list conflicted files.
          - For each: read both sides of \`<<<<<<<\` / \`=======\` / \`>>>>>>>\` markers, understand each side's intent, produce a correct merged result, remove all markers.
          - Lockfiles / generated files (\`package-lock.json\`, \`yarn.lock\`, \`Cargo.lock\`, \`.build/\` artifacts): regenerate after accepting the default-branch version (re-run \`npm install\`, \`cargo build\`, \`make build\`) rather than hand-editing.
          - Stop and ask the user only if resolution requires judgment you don't have (conflicting semantics, diverging feature logic). Don't bail on conflicts you CAN reason through.
          - \`git add <files>\` and \`git commit --no-edit\` to finalize.
          - Verify clean tree: \`git status\` should show no "unmerged paths".

       e. **Push if upstream exists.** Check \`git rev-parse --abbrev-ref --symbolic-full-name @{u}\` — if it returns a value, \`git push\`. If \`fatal: no upstream\`, skip the push and don't auto-set one.

    10. **Worktrees on other branches:** \`git worktree list --porcelain\` enumerates every worktree. For each additional worktree (not the main one) whose HEAD is on a branch (not detached), \`cd\` into its directory and run the same merge-default-into-branch flow as step 9 there. Git enforces "one branch per worktree" so step 9 in the main worktree could not have touched these branches.

    11. **Garbage-collect lightly:** \`git gc --auto\` — cheap if nothing to do. Do NOT run \`git gc --aggressive\` or \`--prune=now\`; rarely worth the slowdown. Skip entirely if \`[maintenance] auto = true\` is set (background job already handles it).

    12. **Return to the default branch** so the user lands somewhere predictable: \`git checkout <default>\`.

    13. **Pop the auto-stash from step 3 — only if we stashed:**
        - \`git stash pop\`.
        - If the pop conflicts (working tree changed under us), leave the stash in place and tell the user. Do NOT auto-resolve a stash-pop conflict — too easy to lose work.

    14. **Final report.** Concise block:
        - Repo path + default branch
        - Branches deleted (gone-tracked)
        - Worktree records pruned
        - Tags pruned (or "skipped — N local-only tags kept: …")
        - Branches synced with default (with vs. without conflicts that we resolved)
        - Branches skipped (no upstream / already current)
        - Whether the auto-stash popped successfully

    ## Rules

    - **Always merge to sync, never rebase.** Branches in this loop may already be pushed; rewriting history would force \`--force-with-lease\` next push.
    - **Never \`--squash\` when merging the default into a feature branch.** Squashing here would erase the linkage and break the next groom run's ancestor check.
    - **Never force-push.** This skill never produces \`git push --force\` or \`--force-with-lease\`. If a normal push fails, stop and report.
    - **Never delete a worktree directory.** \`git worktree prune\` only cleans bookkeeping for already-removed dirs. Removing a live worktree is the user's call.
    - **Stash is opt-in based on dirty state.** Only stash when there's something to stash; only pop what we stashed.
    - **Don't auto-resolve a stash-pop conflict.** Leave the stash, report it.
    - **Tag pruning is opt-in.** Default to plain \`--prune\` when any local-only tags exist; \`--prune-tags\` only when local tags are a strict subset of remote.
    - **Default branch's pull is \`--rebase\`** (matches global \`pull.rebase = true\`). Feature branches use merge.
    - **Detached HEAD short-circuit.** If step 2 reports detached HEAD, do steps 5 (fetch), 6 (worktree prune), 7 (gone-branch cleanup), 11 (gc) only. Skip the default-branch checkout and the merge loop — the user is mid-something; do not move HEAD out from under them.
  `,

  "sync-and-groom-repos.md": code`
    Run \`/sync-and-groom-repo\` on EVERY git repo in the current folder. This command is a fan-out wrapper — it discovers repos and delegates the full per-repo cleanup loop (fetch, prune, drop dead branches/worktrees, sync default, merge default into every other branch) to \`/sync-and-groom-repo\` for each one.

    ## Steps

    1. **Discover repos to process** — exactly one level, no recursion into subdirectories of repos:
       - If \`\$PWD\` itself is a git repo (\`git rev-parse --show-toplevel\` succeeds), include it.
       - For each immediate child directory of \`\$PWD\`, include it if it has a \`.git/\` directory (or a \`.git\` file pointing at a worktree).
       - **Do NOT recurse.** Submodules and nested checkouts inside a repo are deliberately ignored — they're owned by their parent repo's lifecycle.

       Reference shell discovery (for clarity, not literal copy-paste):
       \`\`\`bash
       repos=()
       [ -e ".git" ] && repos+=("\$PWD")
       for d in */; do [ -e "\$d/.git" ] && repos+=("\$PWD/\${d%/}"); done
       \`\`\`

    2. **Announce:** Tell the user how many repos were found and list them (basename + branch + dirty/clean indicator). Use \`git -C <path> branch --show-current\` and \`git -C <path> status --porcelain\` for the per-repo summary line.

    3. **For each repo, delegate to \`/sync-and-groom-repo <absolute-repo-path>\`.** That command owns the full per-repo behavior:
       - resolve target + announce
       - auto-stash (only if dirty)
       - detect default branch
       - fetch --all --prune (with tag-pruning safety check)
       - prune stale worktree records
       - drop ": gone]" branches
       - checkout default + pull --rebase
       - merge default into every other branch (resolve conflicts as needed, push if upstream)
       - visit each additional worktree and apply the same merge
       - gc --auto, return to default branch, pop stash, final report.

       Do NOT duplicate any of that logic here — if the per-repo flow needs to change, edit \`/sync-and-groom-repo\`.

    4. **Run sequentially, not in parallel.** Each delegation may need to resolve merge conflicts that require human judgment; running them concurrently would interleave prompts and make the conflict-resolution context impossible to follow. One repo at a time.

    5. **If a per-repo run fails or asks the user for help:** surface that clearly in the running log, but continue to the next repo. Do not abort the whole fan-out on a single repo's conflict — collect per-repo outcomes and report them together.

    6. **Final report:** A short summary table covering every repo: repo name, branches deleted, worktrees pruned, branches synced (with vs. without conflicts), branches skipped, and any repo that needs human attention (unresolved conflict, push refused, dirty stash that wouldn't pop).

    ## Rules

    - This command is a dispatcher. The per-repo loop lives in \`/sync-and-groom-repo\` — do not re-implement it here.
    - **One level of discovery only.** Never recurse into subdirectories of discovered repos. Submodules and nested checkouts stay alone.
    - **Sequential execution.** Conflict resolution is human-in-the-loop; parallel runs would scramble the prompts.
    - **Continue on per-repo failure.** A stuck repo doesn't stop the rest of the fan-out — collect outcomes, report at the end.
    - Do not auto-set upstreams, do not force-push, do not delete worktree directories. All those constraints come from \`/sync-and-groom-repo\` and are inherited by this wrapper.
  `,

  "create-pr.md": code`
    Create a pull request for the current branch.

    ## Steps

    1. Run \`git status\` to check for uncommitted changes and \`git log\` to understand the commits on this branch.
    2. Determine the base branch (usually \`master\` or \`main\`).
    3. Run \`git diff <base>...HEAD\` to understand all changes included in the PR.
    4. Generate a PR title and body based on the changes:
       - Title: concise description of the changes.
       - Body should include a \`## Summary\` section with bullet points and a \`## Test plan\` section.
    5. Push the branch if needed: \`git push -u origin <branch>\`
    6. Create the PR: \`gh pr create --title "..." --body "..."\`
    7. Return the PR URL.
    8. ${_OFFER_BABYSIT_BLOCK}
  `,

  "draft-pr.md": code`
    Create a WIP pull request for the current branch. Not a GitHub draft — a regular PR with a WIP title prefix so CI runs.

    ## Steps

    1. Run \`git status\` to check for uncommitted changes and \`git log\` to understand the commits on this branch.
    2. Determine the base branch (usually \`master\` or \`main\`).
    3. Run \`git diff <base>...HEAD\` to understand all changes included in the PR.
    4. Generate a PR title and body based on the changes:
       - Title format: \`WIP: DO NOT MERGE — <concise description of changes>\`
       - Body should include a \`## Summary\` section with bullet points and a \`## Test plan\` section.
    5. Push the branch if needed: \`git push -u origin <branch>\`
    6. Create the PR (regular, NOT draft): \`gh pr create --title "WIP: DO NOT MERGE — ..." --body "..."\`
    7. Return the PR URL.
    8. ${_OFFER_BABYSIT_BLOCK}

    ## Rules

    - Always create as a **regular PR** (never \`--draft\`) so CI runs immediately.
    - Always use the title prefix \`WIP: DO NOT MERGE —\` followed by a concise description.
  `,

  "list-prs.md": code`
    List open pull requests across all repos, grouped by readiness.

    Argument: $ARGUMENTS (optional — the PR author to filter by: a GitHub username, a full name, or empty.)

    ## Resolving the author

    ${_resolveAuthorBlock("list")}

    ## Steps

    1. Fetch open PRs for the resolved author:
       \`gh search prs --author=<resolved> --state=open --json number,title,repository,isDraft,url,headRefName,createdAt\`

    2. For each PR, fetch detailed status:
       - CI/build status: \`gh pr view <number> --repo <owner/repo> --json statusCheckRollup\` -> passing / failing / pending
       - Approval status: \`gh pr view <number> --repo <owner/repo> --json reviews,reviewDecision\` -> approved (count) / changes requested / pending review
       - Merge readiness: all checks pass + approved + no conflicts

    3. **Classify each PR into one of two groups:**
    ${_CLASSIFY_PRS_BLOCK}

    4. **Sort within each group** using this order (each tiebreaker applies only when the previous is equal):
    ${_SORT_PRS_BLOCK}

    5. Present **two separate tables**, READY first then WIP / DRAFT, each with these columns:
       | PR | Repo | Title | Link | CI Status | Approvals | Ready to Merge? |
       - PR column: PR number and branch name on separate lines (e.g. \`#123\` then \`feature-branch\` below it)
       - CI Status: passing / failing / pending
       - Approvals: approved (count) / changes requested / pending review
       - Ready to Merge: yes (all green + approved + mergeable) or no (with reason)
       - In the WIP / DRAFT table, mark titles with \`[WIP]\` (title contains WIP / DNM) or \`[Draft]\` (GitHub draft). A PR can have both tags.

    6. Above each table, print a heading: \`## Ready for review (N)\` and \`## WIP / Draft (N)\` with the count.
  `,

  "slack-prs.md": code`
    Draft a short Slack message asking the team to review open pull requests, grouped by readiness.

    Argument: $ARGUMENTS (optional — the PR author to filter by: a GitHub username, a full name, or empty.)

    ## Resolving the author

    ${_resolveAuthorBlock("share")}

    ## Steps

    1. Fetch open PRs for the resolved author:
       \`gh search prs --author=<resolved> --state=open --json number,title,repository,isDraft,url,headRefName,createdAt\`

    2. **Classify each PR into one of two groups:**
    ${_CLASSIFY_PRS_BLOCK}

    3. **Sort within each group** using this order (each tiebreaker applies only when the previous is equal):
    ${_SORT_PRS_BLOCK}

    4. **Compose a short Slack message** (plain text, copy-pasteable — no tables, no markdown headers):

       \`\`\`
       Hi team, can I have a review on these PRs? 🙏

       *Ready for review*
       - <repo> — <branch> — <friendly title> — <url>
       - <repo> — <branch> — <friendly title> — <url>

       *WIP / Draft (early feedback welcome)*
       - <repo> — <branch> — <friendly title> — <url>
       \`\`\`

       Rules:
       - Keep it short. Just the four fields per line — no CI, approvals, or merge status.
       - "Friendly title" = the PR title with any \`WIP:\`, \`DO NOT MERGE\`, or \`[Draft]\` prefixes stripped for readability.
       - Omit a group entirely (including its header) if it has zero PRs.
       - If BOTH groups are empty, output just: \`No PRs to share right now.\`
       - Use Slack-flavored formatting (\`*bold*\`, not \`**bold**\`).

    5. Print the final message inside a fenced code block so the user can copy it directly into Slack.
  `,

  "release-beta.md": code`
    Trigger a beta release from a specific commit SHA.

    Argument: $ARGUMENTS (required — a commit SHA or branch name to release from.)

    ## Steps

    1. Determine the repo from \`git remote get-url origin\`.
    2. Resolve the target SHA:
       - If \`$ARGUMENTS\` looks like a SHA (hex string), use it directly.
       - If \`$ARGUMENTS\` is a branch name, resolve it: \`git rev-parse origin/<branch>\` or \`gh api repos/<owner/repo>/git/ref/heads/<branch> --jq '.object.sha'\`
       - If \`$ARGUMENTS\` is empty, ask the user for a branch name or SHA.
    3. List release workflows: \`gh workflow list --repo <owner/repo>\`.
       - **Select** the beta workflow — names containing \`release-beta\`, \`release beta\`, \`beta\`, \`prerelease\`, \`pre-release\`, \`canary\`, or \`nightly\`.
       - **Reject** any workflow that is the official/stable release (names like \`release-official\`, \`release official\`, \`official-release\`, \`publish\`, or bare \`release\` with no modifier). If the only matches are official, stop and report "no beta release workflow found — aborting". This command must never trigger an official release.
       - If multiple beta candidates remain, ask the user which one to trigger.
    4. Confirm with the user: "About to trigger BETA release \`<workflow name>\` at SHA \`<sha>\` (<short description>) in \`<owner/repo>\`. This is NOT an official release. Proceed? (yes/no)"
       - If no: stop.
    5. Trigger: \`gh workflow run <workflow-id> --repo <owner/repo> --ref <sha>\`
    6. Wait a few seconds, then find the new run: \`gh run list --repo <owner/repo> --workflow=<workflow-id> --limit 1 --json databaseId,status,url\`
    7. Report the run URL and status to the user.
  `,

  "release-official.md": _RELEASE_OFFICIAL_BODY,
  "release-main.md": _RELEASE_OFFICIAL_BODY,
  "release-master.md": _RELEASE_OFFICIAL_BODY,
};

/**
 * Deploys inline slash command definitions from CLAUDE_COMMANDS to ~/.claude/commands/.
 * Each entry becomes a user-level /<name> command available across all projects.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doCommandsWork(targetDir) {
  const commandsDir = path.join(targetDir, "commands");

  log(">> Claude Code Commands:", commandsDir);

  fs.mkdirSync(commandsDir, { recursive: true });

  for (const [file, content] of Object.entries(CLAUDE_COMMANDS)) {
    const dest = path.join(commandsDir, file);
    await backupConfigFile(dest);
    fs.writeFileSync(dest, content + "\n");
    log("   Deployed:", file);
  }
}

////// Main Entry Point //////

/**
 * Orchestrates all Claude Code setup: settings, keybindings, and commands.
 */
async function doWork() {
  const targetDir = path.join(BASE_HOMEDIR_LINUX, ".claude");

  if (!fs.existsSync(targetDir)) {
    log(">> Skipping Claude Code setup — ~/.claude not found");
    return;
  }

  log(">> Configuring Claude Code:", targetDir);

  await _doSettingsWork(targetDir);
  await _doKeysWork(targetDir);
  await _doCommandsWork(targetDir);
  await _doInstructionsWork(targetDir);
}
