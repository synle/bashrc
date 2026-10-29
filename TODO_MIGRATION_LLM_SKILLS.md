# TODO: migrate LLM skills to upstream-backed adapters

## TLDR

Replace generic custom Sy workflow bodies with reviewed upstream skills, while preserving Sy names through thin adapters. Keep only necessary local policy differences and explicitly decide whether to retain custom operational capabilities without an upstream equivalent.

## Status and scope

**Status: seven primary source adapters implemented; six component integrations and live deployment pending.** This document records the replacement audit and implementation checklist; it is not new standing agent guidance.

No skill migration, installation, retirement, deployment, commit, push, merge, or release is authorized by this checklist alone.

The 2026-10-29 audit mapped 30 registered Sy skills against all 11 repositories in the [guideline source registry](.agents/skills/refresh-llm-guidance/SKILL.md).

The original audit found 7 first-wave candidates, 7 partial matches, and 16 skills without a verified equivalent. Four unused skills are now retired, leaving 26 active skills: 7 first-wave, 7 partial, and 12 without a verified equivalent.

None establishes a drop-in replacement of the complete remaining Sy contract.

The goal is upstream ownership of workflow bodies, not another locally rewritten copy of those bodies.

## Impact

- **Benefit:** reduce maintenance of generic engineering procedures while preserving familiar Sy entry points.
- **Scope:** one shared registry/deployment seam, 26 remaining alias decisions, upstream dependencies, and affected compatibility checks.
- **Tradeoff:** complete elimination of custom workflows requires intentionally retiring capabilities the audited upstreams do not supply.
- **Measurement:** no runtime, token-cost, or agent-performance improvement has been measured.

The existing 30 source bodies totaled 546,118 bytes at the audit snapshot. The 5 largest PR workflows accounted for 350,173 bytes, or 64.1%:

| Source body      |  Bytes |
| ---------------- | -----: |
| `babysit-pr.md`  | 93,623 |
| `list-prs.md`    | 87,508 |
| `review-pr.md`   | 65,022 |
| `babysit-prs.md` | 56,757 |
| `review-prs.md`  | 47,263 |

The 7 first-wave candidates accounted for only 51,176 bytes, or 9.4%. Replacing generic skills alone therefore leaves most custom orchestration text.

These figures describe the audit baseline, not achievable savings or current runtime behavior.

## Adapter implementation progress

The requested delivery has two commits. Source implementation and isolated checks do not imply live client deployment or agent compliance.

- [x] Primary adapters: debugging, dependency bumps, RFCs, test gaps, calibrated interviews, repository onboarding, and plan execution.
- [x] Shared dependency installer: pinned revisions, complete selected resource inventories, exact SHA-256/size checks, immutable folders, and offline reuse.
- [x] Isolated proof: exact resource bytes, script modes without execution, malformed metadata, corruption, symbolic links, dry-run, repeatability, and all eight primary dependency bindings.
- [ ] Component integrations: instruction cleanup, PR reconciliation, CI triage, cross-agent migration, PR Slack drafts, and standup summaries.
- [ ] Live deployment and client reload after credential approval; repeat deployment and actual agent behavior remain unverified.

The first focused adapter suite passed 29 tests. The dependency inventory contains 109 resources across the three primary providers.
The first `make precommit` run passed 4,755 tests and failed only the unchanged curl Markdown-formatting test at `software/tests/curlWrapperFormat.dispatch-and-fallback.spec.js:264`.
That known failure remains unresolved and is not reported as a successful gate. Live deployment and executable-resource approval remain pending.
Retained local differences include dependency batching/pins without new cooldowns, existing-plan pressure calibration, missing-only documentation, and the original publication/state controller.
The requested second group excludes `sy-review-pr`; its independent audit item stays pending.

## Completed source retirements

The user approved these removals on 2026-10-29. The source bodies are deleted, the live registry no longer exposes them, and their names remain in the retirement registry.

| Retired skill             | Consumer audit and disposition                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `sy-maintenance-day`      | No other active skill or instruction calls it; explicitly retired by request.                   |
| `sy-squash-unpushed`      | No other active skill or instruction calls it; explicitly retired by request.                   |
| `sy-sync-and-clean-repos` | Its maintenance-workflow caller is retired; no remaining active consumer was found.             |
| `sy-sync-and-clean-repo`  | Its maintenance and plural-cleanup callers are retired; no remaining active consumer was found. |

