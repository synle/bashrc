/** Guardrails preventing restoration of the retired listing dependency. */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";

/** Platform package lists that must not install the retired backend. */
const INSTALLERS = [
  "software/scripts/mac/_full-setup.sh",
  "software/scripts/ubuntu/_full-setup.sh",
  "software/scripts/redhat/_full-setup.sh",
  "software/scripts/arch_linux/_full-setup.sh",
  "software/scripts/steamos/_full-setup.sh",
  "software/scripts/chromeos/_full-setup.sh",
  "software/scripts/android_termux/_full-setup.sh",
  "software/scripts/windows/_winget-install.sh",
];
/** Shared completion source and its generated consumers. */
const COMPLETION_SOURCES = [
  "software/metadata/autocomplete.common.js",
  "software/metadata/autocomplete-spec-git.js",
  "software/metadata/autocomplete-spec-npm.js",
  "software/metadata/autocomplete-spec-docker.js",
  "software/scripts/advanced/bash-autocomplete-complete-spec.js",
  "software/scripts/windows/powershell.js",
];

describe("retired listing dependency", () => {
  it.each(INSTALLERS)("does not install the retired package from %s", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/(?:install\w*Package\s+eza\b|["']eza-community\.eza["'])/);
  });

  it.each(COMPLETION_SOURCES)("does not register retired completion in %s", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/command:\s*["']eza["']/);
  });

  it("removes the obsolete completion spec rather than leaving an orphan", () => {
    expect(existsSync("software/metadata/autocomplete-complete-spec/eza")).toBe(false);
  });

  it("keeps the explicit decommission notice next to native listing setup", () => {
    expect(readFileSync("software/bootstrap/profile-core.sh", "utf8")).toMatch(/TODO: DECOMMISSION \/ DEPRECATED: eza/);
  });

  it("does not regenerate reverse-listing functions over the explicit native aliases", () => {
    expect(readFileSync("software/scripts/bash-dynamic-aliases.profile.bash", "utf8")).not.toContain("--suffix=_first");
  });
});
