/** Bash integration: both SteamOS delegations explicitly bypass selector confirmation. */
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Actual delegation blocks; exclude unrelated system provisioning. */
const setupSource = fs.readFileSync("software/scripts/steamos/setup.bash", "utf8");
/** Decky installer function and explicit invocation for isolated execution. */
const deckySource =
  setupSource.split("# --- Decky Loader + plugins + CSS Loader themes ---")[1].split("# --- Steam shortcuts ---")[0] +
  "\n_bootstrap_decky_loader_plugins_themes\n";
/** Editor/browser installer block, including its original temporary-folder cleanup. */
const editorSource = setupSource
  .split("# --- Browser Extensions + tmux/vim (via the synle/bashrc installer) ---")[1]
  .split("\nif type -P paru")[0];
/** Test-owned temporary roots, removed even after assertion failure. */
const folders = [];

afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("SteamOS unattended installer delegation (Bash subprocess)", () => {
  it.each([
    ["Decky", deckySource, "--files=software/scripts/decky-and-css-loader.standalone.js"],
    ["editors and browser extensions", editorSource, "--files=url-porter,skippy-ff,tmux,vim-config,vim-jetpack"],
  ])("passes --skip-prompt to %s on two consecutive runs", (_name, source, selector) => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-selector-prompt-"));
    folders.push(folder);
    const installer = path.join(folder, "installer.bash");
    const log = path.join(folder, "arguments.log");
    fs.writeFileSync(installer, '#!/bin/bash\nprintf "%s\\n" "$@" >> "$CALL_LOG"\n');
    const result = spawnSync(
      "/bin/bash",
      [
        "-c",
        `
# Replace only the download boundary; execute actual setup commands and installer transport.
function curl() {
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "-o" ]; then
      cp "$FIXTURE_INSTALLER" "$2"
      return $?
    fi
    shift
  done
  return 1
}
${source}
${source}
`,
      ],
      {
        cwd: folder,
        encoding: "utf8",
        timeout: 10000,
        env: { ...process.env, BASH_ENV: "", TMPDIR: folder, FIXTURE_INSTALLER: installer, CALL_LOG: log },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(log, "utf8").trim().split("\n")).toEqual(["--skip-prompt", selector, "--skip-prompt", selector]);
    expect(fs.readdirSync(folder).sort()).toEqual(["arguments.log", "installer.bash"]);
  });
});