- [x] Remove all four live registry entries, delete their source bodies, and register all four names for managed deployment cleanup.
- [ ] Deploy through the approved client setup path and reload clients; source retirement alone does not remove previously installed copies.

The independent `sy-close-stale-prs` and `sy-sync-pr-branch` workflows remain active. Historical audit counts below describe the original snapshot, not the remaining live inventory.

## Decisions before implementation

Resolve these choices explicitly rather than hiding behavior changes inside cleanup.

- [ ] Decide whether to retain custom PR polling, scheduling, dashboards, and multi-repository ownership, or retire them in favor of one-shot upstream workflows.
- [ ] Decide whether PR review should adopt upstream COMMENT-only semantics or retain Sy approval and request-changes behavior.
- [ ] Decide which existing input, output, state-retention, publication, and completion contracts each alias must preserve.
- [ ] Decide how dependency batching and upstream release-age cooldowns interact with local production-minor isolation and pinning rules.
- [ ] Decide how explicit upstream confirmation gates apply to already-authorized autonomous work; never infer additional authority from skill selection.
- [ ] Decide whether the generic bounded `sy-loop` contract remains necessary instead of treating planning persistence as an equivalent.
- [ ] Decide which repository-specific release and maintenance operations remain guarded tools rather than prose-heavy skills.

## Work checklist

Complete an item only when its implementation and acceptance evidence exist. Record changed paths, exact check commands, quoted results, remaining exceptions, and rollback beside completed implementation items.

### Audit baseline

- [x] Inventory all 30 registered Sy names and compare the inspected shared discovery inventories.
- [x] Retrieve complete catalogs from all 11 source repositories and record their default branches and revisions.
- [x] Retrieve 79 selected public documents and identify candidate mappings, gaps, and policy conflicts.
- [x] Map every registry skill exactly once: 7 first-wave, 7 partial, and 16 without verified equivalents.
- [ ] Finish full semantic reads for the 6 sampled local bodies and every affected upstream reference, sibling skill, script, hook, and template.
- [ ] Recheck the live registry and upstream revisions before implementation; treat this document's pins as audit evidence, not permanently current versions.

### Shared adapter and ownership seam

- [x] Keep the single Sy command registry and resolve adapter dependencies through one generated provider manifest; no per-client skill list was added.
- [x] Define immutable local upstream snapshots and record source revision, skill folder, license, and required sibling resources.
- [x] Generate thin Sy adapters with matching folder/frontmatter names and explicit upstream loading.
- [x] Preserve upstream folder identity and relative dependencies instead of renaming an upstream folder and assuming discovery still works.
- [x] Keep universal safety and authorization in the existing shared instructions; retain only operation-specific differences in adapters.
- [ ] Review executable dependency permissions, network behavior, and lifecycle effects before use.
- [x] Reuse the current shared deployment/linking boundary and preserve foreign files, folders, skills, and links.
- [x] Define a reviewed upstream-update process; do not fetch mutable remote workflow content during ordinary skill invocation.

### First-wave workflow cores

The mapping below defines the proposed upstream owner and the behavior still requiring adaptation.

- [x] Migrate `sy-debug` after resolving its listed adaptation and gap.
- [x] Migrate `sy-dep-bump` after resolving its listed adaptation and gap.
- [x] Migrate `sy-test-gap` after resolving its listed adaptation and gap.
- [x] Migrate `sy-rfc` after resolving its listed adaptation and gap.
- [x] Migrate `sy-plan-grill-me` after resolving its listed adaptation and gap.
- [x] Migrate `sy-onboard-repo` after resolving its listed adaptation and gap.
- [x] Migrate `sy-execute-plan` after resolving its listed adaptation and gap.

### Partial matches and operational remainder

- [ ] Integrate the 7 partial matches only for their verified components; preserve or explicitly retire the rest of each operation.
- [ ] Record a keep, adapt, or retire decision for each of the 12 remaining skills without a verified equivalent.
- [ ] Keep deterministic operational behavior in small guarded tools where appropriate rather than reproducing lengthy command procedures in each skill.
- [ ] Audit every consumer before removing or renaming a skill body, alias, registry entry, or compatibility path.
- [ ] Preserve uncertain consumers through compatibility; do not delete them because an upstream catalog lacks a matching name.
- [ ] Apply the existing retirement registry and deployment ownership rules only after migration checks and required approval.

### Verification and rollout

