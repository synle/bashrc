[Sy] Tighten rules, instructions, skills, and agent definitions across all concerns. Use when guidance grows, duplicates policy, conflicts, goes stale, or approaches its context budget.

Argument: $ARGUMENTS (optional paths or glob; if empty or unexpanded, use the scope in the request, otherwise the repo's complete source guidance corpus).

## When to use

- Reduce context load after additions or before a budget overflow.
- Resolve duplicated knowledge, contradictory steps, stale mechanics, and repeated explanation.
- Move conditional reference behind a pointer when compression alone cannot meet the budget.

## Hard rules

- **Apply Writing Rules from `instructions.md`.** Check meaning-preserving concision, sentence structure, active voice, and consistent terminology while revising guidance. Do not rewrite the whole corpus merely to add these rules. Preserve protected technical payloads and attach every condition and exception to its action.
- **Trim restatement, never a rule.** Preserve distinct behavior, conditions, ordering, exceptions, and safety gates. Split behind a pointer if useful compression cannot meet the budget.
- **Preserve named-rule names verbatim.** Keep referenced names while rewriting their prose; verify every cross-reference.
- **Meaning has one home.** Consolidate knowledge that changes for the same reason. Similar wording with different ownership or triggers may remain.
- **The environment is a source of truth.** Point to authoritative config, manifests, and help instead of caching inventories. Retain non-obvious conventions and failure history needed to use them correctly.
- **Never invent a rule while cleaning.** Separate and announce requested behavior changes. Resolve conflicting text by explicit precedence; ask when precedence does not settle it.

## Steps

### 1. Inventory

Inventory repo rules, shared/on-demand instructions, local/deployed skill sources, agent definitions, and deployment seams in scope. Count characters against declared budgets. Mark each file read fully, partially, or not read; a header scan is not a semantic audit.

### 2. Hunt no-ops, sentence by sentence

Apply the **no-op test**: does this sentence add behavior beyond another authoritative rule? Cut repeated rationale and examples that teach no additional boundary. Model defaults or upstream silence alone do not prove a local rule obsolete; verify local evidence before removing it.

- **Restatement tail:** remove explanation that adds no constraint or useful failure case.
- **Weak leading word:** replace vague encouragement with its existing observable requirement, not a stronger adjective.

### 3. Prompt the positive, not the prohibition

Prefer direct actions when equally precise. Keep explicit prohibitions, negation, and exceptions wherever they carry a safety or compatibility boundary; do not weaken them for a prompting theory.

### 4. Collapse restatement into leading words

Use established terms only when they preserve the full requirement. Keep explicit bounds and success criteria; a label such as "tight" does not replace deterministic, bounded, and low-overhead checks. Write instructions and skills in concise standard English, not the chat persona.

### 5. Dedupe meaning and prune sediment

- For each duplicate, name its authoritative home and replace the other definition with a trigger-specific pointer.
- Verify stale paths, flags, examples, workflow sequences, and ownership against current code. Resolve contradictions across concerns, not only wording or persona.

### 6. Progressive disclosure for what remains

Keep universal rules inline and move conditional reference to a companion reached by a backticked path, not an eager import. Give each pointer an explicit read trigger. Use the repo's registry and generator; edit sources only.

### 7. Verify

- Review before/after behavior, named-rule sets, references, and exact sizes. Record every deliberate merge or precedence resolution.
- Check revised prose for one idea per sentence, at most 30 words per sentence, active voice, and consistent terminology. Review meaning separately; sentence counts cannot prove it. Preserve technical payloads rather than rewriting them to satisfy a word limit.
- Run focused registry, budget, generator and deployment checks, then the required final gate once. Deploy twice; quote counts, failures, skips, and second-run churn.

## Safety

Never:

- Delete a live rule — or weaken one to a suggestion — to hit a char budget. Split behind a pointer instead.
- Rename a rule whose name is cross-referenced elsewhere.
- Author a new rule under cover of "cleanup," or change a rule's meaning while compressing its prose.
- Edit a generated/deployed copy instead of the source (the deployed corpus regenerates; the source is the single home).
- Bypass a size gate by trimming a code fence, a required value, or a load-bearing example.

Stop and ask when a section is over budget with no restatement left to cut and no clean split boundary — the fix is a design call (which rules move, which file they land in) the human should make.

## Verification

Report coverage for every in-scope file, changed and unchanged; size deltas; preserved or merged named rules; contradiction resolutions; actual checks and deploy output; and remaining gaps. Do not present a partial audit or prompt-only persona reinforcement as guaranteed compliance.
