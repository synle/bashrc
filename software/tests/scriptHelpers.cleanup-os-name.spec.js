import { describe, it, expect } from "vitest";

import fs from "fs";

import vm from "vm";

import { getIndexFunction, getIndexConstant } from "./setup.js";

const clone = getIndexFunction("clone");

const code = getIndexFunction("code");

const trimLeftSpaces = getIndexFunction("trimLeftSpaces");

const EDITOR_CONFIGS = getIndexConstant("EDITOR_CONFIGS");

function loadScript(filePath, globals = {}) {
  const source = fs.readFileSync(filePath, "utf-8");
  const sandbox = { ...globals };
  vm.runInNewContext(source.replace(/^(const|let) /gm, "var "), sandbox);
  return sandbox;
}

describe("_getPrimaryOsName (~cleanup.js)", () => {
  it("should return the highest-priority active OS", () => {
    // Simulate OS_SCRIPT_PATHS with mac active
    const source = fs.readFileSync("software/scripts/~cleanup.js", "utf-8");
    const sandbox = {
      log: () => {},
      fs: { existsSync: () => false, readFileSync: () => "", writeFileSync: () => {} },
      path: require("path"),
      BASH_SYLE_PATH: "/mock/.bash_syle",
      BASE_HOMEDIR_LINUX: "/mock",
      replaceBlock: (c) => c,
      writeBuildArtifact: () => {},
      IS_DRY_RUN: false,
      writeFile: () => {},
      OS_SCRIPT_PATHS: [
        [true, "software/scripts/mac"],
        [false, "software/scripts/ubuntu"],
      ],
    };
    vm.runInNewContext(source.replace(/^(const|let) /gm, "var "), sandbox);
    expect(sandbox._getPrimaryOsName()).toBe("mac");
  });

  it("should return null when no OS is active", () => {
    const source = fs.readFileSync("software/scripts/~cleanup.js", "utf-8");
    const sandbox = {
      log: () => {},
      fs: { existsSync: () => false, readFileSync: () => "", writeFileSync: () => {} },
      path: require("path"),
      BASH_SYLE_PATH: "/mock/.bash_syle",
      BASE_HOMEDIR_LINUX: "/mock",
      replaceBlock: (c) => c,
      writeBuildArtifact: () => {},
      IS_DRY_RUN: false,
      writeFile: () => {},
      OS_SCRIPT_PATHS: [
        [false, "software/scripts/mac"],
        [false, "software/scripts/ubuntu"],
      ],
    };
    vm.runInNewContext(source.replace(/^(const|let) /gm, "var "), sandbox);
    expect(sandbox._getPrimaryOsName()).toBe(null);
  });

  it("should respect priority order (mac before ubuntu)", () => {
    const source = fs.readFileSync("software/scripts/~cleanup.js", "utf-8");
    const sandbox = {
      log: () => {},
      fs: { existsSync: () => false, readFileSync: () => "", writeFileSync: () => {} },
      path: require("path"),
      BASH_SYLE_PATH: "/mock/.bash_syle",
      BASE_HOMEDIR_LINUX: "/mock",
      replaceBlock: (c) => c,
      writeBuildArtifact: () => {},
      IS_DRY_RUN: false,
      writeFile: () => {},
      OS_SCRIPT_PATHS: [
        [true, "software/scripts/ubuntu"],
        [true, "software/scripts/mac"],
      ],
    };
    vm.runInNewContext(source.replace(/^(const|let) /gm, "var "), sandbox);
    // mac should win since _OS_PRIORITY lists it before ubuntu
    expect(sandbox._getPrimaryOsName()).toBe("mac");
  });
});
