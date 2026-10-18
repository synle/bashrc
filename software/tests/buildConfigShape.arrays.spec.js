import { describe, it, expect } from "vitest";

import fs from "fs";

import path from "path";

function parseJsonc(text) {
  const stripped = text.replace(/^\s*\/\/.*$/gm, "").trim();
  return JSON.parse(stripped);
}

function readBuildConfigKeys(filename) {
  const filePath = path.resolve(".build", filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const data = parseJsonc(content);
  return Object.keys(data).sort();
}

function readBuildArrayShape(filename) {
  const filePath = path.resolve(".build", filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const data = parseJsonc(content);
  const shape = { length: data.length };
  if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
    shape.firstElementKeys = Object.keys(data[0]).sort();
  }
  return shape;
}

function readBuildFileSize(filename) {
  const filePath = path.resolve(".build", filename);
  return fs.statSync(filePath).size;
}

const MIN_FILE_SIZES = {
  "sublime-merge": 200,
  "sublime-merge-keys-mac": 1400,
  "sublime-merge-keys-windows": 2300,
  "sublime-text-config": 4000,
  "sublime-text-config-mac": 4000,
  "vs-code-color-dark": 8000,
  "vs-code-color-light": 8000,
  "vs-code-config": 28100,
  "vs-code-config-mac": 35400,
  "zed-color-dark": 7100,
  "zed-color-light": 7100,
  "zed-config": 3600,
  "sublime-text-keys-linux": 8200,
  "sublime-text-keys-mac": 4000,
  "sublime-text-keys-windows": 8200,
  "sublime-text-mouse": 500,
  "sublime-text-mouse-mac": 500,
  "vs-code-keys-combined": 17700,
  "zed-keys": 2700,
  "zed-keys-linux": 380,
  "zed-keys-windows": 5600,
  "ip-address.config.hostnamesFlattened": 1800,
};

describe("build config shape - arrays", () => {
it("sublime-merge-keys-mac", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-merge-keys-mac"))) {
      console.warn("  [WARNING] .build/sublime-merge-keys-mac not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("sublime-merge-keys-mac");
    expect(shape.length).toBeGreaterThanOrEqual(10);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

it("sublime-merge-keys-windows", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-merge-keys-windows"))) {
      console.warn("  [WARNING] .build/sublime-merge-keys-windows not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("sublime-merge-keys-windows");
    expect(shape.length).toBeGreaterThanOrEqual(20);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

it("sublime-text-keys-linux", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-text-keys-linux"))) {
      console.warn("  [WARNING] .build/sublime-text-keys-linux not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("sublime-text-keys-linux");
    expect(shape.length).toBeGreaterThanOrEqual(70);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

it("sublime-text-keys-mac", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-text-keys-mac"))) {
      console.warn("  [WARNING] .build/sublime-text-keys-mac not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("sublime-text-keys-mac");
    expect(shape.length).toMatchInlineSnapshot(`44`);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

it("sublime-text-keys-windows", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-text-keys-windows"))) {
      console.warn("  [WARNING] .build/sublime-text-keys-windows not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("sublime-text-keys-windows");
    expect(shape.length).toBeGreaterThanOrEqual(70);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

it("sublime-text-mouse", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-text-mouse"))) {
      console.warn("  [WARNING] .build/sublime-text-mouse not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("sublime-text-mouse");
    expect(shape.length).toMatchInlineSnapshot("5");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "button",
        "command",
        "count",
        "modifiers",
        "press_command",
      ]
    `);
  });

it("sublime-text-mouse-mac", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-text-mouse-mac"))) {
      console.warn("  [WARNING] .build/sublime-text-mouse-mac not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("sublime-text-mouse-mac");
    expect(shape.length).toMatchInlineSnapshot("5");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "button",
        "command",
        "count",
        "modifiers",
        "press_command",
      ]
    `);
  });

it("vs-code-keys-combined", () => {
    if (!fs.existsSync(path.resolve(".build", "vs-code-keys-combined"))) {
      console.warn("  [WARNING] .build/vs-code-keys-combined not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("vs-code-keys-combined");
    expect(shape.length).toBeGreaterThanOrEqual(150);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "key",
        "when",
      ]
    `);
  });

it("zed-keys", () => {
    if (!fs.existsSync(path.resolve(".build", "zed-keys"))) {
      console.warn("  [WARNING] .build/zed-keys not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("zed-keys");
    expect(shape.length).toMatchInlineSnapshot("2");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "bindings",
        "context",
      ]
    `);
  });

it("zed-keys-linux", () => {
    if (!fs.existsSync(path.resolve(".build", "zed-keys-linux"))) {
      console.warn("  [WARNING] .build/zed-keys-linux not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("zed-keys-linux");
    expect(shape.length).toMatchInlineSnapshot(`5`);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "bindings",
      ]
    `);
  });

it("zed-keys-windows", () => {
    if (!fs.existsSync(path.resolve(".build", "zed-keys-windows"))) {
      console.warn("  [WARNING] .build/zed-keys-windows not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("zed-keys-windows");
    expect(shape.length).toMatchInlineSnapshot("2");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "bindings",
        "context",
      ]
    `);
  });

it("ip-address.config.hostnamesFlattened", () => {
    if (!fs.existsSync(path.resolve(".build", "ip-address.config.hostnamesFlattened"))) {
      console.warn("  [WARNING] .build/ip-address.config.hostnamesFlattened not found — skipping (not generated in this environment)");
      return;
    }
    const shape = readBuildArrayShape("ip-address.config.hostnamesFlattened");
    expect(shape.length).toMatchInlineSnapshot("11");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "0",
        "1",
        "2",
      ]
    `);
  });
});
