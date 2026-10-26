/** Windows Terminal profile ordering and visibility regression tests. */
import { describe, it, expect } from "vitest";
import { getIndexFunction, loadScriptHelpers } from "./setup.js";

loadScriptHelpers("software/scripts/windows-terminal.js");
/** Profile ordering seam loaded from the installer sandbox. */
const prioritizeProfiles = getIndexFunction("_prioritizeWindowsTerminalProfiles");

describe("Windows Terminal profile policy", () => {
  it("orders WSL, Windows PowerShell, Azure, then other profiles with missing visibility defaults", () => {
    expect(
      prioritizeProfiles([
        { name: "Azure", source: "Windows.Terminal.Azure" },
        { name: "Developer PowerShell for VS 2022", source: "Windows.Terminal.VisualStudio" },
        { name: "Windows PowerShell" },
        { name: "Command Prompt" },
        { name: "Kali", source: "Microsoft.WSL" },
        { name: "Ubuntu" },
      ]).map(({ name, hidden }) => [name, hidden]),
    ).toMatchInlineSnapshot(`
      [
        [
          "Ubuntu",
          false,
        ],
        [
          "Kali",
          false,
        ],
        [
          "Windows PowerShell",
          false,
        ],
        [
          "Azure",
          false,
        ],
        [
          "Developer PowerShell for VS 2022",
          true,
        ],
        [
          "Command Prompt",
          true,
        ],
      ]
    `);
  });

  it("preserves explicit true and false visibility for every profile category", () => {
    expect(
      prioritizeProfiles([
        { name: "Kali", source: "Microsoft.WSL", hidden: true },
        { name: "Windows PowerShell", hidden: true },
        { name: "Command Prompt", hidden: false },
        { name: "Azure", source: "Windows.Terminal.Azure", hidden: true },
      ]).map(({ hidden }) => hidden),
    ).toEqual([true, true, true, false]);
  });

  it("hides miscellaneous profiles without WSL while preserving each profile's color scheme", () => {
    expect(
      prioritizeProfiles([
        { name: "Custom", colorScheme: "old" },
        { name: "Command Prompt", colorScheme: "Campbell" },
      ]),
    ).toMatchInlineSnapshot(`
      [
        {
          "colorScheme": "old",
          "hidden": true,
          "name": "Custom",
        },
        {
          "colorScheme": "Campbell",
          "hidden": true,
          "name": "Command Prompt",
        },
      ]
    `);
  });

  it("handles empty lists and normalizes non-boolean hidden values without mutating input", () => {
    const input = [
      { name: "Windows PowerShell", hidden: null },
      { name: "Custom", hidden: "false" },
    ];
    expect(prioritizeProfiles(input)).toMatchInlineSnapshot(`
      [
        {
          "hidden": false,
          "name": "Windows PowerShell",
        },
        {
          "hidden": true,
          "name": "Custom",
        },
      ]
    `);
    expect(input).toEqual([
      { name: "Windows PowerShell", hidden: null },
      { name: "Custom", hidden: "false" },
    ]);
    expect(prioritizeProfiles([])).toEqual([]);
  });
});
