import { describe, expect, it } from "vitest";

import { execFileSync } from "child_process";
import path from "path";

import { readBuildText, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

/**
 * Reads one value through Git's config parser.
 * @param {string} filePath - Git config file path.
 * @param {string} key - Git config key.
 * @returns {string} Parsed config value.
 */
function readGitConfigValue(filePath, key) {
  return execFileSync("git", ["config", "--file", filePath, "--get", key], { encoding: "utf-8" }).trim();
}

describe(".build/gitconfig", () => {
  it("keeps generated Git defaults parseable by Git", () => {
    const filename = "gitconfig";
    if (warnIfBuildArtifactMissing(filename)) return;

    const filePath = path.resolve(".build", filename);
    expect({
      "core.autocrlf": readGitConfigValue(filePath, "core.autocrlf"),
      "init.defaultBranch": readGitConfigValue(filePath, "init.defaultBranch"),
      "pull.rebase": readGitConfigValue(filePath, "pull.rebase"),
      "push.autoSetupRemote": readGitConfigValue(filePath, "push.autoSetupRemote"),
    }).toMatchInlineSnapshot(`
      {
        "core.autocrlf": "input",
        "init.defaultBranch": "main",
        "pull.rebase": "false",
        "push.autoSetupRemote": "true",
      }
    `);
  });
});

describe(".build/gitignore_global", () => {
  it("keeps the complete global ignore config", () => {
    const filename = "gitignore_global";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildText(filename)).toMatchInlineSnapshot(`
      "# OS files
      .DS_Store
      *.Identifier

      # Editors & Backups
      *.swp
      *.swo
      *.rej

      # Environments & Dependencies
      venv/
      .venv/
      node_modules/

      # Python
      __pycache__/
      *.pyc
      *.egg-info/
      .uv/

      # Logs & Debug
      npm-debug.log*
      yarn-debug.log*
      yarn-error.log*

      # Environment & Secrets
      .env
      .env.local
      .env.*.local
      .npmrc

      # Test & Coverage
      coverage/
      .nyc_output/

      # Cache
      .codegraph/
      .codegraph-wsl/
      .cache/
      .parcel-cache/
      .prettier-cache
      .playwright-mcp/

      # Worktrees
      .worktrees/
      .worktree/
      .worktree*/
      worktree*/
      .wt/"
    `);
  });
});
