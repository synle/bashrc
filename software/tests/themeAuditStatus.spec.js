/** Verifies that current closure and retained historical evidence cannot be confused. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import crypto from "crypto";
import ts from "typescript";

const raw = fs.readFileSync("theme/audit.jsonc", "utf8");
const audit = ts.parseConfigFileTextToJson("theme/audit.jsonc", raw).config;

describe("current theme audit ledger", () => {
  it("retains the original 436-pair historical snapshot without changing its values", () => {
    const historical = Object.fromEntries(audit.historicalEvidence.retainedLegacyFields.map((key) => [key, audit[key]]));
    const digest = crypto.createHash("sha256").update(JSON.stringify(historical)).digest("hex");
    expect(digest).toBe("07cd618d773872f113b4066798766dc2dd3ba455b61e4a7c53e11ffe761df5f8");
    expect(audit.historicalEvidence.semanticSha256).toBe(digest);
    expect(audit.measurements).toHaveLength(436);
    expect(audit.purpose).toContain("historical only");
  });
  it("marks the requested code fixes closed without claiming native appearance or a whole-build pass", () => {
    expect(audit.currentIssues.find((issue) => issue.id === "windows_all_profile_content").status).toBe("resolved_in_code");
    expect(audit.currentIssues.find((issue) => issue.id === "termux_shared_optout").status).toBe("resolved_in_code");
    expect(audit.currentIssues.find((issue) => issue.id === "opacity_and_dimming").status).toBe("unverified");
    expect(audit.currentIssues.find((issue) => issue.id === "main_release_gate").status).toBe("unverified");
    expect(audit.currentIssues.find((issue) => issue.id === "copilot_custom_import").status).toBe("capability_limit");
  });
  it("uses unique IDs and documented status values", () => {
    expect(new Set(audit.currentIssues.map((issue) => issue.id)).size).toBe(audit.currentIssues.length);
    expect(audit.currentIssues.every((issue) => Object.hasOwn(audit.statusDefinitions, issue.status))).toBe(true);
  });
  it.each(audit.currentIssues)("keeps $id synchronized with the checklist and existing evidence paths", (issue) => {
    const markdown = fs.readFileSync("theme/AUDIT.md", "utf8");
    expect(markdown).toContain(`\`${issue.id}\``);
    expect(markdown).toContain(issue.title);
    expect(issue.evidence.length).toBeGreaterThan(0);
    expect(issue.evidence.every((file) => fs.existsSync(file))).toBe(true);
  });
});