- [ ] Verify every retained alias resolves exactly once to the intended reviewed upstream content.
- [ ] Verify scripts, references, assets, templates, and sibling skills resolve without changing the caller's repository unexpectedly.
- [ ] Verify supported client discovery retains expected names without duplicate bodies.
- [ ] Verify dry-run review performs no GitHub writes.
- [ ] Verify unrequested push, merge, release, secret access, and delegation remain blocked.
- [ ] Verify shared feature branches are not rebased or force-pushed.
- [ ] Verify caller-selected feedback scope never widens silently.
- [ ] Verify concurrent PR work does not collide through fixed temporary filenames.
- [ ] Verify durable state remains recoverable under the chosen retention contract.
- [ ] Verify unavailable snapshots fail visibly rather than silently reverting to an old custom body.
- [ ] Run scoped formatting and affected registry, budget, loader, and behavior checks under repository validation rules.
- [ ] Obtain any required Secret Handling approval before deployment; deploy twice and verify stable counts with no stale-removal churn.
- [ ] Record per-alias rollback and actual verification evidence before retiring original bodies.

No runtime compatibility check above has passed merely because this document exists.

## Complete replacement map

A first-wave candidate can replace its workflow core after adaptation. A partial match supplies a component but not the complete operation.

“No equivalent” means no behavioral replacement was verified in the audited catalogs; it does not prove that no possible upstream solution exists.

### 7 first-wave workflow-core candidates

