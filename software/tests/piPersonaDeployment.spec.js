/** Exercises hidden Pi guidance through generated lifecycle callbacks, preserving caller messages. */
import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import vm from "vm";
import { fileSystem, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/pi/setup.js");
  setSandboxGlobal("getLLMPersonaRules", async () => ({
    caveman: fs.readFileSync("software/scripts/advanced/llm/_common/v_current/instructions-persona.md", "utf8"),
    ultracave: fs.readFileSync("software/scripts/advanced/llm/_common/v_current/instructions-persona-ultracave.md", "utf8"),
  }));
});

/** @returns {Promise<object>} Generated handlers and captured native persistence effects. */
async function loadHooks() {
  await getIndexFunction("_doPiPersonaExtensionWork")("/mock/home/.pi/agent");
  const context = {};
  vm.runInNewContext(
    fileSystem["/mock/home/.pi/agent/extensions/sy-persona-reminder.js"].replace("export default", "var extension ="),
    context,
  );
  const hooks = {},
    entries = [],
    sent = [];
  context.extension({
    on: (name, handler) => {
      hooks[name] = handler;
    },
    appendEntry: (name, data) => entries.push({ name, data }),
    sendMessage: (message) => sent.push(message),
  });
  return { hooks, entries, sent };
}

describe("Pi hidden persona guidance", () => {
  it("adds one hidden tail message after tools while preserving exact transcript objects", async () => {
    const { hooks } = await loadHooks();
    const system = Object.freeze({ role: "system", content: "Exact `code`", toolsAdded: [] });
    const user = Object.freeze({ role: "user", content: "Read file" });
    const tool = Object.freeze({ role: "toolResult", toolCallId: "one", content: [] });
    const first = hooks.context_with_system({ messages: [system, user] });
    const next = hooks.context_with_system({ messages: [...first.messages, tool] });
    expect(next.messages).toHaveLength(4);
    expect(next.messages[0]).toBe(system);
    expect(next.messages[1]).toBe(user);
    expect(next.messages[2]).toBe(tool);
    expect(next.messages[3].display).toBe(false);
    expect(next.messages[3].content).toContain("voice, not broken grammar");
  });

  it("persists mode switches and refreshes the active mode after compaction", async () => {
    const { hooks, entries, sent } = await loadHooks();
    hooks.session_start({}, { sessionManager: { getSessionId: () => "one", getBranch: () => [] } });
    const event = { messageType: "user", prompt: "/ultracave", systemPrompt: "Preserve base" };
    const result = hooks.before_agent_start(event);
    expect(event.systemPrompt).toBe("Preserve base");
    expect(result.message.display).toBe(false);
    expect(result.message.content).toContain('mode="ultracave"');
    hooks.session_compact();
    expect(entries).toEqual([
      { name: "sy-persona-mode", data: { mode: "ultracave" } },
      { name: "sy-persona-mode", data: { mode: "ultracave" } },
    ]);
    expect(sent[0].content).toContain('mode="ultracave"');
  });

  it("restores saved off mode without changing it for a status request", async () => {
    const { hooks, entries } = await loadHooks();
    hooks.session_start(
      {},
      {
        sessionManager: {
          getSessionId: () => "two",
          getBranch: () => [{ type: "custom", customType: "sy-persona-mode", data: { mode: "off" } }],
        },
      },
    );
    const result = hooks.before_agent_start({ messageType: "user", prompt: "/caveman status" });
    expect(result.message.content).toContain('mode="off"');
    expect(entries).toEqual([]);
  });

  it("leaves an empty transcript untouched", async () => {
    const { hooks } = await loadHooks();
    expect(hooks.context_with_system({ messages: [] })).toBeUndefined();
  });
});
