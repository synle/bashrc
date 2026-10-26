/** Opt-in native integration: full generated vimrc with real, already-installed Jetpack/Signify/Lightline plugins. */
import { beforeAll, beforeEach, describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileSystem, getIndexConstant, getIndexFunction, loadScriptHelpers, runScript, setSandboxGlobal } from "./setup.js";

/** Existing native runtime root; absent means an explicit optional integration skip, never a mocked plugin. */
const pluginRoot = process.env.BASHRC_VIM_PLUGIN_ROOT;
/** Sandbox deployment identity; generated configuration and colors are copied into a temporary native runtime. */
const home = getIndexConstant("BASE_HOMEDIR_LINUX");
/** Accepted native observations; every recorded group is rechecked before accepting a settings fingerprint. */
const nativeEvidence = getIndexFunction("parseJsonWithComments")(fs.readFileSync("theme/native-consumption.jsonc", "utf8")).vim;

beforeAll(() => loadScriptHelpers("software/scripts/vim-config.js"));
beforeEach(() => {
  setSandboxGlobal("is_gui", true);
  setSandboxGlobal("is_os_windows", false);
  setSandboxGlobal("IS_CI", false);
  setSandboxGlobal("getRuntimeOption", () => false);
  fileSystem["software/scripts/vim-config-settings.vim"] = fs.readFileSync("software/scripts/vim-config-settings.vim", "utf8");
});

/**
 * Run the full generated vimrc with installed plugins and observe every accepted highlight group after startup and appearance switches.
 * @param {string} appearance - Initial appearance; switches twice after native Signify setup.
 * @returns {Promise<object>} Native plugin-load flags and per-appearance highlight observations.
 * @throws {Error} For missing plugins, failed setup, timeout, or nonzero Vim exit; owned temporary files are removed after the test.
 */
async function probe(appearance) {
  // Reject an incomplete plugin root before the generated first-run bootstrap could download anything.
  const required = [
    "vim-jetpack",
    "vim-signify",
    "lightline.vim",
    "lightline-bufferline",
    "ayu-vim",
    "vim-javascript",
    "vim-jsx-pretty",
    "vim-jsx-typescript",
    "typescript-vim",
    "vim-styled-components",
    "vim-graphql",
    "css.vim",
    "scss-syntax.vim",
    "fzf",
    "fzf.vim",
    "vim-visual-multi",
  ];
  if (path.basename(pluginRoot) !== ".vim") throw new Error("BASHRC_VIM_PLUGIN_ROOT must be a native .vim folder");
  const installed = JSON.parse(fs.readFileSync(path.join(pluginRoot, "pack/jetpack/opt/available_packages.json"), "utf8"));
  for (const name of required) {
    if (!Object.hasOwn(installed, name) || !fs.existsSync(path.join(pluginRoot, "pack/jetpack/opt", name))) {
      throw new Error(`Missing installed Vim plugin: ${name}`);
    }
  }
  await runScript("software/scripts/vim-config.js");
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "vim native plugins "));
  onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.mkdirSync(path.join(folder, ".vim/colors"), { recursive: true });
  fs.writeFileSync(path.join(folder, ".vimrc"), fileSystem[`${home}/.vimrc`]);
  fs.writeFileSync(path.join(folder, ".vim/colors/sy-dark.vim"), fileSystem[`${home}/.vim/colors/sy-dark.vim`]);
  fs.writeFileSync(path.join(folder, ".vim/colors/sy-light.vim"), fileSystem[`${home}/.vim/colors/sy-light.vim`]);
  const output = path.join(folder, "result.json");
  const script = path.join(folder, "probe.vim");
  fs.writeFileSync(
    script,
    [
      "set nomore",
      "function! NativePluginProbe(timer) abort",
      "try",
      // Initialize the real plugin's links as opening a VCS buffer does, then exercise actual ColorScheme handlers.
      "call sy#highlight#setup()",
      "let result = {'signify': get(g:, 'loaded_signify', 0), 'lightline': exists('*lightline#init'), 'states': []}",
      `for appearance in ${JSON.stringify([appearance, appearance === "dark" ? "light" : "dark", appearance])}`,
      "execute 'set background=' . appearance",
      "call SyLightlineSetModeColors()",
      "call lightline#highlight('normal')",
      "let groups = {}",
      `for name in ${JSON.stringify([...Object.keys(nativeEvidence.appearances[0].groups), "SignifyLineAdd"])}`,
      "let id = synIDtrans(hlID(name))",
      "let groups[name] = {'target': synIDattr(id, 'name'), 'foreground': synIDattr(id, 'fg', 'gui'), 'background': synIDattr(id, 'bg', 'gui')}",
      "endfor",
      "call add(result.states, {'scheme': g:colors_name, 'lightline': g:lightline.colorscheme, 'groups': groups})",
      "endfor",
      `call writefile([json_encode(result)], ${JSON.stringify(output)})`,
      "qall!",
      "catch",
      `call writefile([json_encode({'error': v:exception, 'throwpoint': v:throwpoint})], ${JSON.stringify(output)})`,
      "cquit 1",
      "endtry",
      "endfunction",
      "autocmd VimEnter * call timer_start(0, function('NativePluginProbe'))",
    ].join("\n"),
  );
  const status = await new Promise((resolve, reject) => {
    const child = spawn(
      "vim",
      [
        "-N",
        "--cmd",
        `let &packpath = ${JSON.stringify(pluginRoot)} . ',' . &packpath`,
        "--cmd",
        `let &runtimepath = ${JSON.stringify(path.join(folder, ".vim"))} . ',' . &runtimepath`,
        "--cmd",
        `set background=${appearance}`,
        "-u",
        path.join(folder, ".vimrc"),
        "-i",
        "NONE",
        "-n",
        "--not-a-term",
        "-S",
        script,
      ],
      {
        // Jetpack defaults its package database from HOME, not packpath. Keep its prevalidated native home.
        env: { ...process.env, HOME: path.dirname(pluginRoot) },
        stdio: ["pipe", "ignore", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Native Vim plugin probe timed out"));
    }, 5000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
  expect(status.code, status.stderr).toBe(0);
  return JSON.parse(fs.readFileSync(output, "utf8"));
}

describe.skipIf(!pluginRoot)("native installed Vim plugin integration", () => {
  it.each([
    ["dark", ["sy-dark", "sy-light", "sy-dark"]],
    ["light", ["sy-light", "sy-dark", "sy-light"]],
  ])("preserves Signify links and Lightline colors after switching from %s", async (appearance, expectedSchemes) => {
    const result = await probe(appearance);
    expect(result.signify).toBe(1);
    expect(result.lightline).toBe(1);
    expect(result.states.map((state) => state.scheme)).toEqual(expectedSchemes);
    const statusColors = {
      "sy-dark": { foreground: "#0a0a0a", background: "#76a762" },
      "sy-light": { foreground: "#f8f8f8", background: "#004a15" },
    };
    for (const state of result.states) {
      /** Accepted groups for the native colorscheme observed in this state. */
      const recorded = nativeEvidence.appearances.find((entry) => entry.scheme === state.scheme);
      expect(state.groups).toMatchObject(recorded.groups);
      expect(state.lightline).toBe("sy");
      expect(state.groups.SignifySignAdd.target).toBe("DiffAdd");
      expect(state.groups.SignifySignChange.target).toBe("DiffChange");
      expect(state.groups.SignifySignDelete.target).toBe("DiffDelete");
      expect(state.groups.SignifyLineAdd.target).toBe("DiffAdd");
      expect(state.groups.LightlineLeft_normal_0).toMatchObject(statusColors[state.scheme]);
    }
  });
});
