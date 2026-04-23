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

////// Commands (Custom Slash Commands) //////

/**
 * Inline definitions for user-level Claude Code slash commands.
 * Each entry becomes a /<name-without-.md> command available across all projects.
 * Keeping these inline (rather than in a sibling folder of .md files) means the
 * source of truth lives with the deploy logic and moves with the repo.
 * @type {Record<string, string>}
 */
const CLAUDE_COMMANDS = {
  "babysit-pr.md": code`
    Monitor a pull request, fix failing builds, and wait until CI passes.

    Argument: $ARGUMENTS (optional — a PR URL or PR number. If empty, use the current branch's PR.)

    ## Steps

    1. **Determine which PR to babysit:**
       - If \`$ARGUMENTS\` is provided (a PR URL like \`https://github.com/org/repo/pull/123\` or a PR number), use that.
       - If \`$ARGUMENTS\` is empty, detect from the current working directory:
         - Run \`git remote get-url origin\` to determine the repo.
         - Run \`git branch --show-current\` to get the current branch.
         - Run \`gh pr view --json number,title,url,headRefName\` to find the PR for the current branch.
         - If no PR exists for the current branch, tell the user and stop.

    2. **Announce:** Tell the user which repo and PR you are babysitting (repo name, PR number, title, URL).

    3. **Check CI status:** Run \`gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable\` to get current state.

    4. **If all checks pass:** Report success and stop.

    5. **If checks are still pending:** Wait and re-check periodically until they complete.

    6. **If checks are failing:**
       a. Get the failing run IDs from statusCheckRollup.
       b. Examine logs: \`gh run view <run-id> --repo <owner/repo> --log-failed\`.
       c. Read the relevant code, diagnose the issue, and fix it.
       d. Commit the fix and push.
       e. Wait for CI to re-run.
       f. Re-check status — repeat until passing or the issue requires human intervention.

    7. **Final report:** Summarize what happened — checks status, fixes applied, and whether the PR is now green.
  `,

  "babysit-prs.md": code`
    Monitor ALL my open pull requests, fix failing builds, and wait until they pass.

    ## Steps

    1. Run \`gh search prs --author=@me --state=open --json number,title,repository,isDraft,url\` to find all open PRs.

    2. **Announce:** Tell the user how many open PRs were found and list them (repo, PR number, title).

    3. For each PR, check CI status via \`gh pr view <number> --repo <owner/repo> --json statusCheckRollup\`.

    4. Identify PRs with failing or errored checks. For each failing PR:
       a. Examine the failing check details and logs (\`gh run view <run-id> --repo <owner/repo> --log-failed\`).
       b. Checkout the branch, read the relevant code, and fix the issue.
       c. Commit the fix and push.
       d. Wait for CI to re-run and verify it passes.

    5. For PRs with pending checks, wait for them to complete and re-check.

    6. Report a final summary table of all PRs and their updated status:
       | # | Repo | Title | CI Status | Action Taken |

    7. Repeat the cycle until all PRs have passing CI or the issues require human intervention (e.g., flaky infra, missing secrets, approval-gated checks). Report those clearly.
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
    8. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"
       - If yes: run \`/babysit-pr\` with the new PR URL.
       - If no: stop.
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
    8. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"
       - If yes: run \`/babysit-pr\` with the new PR URL.
       - If no: stop.

    ## Rules

    - Always create as a **regular PR** (never \`--draft\`) so CI runs immediately.
    - Always use the title prefix \`WIP: DO NOT MERGE —\` followed by a concise description.
  `,

  "list-prs.md": code`
    List open pull requests across all repos, grouped by readiness.

    Argument: $ARGUMENTS (optional — the PR author to filter by: a GitHub username, a full name, or empty.)

    ## Resolving the author

    1. If \`$ARGUMENTS\` is empty, whitespace, or one of \`me\`/\`mine\`/\`self\`, filter by the current user (\`--author=@me\`) — this is the default.
    2. If \`$ARGUMENTS\` is a clear GitHub handle (single token, no spaces), use it directly (\`--author=<handle>\`).
    3. If \`$ARGUMENTS\` is ambiguous (e.g. a full name with spaces, or unclear), ask the user: "Whose PRs should I list? Please provide a GitHub username or a full name." Then resolve:
       - If the user gives a handle, use it directly.
       - If the user gives a full name, try \`gh api "search/users?q=<name>" --jq '.items[0].login'\` to resolve to a handle, and confirm the match with the user before proceeding.

    ## Steps

    1. Fetch open PRs for the resolved author:
       \`gh search prs --author=<resolved> --state=open --json number,title,repository,isDraft,url,headRefName,createdAt\`

    2. For each PR, fetch detailed status:
       - CI/build status: \`gh pr view <number> --repo <owner/repo> --json statusCheckRollup\` -> passing / failing / pending
       - Approval status: \`gh pr view <number> --repo <owner/repo> --json reviews,reviewDecision\` -> approved (count) / changes requested / pending review
       - Merge readiness: all checks pass + approved + no conflicts

    3. **Classify each PR into one of two groups:**
       - **READY** — title does NOT contain \`WIP\` or \`DO NOT MERGE\` AND \`isDraft\` is false. These are ready for review.
       - **WIP / DRAFT** — title contains \`WIP\` or \`DO NOT MERGE\`, OR \`isDraft\` is true. Still in progress.

    4. **Sort within each group** using this order (each tiebreaker applies only when the previous is equal):
       a. Repo name (alphabetical).
       b. Dependency order — if PR A must merge before PR B (e.g. B's branch is based on A's branch, or B's description references A), put A first.
       c. \`createdAt\` ascending — oldest PR first, newest last.

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

    1. If \`$ARGUMENTS\` is empty, whitespace, or one of \`me\`/\`mine\`/\`self\`, filter by the current user (\`--author=@me\`) — this is the default.
    2. If \`$ARGUMENTS\` is a clear GitHub handle (single token, no spaces), use it directly (\`--author=<handle>\`).
    3. If \`$ARGUMENTS\` is ambiguous (e.g. a full name with spaces, or unclear), ask the user: "Whose PRs should I share? Please provide a GitHub username or a full name." Then resolve:
       - If the user gives a handle, use it directly.
       - If the user gives a full name, try \`gh api "search/users?q=<name>" --jq '.items[0].login'\` to resolve to a handle, and confirm the match with the user before proceeding.

    ## Steps

    1. Fetch open PRs for the resolved author:
       \`gh search prs --author=<resolved> --state=open --json number,title,repository,isDraft,url,headRefName,createdAt\`

    2. **Classify each PR into one of two groups:**
       - **READY** — title does NOT contain \`WIP\` or \`DO NOT MERGE\` AND \`isDraft\` is false. These are ready for review.
       - **WIP / DRAFT** — title contains \`WIP\` or \`DO NOT MERGE\`, OR \`isDraft\` is true. Still in progress.

    3. **Sort within each group** using this order (each tiebreaker applies only when the previous is equal):
       a. Repo name (alphabetical).
       b. Dependency order — if PR A must merge before PR B (e.g. B's branch is based on A's branch, or B's description references A), put A first.
       c. \`createdAt\` ascending — oldest PR first, newest last.

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
    3. List release workflows: \`gh workflow list --repo <owner/repo>\` and find the beta release workflow (look for names containing "release-beta", "release beta", "beta", or "prerelease").
    4. Confirm with the user: "About to trigger <workflow name> at SHA <sha> (<short description>) in <owner/repo>. Proceed? (yes/no)"
       - If no: stop.
    5. Trigger: \`gh workflow run <workflow-id> --repo <owner/repo> --ref <sha>\`
    6. Wait a few seconds, then find the new run: \`gh run list --repo <owner/repo> --workflow=<workflow-id> --limit 1 --json databaseId,status,url\`
    7. Report the run URL and status to the user.
  `,

  "release-official.md": code`
    Trigger an official release from the main branch.

    Argument: $ARGUMENTS (optional — repo in owner/repo format. If empty, use the current repo.)

    ## Steps

    1. Determine the repo:
       - If \`$ARGUMENTS\` is provided, use it as the repo.
       - Otherwise, run \`git remote get-url origin\` to detect the current repo.
    2. Identify the default branch (\`main\` or \`master\`): \`gh repo view <owner/repo> --json defaultBranchRef --jq '.defaultBranchRef.name'\`
    3. List release workflows: \`gh workflow list --repo <owner/repo>\` and find the official release workflow (look for names containing "release-official", "release official", "release", or "publish").
    4. Confirm with the user: "About to trigger <workflow name> on <default branch> in <owner/repo>. Proceed? (yes/no)"
       - If no: stop.
    5. Trigger: \`gh workflow run <workflow-id> --repo <owner/repo> --ref <default-branch>\`
    6. Wait a few seconds, then find the new run: \`gh run list --repo <owner/repo> --workflow=<workflow-id> --limit 1 --json databaseId,status,url\`
    7. Report the run URL and status to the user.
  `,
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
}