| Sy skill           | Closest upstream skill                                                                                                                                                                                                                                                                                                                                                                                 | Required adaptation                                                                                                                                                                                                                                  | Remaining gap                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sy-debug`         | [obra/superpowers: systematic-debugging](https://raw.githubusercontent.com/obra/superpowers/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/systematic-debugging/SKILL.md)                                                                                                                                                                                                                             | Preserve explicit reproduction/shrinking, original-command rerun, load-bearing revert proof, and local secret-safe diagnostics. Resolve required sibling skills locally; retain local safety precedence.                                             | Upstream does not explicitly preserve the complete Sy shrink/bisect/report contract.                                                                                     |
| `sy-dep-bump`      | [khasky/awesome-agent-skills: awesome-dependency-upgrade](https://raw.githubusercontent.com/khasky/awesome-agent-skills/58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7/skills/awesome-dependency-upgrade/SKILL.md)                                                                                                                                                                                           | Keep exact production pins, production-minor isolation and changelog review, deprecation reporting, publication authority, and lifecycle-script review. Treat upstream cooldowns as a deliberate new behavior, not cleanup.                          | Upstream permits patch/minor batching and conditional bot automerge; current Sy policy differs.                                                                          |
| `sy-test-gap`      | [khasky/awesome-agent-skills: awesome-test-gap-audit](https://raw.githubusercontent.com/khasky/awesome-agent-skills/58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7/skills/awesome-test-gap-audit/SKILL.md); [khasky/awesome-agent-skills: awesome-test-writing](https://raw.githubusercontent.com/khasky/awesome-agent-skills/58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7/skills/awesome-test-writing/SKILL.md) | Compose read-only gap discovery with test writing; default to the current branch diff, retain changed-code coverage evidence and optional bounded loop. Decide how upstream seam-confirmation gates behave in explicitly authorized autonomous work. | The audit alone never writes tests; the writing phase requires confirmed seams.                                                                                          |
| `sy-rfc`           | [khasky/awesome-agent-skills: awesome-design-doc](https://raw.githubusercontent.com/khasky/awesome-agent-skills/58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7/skills/awesome-design-doc/SKILL.md)                                                                                                                                                                                                           | Redirect output to the existing flat RFC artifact convention, preserve the concise RFC template and confidentiality rules, and scale load arithmetic to relevant decisions.                                                                          | Upstream ADR eligibility, numerical requirements, default repository docs location, and completeness gates differ.                                                       |
| `sy-plan-grill-me` | [addyosmani/agent-skills: interview-me](https://raw.githubusercontent.com/addyosmani/agent-skills/eb07f19f52c2669f2364897aaa293e2aaddd7b1c/skills/interview-me/SKILL.md)                                                                                                                                                                                                                               | Retain one question plus recommended answer, evidence-first reading, pressure/knowledge dials, and explicit user stop. Distinguish intent extraction from critique of an already formed plan.                                                        | Upstream requires an explicit yes and treats ordinary assent as insufficient; it lacks Sy pressure calibration.                                                          |
| `sy-onboard-repo`  | [khasky/awesome-agent-skills: awesome-agents-md-generator](https://raw.githubusercontent.com/khasky/awesome-agent-skills/58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7/skills/awesome-agents-md-generator/SKILL.md)                                                                                                                                                                                         | Use verified codebase mining for AGENTS.md; keep a small extension for ARCHITECTURE.md and DEV.md, missing-only behavior, and existing compatibility-link ownership. Review the referenced format and pattern catalogs before use.                   | Upstream explicitly writes only AGENTS.md and consented shims, not the complete three-document Sy contract.                                                              |
| `sy-execute-plan`  | [obra/superpowers: executing-plans](https://raw.githubusercontent.com/obra/superpowers/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/executing-plans/SKILL.md)                                                                                                                                                                                                                                       | Retain local plan/state locations, permission boundaries, iteration/stall caps, repository validation cadence, and publication/CI completion ownership. Review and install the full sibling/script dependency closure before running.                | Upstream uses a repository-local workspace, deletes it at finish, dispatches a final reviewer when possible, and does not implement Sy PR checkpoints or reconciliation. |

### 7 partial matches

| Sy skill                                    | Closest upstream skill                                                                                                                                                                                                                                                                                                                                              | Required adaptation                                                                                                                                                                                                                    | Remaining gap                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `sy-clean-instructions`                     | [khasky/awesome-agent-skills: awesome-document-style](https://raw.githubusercontent.com/khasky/awesome-agent-skills/58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7/skills/awesome-document-style/SKILL.md)                                                                                                                                                                | Reuse editing passes only. Keep semantic deduplication, named-rule and condition preservation, authoritative-source selection, budget checks, regeneration, and deployment in one local policy layer.                                  | Editorial cleanup is not a full instruction-corpus consolidation or deployment workflow.                                                     |
| `sy-review-pr`                              | [SteveVitali/agent-skills: review-pr](https://raw.githubusercontent.com/SteveVitali/agent-skills/e981ec57d487a2c41d416672483b5a4df15b1233/skills/review-pr/SKILL.md)                                                                                                                                                                                                | Choose upstream COMMENT-only semantics or explicitly retain Sy approval/request-changes policy. Preserve dry-run translation, unique file-backed payloads, durable review identity, deduplication, and optional scheduling separately. | Upstream explicitly refuses APPROVE and REQUEST_CHANGES; it is a one-shot review, not the Sy watch workflow.                                 |
| `sy-pr-reconciliation-pass`                 | [SteveVitali/agent-skills: address-pr-comments](https://raw.githubusercontent.com/SteveVitali/agent-skills/e981ec57d487a2c41d416672483b5a4df15b1233/skills/address-pr-comments/SKILL.md)                                                                                                                                                                            | Add caller-selected versus all-actionable scope, CI failure classification, broken-default/dependency gates, single repair batch, shared branch sync, and reply-after-publication evidence. Preserve explicit push permission.         | Upstream processes unresolved review threads, defaults push=true, and commits by concern; it does not own Sy CI repair or one-push batching. |
| `sy-triage-ci`                              | [arjunprabhulal/agent-skills: ci-pipelines](https://raw.githubusercontent.com/arjunprabhulal/agent-skills/42dd24080fce6d731d00e2a1134f398c3da4171b/skills/devops/ci-pipelines/SKILL.md); [obra/superpowers: systematic-debugging](https://raw.githubusercontent.com/obra/superpowers/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/systematic-debugging/SKILL.md) | Use upstream CI/debugging discipline after a small local adapter resolves the failed run, first failure, last-green comparison, cause class, rollback authority, and latest-run proof.                                                 | Neither target implements the complete no-PR failing-run triage and fix-forward/revert workflow.                                             |
| `sy-migrate-cross-agent-skills-and-context` | [khasky/awesome-agent-skills: awesome-agents-md-generator](https://raw.githubusercontent.com/khasky/awesome-agent-skills/58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7/skills/awesome-agents-md-generator/SKILL.md)                                                                                                                                                      | Reuse Merge mode for verified agent-context convergence only; retain scoped skill-folder moves, consumer audit, symlink ownership, generated-source protection, discovery checks, and commit authorization locally.                    | AGENTS.md consolidation is covered; portable skill migration and deployment compatibility are not.                                           |
| `sy-slack-prs`                              | [anthropics/skills: internal-comms](https://raw.githubusercontent.com/anthropics/skills/ca45fc496a3436251f191354091d557da31c15b5/skills/internal-comms/SKILL.md)                                                                                                                                                                                                    | Use only the communication renderer after a local read-only query supplies verified PRs, author attribution, readiness groups, dependency order, and Slack format. Do not send the draft automatically.                                | Upstream does not discover PRs or implement Sy grouping and author rules.                                                                    |
| `sy-standup`                                | [anthropics/skills: internal-comms](https://raw.githubusercontent.com/anthropics/skills/ca45fc496a3436251f191354091d557da31c15b5/skills/internal-comms/SKILL.md)                                                                                                                                                                                                    | Reuse update formatting after a local evidence collector resolves time windows, repositories, authors, merged-versus-released state, reviews, and blind spots.                                                                         | Upstream is a writing skill, not a Git/GitHub activity collector.                                                                            |

### 12 remaining skills without a verified behavioral replacement

Targets shown here are related components, not substitutes for the named Sy operation.

| Sy skill              | Closest upstream skill                                                                                                                                                                                                                                                                                                                                                          | Required adaptation                                                                                                                                                                                                                  | Remaining gap                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `sy-babysit-pr`       | [SteveVitali/agent-skills: address-pr-comments](https://raw.githubusercontent.com/SteveVitali/agent-skills/e981ec57d487a2c41d416672483b5a4df15b1233/skills/address-pr-comments/SKILL.md)                                                                                                                                                                                        | Keep or intentionally retire the bounded author-side watch controller; delegate individual review-thread repairs upstream only after scope and permission adaptation.                                                                | No verified target supplies Sy clock, polling, approval preservation, repair eligibility, branch sync, and latest-head CI completion together.  |
| `sy-babysit-prs`      | [SteveVitali/agent-skills: address-pr-comments](https://raw.githubusercontent.com/SteveVitali/agent-skills/e981ec57d487a2c41d416672483b5a4df15b1233/skills/address-pr-comments/SKILL.md)                                                                                                                                                                                        | Keep or retire multi-repository discovery, ranking, ownership, scheduling, and enrollment; a thread-repair skill can be a worker, not the dispatcher.                                                                                | No verified upstream batch babysitter.                                                                                                          |
| `sy-review-prs`       | [SteveVitali/agent-skills: review-pr](https://raw.githubusercontent.com/SteveVitali/agent-skills/e981ec57d487a2c41d416672483b5a4df15b1233/skills/review-pr/SKILL.md)                                                                                                                                                                                                            | Keep or retire discovery, author filtering, ranking, per-repository ownership, and watch budget; delegate one-shot review content upstream.                                                                                          | A single-PR review is not the plural scheduled review workflow.                                                                                 |
| `sy-list-prs`         | No verified upstream equivalent                                                                                                                                                                                                                                                                                                                                                 | Keep as a small read-only tool or retire its custom views; no skill in the audited catalogs was verified to provide the same dashboard.                                                                                              | Cross-repository readiness, thread/check joins, ranking, clustering, and pingpong output remain local behavior.                                 |
| `sy-list-prs-pending` | No verified upstream equivalent                                                                                                                                                                                                                                                                                                                                                 | Keep as a filter over the same read-only PR data tool, or retire the pending-only view.                                                                                                                                              | No verified upstream clustered pending-PR renderer with the Sy placeholder/clear filters.                                                       |
| `sy-create-pr`        | [arjunprabhulal/agent-skills: pr-descriptions](https://raw.githubusercontent.com/arjunprabhulal/agent-skills/42dd24080fce6d731d00e2a1134f398c3da4171b/skills/docs/pr-descriptions/SKILL.md)                                                                                                                                                                                     | Reuse body drafting if useful; keep or retire local publication permissions, default-base checks, template handling, title rules, owned-PR memory, and automerge decisions.                                                          | A description-writing skill does not safely publish a PR or preserve the Sy publication contract.                                               |
| `sy-draft-pr`         | [arjunprabhulal/agent-skills: pr-descriptions](https://raw.githubusercontent.com/arjunprabhulal/agent-skills/42dd24080fce6d731d00e2a1134f398c3da4171b/skills/docs/pr-descriptions/SKILL.md)                                                                                                                                                                                     | Reuse body drafting only; retain or intentionally drop the distinction between ordinary WIP and placeholder draft, including promotion and publication gates.                                                                        | No verified upstream placeholder-first/WIP PR creation workflow.                                                                                |
| `sy-close-stale-prs`  | No verified upstream equivalent                                                                                                                                                                                                                                                                                                                                                 | Keep as a consent-gated GitHub operation or retire; preserve per-PR confirmation, approved/pinned exclusions, and remote branches.                                                                                                   | No verified equivalent in the audited skill catalogs.                                                                                           |
| `sy-sync-pr-branch`   | No verified upstream equivalent                                                                                                                                                                                                                                                                                                                                                 | Keep one deterministic sync implementation or retire custom ancestry handling; preserve floor/ancestor order, merge-only history, migration checks, and structured result flags.                                                     | No verified upstream skill implements the Sy ancestry, floor, migration, and push contract.                                                     |
| `sy-merge`            | No verified upstream equivalent                                                                                                                                                                                                                                                                                                                                                 | Keep as a thin command over branch sync with distinct upstream-default merge last, or retire that special meaning of pull latest.                                                                                                    | Generic Git advice does not preserve this ordering and fork behavior.                                                                           |
| `sy-release`          | [arjunprabhulal/agent-skills: release-notes](https://raw.githubusercontent.com/arjunprabhulal/agent-skills/42dd24080fce6d731d00e2a1134f398c3da4171b/skills/docs/release-notes/SKILL.md); [addyosmani/agent-skills: shipping-and-launch](https://raw.githubusercontent.com/addyosmani/agent-skills/eb07f19f52c2669f2364897aaa293e2aaddd7b1c/skills/shipping-and-launch/SKILL.md) | Reuse release-note drafting or launch review only; keep channel/ref validation, tag-safety checks, workflow selection, confirmation, and post-dispatch proof in repository-owned tooling.                                            | Neither target replaces the Sy official/beta workflow dispatcher.                                                                               |
| `sy-loop`             | [obra/superpowers: executing-plans](https://raw.githubusercontent.com/obra/superpowers/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/executing-plans/SKILL.md); [OthmanAdi/planning-with-files: planning-with-files](https://raw.githubusercontent.com/OthmanAdi/planning-with-files/5d29800bf8b919ca9a88ee7885b90050b5cb64ed/skills/planning-with-files/SKILL.md)            | Use plan execution plus durable state only if deliberately changing the contract; otherwise keep the bounded machine-checkable controller with iteration cap, stall detection, one writer, shrinking worklist, and success sentinel. | Plan execution and planning persistence are not a generic bounded shrinking-worklist loop; upstream layouts and lifecycle behavior also differ. |

## Compatibility conflicts to resolve

### PR review and repair

Steve Vitali's `review-pr` explicitly submits only `COMMENT` and refuses both `APPROVE` and `REQUEST_CHANGES`.

Current `sy-review-pr` supports all 3 verdicts and owns a bounded watch workflow. Adopting upstream semantics changes that contract unless an explicit local policy retains the additional behavior.

Its `address-pr-comments` companion handles unresolved review threads. It does not replace CI repair classification, shared branch sync, scheduled polling, or a batch dispatcher.

### Dependency upgrades

Arjun's `dependency-upgrade` requires one dependency per commit, always. Khasky's `awesome-dependency-upgrade` permits patch/minor batching and introduces release-age cooldowns of 3, 7, and 30 days.

Current Sy isolates production-minor bumps and requires their changelog review. It also constrains exact production pins, lifecycle scripts, and publication authority.

Prefer one upstream workflow owner and preserve deliberate local differences in one authoritative policy layer.

### Planning and bounded execution

`planning-with-files` supplies file-backed planning with fixed planning filenames, a selected project task folder, scripts, and optional host hooks.

Superpowers `executing-plans` uses a repository-local workspace, sibling skills, helper scripts, final review, and workspace deletion at finish.

Current `sy-loop` specifies a shrinking worklist, iteration cap, stall detection, one state writer, and a machine-checkable success sentinel. Neither target establishes that complete controller contract.

Murat's `long-horizon-prompting` concerns launch-prompt design, not that runtime controller. Its `self-improvement-loops` targets evolution of the harness itself, not completion of an ordinary task list.

### Documentation and cross-agent migration

Khasky's `awesome-agents-md-generator` supports Create, Refresh, and Merge modes, but writes only `AGENTS.md` files and consented compatibility shims.

It does not generate the complete Sy rules/map/developer-doc trio or migrate portable skill folders and their consumers.

Steve Vitali's `agent-docs` is an alternative for agent-documentation generation and drift detection. Its checked sections prescribe helper scripts, a bridge, and a commit step requiring local adaptation.

### Instruction cleanup

Khasky's `awesome-document-style` covers editorial cleanup, not complete policy consolidation, named-rule accounting, generator ownership, size budgets, or cross-client deployment.

Do not substitute `caveman-compress` for instruction governance. It rewrites policy prose into Caveman style, sends the file through a configured provider, and overwrites the original after backup.

That behavior conflicts with the local standard-prose exemption for instructions and the requirement to preserve policy meaning and authorization boundaries.

`awesome-skills-purge` is an uninstall workflow, not semantic cleanup. It removes installed skills after inventory, backup, and confirmation.

## Current implementation seam

At the audit snapshot, the implementation uses these authoritative sources:

- `software/scripts/advanced/llm/llm-common.js`: `LLM_COMMAND_DEPLOY_MAP` owns the command inventory.
- `readLLMCommandSource` reads a local Markdown basename through `readLLMDocSource`.
- `deploySharedLLMSkills` writes generated Sy frontmatter and the body, then links shared skills into clients.

Merely replacing a registry value with a URL does not install an upstream skill folder or its dependencies.

The proposed architecture preserves one command registry, one shared deployment boundary, complete upstream resources, and thin compatibility adapters instead of duplicated workflow bodies.

## Source snapshot and provenance

The audit retrieved source metadata and complete catalogs on 2026-10-29, around 18:09 UTC. Every recursive tree reported `truncated=false`; all 79 selected document retrievals succeeded.

These revisions identify audit evidence. Resolve current default branches and HEAD again before implementation or refresh.

| Repository                                                                                                                    | Default branch | Audited revision                           |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------ |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)                                                         | `main`         | `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846` |
| [juliusbrussee/caveman](https://github.com/juliusbrussee/caveman)                                                             | `main`         | `9b68f7ed12b05e7efaff18e65c5a3fc2849fd0a4` |
| [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)                                     | `main`         | `2c606141936f1eeef17fa3043a72095b4765b9c2` |
| [khasky/awesome-agent-skills](https://github.com/khasky/awesome-agent-skills)                                                 | `main`         | `58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7` |
| [arjunprabhulal/agent-skills](https://github.com/arjunprabhulal/agent-skills)                                                 | `main`         | `42dd24080fce6d731d00e2a1134f398c3da4171b` |
| [OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files)                                             | `master`       | `5d29800bf8b919ca9a88ee7885b90050b5cb64ed` |
| [anthropics/skills](https://github.com/anthropics/skills)                                                                     | `main`         | `ca45fc496a3436251f191354091d557da31c15b5` |
| [SteveVitali/agent-skills](https://github.com/SteveVitali/agent-skills)                                                       | `main`         | `e981ec57d487a2c41d416672483b5a4df15b1233` |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)                                                         | `main`         | `eb07f19f52c2669f2364897aaa293e2aaddd7b1c` |
| [muratcankoylan/Agent-Skills-for-Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) | `main`         | `9ff0c99108b36d3b886defd825d8ac1f47dba374` |
| [obra/superpowers](https://github.com/obra/superpowers)                                                                       | `main`         | `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b` |

Candidate links in the replacement tables identify files at these audited revisions.

Repository metadata is not a complete license review. The Karpathy skill declares MIT in its frontmatter while its repository metadata has no license identifier.

Anthropic candidates have per-skill license files. Applicable licenses and notices require review before redistribution.

## Read coverage and limitations

At the original audit snapshot, all 30 local skills were inventoried. The 24 smaller bodies were read in full.

Six bodies were sampled rather than audited sentence by sentence: `babysit-pr.md`, `babysit-prs.md`, `review-pr.md`, `review-prs.md`, `list-prs.md`, and `draft-pr.md`.

Upstream catalog coverage spans all 11 retrieved trees, but semantic reading covers selected candidate bodies and passages rather than every repository file.

No bundled executable script, installer, hook, or plugin was executed or approved. README and license files were retrieved for provenance and follow-up, not read in full.

The prior audit's static checks confirmed all 30 mappings, target paths in pinned trees, successful selected-document retrieval, and the 7/7/16 grouping.

Those checks do not prove runtime compatibility, preservation of every local rule, or safe removal of any original body. Full affected-source and dependency review remains open in the checklist.
