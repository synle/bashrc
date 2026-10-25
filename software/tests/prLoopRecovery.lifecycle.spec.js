/** Static regressions for PR run selection, partial-launch safety, and recovery-status rendering; not runtime enforcement tests. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/** @type {string} Authoritative shared workflow source folder. */
const SKILL_FOLDER = path.resolve("software/scripts/advanced/llm/_common/v_current/skills");
/** @type {string} Shared scheduling and recovery policy. */
const loop = fs.readFileSync(path.join(SKILL_FOLDER, "pr-loop.md"), "utf8");
/** @type {string} Authoritative four-column status renderer contract. */
const renderer = fs.readFileSync(path.join(SKILL_FOLDER, "list-prs.md"), "utf8");

/**
 * Read a scheduler section without admitting assertions from another section.
 * @param {string} heading - Exact Markdown section heading.
 * @returns {string} Section body, or empty text when absent.
 */
function section(heading) {
  return loop.split(`${heading}\n`)[1]?.split("\n### ")[0] ?? "";
}

/** @type {string} Run identity and lifecycle selection rules. */
const selection = section("### Run selection");
/** @type {string} Shared handling for partially accepted worker launches. */
const partial = section("### Partial-launch handoff");

describe("PR run selection policy", () => {
  it("normalizes workflow and scope before choosing a saved run", () => {
    expect(selection).toContain("workflow, scope kind, normalized repository/PR identities, resolved author filters");
    expect(selection).toContain("canonical search root and discovery depth");
    expect(selection).toContain("run_id");
    expect(selection).toContain("run_lifecycle");
    expect(selection).toContain("Before creating a clock");
  });

  it("blocks ambiguous ledgers and checks overlapping owners across run identities", () => {
    expect(selection).toContain("Several matching ledgers");
    expect(selection).toContain("never choose the newest ledger merely by timestamp");
    expect(selection).toContain("check stable per-PR owner keys across runs");
    expect(selection).toContain("A different scope or run_id never proves a PR unowned");
  });

  it("permits the default budget only after proven completed history", () => {
    expect(selection).toContain("A plain authorized invocation after proven completed history starts the default budget");
    expect(selection).toContain("finished_at");
    expect(selection).toContain("exit_reason");
    expect(selection).toContain("no active writer and no unfinished workspace, publication, or cleanup debt");
    expect(selection).toContain("Deadline expiry alone never proves completion");
    expect(selection).toContain("Preserve repair caps, de-duplication, automerge ownership, and unresolved decisions across fresh runs");
  });

  it("preserves an interrupted deadline and an explicit pause", () => {
    expect(selection).toContain("An interrupted expired run still requires an explicit valid new watch budget");
    expect(selection).toContain("A budget change never clears a pause");
    expect(selection).toContain("Check saved pause scopes against overlapping PRs");
    expect(selection).toContain("An audit, restart, or unrelated instruction is not resumption");
    expect(selection).toContain("Legacy or contradictory lifecycle evidence remains unknown");
  });
});

describe("partial PR worker launch policy", () => {
  it("drains healthy accepted passes without cancellation or assignment injection", () => {
    expect(partial).toContain("Let healthy started passes return at a safe point");
    expect(partial).toContain("never cancel them merely because peer launches failed");
    expect(partial).toContain("Do not inject rejected assignments into a running slot");
    expect(partial).toContain("complete per-PR state");
  });

  it("requires capacity evidence rather than deriving a cap from accepted count", () => {
    expect(partial).toContain("Accepted count k alone is not capacity evidence");
    expect(partial).toContain("Non-capacity rejection never changes S");
    expect(partial).toContain("never exceed the selected user/harness ceiling");
    expect(partial).toContain("k == 0 is a launch failure, never S = 0");
  });

  it("keeps exceptional cancellation subordinate to full writer quiescence and reconciliation", () => {
    expect(partial).toContain("Owner recovery and restart or an explicit user stop");
    expect(partial).toContain("A cancellation response does not prove child or remote operations stopped");
    expect(partial).toContain(
      "Block replacement writes until termination or effective revocation, operation reconciliation, and exclusive authority are verified",
    );
  });

  it.each(["babysit-prs", "review-prs"])("routes %s through shared partial-launch handling", (name) => {
    const adapter = fs.readFileSync(path.join(SKILL_FOLDER, `${name}.md`), "utf8");
    expect(adapter).toContain("Partial-launch handoff");
    expect(adapter).not.toContain("cancel and relaunch");
    expect(adapter).not.toContain("Then set `S = k`");
    expect(adapter).not.toContain("A cancelled first pass costs almost nothing");
    expect(adapter).not.toContain("sequential and must be relaunched");
  });
});

describe("PR recovery telemetry rendering contract", () => {
  it("adds telemetry to the existing Agent cell without a new board", () => {
    expect(renderer).toContain("<counters>[ · <recovery telemetry>]");
    expect(renderer).toContain("owner <active|idle|unknown>");
    expect(renderer).toContain("hb <age|unknown|n/a>");
    expect(renderer).toContain("progress <age|unknown>");
    expect(renderer).toContain("recovery <decision>");
    expect(renderer).toContain("⛔ OWNERSHIP BLOCKED");
    expect(renderer).toContain("Idle owners show hb n/a");
    expect(renderer).toContain("Unsupported active-pass heartbeat shows hb unknown");
  });

  it("excludes heartbeat ticks and elapsed operation time from movement", () => {
    expect(renderer).toContain("Exclude last_heartbeat_at, heartbeat age, operation elapsed time, and progress age from movement");
    expect(renderer).toContain("Diff recovery_decision, recovery_reason, owner_state, operation identity, and last_progress_at");
    expect(renderer).toContain("Heartbeat-only updates remain ▫️");
    expect(renderer).toContain("A recovery transition such as investigate to blocked is Δ");
  });

  it("takes recovery identity and evidence from the caller instead of inventing them", () => {
    expect(renderer).toContain("heartbeat_supported");
    expect(renderer).toContain("operation_started_at");
    expect(renderer).toContain("recovery_next_action");
    expect(renderer).toContain("run_lifecycle");
    expect(renderer).toContain("Missing telemetry never proves ownership, completion, or a free worker slot");
  });
});
