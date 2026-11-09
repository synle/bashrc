/** Installer fixture extraction must fail closed instead of executing adjacent setup work. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import { extractSetupSection } from "./steamosSetup.sections.js";

/** Actual source used only for extraction assertions, never shell execution. */
const setupSource = fs.readFileSync("software/scripts/steamos/setup.bash", "utf8");

describe("SteamOS fixture extraction", () => {
  it("excludes adjacent installer code after the ending marker", () => {
    expect(extractSetupSection("before\nstart\nprintf safe\nend\ncurl installer", "start", "end")).toBe("start\nprintf safe\n");
  });

  it.each([
    ["missing start", "end only", "start", "end"],
    ["missing end", "start only", "start", "end"],
    ["reversed", "end before start", "start", "end"],
    ["empty source", "", "start", "end"],
    ["empty start marker", "start\nend", "", "end"],
    ["empty end marker", "start\nend", "start", ""],
    ["duplicate start", "start\nstart\nend", "start", "end"],
    ["duplicate end", "start\nend\nend", "start", "end"],
  ])("rejects %s before shell execution", (_label, source, start, end) => {
    expect(() => extractSetupSection(source, start, end)).toThrow("Invalid SteamOS setup fixture boundaries");
  });

  it("rejects a missing Kate end marker instead of consuming later installers", () => {
    const source = setupSource.replace("# --- END - Remove Kate ---", "");
    expect(() => extractSetupSection(source, "# --- BEGIN - Remove Kate ---", "# --- END - Remove Kate ---")).toThrow(
      "Invalid SteamOS setup fixture boundaries",
    );
  });

  it("bounds editor delegation independently of the position of Kate removal", () => {
    const section = extractSetupSection(
      setupSource,
      "# --- BEGIN - Browser Extensions + editors (via the synle/bashrc installer) ---",
      "# --- END - Browser Extensions + editors (via the synle/bashrc installer) ---",
    );
    expect(section).toContain("--skip-prompt --files=url-porter,skippy-ff");
    expect(section).not.toContain("_prompt");
    expect(section).not.toContain("# --- BEGIN - Optional AUR upgrades ---");
  });
});
