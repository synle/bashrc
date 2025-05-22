/** doWork tests for software/scripts/advanced/format.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, runScript, getIndexConstant } from "../../setup.js";

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");
const BUILD_DIR = getIndexConstant("BUILD_DIR");

describe("advanced/format.js doWork", () => {
  it("should register format script profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/format.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("format script");
  });

  it("should define format() function in profile", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/format.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("function format");
  });

  it("should define format_js() function", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/format.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("format_js");
  });

  it("should define format_python() function", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/format.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("format_python");
  });

  it("should define format_cleanup() function", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/format.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("format_cleanup");
  });

  it("should reference EDITOR_CONFIGS settings in format functions", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/format.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    // format functions should reference prettier and line length settings
    expect(profile).toContain("prettier");
  });
});
