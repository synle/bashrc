/** Exercises generated Vim large-file limits through isolated, network-free Vim processes. */
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileSystem, getIndexConstant, runScript, setSandboxGlobal } from "../setup.js";

/** Sandbox destination used by the real generator. */
const HOME = getIndexConstant("BASE_HOMEDIR_LINUX");

beforeEach(() => {
  setSandboxGlobal("is_os_windows", false);
  setSandboxGlobal("IS_CI", false);
  setSandboxGlobal("getRuntimeOption", () => false);
  fileSystem["software/scripts/vim-config-settings.vim"] = fs.readFileSync("software/scripts/vim-config-settings.vim", "utf-8");
  fileSystem["theme/sy/vim_dark.jsonc"] = fs.readFileSync("theme/sy/vim_dark.jsonc", "utf-8");
  fileSystem["theme/sy/vim_light.jsonc"] = fs.readFileSync("theme/sy/vim_light.jsonc", "utf-8");
});

/**
 * Deploys the generated vimrc and real Sy schemes to an isolated runtime, then observes native syntax for an owned fixture.
 * @param {number|null} size - Exact fixture size in bytes, or null for a nonexistent file.
 * @param {string[]} commands - Additional Vimscript observations or buffer transitions.
 * @returns {Promise<object>} Native option values and observations; process or read failures fail the test.
 */
async function probeVim(size, commands = []) {
  await runScript("software/scripts/vim-config.js");
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "vim large file's "));
  onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
  const vimrc = path.join(folder, "vimrc");
  const input = path.join(folder, "input.json");
  const output = path.join(folder, "state.json");
  const script = path.join(folder, "probe.vim");
  const plugin = path.join(folder, ".vim/pack/jetpack/opt/vim-jetpack/plugin/jetpack.vim");
  fs.mkdirSync(path.dirname(plugin), { recursive: true });
  // An existing empty manager exercises the supported missing-plugin path without downloading anything.
  fs.writeFileSync(plugin, "");
  // Missing Ayu previously exercised error fallback during every timing-sensitive syntax probe.
  const colorsFolder = path.join(folder, ".vim/colors");
  fs.mkdirSync(colorsFolder, { recursive: true });
  for (const appearance of ["dark", "light"]) {
    fs.writeFileSync(path.join(colorsFolder, `sy-${appearance}.vim`), fileSystem[`${HOME}/.vim/colors/sy-${appearance}.vim`]);
  }
  fs.writeFileSync(vimrc, fileSystem[`${HOME}/.vimrc`]);
  fs.writeFileSync(path.join(folder, "small.json"), '{"key":true}\n');
  if (size !== null) {
    fs.writeFileSync(input, size === 0 ? "" : '{"key":true}'.padEnd(size - 1, "\n" + " ".repeat(127)) + "\n");
  }
  fs.writeFileSync(
    script,
    [
      `execute 'edit ' . fnameescape(${JSON.stringify(input)})`,
      "let g:observations = {}",
      ...commands,
      "let g:state = {'syntax': &l:syntax, 'highlighted': synID(1, 3, 1) != 0, 'filetype': &l:filetype, 'redrawtime': &redrawtime, 'observations': g:observations}",
      `call writefile([json_encode(g:state)], ${JSON.stringify(output)})`,
      "qall!",
    ].join("\n"),
  );
  const result = spawnSync("vim", ["-N", "-u", vimrc, "-i", "NONE", "-n", "-es", "-V1", "-S", script], {
    env: { ...process.env, HOME: folder },
    encoding: "utf-8",
    timeout: 5000,
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).not.toContain("Theme missing:");
  return JSON.parse(fs.readFileSync(output, "utf-8"));
}

describe("Vim large-file integration", () => {
  it("sets the generated redraw budget to six seconds", async () => {
    expect((await probeVim(0)).redrawtime).toBe(6000);
  });

  it.each([
    ["just below 8 MiB", 8388607],
    ["exactly 8 MiB", 8388608],
  ])("retains actual JSON highlighting %s", async (_name, size) => {
    const state = await probeVim(size);
    expect(state.syntax).toBe("json");
    expect(state.highlighted).toBe(1);
    expect(state.filetype).toBe("json");
  });

  it("disables actual highlighting one byte above 8 MiB", async () => {
    const state = await probeVim(8388609);
    expect(state.syntax).toBe("OFF");
    expect(state.highlighted).toBe(0);
    expect(state.filetype).toBe("json");
  });

  it.each([
    ["empty", 0],
    ["nonexistent", null],
  ])("keeps %s files on the normal syntax path", async (_name, size) => {
    const state = await probeVim(size);
    expect(state.syntax).toBe("json");
  });

  it("keeps the large-buffer policy local when opening a smaller buffer and switching back", async () => {
    const state = await probeVim(8388609, [
      "let g:observations.large = [&l:syntax, synID(1, 3, 1)]",
      "execute 'edit ' . fnameescape(expand('%:p:h') . '/small.json')",
      "let g:observations.small = [&l:syntax, synID(1, 3, 1) != 0]",
      "buffer #",
    ]);
    expect(state.observations.large).toEqual(["OFF", 0]);
    expect(state.observations.small).toEqual(["json", 1]);
    expect(state.syntax).toBe("OFF");
    expect(state.highlighted).toBe(0);
  });

  it("generates identical configuration on consecutive runs", async () => {
    await runScript("software/scripts/vim-config.js");
    const first = fileSystem[`${HOME}/.vimrc`];
    await runScript("software/scripts/vim-config.js");
    expect(fileSystem[`${HOME}/.vimrc`]).toBe(first);
  });
});
