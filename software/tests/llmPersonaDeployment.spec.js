/** Verifies deployed persona hooks reinforce chat style without rewriting policy artifacts. */
import { beforeAll, describe, expect, it } from "vitest";
import vm from "vm";
import { fileSystem, getIndexFunction, loadScriptHelpers } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

describe("OpenCode persona reinforcement", () => {
  it("keeps one tail reminder after repeated model requests and preserves existing system context", async () => {
    await getIndexFunction("_doOpencodePersonaPluginWork")();
    const source = fileSystem["/mock/home/.config/opencode/plugins/sy-persona-reminder.js"];
    const context = {};
    vm.runInNewContext(source.replace("export default", "var plugin ="), context);
    const hooks = await context.plugin();
    const output = { system: ["Repository policy", "User context"] };

    await hooks["experimental.chat.system.transform"]({}, output);
    const reminder = output.system[2];
    output.system.push("Later context");
    await hooks["experimental.chat.system.transform"]({}, output);

    expect(output.system).toEqual(["Repository policy", "User context", "Later context", reminder]);
    expect(reminder).toContain("Before sending");
    expect(reminder).toContain("instructions and skills");
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
