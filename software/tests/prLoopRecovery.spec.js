/** Static policy checks for bounded PR owner recovery; these do not prove runtime exclusivity or liveness. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/** @type {string} Canonical source folder for shared PR guidance. */
const SOURCE_FOLDER = path.resolve("software/scripts/advanced/llm/_common/v_current");
/** @type {string} Authoritative cross-workflow scheduler contract. */
const loop = fs.readFileSync(path.join(SOURCE_FOLDER, "skills/pr-loop.md"), "utf8");

/**
 * Read a named Markdown section through the next heading of the same level.
 * @param {string} heading - Exact heading identifying the policy boundary.
 * @returns {string} Section body, or an empty string when the policy is absent.
 */
function section(heading) {
  return loop.split(`${heading}\n`)[1]?.split("\n### ")[0] ?? "";
}

/** @type {string} Recovery policy kept separate from ordinary GitHub probes. */
const recovery = section("### Owner recovery and restart");

describe("PR owner recovery guidance", () => {
  it("bounds discovery instead of treating a saved running label as live ownership", () => {
    expect(recovery).toContain("one 60-second discovery window");
    expect(recovery).toContain("at most two targeted status reads per owner");
    expect(recovery).toContain("Do not repeat discovery without new evidence");
    expect(recovery).toContain("An empty active list, saved handle, or stale running label proves neither liveness nor termination");
  });

  it("separates optional runtime heartbeats from actual operation progress", () => {
    expect(recovery).toContain("Every 60 seconds");
    expect(recovery).toContain("5 minutes");
    expect(recovery).toContain("30 minutes");
    expect(recovery).toContain("record heartbeat as unknown");
    expect(recovery).toContain("Heartbeats, repeated status text, and unchanged checkpoint rewrites never advance progress");
    expect(recovery).toContain("These thresholds trigger investigation, never takeover");
  });

  it.each([
    ["Idle and addressable", "Resume the same owner"],
    ["Running with verified progress", "Retain the owner"],
    ["Stale heartbeat or progress", "Investigate"],
    ["Former writer terminated or effectively revoked", "Acquire exclusive ownership"],
    ["Unreachable, contradictory, or unconfirmed termination", "Block replacement writes"],
    ["Paused", "Keep paused"],
    ["Expired deadline", "Report final state"],
  ])("defines a bounded decision for %s", (condition, decision) => {
    expect(recovery.replace(/[ \t]+/g, " ")).toContain(`| ${condition} | ${decision}`);
  });

  it("requires exclusive authority and writer quiescence rather than deleting a stale-looking lock", () => {
    expect(recovery).toContain("another 60 seconds");
    expect(recovery).toContain("Confirm termination or effective revocation of the former writer and relevant child or remote operations");
    expect(recovery).toContain("atomic acquisition and fencing");
    expect(recovery).toContain("verified sole controller and confirmed termination");
    expect(recovery).toContain("Never delete a stale-looking lock");
    expect(recovery).toContain("A Markdown generation cannot revoke credentials");
  });

  it("preserves restart state and reconciles uncheckpointed remote writes before retrying", () => {
    expect(recovery).toContain("interrupted Git operations, dirty edits, and unpushed commits before syncing");
    expect(recovery).toContain("reconcile live head SHAs, comments, reviews, reactions, thread resolutions, and automerge state");
    expect(recovery).toContain("Retry only missing actions");
    expect(recovery).toContain("run identity, stable job key, owner handle");
    expect(recovery).toContain("last_heartbeat_at");
    expect(recovery).toContain("last_progress_at");
    expect(recovery).toContain("operation_started_at");
    expect(loop).toContain("Never reset repair caps, de-duplication, workspace ownership, automerge ownership, or readiness evidence");
  });

  it("does not create fresh monitoring authority from a restart or a pause", () => {
    expect(recovery).toContain("A new invocation is a recovery entrypoint, not a fresh watch budget");
    expect(recovery).toContain(
      "Preserve saved started_at, deadline_at, and cadence unless the user explicitly supplies a valid new watch budget",
    );
    expect(recovery).toContain("A user pause overrides recovery and dispatch");
    expect(recovery).toContain("Do not start a pass after an expired deadline");
    expect(section("### Clock and schedule")).toContain("Owner recovery and restart before creating a new clock");
  });

  it("limits active-pass interruption to guarded recovery rather than routine status or incoming events", () => {
    expect(section("### Lifecycle and termination")).toContain("except through Owner recovery and restart");
    expect(section("### Batch pulse")).toContain("Recovery occurs outside rendering");
    expect(loop).toContain("No instruction-only check proves runtime enforcement");
  });
});

describe("PR workflow recovery adapters", () => {
  it.each(["babysit-pr", "babysit-prs", "review-pr", "review-prs"])("routes %s through the shared recovery policy", (name) => {
    const adapter = fs.readFileSync(path.join(SOURCE_FOLDER, `skills/${name}.md`), "utf8");
    expect(adapter).toContain("Owner recovery and restart");
    expect(adapter).toContain("<<LLM_ROOT_FOLDER>>/skills/sy-pr-loop/SKILL.md");
    expect(adapter).not.toMatch(/Never (?:cancel a pass mid-edit|preempt a running pass)\./);
  });

  it("keeps global owner-reuse instructions subordinate to bounded recovery", () => {
    const instructions = fs.readFileSync(path.join(SOURCE_FOLDER, "instructions-pr-workflow.md"), "utf8");
    expect(instructions).toContain("Owner recovery and restart");
    expect(instructions).toContain("empty active list is not termination proof");
  });
});
