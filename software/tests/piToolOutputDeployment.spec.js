/** Verifies Pi setup deploys lifecycle-based collapsed tool output without changing tool data. */
import { beforeAll, describe, expect, it, vi } from "vitest";
import vm from "vm";
import { fileSystem, getIndexFunction, loadScriptHelpers } from "./setup.js";

/** @type {string} In-memory target for the generated personal extension. */
const EXTENSION_PATH = "/mock/home/.pi/agent/extensions/sy-collapsed-tools.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/pi/setup.js");
});

/**
 * Deploys and evaluates the extension using Pi's event-registration contract.
 * @returns {Promise<Record<string, Function>>} Registered callbacks; no real files are written.
 */
async function loadToolOutputHooks() {
  await getIndexFunction("_doPiToolOutputExtensionWork")("/mock/home/.pi/agent");
  const context = {};
  vm.runInNewContext(fileSystem[EXTENSION_PATH].replace("export default", "var extension ="), context);
  const hooks = {};
  context.extension({
    on: (name, handler) => {
      hooks[name] = handler;
    },
  });
  return hooks;
}

describe("Pi collapsed tool output", () => {
  it("wires deployment into the installed-Pi setup path", () => {
    const setup = getIndexFunction("doWork").toString();
    expect(setup).toContain("await _doPiToolOutputExtensionWork(piAgentDir);");
  });

  it("registers session startup and both tool execution boundaries", async () => {
    const hooks = await loadToolOutputHooks();
    expect(Object.keys(hooks).sort()).toEqual(["session_start", "tool_execution_end", "tool_execution_start"]);
  });

  it("re-collapses expanded output at every lifecycle boundary without modifying tool data", async () => {
    const hooks = await loadToolOutputHooks();
    let expanded = true;
    const setToolsExpanded = vi.fn((value) => {
      expanded = value;
    });
    const context = { mode: "tui", ui: { setToolsExpanded } };
    const event = Object.freeze({
      toolName: "read",
      result: Object.freeze({ content: Object.freeze([{ type: "text", text: "Preserve complete tool output" }]) }),
    });

    for (const name of ["session_start", "tool_execution_start", "tool_execution_end", "session_start"]) {
      expanded = true;
      expect(hooks[name](event, context)).toBeUndefined();
      expect(expanded).toBe(false);
    }

    expect(setToolsExpanded.mock.calls).toEqual([[false], [false], [false], [false]]);
    expect(event.result.content).toEqual([{ type: "text", text: "Preserve complete tool output" }]);
  });

  it.each(["print", "json", "rpc"])("does not access terminal UI in %s mode", async (mode) => {
    const hooks = await loadToolOutputHooks();
    for (const handler of Object.values(hooks)) {
      expect(handler({}, { mode })).toBeUndefined();
    }
  });

  it("re-deploys identical extension bytes and preserves unrelated settings and extensions", async () => {
    const settingsPath = "/mock/home/.pi/agent/settings.json";
    const otherExtensionPath = "/mock/home/.pi/agent/extensions/user.js";
    fileSystem[settingsPath] = '{"quietStartup": false, "packages": ["npm:example-package"]}';
    fileSystem[otherExtensionPath] = "export default function () {}";
    const before = { ...fileSystem };
    await loadToolOutputHooks();
    const first = fileSystem[EXTENSION_PATH];

    await loadToolOutputHooks();

    expect(fileSystem).toEqual({ ...before, [EXTENSION_PATH]: first });
    expect(first).toContain("setToolsExpanded(false)");
  });
});
