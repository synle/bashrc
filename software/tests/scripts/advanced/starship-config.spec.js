/** doWork tests for software/scripts/advanced/starship-config.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, fetchResponses, runScript, getIndexConstant } from "../../setup.js";

const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");
const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");

describe("advanced/starship-config.js doWork", () => {
  it("should write starship.toml to ~/.config/", async () => {
    fetchResponses["software/scripts/advanced/starship-config.toml"] = '[character]\nsuccess_symbol = "[>](bold green)"';

    await runScript("software/scripts/advanced/starship-config.js");

    const toml = fileSystem[`${BASE_HOMEDIR_LINUX}/.config/starship.toml`];
    expect(toml).toBeDefined();
    expect(toml).toContain("[character]");
  });

  it("should register starship prompt profile block", async () => {
    fetchResponses["software/scripts/advanced/starship-config.toml"] = "[character]\nformat = 'test'";
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/starship-config.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("starship");
  });
});
