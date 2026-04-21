Monitor ALL my open pull requests, fix failing builds, and wait until they pass.

## Steps

1. Run `gh search prs --author=@me --state=open --json number,title,repository,isDraft,url` to find all open PRs.

2. **Announce:** Tell the user how many open PRs were found and list them (repo, PR number, title).

3. For each PR, check CI status via `gh pr view <number> --repo <owner/repo> --json statusCheckRollup`.

4. Identify PRs with failing or errored checks. For each failing PR:
   a. Examine the failing check details and logs (`gh run view <run-id> --repo <owner/repo> --log-failed`).
   b. Checkout the branch, read the relevant code, and fix the issue.
   c. Commit the fix and push.
   d. Wait for CI to re-run and verify it passes.

5. For PRs with pending checks, wait for them to complete and re-check.

6. Report a final summary table of all PRs and their updated status:
   | # | Repo | Title | CI Status | Action Taken |

7. Repeat the cycle until all PRs have passing CI or the issues require human intervention (e.g., flaky infra, missing secrets, approval-gated checks). Report those clearly.
