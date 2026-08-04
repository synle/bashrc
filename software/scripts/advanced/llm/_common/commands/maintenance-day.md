# /sy-refresh-reset-and-sync-repos

Orchestrates a sequential maintenance workflow for the repository. Consists of two phases: PR cleanup and global repository grooming.

## Workflow Phases

### Phase 1: GitHub PR Cleanup

Closes stale Pull Requests to reduce noise and maintain focus on active work.

- Command: `close-stale-prs`

### Phase 2: Global Repository Grooming

Performs bulk synchronization and grooming for all managed repositories (e.g., syncing branches, cleaning up old artifacts, updating metadata).

- Command: `sync-and-groom-repos`

## Reporting

At the end of both phases, a consolidated **Maintenance Summary** will be generated, detailing:

- Number of closed stale PRs.
- Status and results of repository grooming actions.
- Any identified errors or warnings during the process.

## Usage

Use `/sy-refresh-reset-and-sync-repos` when performing periodic repo maintenance or "cleanup days".
