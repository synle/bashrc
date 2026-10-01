/** Tests for software/scripts/text-server.keybindings.cjs: chord pairing, event matching, conflict detection. */
import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const keys = require("../scripts/text-server.keybindings.cjs");

describe("text-server keybindings: expandChord", () => {
  it("pairs super with Cmd and Alt on mac", () => {
    expect(keys.expandChord("super+shift+d", true)).toEqual(["Shift-Cmd-D", "Shift-Alt-D"]);
  });
  it("pairs super with Ctrl and Alt off mac", () => {
    expect(keys.expandChord("super+shift+d", false)).toEqual(["Shift-Ctrl-D", "Shift-Alt-D"]);
  });
  it("drops the Ctrl pair member when the chord already names ctrl (off mac)", () => {
    expect(keys.expandChord("super+ctrl+g", false)).toEqual(["Ctrl-Alt-G"]);
  });
  it("keeps both members for super+ctrl on mac", () => {
    expect(keys.expandChord("super+ctrl+g", true)).toEqual(["Cmd-Ctrl-G", "Ctrl-Alt-G"]);
  });
  it("leaves native word-motion modifiers alone on arrows (mac keeps Alt-Left for word jump)", () => {
    expect(keys.expandChord("super+left", true)).toEqual(["Cmd-Left"]);
  });
  it("leaves native word-motion modifiers alone on arrows (off mac keeps Ctrl-Left for word jump)", () => {
    expect(keys.expandChord("super+left", false)).toEqual(["Alt-Left"]);
  });
  it("passes non-super chords through unchanged", () => {
    expect(keys.expandChord("ctrl+m", true)).toEqual(["Ctrl-M"]);
  });
  it("throws on an unknown modifier", () => {
    expect(() => keys.expandChord("hyper+d", true)).toThrow("unknown modifier 'hyper'");
  });
});

describe("text-server keybindings: eventKeyName", () => {
  it("names an Alt chord from the physical key, not the typed symbol", () => {
    expect(keys.eventKeyName({ code: "KeyD", key: "∂", shiftKey: false, metaKey: false, ctrlKey: false, altKey: true })).toBe("Alt-D");
  });
  it("names a symbol key with modifiers in CodeMirror order", () => {
    expect(keys.eventKeyName({ code: "Backslash", shiftKey: true, metaKey: true, ctrlKey: true, altKey: false })).toBe("Shift-Cmd-Ctrl-\\");
  });
  it("returns null for keys no binding uses", () => {
    expect(keys.eventKeyName({ code: "NumpadAdd", shiftKey: false, metaKey: false, ctrlKey: false, altKey: false })).toBeNull();
  });
});

describe("text-server keybindings: BINDINGS table", () => {
  it("has no conflicting chords on mac", () => {
    expect(() => keys.buildIndex(keys.BINDINGS, true)).not.toThrow();
  });
  it("has no conflicting chords off mac", () => {
    expect(() => keys.buildIndex(keys.BINDINGS, false)).not.toThrow();
  });
  it("reports a conflict between two bindings that expand to the same key", () => {
    const clash = [
      { chord: "super+d", action: "a", scope: "page" },
      { chord: "alt+d", action: "b", scope: "page" },
    ];
    expect(() => keys.buildIndex(clash, true)).toThrow("keybinding conflict on Alt-D");
  });
  it("resolves super+ctrl+g to select-all-matches on both OS flavors", () => {
    expect(keys.buildIndex(keys.BINDINGS, true).get("Cmd-Ctrl-G").action).toBe("findAllUnder");
    expect(keys.buildIndex(keys.BINDINGS, false).get("Ctrl-Alt-G").action).toBe("findAllUnder");
  });
  it("renders a tooltip hint per OS", () => {
    expect(keys.hintFor("snapshot", true)).toBe("Cmd+S / Alt+S");
    expect(keys.hintFor("snapshot", false)).toBe("Ctrl+S / Alt+S");
  });
});
