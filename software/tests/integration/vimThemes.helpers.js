/** Native Vim theme probes with owned temporary files and an input pipe kept open until Vim exits. */
import { afterAll, expect, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { getIndexFunction } from "../setup.js";

/** Native configuration source, loaded without the network-enabled plugin bootstrap. */
const settingsPath = path.resolve("software/scripts/vim-config-settings.vim");
/** Owned capability-probe folder; native Windows Vim cannot write to /dev/stdout. */
const capabilityFolder = fs.mkdtempSync(path.join(os.tmpdir(), "vim capability "));
/** Runtime plugin path returned by the installed Vim binary. */
const capabilityOutput = path.join(capabilityFolder, "color-response.txt");
afterAll(() => fs.rmSync(capabilityFolder, { recursive: true, force: true }));

/** Native capability result; missing Vim or a broken probe must fail rather than silently skip integration checks. */
const capabilityProbe = spawnSync(
  "vim",
  [
    "-Nu",
    "NONE",
    "-i",
    "NONE",
    "-n",
    "-es",
    "-c",
    `call writefile([globpath(&runtimepath, 'plugin/colorresp.vim')], ${JSON.stringify(capabilityOutput)})`,
    "-c",
    "qall!",
  ],
  { encoding: "utf-8", timeout: 5000 },
);
expect(capabilityProbe.error, capabilityProbe.stderr).toBeUndefined();
expect(capabilityProbe.status, capabilityProbe.stderr).toBe(0);

/** Whether this native Vim ships the OSC handler; older builds skip only those protocol integration cases. */
export const hasColorResponsePlugin = fs.readFileSync(capabilityOutput, "utf-8").trim() !== "";

/**
 * Loads generated themes in isolated Vim and observes native highlights, navigation, and terminal output.
 * @param {string} selection - Generated theme-selection Vimscript.
 * @param {string} appearance - Initial native background setting.
 * @param {string[]} commands - Startup-timer commands; may return early and call RecordThemeProbe from a later native event.
 * @param {object} extraSchemes - Owned fixture colorschemes, not third-party API mocks.
 * @returns {Promise<object>} Native observations and output; timeout, Vim errors, and nonzero exits fail explicitly.
 */
export async function probeTheme(selection, appearance, commands = [], extraSchemes = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "vim theme's "));
  onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
  const colorsFolder = path.join(folder, "colors");
  const output = path.join(folder, "result.json");
  const script = path.join(folder, "probe.vim");
  fs.mkdirSync(colorsFolder);
  fs.writeFileSync(path.join(colorsFolder, "sy-dark.vim"), await getIndexFunction("_buildVimTheme")("dark"));
  fs.writeFileSync(path.join(colorsFolder, "sy-light.vim"), await getIndexFunction("_buildVimTheme")("light"));
  for (const [name, content] of Object.entries(extraSchemes)) fs.writeFileSync(path.join(colorsFolder, `${name}.vim`), content);
  fs.writeFileSync(
    script,
    [
      "set nomore",
      `let &runtimepath = ${JSON.stringify(folder)} . ',' . &runtimepath`,
      `set background=${appearance}`,
      `execute 'source ' . fnameescape(${JSON.stringify(settingsPath)})`,
      selection,
      '" Persist the native state and exit; no arguments or return value.',
      "function! RecordThemeProbe() abort",
      "let result = {'scheme': g:colors_name, 'background': &background, 'ayu': get(g:, 'ayucolor', ''), 'foreground': synIDattr(synIDtrans(hlID('Normal')), 'fg', 'gui'), 'tag': synIDattr(synIDtrans(hlID('tsxTagName')), 'fg', 'gui'), 'mode': get(get(g:, 'sy_lightline_palette', {}), 'insert', {}), 'line': line('.'), 'text': getline(1)}",
      `call writefile([json_encode(result)], ${JSON.stringify(output)})`,
      "qall!",
      "endfunction",
      '" Run commands after startup; timer is unused, errors are persisted before failing the process.',
      "function! RunThemeProbe(timer) abort",
      "try",
      ...commands,
      "call RecordThemeProbe()",
      "catch",
      `call writefile([json_encode({'error': v:exception, 'throwpoint': v:throwpoint})], ${JSON.stringify(output)})`,
      "cquit 1",
      "endtry",
      "endfunction",
      // OptionSet is suppressed during startup, including VimEnter; dispatch from the main loop instead.
      "autocmd VimEnter * call timer_start(0, function('RunThemeProbe'))",
    ].join("\n"),
  );
  const result = await new Promise((resolve, reject) => {
    const child = spawn("vim", ["-N", "-u", "NONE", "-i", "NONE", "-n", "--not-a-term", "-S", script], {
      env: { ...process.env, HOME: folder },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf-8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf-8").on("data", (chunk) => {
      stderr += chunk;
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 5000);
    onTestFinished(() => {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (status) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error(`Native Vim theme probe timed out: ${stderr}`));
      else resolve({ status, stdout, stderr });
    });
  });
  const observations = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, "utf-8")) : null;
  expect(result.status, JSON.stringify(observations) + result.stderr).toBe(0);
  expect(observations, "Native Vim exited without recording observations").not.toBeNull();
  return { ...observations, terminalOutput: result.stdout };
}
