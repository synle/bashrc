/** doWork tests for software/scripts/advanced/starship-config.js. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import { spawnSync } from "child_process";
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

  it.each([
    { name: "reuses IP addresses between prompts", transition: "", expected: "192.0.2.10, 198.51.100.20" },
    { name: "refreshes expired IP addresses", transition: "_ifconfig2_time=0", expected: "203.0.113.30" },
    { name: "refreshes at the existing call limit", transition: "_ifconfig2_count=59", expected: "203.0.113.30" },
    { name: "refreshes an invalidated IP cache", transition: "_ifconfig2_cache=", expected: "203.0.113.30" },
    { name: "keeps an empty IP display empty", transition: "fixture_ip=; _ifconfig2_cache=", expected: "" },
  ])("$name", async ({ transition, expected }) => {
    fetchResponses["software/scripts/advanced/starship-config.toml"] = "[character]";
    fileSystem[BASH_SYLE_PATH] = "";
    await runScript("software/scripts/advanced/starship-config.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    const hook = profile.slice(profile.indexOf("function _starship_preexec()"), profile.indexOf("starship_precmd_user_func="));
    const legacy = fs.readFileSync("software/scripts/bash-prompt-legacy.profile.bash", "utf8");
    const cache = legacy.slice(legacy.indexOf('_ifconfig2_cache=""'), legacy.indexOf("# truncates deep paths"));
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc"], {
      input: `
${cache}
${hook}
function is_help_arg() { return 1; }
function _starship_time() { printf '%s' '01:00:00PM'; }
function shorter_pwd_path() { printf '%s' '~/fixture'; }
function _ifconfig2_fetch() { printf '%s' "$fixture_ip"; }
fixture_ip=192.0.2.10,198.51.100.20
_starship_preexec
printf '%s\\n' "$STARSHIP_IP_ADDR"
fixture_ip=203.0.113.30
${transition}
_starship_preexec
printf '%s\\n' "$STARSHIP_IP_ADDR"
`,
      env: { PATH: process.env.PATH, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`192.0.2.10, 198.51.100.20\n${expected}\n`);
  });
});
