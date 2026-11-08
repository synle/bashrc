/** Sorted selected package identities, versions, and kinds replace incidental inventory counts. */
import { describe, expect, it } from "vitest";
import packages from "../scripts/decky/decky-packages.common.js";
import inventory from "../metadata/decky-packages.json";

describe("Decky selected package inventory", () => {
  it("resolves every selected plugin and theme by name without depending on declaration order", () => {
    const pins = packages.resolvePackages(inventory.decky_packages);
    expect(
      pins
        .map(({ name, version, theme_id }) => ({ name, version, kind: theme_id ? "theme" : "plugin" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toMatchInlineSnapshot(`
      [
        {
          "kind": "plugin",
          "name": "AutoFlatpaks",
          "version": "1.6.8",
        },
        {
          "kind": "theme",
          "name": "Centered Home",
          "version": "1.3",
        },
        {
          "kind": "theme",
          "name": "Clean Gameview",
          "version": "1.7",
        },
        {
          "kind": "plugin",
          "name": "CSS Loader",
          "version": "2.1.3",
        },
        {
          "kind": "plugin",
          "name": "Decky LSFG-VK",
          "version": "0.14.4",
        },
        {
          "kind": "plugin",
          "name": "Decky-Framegen",
          "version": "0.17",
        },
        {
          "kind": "plugin",
          "name": "DeckyPlumber",
          "version": "0.1.8",
        },
        {
          "kind": "plugin",
          "name": "EmuDecky",
          "version": "1.0.10",
        },
        {
          "kind": "theme",
          "name": "Faster Transition Animations",
          "version": "1.1",
        },
        {
          "kind": "plugin",
          "name": "HLTB for Deck",
          "version": "2.0.12",
        },
        {
          "kind": "plugin",
          "name": "HueSync",
          "version": "3.10.0",
        },
        {
          "kind": "theme",
          "name": "Mini Carousel",
          "version": "1.0",
        },
        {
          "kind": "theme",
          "name": "No Home Edge Fade",
          "version": "1.2",
        },
        {
          "kind": "theme",
          "name": "No Home Recent Text",
          "version": "1.0",
        },
        {
          "kind": "theme",
          "name": "No Home Text",
          "version": "1.0",
        },
        {
          "kind": "theme",
          "name": "Obsidian",
          "version": "4.2",
        },
        {
          "kind": "plugin",
          "name": "ProtonDB Badges",
          "version": "1.3.4",
        },
        {
          "kind": "theme",
          "name": "Round",
          "version": "2.7",
        },
        {
          "kind": "plugin",
          "name": "SteamGridDB",
          "version": "1.8.1",
        },
        {
          "kind": "plugin",
          "name": "Volume Boost",
          "version": "0.0.7",
        },
      ]
    `);
  });
});
