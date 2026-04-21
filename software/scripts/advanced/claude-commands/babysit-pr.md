Monitor a pull request, fix failing builds, and wait until CI passes.

Argument: $ARGUMENTS (optional — a PR URL or PR number. If empty, use the current branch's PR.)

## Steps

1. **Determine which PR to babysit:**
   - If `$ARGUMENTS` is provided (a PR URL like `https://github.com/org/repo/pull/123` or a PR number), use that.
   - If `$ARGUMENTS` is empty, detect from the current working directory:
     - Run `git remote get-url origin` to determine the repo.
     - Run `git branch --show-current` to get the current branch.
     - Run `gh pr view --json number,title,url,headRefName` to find the PR for the current branch.
     - If no PR exists for the current branch, tell the user and stop.

2. **Announce:** Tell the user which repo and PR you are babysitting (repo name, PR number, title, URL).

3. **Check CI status:** Run `gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable` to get current state.

4. **If all checks pass:** Report success and stop.

5. **If checks are still pending:** Wait and re-check periodically until they complete.

6. **If checks are failing:**
   a. Get the failing run IDs from statusCheckRollup.
   b. Examine logs: `gh run view <run-id> --repo <owner/repo> --log-failed`.
   c. Read the relevant code, diagnose the issue, and fix it.
   d. Commit the fix and push.
   e. Wait for CI to re-run.
   f. Re-check status — repeat until passing or the issue requires human intervention.

7. **Final report:** Summarize what happened — checks status, fixes applied, and whether the PR is now green.
