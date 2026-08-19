/**
 * Tests for ensureSyHomeMigrated() — the one-time move of the abandoned `$HOME/sy`
 * personal root into the current one (`$HOME/_extra`).
 *
 * TEMPORARY, exactly like the code it covers: delete this file in the same commit that
 * drops SY_LEGACY_ROOT_FOLDER once every machine has migrated.
 *
 * The destination predates the move and is full of tool staging, so the only acceptable
 * behavior is a MERGE that never overwrites. Two failure modes worth a test each:
 *
 * 1. Overwriting a colliding name would destroy whichever copy is newer, and a migration
 *    that eats data is worse than one that never ran. A collision is kept where it is
 *    and reported instead.
 * 2. Removing the legacy root before it is genuinely empty would strand the collisions
 *    it just declined to move — the folder is only removed when nothing is left in it.
 *
 * Runs against real temp folders rather than the shared mock fs, which has no
 * renameSync/mkdirSync/rmdirSync.
 */
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INDEX_JS_PATH = path.join(ROOT_DIR, "software/index.js");

/**
 * Loads index.js as a library into a sandbox backed by the REAL filesystem, with the
 * personal root and its abandoned twin pointed at throwaway temp folders.
 * @param {string} home - Temp folder standing in for $HOME.
 * @param {string} syHome - Temp folder standing in for the current personal root.
 * @returns {Record<string, any>} The populated sandbox.
 */
