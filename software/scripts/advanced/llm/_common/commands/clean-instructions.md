[Sy] Consolidate and shrink an always-loaded agent instruction corpus — purge dead rules, dedupe meaning, cut restatement, and keep every file under its char budget without dropping a real rule. Use when an instructions/rules file (`AGENTS.md`, `CLAUDE.md`, a `SKILL.md`, a doc reached by a pointer) has grown, gone stale, or bumped its size ceiling.

Argument: $ARGUMENTS (optional — a path or glob to the file(s) to clean. Default: the always-loaded instruction corpus for the current repo/CLI.)

## When to use

- An always-loaded file bumped its size ceiling (the deploy refuses it, or it crowds attention).
- Rules drifted: a fact lives in two places, a rule describes a world that changed, a section restates itself.
- After adding rules — a net-new rule should arrive with an offsetting trim, not silent bloat.
- Onboarding a split: pushing on-demand reference out of the always-loaded file behind a pointer.

## Hard rules

- **Trim restatement, never a rule.** A rule is a distinct instruction that changes behavior; restatement is a second sentence saying what the first already said. Cut the second, keep the first. When the budget still overflows after every no-op is gone, **split a section behind a pointer** — never delete a live rule to fit.
- **Preserve named-rule names verbatim.** Rules are referenced by name across the corpus; renaming one silently breaks every cross-reference. Rewrite a rule's prose freely, keep its name.
- **Meaning has one home.** The defect is duplicate *knowledge* (one fact in two files), not duplicate *text* (two rules that would change for different reasons). Dedupe the former on sight; leave the latter.
- **The environment is a source of truth.** A line restating what `--help`, a config file, a lockfile, or the directory layout already says is a stale cache — cut it and point at the source. Cache only what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha.
- **Never invent a rule while cleaning.** Consolidation moves and compresses existing rules; it does not author new ones. A new rule is a separate, announced change.

## Steps

### 1. Inventory

List the files in scope and each one's char count against its ceiling (the always-loaded file has the tightest budget; on-demand companions have room). Name the overflow, if any, in exact chars.

### 2. Hunt no-ops, sentence by sentence

Apply the **no-op test**: does this line change behavior versus what the model already does by default? A line the model obeys anyway pays load to say nothing — delete the whole sentence, not a few words from it. The test is model-relative: two readers disagreeing about a no-op disagree about the default, and settle it by *running* the document, not debating it.

- **Restatement tail:** a justification or example that repeats the rule's own point. Cut it.
- **Weak leading word:** "be thorough" when the agent is already thorough-ish is a no-op — the fix is a stronger word ("relentless"), not more sentences.

### 3. Prompt the positive, not the prohibition

**Negation drags the forbidden behavior into context and makes it more available, not less** ("don't think of an elephant"). State the target behavior so the banned one is never spoken: "write one-line comments," not "don't write long comments." Keep a bare prohibition only as a guardrail you cannot phrase positively — and even then pair it with the positive target.

### 4. Collapse restatement into leading words

A **leading word** is a compact concept already in the model's pretraining (`tight` loop, the loop goes `red`, `tracer bullet`) — repeated as a token, never re-explained as a sentence, it anchors a whole region of behavior in the fewest tokens. Hunt a triad spelled out at three sites ("fast, deterministic, low-overhead" → `tight`) and collapse it. Reach for an existing word before coining one; a made-up word recruits no priors and costs its definition in tokens.

### 5. Dedupe meaning and prune sediment

- One fact, one home (Hard rules). When the same knowledge sits in two files, keep the authoritative one and point the other at it.
- Cut lines that lost **relevance** — a rule for a removed subsystem, a path that moved, a convention that changed. Stale layers accumulate because adding feels safe and removing feels risky; core down through them.

### 6. Progressive disclosure for what remains

If the always-loaded file is still over budget after no-ops are gone, push **on-demand reference** (consulted only on some branches) into a companion file reached by a **pointer** — a backticked path, never an `@`-import that re-inflates the budget. Inline what *every* branch needs; disclose what only *some* reach. The pointer's wording is what triggers reaching it: front-load the leading word, one trigger per branch.

### 7. Verify

- Re-count every touched file; the always-loaded file is under its ceiling, in exact chars.
- No named rule lost: diff the rule-name list before and after — same set (minus any deliberately merged, named in the summary).
- Every cross-reference still resolves (a renamed section, a moved rule, a new pointer).
- Redeploy the corpus and confirm it loads: same skill/command count, no truncation, no "refused — over budget" error. Quote the counts.

## Safety

Never:

- Delete a live rule — or weaken one to a suggestion — to hit a char budget. Split behind a pointer instead.
- Rename a rule whose name is cross-referenced elsewhere.
- Author a new rule under cover of "cleanup," or change a rule's meaning while compressing its prose.
- Edit a generated/deployed copy instead of the source (the deployed corpus regenerates; the source is the single home).
- Bypass a size gate by trimming a code fence, a required value, or a load-bearing example.

Stop and ask when a section is over budget with no restatement left to cut and no clean split boundary — the fix is a design call (which rules move, which file they land in) the human should make.
