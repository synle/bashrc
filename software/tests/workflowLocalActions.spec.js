/** Every local `uses: ./.github/actions/<name>` in a workflow must point at a real action folder. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const WORKFLOW_FOLDER = path.join(REPO_ROOT, ".github/workflows");
const workflowFiles = fs.readdirSync(WORKFLOW_FOLDER).filter((f) => /\.ya?ml$/.test(f));

/**
 * Collects every local `uses: ./...` reference plus the line after it.
 * @param {string} text - Workflow file contents
 * @returns {{ref: string, next: string, line: number}[]} Local action references
 */
function collectLocalUses(text) {
  const lines = text.split("\n");
  const found = [];
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(?:-\s+)?uses:\s+(\.\/\S+)\s*$/);
    if (m) found.push({ ref: m[1], next: lines[i + 1] || "", line: i + 1 });
  });
  return found;
}

// Workflows with no local action references have nothing to check (vitest rejects empty suites).
const workflowsWithLocalUses = workflowFiles
  .map((file) => ({ file, refs: collectLocalUses(fs.readFileSync(path.join(WORKFLOW_FOLDER, file), "utf8")) }))
  .filter((w) => w.refs.length > 0);

it("finds at least one local action reference to check", () => {
  expect(workflowsWithLocalUses.length).toBeGreaterThan(0);
});

describe.each(workflowsWithLocalUses)("$file local actions", ({ refs }) => {

  it.each(refs)("line $line: $ref has an action.yml", ({ ref }) => {
    const folder = path.join(REPO_ROOT, ref);
    expect(fs.existsSync(path.join(folder, "action.yml")) || fs.existsSync(path.join(folder, "action.yaml"))).toBe(true);
  });

  // A stray more-indented plain line after `uses:` gets folded into the path by YAML
  // (how `ci-install-chrome` once became `ci-install-chrome fi`).
  it.each(refs)("line $line: $ref is not followed by a folded continuation line", ({ next }) => {
    const isContinuation = next.trim() !== "" && !/^\s*(-\s|[A-Za-z_][\w-]*:|#)/.test(next);
    expect(isContinuation).toBe(false);
  });
});
