/** Verifies global reset commands through real Bash execution with isolated homes. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/** Reset partial loaded without installer side effects. */
const PARTIAL = path.resolve("software/scripts/advanced/llm/_common/llm-reset.profile.bash");
/** Independent client expectations for configuration and instruction files. */
const CLIENTS = [
  { cli: "claude", json: [".claude/settings.json", ".claude/keybindings.json"], markdown: [".claude/CLAUDE.md"] },
  { cli: "copilot", json: [".copilot/settings.json", ".copilot/mcp-config.json"], markdown: [".copilot/copilot-instructions.md"] },
  { cli: "gemini", json: [".gemini/settings.json", ".gemini/keybindings.json"], markdown: [".gemini/GEMINI.md"] },
  {
    cli: "opencode",
    json: [".config/opencode/opencode.json", ".config/opencode/opencode.jsonc", ".config/opencode/tui.json"],
    markdown: [".config/opencode/AGENTS.md"],
  },
  {
    cli: "pi",
    json: [".pi/agent/settings.json", ".pi/agent/keybindings.json", ".pi/agent/models.json", ".pi/agent/mcp.json"],
    markdown: [".pi/agent/AGENTS.md", ".pi/agent/APPEND_SYSTEM.md"],
  },
];
/** Per-test isolated home. */
let home;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "llm-reset-"));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

/** Writes one isolated file fixture; returns its path. */
function fixture(relative, content) {
  const file = path.join(home, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

/** Runs a public reset command with controlled confirmation; returns exit status and output. */
function reset(cli, args = [], approved = true) {
  return spawnSync(
    "/bin/bash",
    [
      "-c",
      `
    function is_help_arg() { [ "\$1" = --help ]; }
    function prompt_yes_no() { return ${approved ? 0 : 1}; }
    _SY_SUPPORTED_LLMS=(claude copilot gemini opencode pi)
    . "$RESET_PARTIAL"
    "${cli}_clear_and_reset_all_settings" "$@"
  `,
      "reset",
      ...args,
    ],
    {
      env: {
        ...process.env,
        HOME: home,
        RESET_PARTIAL: PARTIAL,
        PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
        BASH_ENV: "",
      },
      encoding: "utf8",
      timeout: 10000,
    },
  );
}

describe.each(CLIENTS)("$cli global reset", ({ cli, json, markdown }) => {
  it("empties configuration and instructions, retains backups, and preserves unrelated files", () => {
    for (const relative of json) fixture(relative, '{"custom":true}');
    for (const relative of markdown) fixture(relative, "custom instructions");
    const credentials = fixture(
      ".claude.json",
      '{"oauthAccount":{"fake":"test-only"},"mcpServers":{"captain":{"command":"captain"}},"projects":{"kept":true}}',
    );
    const untouched = fixture("private/auth.json", '{"fake":"test-only"}');
    const session = fixture("private/session.md", "session preserved");
    const result = reset(cli);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Reset: ");
    for (const relative of json) {
      const file = path.join(home, relative);
      expect(fs.readFileSync(file, "utf8")).toBe("{}\n");
      const backup = fs.readdirSync(path.dirname(file)).find((name) => name.startsWith(path.basename(file) + ".reset-backup-"));
      expect(fs.readFileSync(path.join(path.dirname(file), backup), "utf8")).toBe('{"custom":true}');
    }
    for (const relative of markdown) expect(fs.readFileSync(path.join(home, relative), "utf8")).toBe("");
    expect(JSON.parse(fs.readFileSync(credentials, "utf8"))).toEqual({
      oauthAccount: { fake: "test-only" },
      mcpServers: cli === "claude" ? {} : { captain: { command: "captain" } },
      projects: { kept: true },
    });
    expect(fs.readFileSync(untouched, "utf8")).toBe('{"fake":"test-only"}');
    expect(fs.readFileSync(session, "utf8")).toBe("session preserved");
    const second = reset(cli);
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain("Reset: ");
  });

  it("shows help without writes or confirmation", () => {
    const result = reset(cli, ["--help"], false);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`${cli}_clear_and_reset_all_settings: empty global configuration and instructions`);
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it("cancels without writes", () => {
    const result = reset(cli, [], false);
    expect(result.status).toBe(1);
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it("creates valid empty config and instruction files for a fresh home", () => {
    const result = reset(cli);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Reset: ");
    for (const relative of json) expect(JSON.parse(fs.readFileSync(path.join(home, relative), "utf8"))).toEqual({});
    for (const relative of markdown) expect(fs.readFileSync(path.join(home, relative), "utf8")).toBe("");
    expect(fs.existsSync(path.join(home, ".claude.json"))).toBe(false);
  });
});

describe("reset boundaries", () => {
  it("rejects malformed Claude state before resetting any file", () => {
    const config = fixture(".claude/settings.json", '{"keep":true}');
    fixture(".claude.json", "not json");
    const result = reset("claude");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Reset failed:");
    expect(result.stderr).not.toContain("not json");
    expect(fs.readFileSync(config, "utf8")).toBe('{"keep":true}');
    expect(fs.readdirSync(path.join(home, ".claude"))).toEqual(["settings.json"]);
  });

  it("rejects symlink targets without changing their contents", () => {
    const shared = fixture("shared.md", "shared instructions");
    fixture(".pi/agent/settings.json", '{"keep":true}');
    fs.symlinkSync(shared, path.join(home, ".pi/agent/AGENTS.md"));
    const result = reset("pi");
    expect(result.status).toBe(1);
    expect(fs.readFileSync(shared, "utf8")).toBe("shared instructions");
    expect(fs.readFileSync(path.join(home, ".pi/agent/settings.json"), "utf8")).toBe('{"keep":true}');
  });

  it("rejects unexpected arguments without writes", () => {
    const result = reset("pi", ["--unknown"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unexpected reset arguments");
    expect(fs.readdirSync(home)).toEqual([]);
  });
});
