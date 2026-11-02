/** Verifies custom persona retirement preserves foreign hooks and upstream installation failures. */
import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

beforeEach(() => loadScriptHelpers("software/scripts/advanced/llm/llm-common.js"));

describe("custom persona hook retirement", () => {
  it("leaves absent hooks unchanged", () => {
    const settings = {};
    getIndexFunction("retireLLMPersonaHooks")(settings);
    expect(settings).toEqual({});
  });

  it("rejects malformed hook containers", () => {
    expect(() => getIndexFunction("retireLLMPersonaHooks")({ hooks: [] })).toThrow("LLM hooks must be an object");
  });
  it("removes the managed helper while retaining grouped and separate foreign hooks", () => {
    const foreign = { type: "command", command: "user-hook" };
    const retired = { command: "node", args: ["/mock/home/_extra/ai_llm/hooks/persona-reminder-hook.js"] };
    // Resolve the actual helper identity independently of the test machine's home.
    setSandboxGlobal("LLM_RETIRED_PERSONA_HELPER_PATH", retired.args[0]);
    const settings = { hooks: { UserPromptSubmit: [{ matcher: "*", hooks: [foreign, retired] }, foreign], BeforeAgent: [retired] } };
    const retire = getIndexFunction("retireLLMPersonaHooks");
    retire(settings);
    retire(settings);
    expect(settings).toEqual({ hooks: { UserPromptSubmit: [{ matcher: "*", hooks: [foreign] }, foreign] } });
  });

  it("rejects malformed event lists instead of silently overwriting them", () => {
    const settings = { hooks: { BeforeAgent: "user-value" } };
    expect(() => getIndexFunction("retireLLMPersonaHooks")(settings)).toThrow("LLM hook event must be an array");
    expect(settings.hooks.BeforeAgent).toBe("user-value");
  });
});

describe("retired artifact backup", () => {
  it("preserves exact modified bytes outside discovery and makes a second retirement a no-op", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "persona-retirement-"));
    const artifact = path.join(folder, "sy-persona-reminder.js");
    try {
      fs.writeFileSync(artifact, "user-modified content");
      setSandboxGlobal("fs", fs);
      setSandboxGlobal("LLM_SHARED_ROOT_FOLDER", folder);
      setSandboxGlobal("IS_DRY_RUN", false);
      const retire = getIndexFunction("retireLLMPersonaArtifact");
      retire(artifact);
      retire(artifact);
      const backupRoot = path.join(folder, "retired-persona");
      const entries = fs.readdirSync(backupRoot);
      expect(entries).toHaveLength(1);
      expect(fs.readFileSync(path.join(backupRoot, entries[0], "sy-persona-reminder.js"), "utf8")).toBe("user-modified content");
      expect(fs.existsSync(artifact)).toBe(false);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("upstream persona installation", () => {
  it.each(["claude", "copilot", "gemini", "opencode"])(
    "selects only the upstream %s integration and disables lifecycle scripts",
    async (client) => {
      setSandboxGlobal("IS_DRY_RUN", false);
      setSandboxGlobal("IS_CI", false);
      let command;
      let options;
      setSandboxGlobal("exec", (value, settings, callback) => {
        command = value;
        options = settings;
        callback(null, "", "");
      });
      await getIndexFunction("installUpstreamCaveman")(client);
      expect(command).toContain(`'caveman-install' '--only' '${client}' '--non-interactive'`);
      expect(command).toContain("'--ignore-scripts'");
      expect(options.env.CAVEMAN_REF).toBe("2e068f735253cce28256744804785f01887d9646");
      expect(options.env.npm_config_ignore_scripts).toBe("true");
    },
  );

  it.each([
    { IS_DRY_RUN: true, IS_CI: false },
    { IS_DRY_RUN: false, IS_CI: true },
  ])("does not execute installation when deferred: %j", async (flags) => {
    setSandboxGlobal("IS_DRY_RUN", flags.IS_DRY_RUN);
    setSandboxGlobal("IS_CI", flags.IS_CI);
    setSandboxGlobal("exec", () => {
      throw new Error("unexpected installer execution");
    });
    await expect(getIndexFunction("installUpstreamCaveman")("pi")).resolves.toBeUndefined();
  });
  it("selects the Pi skill-only installer without a proxy or native runtime package", async () => {
    setSandboxGlobal("IS_DRY_RUN", false);
    setSandboxGlobal("IS_CI", false);
    let command;
    setSandboxGlobal("exec", (value, _options, callback) => {
      command = value;
      callback(null, "installed", "");
    });
    await getIndexFunction("installUpstreamCaveman")("pi");
    expect(command).toContain("skills@1.7.5");
    expect(command).toContain("'--skill' 'caveman' '-a' 'pi' '-g'");
    expect(command).not.toContain("@caveman-ai/pi");
    expect(command).not.toContain("enable");
  });

  it("propagates installer failure instead of reporting successful installation", async () => {
    setSandboxGlobal("IS_DRY_RUN", false);
    setSandboxGlobal("IS_CI", false);
    setSandboxGlobal("exec", (_value, _options, callback) => callback({ code: 1 }, "", "failure"));
    await expect(getIndexFunction("installUpstreamCaveman")("opencode")).rejects.toThrow("installation failed for opencode: 1");
  });

  it("rejects unknown clients before launching installation", async () => {
    await expect(getIndexFunction("installUpstreamCaveman")("unknown")).rejects.toThrow("Unsupported Caveman client");
  });
});
