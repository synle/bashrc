/** Static fresh-restart guidance checks; no assertion here certifies a runtime claim, fence, or stopped writer. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/** @type {string} Authoritative shared PR skill sources. */
const SKILLS = path.resolve("software/scripts/advanced/llm/_common/v_current/skills");
/** @type {string} Current scheduler policy, including the opt-in restart contract. */
const loop = fs.readFileSync(path.join(SKILLS, "pr-loop.md"), "utf8");
/** @type {string} Only the fresh-restart section, isolated from ordinary recovery. */
const fresh = loop.split("### Fresh restart\n")[1]?.split("\n### ")[0] ?? "";

describe("fresh PR restart policy", () => {
  it("validates the explicit option and incompatible modes before changing ownership", () => {
    expect(fresh).toContain("restart=fresh");
    expect(fresh).toContain("Omission preserves ordinary recovery");
    expect(fresh).toContain("Reject unknown restart values, duplicate restart/budget options");
    expect(fresh).toContain("before any stop request, dispatch, clock change, or publication");
    expect(fresh).toContain("dry-run aliases");
    expect(fresh).toContain("pass=single");
  });

  it("uses bounded takeover time independent of an expired predecessor watch", () => {
    expect(fresh).toContain("60-second discovery/capability window");
    expect(fresh).toContain("60-second stop-or-drain confirmation window");
    expect(fresh).toContain("independent of the predecessor watch deadline");
    expect(fresh).toContain("Persist attempt deadlines");
    expect(fresh).toContain("restart blocked");
  });

  it("requires a supported controller and writer barrier rather than a stop acknowledgement", () => {
    expect(fresh).toContain("Before stopping a healthy owner, verify runtime support");
    expect(fresh).toContain("controller quiescence, writer/child completion, and exclusive authority");
    expect(fresh).toContain("A stop acknowledgement or session-file lease is not a stable-PR publishing fence");
    expect(fresh).toContain("verifiable external serialization");
    expect(fresh).toContain("new predecessor child invalidates the barrier");
  });

  it("keeps a blocked batch from launching replacements or clearing its pause", () => {
    expect(fresh).toContain("One barrier covers the entire selected batch");
    expect(fresh).toContain("No replacement slots, new run identity, or fresh watch clock before the barrier succeeds");
    expect(fresh).toContain("failed takeover leaves the matching scheduler pause effective");
    expect(fresh).toContain("out-of-scope assignments");
  });

  it("resets scheduling state without deleting work or resetting safety history", () => {
    expect(fresh).toContain(
      "Reset only run identity, clock/cadence, queue/membership, run-local pass/probe counts, queue aging, and board snapshots",
    );
    expect(fresh).toContain("dirty edits, untracked work, unpushed commits");
    expect(fresh).toContain("posted artifact IDs, reviewed SHAs, repair caps, automerge ownership, sync cooldown history");
    expect(fresh).toContain("Refresh readiness against current head/base");
    expect(fresh).toContain("never force a duplicate review of unchanged code");
  });

  it("records takeover progress in existing memory and reconciles missing acknowledgements before retry", () => {
    expect(fresh).toContain("existing dispatcher ledger and PR-memory ## State");
    expect(fresh).toContain("takeover_attempt_id");
    expect(fresh).toContain("takeover_phase");
    expect(fresh).toContain("stop_request_ids");
    expect(fresh).toContain("Retry only missing steps after reconciling stop requests and remote publications");
    expect(fresh).toContain("Never resume stopped predecessors automatically");
  });

  it("preserves standalone loop ownership and consumes restart only at the top level", () => {
    expect(fresh).toContain("Standalone retains its existing single-worker loop owner");
    expect(fresh).toContain("Batch retains its parent-owned clock and pass=single workers");
    expect(fresh).toContain("never forward the restart token");
    expect(fresh).toContain("completed handoff state");
  });

  it("does not treat implementation approval as monitoring permission or credential containment", () => {
    expect(fresh).toContain("Implementation approval is not a live restart invocation");
    expect(fresh).toContain("human decisions, approval gates, credential incidents, and other action-scoped restrictions remain");
    expect(fresh).toContain("Static/stubbed checks do not certify runtime exclusion");
  });

  it.each(["babysit-pr", "babysit-prs", "review-pr", "review-prs"])("routes %s through one restart contract before dispatch", (name) => {
    const body = fs.readFileSync(path.join(SKILLS, `${name}.md`), "utf8");
    expect(body).toContain("Fresh restart");
    expect(body).toContain("restart=fresh");
    expect(body).toContain("before scope parsing or initial dispatch");
    expect(body).toContain("never forward restart to a worker");
  });

  it("renders pending and blocked takeover without inventing a fresh clock or PR movement", () => {
    const body = fs.readFileSync(path.join(SKILLS, "list-prs.md"), "utf8");
    expect(body).toContain("takeover_phase");
    expect(body).toContain("takeover_attempt_id");
    expect(body).toContain("restart blocked");
    expect(body).toContain("No fresh countdown before takeover completes");
    expect(body).toContain("Takeover deadline ticks never create Δ");
  });
});
