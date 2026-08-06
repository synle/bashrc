[Sy] Generate the rules + map docs (AGENTS.md, ARCHITECTURE.md, DEV.md) for a repo that lacks them, by reading the actual codebase. Never invents conventions — every claim traces to a file.

Argument: $ARGUMENTS (optional — a repo path, or which docs to generate: `rules`, `architecture`, `dev`, or `all`. Default: the current repo, `all`, skipping any doc that already exists.)

## When to use

- A repo has no `AGENTS.md` / `CLAUDE.md`, so every agent session rediscovers its conventions from scratch and gets them subtly wrong.
- A repo has rules but no map (`ARCHITECTURE.md`, `DEV.md`), which is the combination that produces locally-correct, architecturally-wrong changes.
- Onboarding a human and realizing nothing written down explains how the thing is built or run.

Do **not** use this to rewrite a rules file someone maintains. This fills a hole; extending an existing doc is a normal edit, and an existing doc is authoritative over anything inferred here.

## Hard rules

- **Every claim traces to a file.** These docs become the instructions every future agent follows, so a wrong line here is a defect multiplier — it produces confidently wrong work forever, in every session, and nobody rereads it to check. Do not write a convention because it is common in the ecosystem; write it because this repo does it. (See the Epistemic Honesty rules.)
- **Describe what the repo does, not what it should do.** Aspirational rules ("we use conventional commits") that the history contradicts are worse than silence. If a convention is inconsistent, say so and give the dominant form with its rough ratio — "~80% of commits use `type: subject`, the rest are freeform".
- **Mark inferences as inferences.** A convention with two examples is a guess; label it `(inferred from 2 occurrences — confirm)`. Collect these into a `## Confirm these` section at the bottom for the owner to resolve.
- **Never fabricate a command.** Every command in `DEV.md` must exist in `package.json` scripts, the `Makefile`, `pyproject.toml`, `Cargo.toml`, the CI workflow, or an existing README. Run the ones that are safe and read-only (`--help`, `--version`, a lint, a type-check) and note which you actually ran versus which you copied from config.
- **Do not run destructive or slow commands to find out what they do.** Do not run migrations, deploys, releases, `clean`, or anything writing outside the repo. Read their definitions instead.

## Steps

### 1. Resolve and survey

Resolve `owner/repo` (see the Repo Identification rules — never `basename $PWD`). Then survey before writing a word:

```bash
git ls-files | head -200                       # real layout, no build junk
git ls-files | wc -l
git ls-files | sed 's#/[^/]*$##' | sort | uniq -c | sort -rn | head -30   # where the code actually lives
git --no-pager log --oneline -50
git --no-pager log --format='%ae' -200 | sort | uniq -c | sort -rn        # solo, solo+bots, or team
ls .github/workflows/ 2>/dev/null
```

Read every manifest and config found: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `pom.xml`, `build.gradle`, `Makefile`, `justfile`, `Dockerfile`, `docker-compose.yml`, CI workflows, linter and formatter configs, `.editorconfig`, test configs, and any existing `README` / `CONTRIBUTING` / `docs/`.

**Report the survey before generating anything** — entry points, languages, frameworks, test runner, package manager, CI, roughly how big. If the repo is a monorepo, say so and ask (or decide, in autopilot) whether to document the root or one workspace; a single blended doc for eight packages helps nobody.

### 2. Detect conventions from evidence, not vibes

For each of these, find the evidence or write nothing:

| Convention                  | Where the evidence is                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Language / runtime versions | manifests, `.nvmrc`, `.python-version`, `rust-toolchain`, CI matrix, engine fields                 |
| Package manager             | which lockfile exists — never guess from the ecosystem                                             |
| Formatting / linting        | config files, plus whether CI enforces them                                                        |
| Test layout + runner        | test config, the actual `test/` `tests/` `__tests__/` `*_test.go` `*.spec.ts` layout, CI test step |
| Naming / file layout        | the directory histogram from Step 1 plus a read of 3-5 representative files                        |
| Error handling / logging    | grep the logger import, read 3 call sites                                                          |
| Commit style                | `git log --format=%s -100`, report the dominant form and the ratio                                 |
| Branch / PR flow            | branch names in `git branch -a`, PR templates, `CODEOWNERS`, required checks                       |
| Solo vs team                | the author histogram from Step 1                                                                   |

Read representative source files end-to-end. Three files read fully teach more about a codebase's real conventions than thirty files grepped.

### 3. Write the docs

Only generate what is missing. Never overwrite an existing doc — if one exists but is thin, propose an additive diff instead and say which sections you would add.

**`AGENTS.md` — the rules.** What an agent must know before editing. Keep it operational and specific to this repo; do not restate general engineering advice the agent already has.

- What the repo is, in three sentences, and what the product actually is.
- Golden rules — the handful of things that break the repo if violated. Generated output that must not be hand-edited; protected paths; the one file that is the single source for something.
- Layout table: path → purpose, for the directories that matter.
- Conventions, per Step 2, each with its evidence.
- Validation: the exact commands, cheapest-first, and which one is the pre-commit gate.
- Anything portability-constrained: minimum runtime version, OS assumptions, shell version floors.
- Cross-link `ARCHITECTURE.md` and `DEV.md` rather than duplicating them.

**`ARCHITECTURE.md` — the map.** How it is built, so changes land in the right place.

- The 30-second model: what talks to what, in prose. A diagram only if you can generate one that is accurate.
- Entry points and control flow for the main path, traced through real files with `file:line` references.
- Module / package responsibilities and their boundaries.
- Data model and where state lives.
- External dependencies and integration points.
- Extension points: "to add a new X, touch these N files" — the single most-used section in practice.
- Known constraints and deliberate tradeoffs found in comments, ADRs, or commit messages.

**`DEV.md` — the workflow.** How to run and change it.

- Prerequisites with versions, and how to install them.
- First-time setup, as a copy-pasteable block.
- Run, build, test, lint, type-check — each a real command from config.
- How to run one test versus the whole suite.
- Debugging entry points: log locations, debug flags, editor launch configs.
- Common tasks: add a route, add a migration, add a config key, add a test.
- Troubleshooting for anything the codebase clearly trips over (a `.env` requirement, a service dependency, a codegen step that must run first).

### 4. Verify before handing over

- Every command in `DEV.md` exists in config; the safe ones were actually run and their output noted.
- Every path referenced exists — check them, do not eyeball them.
- No convention stated without evidence; everything uncertain sits under `## Confirm these`.
- Cross-links between the three docs resolve.
- If the repo already had a rules file, confirm you did not contradict it.

### 5. Report

- Files created, with line counts.
- Conventions detected, each with its evidence.
- The `## Confirm these` list — inferences the owner must resolve.
- Gaps you could not fill and what would fill them (no CI config, no tests, no entry point you could identify).
- Commands you did **not** run and why.
