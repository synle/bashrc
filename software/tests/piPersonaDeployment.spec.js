/** Verifies the generated Pi extension reinforces each request without replacing unrelated context. */
import { beforeAll, describe, expect, it } from "vitest";
import vm from "vm";
import { fileSystem, getIndexFunction, loadScriptHelpers } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/pi/setup.js");
});

/**
 * Deploys and evaluates the generated extension, returning its registered event handlers.
 * @returns {Promise<Record<string, Function>>} Pi lifecycle callbacks; no real files are written.
 */
async function loadPersonaHooks() {
  await getIndexFunction("_doPiPersonaExtensionWork")("/mock/home/.pi/agent");
  const source = fileSystem["/mock/home/.pi/agent/extensions/sy-persona-reminder.js"];
  const context = {};
  vm.runInNewContext(source.replace("export default", "var extension ="), context);
  const hooks = {};
  context.extension({
    on: (name, handler) => {
      hooks[name] = handler;
    },
  });
  return hooks;
}

describe("Pi request-level persona reinforcement", () => {
  it("registers request-level reinforcement in addition to the run-level guideline", async () => {
    const hooks = await loadPersonaHooks();

    expect(Object.keys(hooks).sort()).toEqual(["before_agent_start", "context_with_system"]);
  });

  it("keeps one run guideline without forcing a replacement system prompt", async () => {
    const hooks = await loadPersonaHooks();
    const event = { systemPrompt: "Original prompt", systemPromptOptions: { promptGuidelines: ["Preserve user policy"] } };

    expect(hooks.before_agent_start(event)).toBeUndefined();
    const reminder = event.systemPromptOptions.promptGuidelines[1];
    expect(hooks.before_agent_start(event)).toBeUndefined();

    expect(event.systemPrompt).toBe("Original prompt");
    expect(event.systemPromptOptions.promptGuidelines).toEqual(["Preserve user policy", reminder]);
    expect(reminder).toContain("Before sending");
    expect(reminder).toContain("Keep instructions and skills, code, payloads, and external deliverables in precise standard prose");
    expect(reminder).toContain("preserve facts, uncertainty, safety, and exact values");
  });

  it("refreshes one tail section across tool follow-ups without changing prompt, tools, or history", async () => {
    const hooks = await loadPersonaHooks();
    const tool = { name: "read", description: "Read a file", parameters: { type: "object", properties: {} } };
    const sections = Object.freeze({ rules: "Preserve policy", sy_persona_reminder: "Old reminder", cwd: "/project" });
    const system = Object.freeze({ role: "system", content: "Original base", sections, toolsAdded: [tool], timestamp: 1 });
    const user = Object.freeze({ role: "user", content: "Inspect file", timestamp: 2 });
    const assistant = Object.freeze({ role: "assistant", content: [{ type: "toolCall", id: "call-1", name: "read", arguments: {} }] });
    const result = Object.freeze({
      role: "toolResult",
      toolCallId: "call-1",
      toolName: "read",
      content: [{ type: "text", text: "Read bytes" }],
    });
    const delta = Object.freeze({ role: "system", content: "Later instructions", toolsRemoved: [{ name: "read" }], timestamp: 3 });
    const messages = Object.freeze([system, user]);

    const first = hooks.context_with_system({ messages });
    const reminder = first.messages[0].sections.sy_persona_reminder;
    const followup = hooks.context_with_system({ messages: [...first.messages, assistant, result, delta] });

    expect(followup.messages).toEqual([
      { ...system, sections: { rules: "Preserve policy", cwd: "/project", sy_persona_reminder: reminder } },
      user,
      assistant,
      result,
      delta,
    ]);
    expect(Object.keys(followup.messages[0].sections)).toEqual(["rules", "cwd", "sy_persona_reminder"]);
    expect(followup.messages[0].toolsAdded).toBe(system.toolsAdded);
    expect(followup.messages[1]).toBe(user);
    expect(followup.messages[4]).toBe(delta);
    expect(hooks.context_with_system(followup)).toEqual(followup);
    expect(system.sections).toBe(sections);
    expect(system.sections.sy_persona_reminder).toBe("Old reminder");
    expect(messages).toEqual([system, user]);
    expect(reminder).toMatch(/^<sy_persona_reminder>\n/);
    expect(reminder).toMatch(/\n<\/sy_persona_reminder>$/);
    expect(reminder).toContain("Resume after tools, compaction, and exempt passages");
    expect(reminder).toContain('Chat-status example: "Backup complete. Eight files verified. Active rules unchanged."');
  });

  it("reinforces freshly rebuilt context without requiring another run-start event", async () => {
    const hooks = await loadPersonaHooks();
    const system = { role: "system", content: "Rebuilt base", timestamp: 1 };
    const summary = { role: "user", content: "Compacted unfinished work", timestamp: 2 };

    const output = hooks.context_with_system({ messages: [system, summary] });

    expect(output.messages).toHaveLength(2);
    expect(output.messages[0]).toEqual({ ...system, sections: { sy_persona_reminder: expect.stringContaining("Caveman Speak") } });
    expect(output.messages[1]).toBe(summary);
    expect(system).toEqual({ role: "system", content: "Rebuilt base", timestamp: 1 });
  });

  it("preserves structured system content and tool declarations without flattening them", async () => {
    const hooks = await loadPersonaHooks();
    const content = Object.freeze([{ type: "text", text: "Keep exact `code`, quotes, 日本語, and emoji 🪨" }]);
    const system = { role: "system", content, sections: { empty: "", removed: null }, toolsAdded: [], toolsRemoved: [], timestamp: 1 };

    const output = hooks.context_with_system({ messages: [system] });

    expect(output.messages[0].content).toBe(content);
    expect(output.messages[0].toolsAdded).toBe(system.toolsAdded);
    expect(output.messages[0].toolsRemoved).toBe(system.toolsRemoved);
    expect(output.messages[0].sections).toEqual({
      empty: "",
      removed: null,
      sy_persona_reminder: expect.stringContaining("Caveman Speak"),
    });
  });

  it.each([
    { name: "empty transcript", messages: [] },
    {
      name: "non-leading system message",
      messages: [
        { role: "user", content: "No system" },
        { role: "system", content: "Later system" },
      ],
    },
  ])("leaves $name untouched instead of manufacturing prompt or tool state", async ({ messages }) => {
    const hooks = await loadPersonaHooks();
    const before = structuredClone(messages);

    expect(hooks.context_with_system({ messages })).toBeUndefined();
    expect(messages).toEqual(before);
  });

  it("deploys byte-identical extension content on a second run", async () => {
    await loadPersonaHooks();
    const first = fileSystem["/mock/home/.pi/agent/extensions/sy-persona-reminder.js"];

    await loadPersonaHooks();

    expect(fileSystem["/mock/home/.pi/agent/extensions/sy-persona-reminder.js"]).toBe(first);
  });
});