function loadIndex(home, syHome) {
  const source = fs.readFileSync(INDEX_JS_PATH, "utf-8");
  // Drop the IIFE entry point at the bottom so requiring the library runs nothing.
  const iifeStart = source.indexOf("\n(async function () {");
  const librarySource = (iifeStart > 0 ? source.substring(0, iifeStart) : source).replace(/^(const|let) /gm, "var ");

  /** @type {Record<string, any>} */
  const sandbox = {
    require: (mod) => require(mod.replace(/^node:/, "")),
    process: { argv: [], env: { BASE_HOMEDIR_LINUX: home, SY_ROOT_FOLDER: syHome }, cwd: () => ROOT_DIR, platform: "linux" },
    console,
    Buffer,
    setTimeout,
    clearTimeout,
    __dirname: path.join(ROOT_DIR, "software"),
    __filename: INDEX_JS_PATH,
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(librarySource, sandbox);
  // Keep the assertions about filesystem state, not about log formatting.
  sandbox.log = () => {};
  sandbox.echo = () => {};
  return sandbox;
}

describe("ensureSyHomeMigrated", () => {
  /** @type {string} Throwaway $HOME for the current case. */
  let home;
  /** @type {string} The current personal root inside that home. */
  let syHome;
  /** @type {string} The abandoned personal root inside that home. */
  let legacy;
  /** @type {Record<string, any>} Freshly loaded index.js library. */
  let index;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "sy-home-"));
    syHome = path.join(home, "_extra");
    legacy = path.join(home, "sy");
    index = loadIndex(home, syHome);
  });

  /**
   * Writes a single file at `<folder>/<name>/<file>` so an entry has content to lose.
   * @param {string} folder - Root to create under.
   * @param {string} name - Top-level entry name.
   * @param {string} file - File name inside it.
   * @param {string} body - File content.
   * @returns {string} The full file path.
   */
  function seed(folder, name, file, body) {
    fs.mkdirSync(path.join(folder, name), { recursive: true });
    const target = path.join(folder, name, file);
    fs.writeFileSync(target, body);
    return target;
  }

  it("should carry every entry across and remove the emptied legacy root", () => {
    seed(legacy, "ai_llm", "plan.md", "# plan\n");
    seed(legacy, "workspaces_tmux", "session.json", "{}\n");

    const result = index.ensureSyHomeMigrated();

    expect(result.moved.sort()).toEqual(["ai_llm", "workspaces_tmux"]);
    expect(result.kept).toEqual([]);
    expect(fs.existsSync(legacy)).toBe(false);
    expect(fs.readFileSync(path.join(syHome, "ai_llm", "plan.md"), "utf8")).toBe("# plan\n");
    expect(fs.readFileSync(path.join(syHome, "workspaces_tmux", "session.json"), "utf8")).toBe("{}\n");
  });

  it("should merge into a destination that already holds unrelated tool staging", () => {
    // ~/_extra predates the move: fonts, downloaded binaries and friends must survive.
    seed(syHome, "url-porter", "binary", "existing\n");
    seed(legacy, "ai_llm", "plan.md", "# plan\n");

    index.ensureSyHomeMigrated();

    expect(fs.readFileSync(path.join(syHome, "url-porter", "binary"), "utf8")).toBe("existing\n");
    expect(fs.existsSync(path.join(syHome, "ai_llm", "plan.md"))).toBe(true);
  });

  it("should never overwrite a colliding name, and keep the legacy copy intact", () => {
    seed(syHome, "ai_llm", "plan.md", "destination wins\n");
    const stranded = seed(legacy, "ai_llm", "plan.md", "legacy copy\n");

    const result = index.ensureSyHomeMigrated();

    expect(result.kept).toEqual(["ai_llm"]);
    expect(result.moved).toEqual([]);
    // Neither side lost anything.
    expect(fs.readFileSync(path.join(syHome, "ai_llm", "plan.md"), "utf8")).toBe("destination wins\n");
    expect(fs.readFileSync(stranded, "utf8")).toBe("legacy copy\n");
  });

  it("should leave the legacy root in place while it still holds a collision", () => {
    seed(syHome, "ai_llm", "plan.md", "destination\n");
    seed(legacy, "ai_llm", "plan.md", "legacy\n");
    seed(legacy, "workspaces_tmux", "session.json", "{}\n");

    const result = index.ensureSyHomeMigrated();

    expect(result.moved).toEqual(["workspaces_tmux"]);
    expect(result.kept).toEqual(["ai_llm"]);
    // Removing it here would destroy the very entry the merge declined to overwrite.
    expect(fs.existsSync(legacy)).toBe(true);
    expect(fs.existsSync(path.join(legacy, "ai_llm", "plan.md"))).toBe(true);
  });

  it("should do nothing when there is no legacy root", () => {
    const result = index.ensureSyHomeMigrated();

    expect(result).toEqual({ moved: [], kept: [] });
    expect(fs.existsSync(legacy)).toBe(false);
  });

  it("should run at most once per process", () => {
    seed(legacy, "ai_llm", "plan.md", "# plan\n");

    const first = index.ensureSyHomeMigrated();
    // A second legacy entry appearing later must NOT be picked up — the latch is the
    // whole reason several scripts in one node heredoc cannot race each other.
    seed(legacy, "late", "file.txt", "late\n");
    const second = index.ensureSyHomeMigrated();

    expect(first.moved).toEqual(["ai_llm"]);
    expect(second).toEqual({ moved: [], kept: [] });
  });

  it("should be wired in before anything writes under the personal root", () => {
    // A --files= run does not include _init.js, so the LLM deploy entry points need the
    // same guard: creating <root>/ai_llm first makes the legacy twin look like a
    // collision and strands it permanently. That is how the previous move went wrong.
    const initSource = fs.readFileSync(path.join(ROOT_DIR, "software/scripts/_init.js"), "utf-8");
    expect(initSource).toContain("ensureSyHomeMigrated()");

    const llmSource = fs.readFileSync(path.join(ROOT_DIR, "software/scripts/advanced/llm/llm-common.js"), "utf-8");
    for (const entry of ["deploySharedLLMInstructions", "deploySharedLLMSkills"]) {
      const body = llmSource.slice(llmSource.indexOf(`async function ${entry}(`));
      expect(body.indexOf("ensureSyHomeMigrated()"), entry).toBeGreaterThan(-1);
      expect(body.indexOf("ensureSyHomeMigrated()"), entry).toBeLessThan(body.indexOf("fs.mkdirSync"));
    }
  });

  it("should never let make nuke delete the personal root", () => {
    // ~/_extra is now SY_ROOT_FOLDER and holds authored plan files that no re-run can
    // regenerate, so the blanket rm -rf that used to sit in `nuke` must stay gone.
    const makefile = fs.readFileSync(path.join(ROOT_DIR, "Makefile"), "utf-8");
    const nuke = makefile.slice(makefile.indexOf("\nnuke:"), makefile.indexOf("$(MAKE) clean", makefile.indexOf("\nnuke:")));
    // Comment lines are allowed to name it — they are why it is spared.
    const commands = nuke
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");

    expect(commands).not.toMatch(/~\/_extra/);
  });
});
