/** Verifies deployed persona hooks reinforce chat style without rewriting policy artifacts. */
import { beforeAll, describe, expect, it } from "vitest";
import vm from "vm";
import fs from "fs";
import { fileSystem, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
  setSandboxGlobal("getLLMPersonaRules", async () => ({
    caveman: fs.readFileSync("software/scripts/advanced/llm/_common/v_current/instructions-persona.md", "utf8"),
    ultracave: fs.readFileSync("software/scripts/advanced/llm/_common/v_current/instructions-persona-ultracave.md", "utf8"),
  }));
});

describe("OpenCode persona reinforcement", () => {
  it("keeps one tail reminder after repeated model requests and preserves existing system context", async () => {
    await getIndexFunction("_doOpencodePersonaPluginWork")();
    const source = fileSystem["/mock/home/.config/opencode/plugins/sy-persona-reminder.js"];
    const context = {};
    vm.runInNewContext(source.replace("export default", "var plugin ="), context);
    const hooks = await context.plugin();
    // OpenCode retains this array when building the model request after the hook.
    const system = ["Repository policy", "User context"];
    const output = { system };

    await hooks["experimental.chat.system.transform"]({}, output);
    const reminder = system[2];
    system.push("Later context");
    await hooks["experimental.chat.system.transform"]({}, output);

    expect(system).toEqual(["Repository policy", "User context", "Later context", reminder]);
    expect(reminder).toContain("**Before sending:**");
    expect(reminder).toContain("Never caveman-ify");
  });

  it("switches modes per session and keeps status and embedded commands non-mutating", async () => {
    await getIndexFunction("_doOpencodePersonaPluginWork")();
    const context = {};
    vm.runInNewContext(
      fileSystem["/mock/home/.config/opencode/plugins/sy-persona-reminder.js"].replace("export default", "var plugin ="),
      context,
    );
    const hooks = await context.plugin();
    await hooks["chat.message"]({ sessionID: "one" }, { parts: [{ type: "text", text: "/caveman off" }] });
    const output = { system: ["Preserve policy"] };
    await hooks["experimental.chat.system.transform"]({ sessionID: "one" }, output);
    expect(output.system[1]).toContain('mode="off"');
    await hooks["chat.message"]({ sessionID: "two" }, { parts: [{ type: "text", text: "Explain /caveman off" }] });
    const other = { system: [] };
    await hooks["experimental.chat.system.transform"]({ sessionID: "two" }, other);
    expect(other.system[0]).toContain('mode="caveman"');
    await hooks["chat.message"]({ sessionID: "one" }, { parts: [{ type: "text", text: "/ultracave" }] });
    const status = { parts: [{ type: "text", text: "/caveman status" }] };
    await hooks["chat.message"]({ sessionID: "one" }, status);
    expect(status.parts[1].text).toContain("ultracave");
    await hooks["experimental.chat.system.transform"]({ sessionID: "one" }, output);
    expect(output.system).toHaveLength(2);
    expect(output.system[1]).toContain('mode="ultracave"');
  });

  it("preserves compaction context and adds the response-style reminder once", async () => {
    await getIndexFunction("_doOpencodePersonaPluginWork")();
    const context = {};
    vm.runInNewContext(
      fileSystem["/mock/home/.config/opencode/plugins/sy-persona-reminder.js"].replace("export default", "var plugin ="),
      context,
    );
    const hooks = await context.plugin();
    const output = { context: ["Keep unfinished work"] };

    await hooks["experimental.session.compacting"]({}, output);
    await hooks["experimental.session.compacting"]({}, output);

    expect(output.context).toHaveLength(2);
    expect(output.context[0]).toBe("Keep unfinished work");
    expect(output.context[1]).toContain("Caveman Speak");
  });
});
